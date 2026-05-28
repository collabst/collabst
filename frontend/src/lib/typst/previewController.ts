// Drives the Typst compile pipeline: owns the engine, VFS mirror, main file,
// and converts engine byte-offset diagnostics into line/character form.
// Rendering lives in <TypstCanvas>, which subscribes to the same Core directly.
import type { Core, Diagnostic as EngineDiagnostic } from '@mudomi/onykia-engine'
import type { Asset, Diagnostic, FileWithContent as ProjectFile } from '$lib/types'
import { getTypstEngine, restartTypstEngine } from './engine'
import { createTypstMirror, isMirrorTrackedText, mimeFor, type MirrorFile } from './mirror'
import { getCachedAsset, cacheAsset } from '$lib/utils/assetCache'
import { assetsApi } from '$lib/services/api'

function normalizePath(p: string): string {
  return p.startsWith('/') ? p : `/${p}`
}

// Convert a byte offset within `text` to a 0-based {line, character}.
function offsetToLineChar(text: string, offset: number): { line: number; character: number } {
  const clamped = Math.max(0, Math.min(offset, text.length))
  let line = 0
  let lastNl = -1
  for (let i = 0; i < clamped; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) {
      line++
      lastNl = i
    }
  }
  return { line, character: clamped - lastNl - 1 }
}

// PDF/HTML take no params; SVG/PNG are per-page (0-based)
export type ExportRequest =
  | { format: 'pdf' }
  | { format: 'html' }
  | { format: 'svg'; index: number }
  | { format: 'png'; index: number; ppi?: number }

export interface PreviewController {
  readonly core: Core | null
  ready(): Promise<Core>
  sync(files: ProjectFile[], assets: Asset[], mainFilePath: string): Promise<void>
  setActiveEditorFile(path: string | null): void
  exportDocument(opts: ExportRequest): Promise<{ data: Uint8Array; mime: string }>
  destroy(): void
}

export interface PreviewControllerOptions {
  projectId: string
  onDiagnostics?: (diagnostics: Diagnostic[]) => void
}

export function createPreviewController(opts: PreviewControllerOptions): PreviewController {
  let core: Core | null = null
  let mirror: ReturnType<typeof createTypstMirror> | null = null
  let offDiagnostics: (() => void) | undefined
  let destroyed = false

  let currentMainPath: string | null = null
  let lastTarget: 'svg' | null = null
  // Per-path source text, retained so engine byte offsets can be mapped back.
  let textByPath: Record<string, string> = {}

  // Coalesce rapid sync() calls (typing) into one engine pass.
  let pending: { files: ProjectFile[]; assets: Asset[]; mainFilePath: string } | null = null
  let syncTimer: ReturnType<typeof setTimeout> | undefined
  let running = false

  function mapDiagnostics(engineDiags: EngineDiagnostic[]): Diagnostic[] {
    return engineDiags.map((d) => {
      const path = d.path ? normalizePath(d.path) : undefined
      const text = path ? textByPath[path] : undefined
      let range: Diagnostic['range']
      if (d.range && text !== undefined) {
        range = {
          start: offsetToLineChar(text, d.range.start),
          end: offsetToLineChar(text, d.range.end)
        }
      }
      return {
        severity: d.severity,
        message: d.message,
        range,
        path: d.path,
        package: d.package
      }
    })
  }

  async function ensureCore(): Promise<Core> {
    if (core) return core
    core = await getTypstEngine()
    mirror = createTypstMirror(core, {
      // WASM trap leaves the worker unusable; rebuild and re-push next sync.
      onFatalError: async (err) => {
        core = await restartTypstEngine(err)
        mirror = createTypstMirror(core)
        currentMainPath = null
        lastTarget = null
        wireDiagnostics()
      }
    })
    wireDiagnostics()
    return core
  }

  function wireDiagnostics() {
    offDiagnostics?.()
    if (!core || !opts.onDiagnostics) return
    offDiagnostics = core.onDiagnostics(({ diagnostics }) => {
      opts.onDiagnostics?.(mapDiagnostics(diagnostics))
    })
  }

  async function loadAssetBytes(asset: Asset): Promise<Uint8Array | null> {
    try {
      const cached = await getCachedAsset(opts.projectId, asset.id, asset.storage_path)
      if (cached) return new Uint8Array(cached.blob)
      const { url } = await assetsApi.getUrl(opts.projectId, asset.id)
      const res = await fetch(url)
      const buf = await res.arrayBuffer()
      cacheAsset(opts.projectId, asset.id, asset.storage_path, asset.mime_type, buf).catch((e) =>
        console.warn('[preview] asset cache write failed', e)
      )
      return new Uint8Array(buf)
    } catch (e) {
      console.error('[preview] failed to load asset', asset.path, e)
      return null
    }
  }

  async function runSync(): Promise<void> {
    if (!pending) return
    // Snapshot but leave pending in place: if we throw, the queued work
    // isn't lost. We clear it only when this snapshot is still the active
    // request at commit time; a newer sync() will have replaced it and the
    // drain loop will pick that up next.
    const snapshot = pending
    const { files, assets, mainFilePath } = snapshot

    const engine = await ensureCore()
    if (destroyed || !mirror) return

    const mirrorFiles: Record<string, MirrorFile> = {}
    const nextText: Record<string, string> = {}

    for (const file of files) {
      if (file.is_folder) continue
      const path = normalizePath(file.path)
      const mime = mimeFor(path)
      if (isMirrorTrackedText(path) || mime.startsWith('text/')) {
        mirrorFiles[path] = { data: file.content, mime, fingerprint: file.content }
        nextText[path] = file.content
      }
    }

    for (const asset of assets) {
      const path = normalizePath(asset.path)
      const bytes = await loadAssetBytes(asset)
      if (destroyed) return
      if (!bytes) continue
      mirrorFiles[path] = {
        data: bytes,
        mime: asset.mime_type || mimeFor(path),
        fingerprint: `asset:${asset.storage_path}`
      }
    }

    // Commit text and mirror together so diagnostic offset mapping reflects
    // whatever the engine just saw.
    textByPath = nextText
    await mirror.reconcile(mirrorFiles)
    if (destroyed) return

    if (lastTarget !== 'svg') {
      // The canvas rasterises via core.render, but the engine needs a target.
      lastTarget = 'svg'
      await engine.setTarget('svg')
    }
    const mainPath = normalizePath(mainFilePath)
    if (currentMainPath !== mainPath) {
      currentMainPath = mainPath
      await engine.setMain(mainPath)
    }
    // Content changes re-layout via the mirror or forwardEdits and fire onPages.

    if (pending === snapshot) pending = null
  }

  async function drainSyncQueue() {
    if (running) return
    running = true
    try {
      while (pending) {
        // eslint-disable-next-line no-await-in-loop
        await runSync()
      }
    } catch (e) {
      console.error('[preview] sync failed', e)
    } finally {
      running = false
    }
  }

  return {
    get core() {
      return core
    },
    ready() {
      return ensureCore()
    },
    async sync(files, assets, mainFilePath) {
      pending = { files, assets, mainFilePath }
      clearTimeout(syncTimer)
      await new Promise<void>((resolve) => {
        syncTimer = setTimeout(resolve, 30)
      })
      await drainSyncQueue()
    },
    setActiveEditorFile(path) {
      mirror?.setActive(path ? normalizePath(path) : null)
    },
    async exportDocument(opts) {
      const engine = await ensureCore()
      const result = await engine.export(opts)
      return { data: result.data, mime: result.mime }
    },
    destroy() {
      // Core is a shared singleton; just detach our subscriptions.
      destroyed = true
      clearTimeout(syncTimer)
      offDiagnostics?.()
    }
  }
}

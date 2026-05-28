// Mirrors project files + assets into the engine VFS. The active editor file
// is owned by CodeMirror's forwardEdits; reconcile tracks its fingerprint but
// skips the actual push so the two don't fight.
import type { Core } from '@mudomi/onykia-engine'
import { isTypstFatalError } from './engine'

const TYPST_MIME = 'text/x-typst'
const TEXT_DEFAULT_MIME = 'text/plain'
const BINARY_DEFAULT_MIME = 'application/octet-stream'

const TEXT_MIME_BY_EXT: Record<string, string> = {
  '.typ': TYPST_MIME,
  '.typst': TYPST_MIME,
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
  '.toml': 'application/toml',
  '.xml': 'application/xml',
  '.bib': 'application/x-bibtex',
  '.txt': 'text/plain',
  '.md': 'text/markdown'
}

const BINARY_MIME_BY_EXT: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf'
}

export function mimeFor(path: string): string {
  const dot = path.lastIndexOf('.')
  if (dot < 0) return TEXT_DEFAULT_MIME
  const ext = path.slice(dot).toLowerCase()
  return TEXT_MIME_BY_EXT[ext] ?? BINARY_MIME_BY_EXT[ext] ?? BINARY_DEFAULT_MIME
}

export function isMirrorTrackedText(path: string): boolean {
  const dot = path.lastIndexOf('.')
  if (dot < 0) return false
  return path.slice(dot).toLowerCase() in TEXT_MIME_BY_EXT
}

export interface MirrorFile {
  data: string | Uint8Array
  mime: string
  // Change key used to skip no-op pushes.
  fingerprint: string
}

export interface TypstMirror {
  // Replace the engine VFS with exactly these files (keyed by absolute path).
  reconcile(files: Record<string, MirrorFile>): Promise<void>
  // Path the mirror should leave alone (the active editor file).
  setActive(path: string | null): void
}

export function createTypstMirror(
  core: Core,
  opts?: { onFatalError?: (error: unknown) => void }
): TypstMirror {
  const known = new Map<string, string>()
  let active: string | null = null
  const onFatalError = opts?.onFatalError

  function notifyFatal(error: unknown) {
    if (isTypstFatalError(error)) onFatalError?.(error)
  }

  async function push(path: string, file: MirrorFile) {
    try {
      await core.create(path, file.mime, file.data)
    } catch (e) {
      console.warn('[typst-mirror] create failed for', path, e)
      notifyFatal(e)
    }
  }

  async function drop(path: string) {
    try {
      await core.delete(path)
    } catch (e) {
      console.warn('[typst-mirror] delete failed for', path, e)
      notifyFatal(e)
    }
  }

  return {
    async reconcile(files) {
      for (const [path, file] of Object.entries(files)) {
        if (known.get(path) === file.fingerprint) continue
        known.set(path, file.fingerprint)
        if (path === active) continue
        await push(path, file)
      }
      const stale: string[] = []
      for (const path of known.keys()) {
        if (!(path in files)) stale.push(path)
      }
      for (const path of stale) {
        known.delete(path)
        if (path === active) continue
        await drop(path)
      }
    },
    setActive(path) {
      active = path
    }
  }
}

// Lazy singleton onykia Typst engine, shared by preview panes and the editor.
import { Core, createWasmFactory } from '@mudomi/onykia-engine'

const LOG = '[typst]'

const PACKAGE_BASE = 'https://packages.typst.org'
const PACKAGE_INDEX_URL = `${PACKAGE_BASE}/preview/index.json`

let corePromise: Promise<Core> | null = null

function errorText(err: unknown): string {
  if (err instanceof Error) return `${err.message}\n${err.stack ?? ''}`
  return String(err ?? '')
}

// Heuristic for WASM traps/panics that require a fresh engine.
export function isTypstFatalError(err: unknown): boolean {
  const text = errorText(err).toLowerCase()
  const isTrap =
    text.includes('runtimeerror: unreachable') ||
    text.includes('error: unreachable') ||
    text.includes('panicked at') ||
    text.includes('option::unwrap')
  if (!isTrap) return false
  return text.includes('onykia') || text.includes('typst') || text.includes('worker')
}

export function isTypstPath(path: string): boolean {
  const lower = path.toLowerCase()
  return lower.endsWith('.typ') || lower.endsWith('.typst')
}

async function buildCore(): Promise<Core> {
  if (typeof window !== 'undefined' && !window.crossOriginIsolated) {
    throw new Error(
      'Page is not cross-origin isolated. The Typst engine needs ' +
        'Cross-Origin-Opener-Policy: same-origin and ' +
        'Cross-Origin-Embedder-Policy on every response.'
    )
  }

  console.info(`${LOG} booting engine…`)

  const packageIndexPromise = fetch(PACKAGE_INDEX_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`index fetch failed (${res.status})`)
      return res.arrayBuffer().then((buf) => new Uint8Array(buf))
    })
    .catch((e) => {
      console.warn(`${LOG} package index fetch failed - @preview imports may not resolve`, e)
      return null
    })

  const core = new Core({
    // Runtime tree is mirrored to /onykia/ by vite-plugin-static-copy because
    // the wasm-bindgen snippets graph relies on relative siblings.
    wasm: createWasmFactory({
      wasmUrl: '/onykia/onykia_engine.wasm',
      workerUrl: '/onykia/onykia_worker.js'
    }),
    package: async (namespace, name, version) => {
      const url = `${PACKAGE_BASE}/${namespace}/${name}-${version}.tar.gz`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`package fetch failed: ${url}`)
      return new Uint8Array(await res.arrayBuffer())
    }
  })

  core.onStatus(({ status, message }) => {
    if (status === 'error' && message) console.warn(`${LOG} engine status error:`, message)
  })

  const packageBytes = await packageIndexPromise
  await core.setRemotePackages(packageBytes ?? new TextEncoder().encode('[]'), [])
  if (packageBytes) console.info(`${LOG} package index loaded`)

  console.info(`${LOG} engine ready`)
  return core
}

export function getTypstEngine(): Promise<Core> {
  if (!corePromise) {
    corePromise = buildCore().catch((e) => {
      // Drop the rejected promise so a later call can retry.
      corePromise = null
      console.error(`${LOG} engine boot failed`, e)
      throw e
    })
  }
  return corePromise
}

// Tear down the current engine and force a fresh boot on next request.
export async function restartTypstEngine(reason?: unknown): Promise<Core> {
  const previous = corePromise
  corePromise = null
  if (previous) {
    try {
      ;(await previous).destroy()
    } catch (e) {
      console.warn(`${LOG} destroy before restart failed`, e)
    }
  }
  if (reason !== undefined) console.warn(`${LOG} restarting engine after fatal error`, reason)
  return getTypstEngine()
}

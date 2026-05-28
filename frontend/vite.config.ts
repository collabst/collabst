import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// Cross-origin isolation headers required by onykia-engine.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless'
}

function coiHeaders() {
  const apply = (server: { middlewares: { use: (fn: (req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => void) => void } }) => {
    server.middlewares.use((_req, res, next) => {
      for (const [k, v] of Object.entries(crossOriginIsolation)) res.setHeader(k, v)
      next()
    })
  }
  return {
    name: 'collabst-coi-headers',
    configureServer: apply,
    configurePreviewServer: apply
  }
}

export default defineConfig({
  plugins: [
    sveltekit(),
    wasm(),
    topLevelAwait(),
    coiHeaders(),
    // static copy for wasm binarry
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@mudomi/onykia-engine/dist/wasm/**/*',
          dest: 'onykia',
          rename: { stripBase: 5 }
        }
      ]
    })
  ],
  worker: { format: 'es' },
  build: { target: 'esnext' },
  optimizeDeps: {
    exclude: ['@lucide/svelte', '@mudomi/onykia-engine', '@mudomi/onykia-codemirror']
  },
  server: {
    headers: crossOriginIsolation,
    watch: {
      usePolling: true,
      interval: 100
    },
    allowedHosts: [getAllowedHost()]
  },
  preview: {
    headers: crossOriginIsolation
  }
})

function getAllowedHost() {
  const url = process.env.VITE_WEB_URL
  if (!url) return 'localhost'
  try {
    return new URL(url).hostname
  } catch {
    return url // fallback if not a full URL
  }
}

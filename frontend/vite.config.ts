import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  plugins: [sveltekit(), wasm(), topLevelAwait()],
  optimizeDeps: {
    exclude: ['@lucide/svelte']
  },
  server: {
    watch: {
      usePolling: true,
      interval: 100
    },
      allowedHosts: [getAllowedHost()]
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

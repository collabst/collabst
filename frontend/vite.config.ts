import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit()],
  optimizeDeps: {
    exclude: ['@lucide/svelte']
  },
  server: {
    watch: {
      usePolling: true,
      interval: 100
    }
  }
})

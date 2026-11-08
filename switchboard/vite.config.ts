import { resolve } from 'node:path'
import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'

// The admin dashboard (admin-ui/) builds to admin-ui/dist, which the Worker serves as static assets. Two pages:
// index.html is the Switchboard (admin.amittal.dev), dash.html is Chaotic Tails' console (dash.chaotictails.com).
// In dev, /api goes to `wrangler dev` on :8787 (set ADMIN_HOST=localhost in .dev.vars).
export default defineConfig({
  root: 'admin-ui',
  plugins: [preact()],
  build: {
    outDir: 'dist', emptyOutDir: true, target: 'es2022', assetsInlineLimit: 0,
    rollupOptions: { input: { main: resolve(import.meta.dirname, 'admin-ui/index.html'), dash: resolve(import.meta.dirname, 'admin-ui/dash.html') } },
  },
  server: { port: 5178, strictPort: true, proxy: { '/api': 'http://localhost:8787' } },
})

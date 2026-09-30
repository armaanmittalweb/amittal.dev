import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'

// The admin dashboard (admin-ui/) builds to admin-ui/dist, which the Worker serves as static assets.
// In dev, /api goes to `wrangler dev` on :8787 (set ADMIN_HOST=localhost in .dev.vars).
export default defineConfig({
  root: 'admin-ui',
  plugins: [preact()],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022', assetsInlineLimit: 0 },
  server: { port: 5178, strictPort: true, proxy: { '/api': 'http://localhost:8787' } },
})

// Builds chroniq-core: core/index.ts and what it uses of src/lib as one ES module, its three
// libraries left as dependencies (npm run build:core)
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // Not the site's icons and fonts
  publicDir: false,
  build: {
    outDir: fileURLToPath(new URL('dist', import.meta.url)),
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    sourcemap: true,
    lib: { entry: fileURLToPath(new URL('index.ts', import.meta.url)), formats: ['es'], fileName: 'index' },
    rollupOptions: { external: [/^astronomy-engine/, /^iztro/, /^tyme4ts/] },
  },
})

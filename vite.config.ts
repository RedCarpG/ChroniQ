/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { serviceWorker } from './scripts/pwa'

export default defineConfig({
  plugins: [react(), serviceWorker()],
  base: './',
  // The main chunk sits just over Vite's 500 kB default (tyme4ts is large);
  // iztro is already split into the lazily loaded 紫微 chunk.
  build: { chunkSizeWarningLimit: 600 },
  // The 紫微 tests cast iztro charts (0.7–1.9 s each on their own); with the whole suite running in
  // parallel on a busy machine they have gone past vitest's 5 s default. 20 s still catches a hang.
  test: { testTimeout: 20_000 },
})

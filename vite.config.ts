/// <reference types="vitest/config" />
import { realpathSync } from 'node:fs'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'
import { calendarFeed } from './scripts/feed'
import { serviceWorker } from './scripts/pwa'

export default defineConfig({
  plugins: [react(), calendarFeed(), serviceWorker()],
  base: './',
  // A worktree (.claude/worktrees/…) may link node_modules to the main checkout's: let the dev server
  // serve files from where it really is too, or the fonts (马善政, 站酷小薇) are refused and the page
  // falls back to the system's
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), realpathSync('node_modules')] } },
  // The calendar needs tyme4ts; chart-page UI and iztro load on demand.
  // Keep the warning below the old 635 kB eager entry bundle.
  build: { chunkSizeWarningLimit: 600 },
  // The 紫微 tests cast iztro charts (0.7–1.9 s each on their own); with the whole suite running in
  // parallel on a busy machine they have gone past vitest's 5 s default. 20 s still catches a hang.
  test: { testTimeout: 20_000 },
})

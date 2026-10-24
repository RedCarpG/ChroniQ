// Vite plugin: writes sw.js into the build, precaching every emitted file and
// every file in public/. The cache name hashes that list (built files carry
// content hashes in their names), so each deploy that changes anything gets a
// fresh cache and the old one is dropped.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

export function serviceWorker(): Plugin {
  return {
    name: 'chroniq-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const publicDir = join(process.cwd(), 'public')
      const publicFiles = readdirSync(publicDir).sort()
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map')).sort()
      const hash = createHash('sha256')
      for (const f of built) hash.update(f)
      for (const f of publicFiles) hash.update(f).update(readFileSync(join(publicDir, f)))
      const precache = ['./', ...built.filter((f) => f !== 'index.html'), ...publicFiles]
      const source = readFileSync(join(process.cwd(), 'scripts/sw-template.js'), 'utf8')
        .replace('__CACHE__', `chroniq-${hash.digest('hex').slice(0, 12)}`)
        .replace('__PRECACHE__', JSON.stringify(precache, null, 2))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

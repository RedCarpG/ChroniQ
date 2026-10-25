// Vite plugin: writes sw.js into the build, precaching every emitted file and
// every file in public/. The cache name hashes that list (built files carry
// content hashes in their names), so each deploy that changes anything gets a
// fresh cache and the old one is dropped.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

/** Large files only some need, not precached but cached when first fetched like any other: the 观月
 *  page's 2K colour map, for a large Moon (offline, the page makes do with the 1K map), and the slices
 *  of the titles' 思源宋体, of which a page needs a few (offline, a slice not yet fetched falls back to
 *  a system serif) */
const ON_DEMAND = [/^assets\/lroc_color_2k-/, /^assets\/noto-serif-sc-/]

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
      const precache = ['./', ...built.filter((f) => f !== 'index.html' && !ON_DEMAND.some((re) => re.test(f))), ...publicFiles]
      const source = readFileSync(join(process.cwd(), 'scripts/sw-template.js'), 'utf8')
        .replace('__CACHE__', `chroniq-${hash.digest('hex').slice(0, 12)}`)
        .replace('__PRECACHE__', JSON.stringify(precache, null, 2))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

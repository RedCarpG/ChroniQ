// The declarations tsc writes keep src/lib's imports as they are written there, without an
// extension ('../src/lib/bazi'), which a project resolving modules as Node does (NodeNext) cannot
// follow: every type from them would be any. This adds the .js each one needs (npm run build:core).
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('dist/types', import.meta.url))

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* files(path)
    else if (name.endsWith('.d.ts')) yield path
  }
}

/** './x' → './x.js', or './x/index.js' for a folder; anything with an extension or not relative stays */
function withExtension(from, spec) {
  if (!spec.startsWith('.') || /\.(js|mjs|cjs|json)$/.test(spec)) return spec
  const target = resolve(dirname(from), spec)
  if (existsSync(`${target}.d.ts`)) return `${spec}.js`
  if (existsSync(join(target, 'index.d.ts'))) return `${spec === '.' ? '.' : spec}/index.js`
  throw new Error(`${from}: cannot find the declarations for '${spec}'`)
}

let changed = 0
for (const file of files(root)) {
  const text = readFileSync(file, 'utf8')
  const fixed = text
    .replace(/(from\s+['"])([^'"]+)(['"])/g, (_m, a, spec, b) => a + withExtension(file, spec) + b)
    .replace(/(import\(\s*['"])([^'"]+)(['"]\s*\))/g, (_m, a, spec, b) => a + withExtension(file, spec) + b)
  if (fixed !== text) {
    writeFileSync(file, fixed)
    changed++
  }
}
console.log(`fix-dts: ${changed} declaration files given .js imports`)

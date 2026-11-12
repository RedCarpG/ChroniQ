// Builds the Claude Code skills in core/skill (npm run build:skill): each folder with a SKILL.md is
// copied as it is (but for its test cases), except that its scripts/*.ts are not copied but bundled, every import included
// (chroniq-core, tyme4ts, iztro, astronomy-engine), into one scripts/<name>.mjs that runs with node
// alone. run.ts and other modules a script imports are bundled into it, not built on their own.
// Out to core/skill/dist/<skill>/, which the core release zips (.github/workflows/core-release.yml),
// or to the folder given as its argument (the core tests build into a temporary one).
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const here = fileURLToPath(new URL('.', import.meta.url))
const version = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8')).version

/** The scripts a skill runs: its scripts/*.ts that are not imported by another (chart.ts, not run.ts) */
const ENTRIES = { 'mingli-chart-reading': ['chart.ts'] }

/** Builds every skill into outDir; returns their names */
async function buildSkills(outDir) {
  rmSync(outDir, { recursive: true, force: true })
  const skills = readdirSync(here).filter((name) => existsSync(join(here, name, 'SKILL.md')))
  for (const skill of skills) {
    const src = join(here, skill)
    const out = join(outDir, skill)
    // Not the test cases (evals/, for skill-creator and claude plugin eval): they stay in the repository
    cpSync(src, out, { recursive: true, filter: (path) => !path.endsWith('.ts') && relative(src, path).split(sep)[0] !== 'evals' })
    // The text with LF line endings, as the release runner has it, also when built from a Windows checkout
    for (const file of readdirSync(out, { recursive: true }).filter((f) => f.endsWith('.md')))
      writeFileSync(join(out, file), readFileSync(join(out, file), 'utf8').replace(/\r\n/g, '\n'))
    const bundled = new Set()
    for (const entry of ENTRIES[skill] ?? []) {
      const result = await build({
        configFile: false,
        logLevel: 'warn',
        publicDir: false,
        define: { __CORE_VERSION__: JSON.stringify(version) },
        // Everything in the one file: the skill is installed by copying a folder, with no npm install
        ssr: { noExternal: true },
        build: {
          ssr: join(src, 'scripts', entry),
          outDir: join(out, 'scripts'),
          emptyOutDir: false,
          target: 'node20',
          minify: false,
          sourcemap: false,
          rollupOptions: { output: { format: 'es', entryFileNames: entry.replace(/\.ts$/, '.mjs'), inlineDynamicImports: true } },
        },
      })
      // Only modules that left code in the file: tree-shaken ones (renderedLength 0) carry nothing to credit
      for (const output of [result].flat())
        for (const chunk of output.output)
          for (const [id, mod] of Object.entries(chunk.modules ?? {})) if (mod.renderedLength > 0) bundled.add(id)
    }
    if (bundled.size) writeLicenses(out, bundled)
  }
  return skills
}

// What a bundled script carries besides chroniq-core's own code, and the notices that must travel with it
const root = join(here, '../..')
/** Packages whose LICENSE file has no copyright line, or that ship no LICENSE file */
const COPYRIGHT_FALLBACK = { 'astronomy-engine': 'Copyright (c) 2019-2023 Don Cross' }
/** src/lib data files under a licence other than plain MIT (src/lib/DATA_SOURCES.md) */
const DATA_LICENSES = {
  'xingguan.ts': 'CC BY-SA 4.0 — Stellarium "chinese" sky culture, via d3-celestial (© 2015 Olaf Frohn)',
  'messierData.ts': 'CC BY-SA 4.0 — d3-celestial (BSD-3-Clause, © 2015 Olaf Frohn) and OpenNGC (Mattia Verga)',
  'brightStars.ts': 'BSD-3-Clause — d3-celestial (© 2015 Olaf Frohn); data from XHIP (Anderson & Francis 2012)',
  'faintStars.ts': 'BSD-3-Clause — d3-celestial (© 2015 Olaf Frohn); data from XHIP (Anderson & Francis 2012)',
  'constellations.ts': 'BSD-3-Clause — d3-celestial (© 2015 Olaf Frohn)',
  'tradChars.ts': 'Apache-2.0 — OpenCC (© BYVoid)',
  'hantFixes.ts': 'Apache-2.0 — OpenCC (© BYVoid)',
}

/** Writes LICENSE (chroniq-core's MIT) and THIRD_PARTY_NOTICES.md for what was bundled */
function writeLicenses(out, bundled) {
  const mit = readFileSync(join(here, '../LICENSE'), 'utf8').replace(/\r\n/g, '\n')
  writeFileSync(join(out, 'LICENSE'), mit)
  const ids = [...bundled].map((id) => id.replace(/\0/g, '').replace(/\\/g, '/'))
  const packages = new Map()
  for (const id of ids) {
    const m = id.match(/\/node_modules\/((?:@[^/]+\/)?[^/]+)\//)
    if (!m || packages.has(m[1])) continue
    const dir = join(root, 'node_modules', m[1])
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    const licenseFile = readdirSync(dir).find((f) => /^licen[cs]e/i.test(f))
    const line = licenseFile && readFileSync(join(dir, licenseFile), 'utf8').split(/\r?\n/).find((l) => /copyright/i.test(l))
    packages.set(m[1], { version: pkg.version, license: pkg.license, copyright: line?.trim() || COPYRIGHT_FALLBACK[m[1]] || '' })
  }
  const data = [...new Set(ids.map((id) => id.match(/\/src\/lib\/([^/]+\.ts)$/)?.[1]).filter((f) => f && DATA_LICENSES[f]))].sort()
  const rows = [...packages].sort(([a], [b]) => a.localeCompare(b))
    .map(([name, p]) => `| [${name}](https://www.npmjs.com/package/${name}) | ${p.version} | ${p.license} | ${p.copyright} |`)
  const text = [
    '# Third-party notices',
    '',
    '`scripts/*.mjs` bundle chroniq-core (MIT, see LICENSE) together with the libraries and data below.',
    '',
    '| Library | Version | License | Copyright |',
    '|---|---|---|---|',
    ...rows,
    '',
    ...(data.length
      ? ['## Data', '', 'Data from these ChroniQ files is bundled as well and keeps its upstream licence (see `src/lib/DATA_SOURCES.md` in the ChroniQ repository):', '', ...data.map((f) => `- \`${f}\`: ${DATA_LICENSES[f]}`), '']
      : []),
    '## MIT License (the libraries above)',
    '',
    mit.split('\n').slice(4).join('\n').trim(),
    '',
  ].join('\n')
  writeFileSync(join(out, 'THIRD_PARTY_NOTICES.md'), text)
}

const outDir = process.argv[2] ? resolve(process.argv[2]) : join(here, 'dist')
const skills = await buildSkills(outDir)
console.log(`build-skill: ${skills.join(', ')} (chroniq-core ${version}) → ${outDir}`)

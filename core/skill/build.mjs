// Builds the Claude Code skills in core/skill (npm run build:skill): each folder with a SKILL.md is
// copied as it is (but for its test cases), except that its scripts/*.ts are not copied but bundled, every import included
// (chroniq-core, tyme4ts, iztro, astronomy-engine), into one scripts/<name>.mjs that runs with node
// alone. run.ts and other modules a script imports are bundled into it, not built on their own.
// Out to core/skill/dist/<skill>/, which the core release zips (.github/workflows/core-release.yml),
// or to the folder given as its argument (the core tests build into a temporary one).
import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
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
    for (const entry of ENTRIES[skill] ?? []) {
      await build({
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
    }
  }
  return skills
}

const outDir = process.argv[2] ? resolve(process.argv[2]) : join(here, 'dist')
const skills = await buildSkills(outDir)
console.log(`build-skill: ${skills.join(', ')} (chroniq-core ${version}) → ${outDir}`)

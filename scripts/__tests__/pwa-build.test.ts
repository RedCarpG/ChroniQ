import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { RollupOutput } from 'rollup'
import { build } from 'vite'
import { expect, it } from 'vitest'
import config from '../../vite.config'

it('precaches only final assets and versions HTML-only changes', async () => {
  async function bundled(changeHtml: boolean) {
    const result = await build({
      ...config,
      configFile: false,
      logLevel: 'silent',
      plugins: [...(config.plugins ?? []), { name: 'html-only-test', transformIndexHtml: (html) => changeHtml ? html.replace('<title>', '<title>Updated ') : html }],
      build: { ...config.build, write: false },
    }) as RollupOutput
    const entry = result.output.find((f) => f.type === 'chunk' && f.isEntry)
    if (!entry || entry.type !== 'chunk') throw new Error('Missing app entry')
    // Follow every static import: moving the same eager code into a vendor
    // chunk would not make chart pages lazy.
    const collectModules = (root: string) => {
      const modules = new Set<string>()
      const visited = new Set<string>()
      const collect = (file: string) => {
        if (visited.has(file)) return
        visited.add(file)
        const chunk = result.output.find((f) => f.fileName === file)
        if (!chunk || chunk.type !== 'chunk') return
        Object.keys(chunk.modules).forEach((id) => modules.add(id))
        chunk.imports.forEach(collect)
      }
      collect(root)
      return [...modules]
    }
    expect(collectModules(entry.fileName).some((id) => id.endsWith('/src/components/BaziView.tsx'))).toBe(false)
    expect(result.output.some((f) => f.type === 'chunk' && Object.keys(f.modules).some((id) => id.endsWith('/src/components/BaziView.tsx')))).toBe(true)
    const solar = result.output.find((f) => f.type === 'chunk' && Object.keys(f.modules).some((id) => id.endsWith('/src/components/SolarSystemView.tsx')))
    if (!solar) throw new Error('Missing solar-system page')
    expect(collectModules(solar.fileName).some((id) => id.endsWith('/src/components/SkyView.tsx'))).toBe(false)
    const sw = result.output.find((f) => f.fileName === 'sw.js')!
    if (sw.type !== 'asset') throw new Error('Missing worker output')
    const source = String(sw.source)
    const files = new Set(result.output.map((f) => f.fileName))
    const precache = JSON.parse(/const PRECACHE = (\[[\s\S]*?\])/.exec(source)![1]) as string[]
    expect(precache.filter((f) => f !== './' && !files.has(f) && !existsSync(join('public', f)))).toEqual([])
    expect(precache.some((f) => /chartWestern.worker.*\.js$/.test(f))).toBe(true)
    return /const CACHE = '([^']+)'/.exec(source)![1]
  }
  const before = await bundled(false)
  const after = await bundled(true)
  expect(after).not.toBe(before)
}, 30_000)

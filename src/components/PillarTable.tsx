import { useRef, type ReactNode } from 'react'
import type { Glyph, Pillar } from '../lib/bazi'
import type { SchoolSettings } from '../lib/schools'
import { useTerm } from '../settingsContext'
import { Char } from './Char'
import { useHighlight, useTrigger } from './highlight'
import { ConceptTip, EmptyTip, SoundTip, TerrainTip } from './GlossaryTips'
import { SchoolMark } from './Schools'
import { ShenShaTip } from './ShenShaTip'
import { useColumnFlip } from './useColumnFlip'

interface Props {
  pillars: Pillar[]
  schools: SchoolSettings
  /** Extra content after a column's header label */
  headerExtra?: (p: Pillar) => ReactNode
  /** Index of the first natal column, drawn with a divider before it */
  dividerAt?: number
  /** 日主 (day stem), for explaining 星运 */
  dayMaster: string
  /** Slide the columns into place when they change (the 岁运盘) */
  animate?: boolean
  /** With 纳音, 星运, 自坐, 空亡 and 神煞 (the 详细 view); without, the stars, the 干支 and 藏干 */
  full?: boolean
}

/** 主星 / 天干 / 地支 / 藏干 (/ 纳音 / 星运 / 自坐 / 空亡 / 神煞, when `full`) table for any set of pillars. */
export function PillarTable({ pillars, schools, headerExtra, dividerAt, dayMaster, animate = false, full = true }: Props) {
  const term = useTerm()
  const ref = useRef<HTMLTableElement>(null)
  useColumnFlip(ref, animate)
  const { hover } = useHighlight()
  const cls = (i: number) => (i === dividerAt ? 'divider' : undefined)
  // Each row: concept name, and how to render a pillar's value with its explanation.
  const rows: [string, (p: Pillar) => ReactNode][] = [
    ['纳音', (p) => <SoundTip name={p.sound} />],
    ['星运', (p) => <TerrainTip name={p.terrain} stem={dayMaster} branch={p.branch.char} kind="terrain" />],
    ['自坐', (p) => <TerrainTip name={p.selfTerrain} stem={p.stem.char} branch={p.branch.char} kind="self" />],
    ['空亡', (p) => <EmptyTip empty={p.empty} xun={p.xun} ganzhi={p.stem.char + p.branch.char} />],
  ]
  return (
    <table className={`pillars${hover ? ' hl-active' : ''}`} ref={ref}>
      <thead>
        <tr>
          <th />
          {pillars.map((p, i) => (
            <th key={p.label} data-col={p.label} className={cls(i)}>
              {p.label.endsWith('柱') ? term(p.label) : <ConceptTip name={p.label} />}
              {headerExtra?.(p)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr className="row-star">
          <th>
            <ConceptTip name="主星" />
          </th>
          {pillars.map((p, i) => (
            <td key={p.label} data-col={p.label} className={cls(i)}>
              <Star name={p.stem.tenStar} />
            </td>
          ))}
        </tr>
        <tr className="row-char">
          <th>
            <ConceptTip name="天干" />
          </th>
          {pillars.map((p, i) => (
            <td key={p.label} data-col={p.label} className={cls(i)}>
              <GanzhiCell pillar={p.label} part="stem" g={p.stem} />
            </td>
          ))}
        </tr>
        <tr className="row-char">
          <th>
            <ConceptTip name="地支" />
          </th>
          {pillars.map((p, i) => (
            <td key={p.label} data-col={p.label} className={cls(i)}>
              <GanzhiCell pillar={p.label} part="branch" g={p.branch} />
            </td>
          ))}
        </tr>
        <tr>
          <th>
            <ConceptTip name="藏干" />
          </th>
          {pillars.map((p, i) => (
            <td key={p.label} data-col={p.label} className={['hidden-stems', cls(i)].filter(Boolean).join(' ')}>
              {p.hidden.map((h) => (
                <div key={h.char}>
                  <span className={`el-${h.element}`}>{h.char}</span>
                  <small>
                    <Star name={h.tenStar} />
                  </small>
                </div>
              ))}
            </td>
          ))}
        </tr>
        {full && rows.map(([name, render]) => (
          <tr key={name}>
            <th>
              <ConceptTip name={name} />
            </th>
            {pillars.map((p, i) => (
              <td key={p.label} data-col={p.label} className={cls(i)}>
                {render(p)}
              </td>
            ))}
          </tr>
        ))}
        {full && (
        <tr className="row-shensha">
          <th>
            <ConceptTip name="神煞" />
          </th>
          {pillars.map((p, i) => (
            <td key={p.label} data-col={p.label} className={cls(i)}>
              {p.shenSha.map((s) => (
                <div key={s.name}>
                  <ShenShaTip name={s.name} />
                  {s.school && <SchoolMark school={s.school} settings={schools} />}
                </div>
              ))}
            </td>
          ))}
        </tr>
        )}
      </tbody>
    </table>
  )
}

/** A 天干 or 地支 that highlights what it 刑冲合会 with. */
function GanzhiCell({ pillar, part, g }: { pillar: string; part: 'stem' | 'branch'; g: Glyph }) {
  const { cells } = useHighlight()
  const trigger = useTrigger({ kind: 'cell', pillar, part })
  return (
    <span className={`hl-target${cells.has(`${pillar}|${part}`) ? ' hl-on' : ''}`} {...trigger}>
      <Char g={g} />
    </span>
  )
}

/** A 十神 that highlights every 十神 of the same name. */
function Star({ name }: { name?: string }) {
  const term = useTerm()
  const { star } = useHighlight()
  const trigger = useTrigger({ kind: 'star', name: name ?? '' })
  // 日主 is a label, not a 十神
  if (!name || name === '日主') return <>{name ? term(name) : null}</>
  return (
    <span className={`hl-target star${star === name ? ' hl-on' : ''}`} {...trigger}>
      {term(name)}
    </span>
  )
}

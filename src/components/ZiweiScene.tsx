// 天书's 紫微, 简洁: the chart as a scene, laid out as 八字's is (BaziHero, whose places and lettering it
// shares). In the middle, the twelve palaces as a round chart about the pole, 紫微垣 (ZiweiWheel): 午 (the
// south) at the top as on the 八字 dial, the palaces' names round the rim, their main stars and 生年四化
// within, the 命宫 glowing vermilion and its 三方四正 drawn in gold light across the middle. Down the right,
// who the 命宫 is; down the left, who was born and the chart's 命主 / 身主; the four 生年四化 at the foot on
// the left, standing as 八字's pillars do; the 格局 at the foot on the right. 详细 is the square board.
// 起盘 (useCasting, four layers): the 命宫, its 三方四正, the other palaces, the 生年四化.
import type { ReactNode } from 'react'
import type { ElementName } from '../lib/bazi'
import { hanNumber } from '../lib/hanNumber'
import { sanFangSiZheng, type ZiweiChart, type ZiweiPalace, type ZiweiStar } from '../lib/ziwei'
import { STAR_INFO } from '../lib/ziweiInfo'
import type { ZiweiPattern } from '../lib/ziweiPatterns'
import { useSettings, useT, useTerm } from '../settingsContext'

const EL_VAR: Record<ElementName, string> = { 木: 'var(--wood)', 火: 'var(--fire)', 土: 'var(--earth)', 金: 'var(--metal)', 水: 'var(--water)' }
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'
const MUTAGENS = ['禄', '权', '科', '忌']
/** The main stars as the books shorten them, two to a 命宫 (武府, 紫相, 日月, 机巨): the 天 stars by their
 * second character, 太阳 and 太阴 as 日 and 月 */
const SHORT: Record<string, string> = {
  紫微: '紫', 天机: '机', 太阳: '日', 武曲: '武', 天同: '同', 廉贞: '廉', 天府: '府',
  太阴: '月', 贪狼: '贪', 巨门: '巨', 天相: '相', 天梁: '梁', 七杀: '杀', 破军: '破',
}

/** A palace's part in the 三方四正 lit */
export type Role = 'self' | 'opposite' | 'trine'

const C = 300
const R_RIM = 292
const R_NAMES = 252
const R_IN = 140
const R_HEART = 64
/** Angle of a palace, degrees clockwise from the top, 午 at the top */
const angleOf = (branch: string) => ((BRANCHES.indexOf(branch) - 6) * 30 + 360) % 360
const at = (r: number, deg: number) => [C + r * Math.sin((deg * Math.PI) / 180), C - r * Math.cos((deg * Math.PI) / 180)] as const
const f = (n: number) => n.toFixed(1)
const sector = (r1: number, r2: number, a1: number, a2: number) => {
  const [x1, y1] = at(r2, a1)
  const [x2, y2] = at(r2, a2)
  const [x3, y3] = at(r1, a2)
  const [x4, y4] = at(r1, a1)
  return `M${f(x1)} ${f(y1)}A${r2} ${r2} 0 0 1 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${r1} ${r1} 0 0 0 ${f(x4)} ${f(y4)}Z`
}

/** A star and its 生年四化, upright: the name in its element's colour, the 化 as a small lit tag after it */
function StarText({ star, x, y, size }: { star: ZiweiStar; x: number; y: number; size: number }) {
  const term = useTerm()
  const name = term(star.name)
  // centred with its tag: the tag's width taken from the name's left
  const tag = star.mutagen ? size * 0.82 + 4 : 0
  const left = x - (name.length * size * 1.02 + tag) / 2
  return (
    <g className="zw-star">
      <text x={f(left)} y={f(y)} fontSize={size} style={{ fill: star.element ? EL_VAR[star.element] : undefined }}>
        {name}
      </text>
      {star.mutagen && (
        <g className={`zw-mut wm-${star.mutagen} cast-l4`}>
          <rect x={f(left + name.length * size * 1.02 + 4)} y={f(y - size * 0.8)} width={f(size * 0.82)} height={f(size * 0.92)} rx={2} />
          <text x={f(left + name.length * size * 1.02 + 4 + size * 0.41)} y={f(y - size * 0.08)} fontSize={f(size * 0.62)} textAnchor="middle">
            {term(star.mutagen)}
          </text>
        </g>
      )}
    </g>
  )
}

/** 紫微垣: the twelve palaces about the pole */
export function ZiweiWheel({
  chart,
  roles,
  lit,
  castLayer,
  pick,
}: {
  chart: ZiweiChart
  /** The 三方四正 lit (the 命宫's, resting, or a palace pointed at's) */
  roles: Map<string, Role> | null
  /** The palaces of a 格局 pointed at */
  lit?: string[]
  castLayer: (branch: string) => string
  pick: (branch: string) => Record<string, unknown>
}) {
  const t = useT()
  const palaces = Object.values(chart.palaces)
  const soul = palaces.find((p) => p.isSoul)!
  const from = roles && [...roles].find(([, r]) => r === 'self')?.[0]
  const sf = from ? sanFangSiZheng(from) : null
  const point = (b: string) => at(R_IN, angleOf(b))
  return (
    <svg className={`zw-wheel${roles ? ' sf-on' : ''}${lit ? ' pt-on' : ''}`} viewBox="-24 -24 648 648" role="img" aria-label={t('紫微命盘')}>
      <circle className="zw-plate" cx={C} cy={C} r={R_RIM + 6} />
      {/* The rim, turning slowly */}
      <g className="zw-turn">
        {Array.from({ length: 120 }, (_, i) => {
          const [x1, y1] = at(R_RIM, i * 3)
          const [x2, y2] = at(R_RIM - (i % 5 ? 5 : 10), i * 3)
          return <line key={i} className={`zw-tick${i % 5 ? '' : ' major'}`} x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} />
        })}
      </g>
      <circle className="zw-ring strong" cx={C} cy={C} r={R_RIM} />
      <circle className="zw-ring" cx={C} cy={C} r={R_RIM - 14} />
      <circle className="zw-ring" cx={C} cy={C} r={R_NAMES} />
      <circle className="zw-ring" cx={C} cy={C} r={R_IN} />
      {palaces.map((p) => (
        <Sector key={p.branch} palace={p} role={roles?.get(p.branch)} lit={!!lit?.includes(p.branch)} layer={castLayer(p.branch)} pick={pick(p.branch)} />
      ))}
      {/* 三方四正 as light: the triangle of the 三合, the 对宫 dashed */}
      {sf && from && (
        <g className="zw-sf cast-l2" aria-hidden="true">
          <polygon points={[from, ...sf.trines].map((b) => point(b).map(f).join(',')).join(' ')} />
          <line x1={f(point(from)[0])} y1={f(point(from)[1])} x2={f(point(sf.opposite)[0])} y2={f(point(sf.opposite)[1])} />
        </g>
      )}
      {/* The pole, and the 命宫's stars under it */}
      <circle className="zw-heart" cx={C} cy={C} r={R_HEART} />
      <circle className="zw-pole" cx={C} cy={C - 38} r={2.6} />
      {soul.major.length ? (
        soul.major.map((s, i) => <StarText key={s.name} star={s} x={C} y={C + 4 + (i - (soul.major.length - 1) / 2) * 30 + 8} size={22} />)
      ) : (
        <text className="zw-empty" x={C} y={C + 8} textAnchor="middle">
          {t('命无正曜')}
        </text>
      )}
    </svg>
  )
}

function Sector({ palace: p, role, lit, layer, pick }: { palace: ZiweiPalace; role?: Role; lit: boolean; layer: string; pick: Record<string, unknown> }) {
  const t = useT()
  const term = useTerm()
  const a = angleOf(p.branch)
  const [x1, y1] = at(R_IN, a - 15)
  const [x2, y2] = at(R_RIM - 14, a - 15)
  // The name along the rim, never upside down
  const [nx, ny] = at((R_RIM - 14 + R_NAMES) / 2, a)
  const turn = a > 90 && a < 270 ? a - 180 : a
  const [sx, sy] = at((R_NAMES + R_IN) / 2, a)
  const stars = p.major
  return (
    <g className={`zw-sector${p.isSoul ? ' soul' : ''}${role ? ` sf-${role}` : ''}${lit ? ' lit' : ''} ${layer}`} tabIndex={0} {...pick}>
      <path className="zw-cell" d={sector(R_IN, R_RIM - 14, a - 15, a + 15)} />
      <line className="zw-spoke" x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} />
      <text className="zw-name" x={f(nx)} y={f(ny)} textAnchor="middle" dominantBaseline="central" transform={`rotate(${turn} ${f(nx)} ${f(ny)})`}>
        {term(p.name)}
        {p.isBody ? ` · ${term('身')}` : ''}　{term(p.branch)}
      </text>
      {stars.length ? (
        stars.map((s, i) => <StarText key={s.name} star={s} x={sx} y={sy + (i - (stars.length - 1) / 2) * 28 + 7} size={20} />)
      ) : (
        <text className="zw-empty" x={f(sx)} y={f(sy + 5)} textAnchor="middle">
          {t('借对宫')}
        </text>
      )}
    </g>
  )
}

/** The scene: the wheel, and what is set round it */
export function ZiweiScene({
  chart,
  wheel,
  cast,
  patterns,
  pickPattern,
  litPattern,
}: {
  chart: ZiweiChart
  wheel: ReactNode
  cast: ReactNode
  patterns: ZiweiPattern[]
  pickPattern: (name: string) => Record<string, unknown>
  litPattern?: string
}) {
  const t = useT()
  const term = useTerm()
  const { language } = useSettings()
  const en = language === 'en'
  const num = (n: number) => (en ? String(n) : hanNumber(n))
  const gap = en ? ' · ' : '　'
  const palaces = Object.values(chart.palaces)
  const soul = palaces.find((p) => p.isSoul)!
  const body = palaces.find((p) => p.isBody)
  const stars = soul.major
  // 武府坐命: two stars by their first characters, as the books name them; one by its name
  const named = stars.length === 2 && !en ? stars.map((s) => term(SHORT[s.name] ?? s.name[0])).join('') : stars.map((s) => term(s.name)).join(en ? ' and ' : '')
  // What each star is, in its first words (化气为财, 财库之星): the explanations are in Chinese only
  const natures = en ? [] : stars.map((s) => STAR_INFO[s.name]?.nature.split(/[。，]/)[0]).filter(Boolean)
  const mutagens = MUTAGENS.flatMap((m) =>
    palaces.flatMap((p) => [...p.major, ...p.minor].filter((s) => s.mutagen === m).map((s) => ({ m, star: s, palace: p }))),
  )
  return (
    <div className="bazi-hero bazi-scene ziwei-scene">
      {/* Down the right: who the 命宫 is */}
      <div className="bz-verse">
        <b className="cast-l1">{stars.length ? t('{stars}坐命', { stars: named }) : t('命无正曜')}</b>
        {natures.length > 0 && <span className="cast-l1">{natures.join(gap)}</span>}
        {stars.length > 0 && (
          <span className="cast-l1">{stars.map((s) => term(s.name) + (s.mutagen ? term(`化${s.mutagen}`) : '')).join(gap)}</span>
        )}
        <small>
          {t('命宫在{branch}', { branch: term(soul.branch) })}
          {gap}
          {term(chart.fiveElementsClass)}
        </small>
      </div>
      {/* Down the left: who was born, the 命主 and 身主, the 身宫 */}
      <div className="bz-margin">
        <span>
          {chart.gender === '男' ? term('乾造') : term('坤造')}
          {gap}
          {t('属{zodiac}', { zodiac: term(chart.zodiac) })}
        </span>
        <span>
          {term('命主')}
          {term(chart.soul)}
          {gap}
          {term('身主')}
          {term(chart.body)}
        </span>
        {body && <span>{t('身宫在{palace}', { palace: term(body.name) })}</span>}
        <span>
          {term(chart.lunarText)} {term(chart.time)}
        </span>
      </div>
      <div className="bazi-hero-dial">{wheel}</div>
      {cast}
      {/* At the foot on the left, the 生年四化, standing as 八字's pillars do */}
      <div className="bz-pillars zw-four cast-l4" aria-label={term('生年四化')}>
        {mutagens.map(({ m, star, palace }) => (
          <div key={m + star.name}>
            <small>{term(`化${m}`)}</small>
            <i className={`mutagen m-${m}`}>{term(m)}</i>
            {[...term(star.name)].map((ch, i) => (
              <b key={i} style={{ color: star.element ? EL_VAR[star.element] : undefined }}>
                {ch}
              </b>
            ))}
            <em>{term(palace.name)}</em>
          </div>
        ))}
      </div>
      {/* At the foot on the right, the 格局: pointing at one lights its palaces */}
      <div className="bz-links zw-patterns-note cast-l2">
        <span>{patterns.length ? t('格局{count}种', { count: num(patterns.length) }) : t('命宫三方未成常见格局')}</span>
        {patterns.slice(0, 3).map((p) => (
          <button key={p.name} type="button" className={`zw-pattern-name${litPattern === p.name ? ' on' : ''}`} {...pickPattern(p.name)}>
            {term(p.name)}
          </button>
        ))}
        {patterns[0] && !en && <span>{term(patterns[0].meaning)}</span>}
      </div>
    </div>
  )
}

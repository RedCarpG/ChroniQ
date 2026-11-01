// 白话解读 for 紫微 and 星盘, as lib/baziReading.ts for 八字: what a chart shows, picked out by fixed
// rules, with the words taken from the same notes as the charts' own tips. No forecast.
import { SIGN_ELEMENT, type Aspect, type ChartPoint, type StarChart } from './astrology'
import { sanFangSiZheng, type ZiweiChart, type ZiweiPalace } from './ziwei'

export interface ZiweiMutagen {
  mutagen: string
  star: string
  palace: string
}

export interface ZiweiReading {
  soul: ZiweiPalace
  /** The 主星 to read for the 命宫: its own, or with none there, the opposite palace's */
  soulStars: { name: string; brightness?: string }[]
  borrowed: boolean
  bodyPalace?: string
  fiveElementsClass: string
  mutagens: ZiweiMutagen[]
  /** The 大限 running in the given (lunar) year */
  decade?: { palace: string; ganzhi: string; from: number; to: number; stars: string[] }
}

const ORDER = ['禄', '权', '科', '忌']

export function ziweiReading(chart: ZiweiChart, year: number): ZiweiReading {
  const palaces = Object.values(chart.palaces)
  const soul = palaces.find((p) => p.isSoul) ?? palaces[0]
  const borrowed = soul.major.length === 0
  const source = borrowed ? chart.palaces[sanFangSiZheng(soul.branch).opposite] ?? soul : soul
  const mutagens = palaces
    .flatMap((p) => [...p.major, ...p.minor].flatMap((s) => (s.mutagen ? [{ mutagen: s.mutagen, star: s.name, palace: p.name }] : [])))
    .sort((a, b) => ORDER.indexOf(a.mutagen) - ORDER.indexOf(b.mutagen))
  const decade = chart.decades.find((d) => d.years.includes(year))
  return {
    soul,
    soulStars: source.major.map((s) => ({ name: s.name, brightness: s.brightness })),
    borrowed,
    bodyPalace: palaces.find((p) => p.isBody)?.name,
    fiveElementsClass: chart.fiveElementsClass,
    mutagens,
    decade: decade && {
      palace: decade.palace,
      ganzhi: decade.stem + decade.branch,
      from: decade.years[0],
      to: decade.years[decade.years.length - 1],
      stars: (chart.palaces[decade.branch]?.major ?? []).map((s) => s.name),
    },
  }
}

/** The seven classical planets, whose signs say most of a person (the outer three stay long in a sign) */
const PERSONAL = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']
const MODALITY = ['基本', '固定', '变动'] as const
const BIG_THREE = ['sun', 'moon', 'asc']

export interface StarReading {
  sun: ChartPoint
  moon: ChartPoint
  ascSign: number
  /** Most common element and modality among the seven planets, with how many there */
  elements: { key: string; count: number }[]
  modalities: { key: (typeof MODALITY)[number]; count: number }[]
  /** Houses holding three or more of the seven */
  crowded: { house: number; planets: ChartPoint[] }[]
  /** The tightest aspects involving the Sun, the Moon or the Ascendant */
  aspects: Aspect[]
}

const tops = <K,>(counts: Map<K, number>) => {
  const most = Math.max(...counts.values())
  return [...counts].filter(([, n]) => n === most).map(([key, count]) => ({ key, count }))
}
const tally = <K,>(keys: K[]) => {
  const counts = new Map<K, number>()
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1)
  return counts
}

export function starReading(chart: StarChart): StarReading {
  const of = (key: string) => chart.points.find((p) => p.key === key)!
  const planets = chart.points.filter((p) => PERSONAL.includes(p.key))
  const houses = new Map<number, ChartPoint[]>()
  for (const p of planets) houses.set(p.house, [...(houses.get(p.house) ?? []), p])
  return {
    sun: of('sun'),
    moon: of('moon'),
    ascSign: Math.floor((((chart.asc % 360) + 360) % 360) / 30),
    elements: tops(tally(planets.map((p) => SIGN_ELEMENT[p.sign] as string))),
    modalities: tops(tally(planets.map((p) => MODALITY[p.sign % 3]))),
    crowded: [...houses].filter(([, list]) => list.length >= 3).map(([house, list]) => ({ house, planets: list })).sort((a, b) => b.planets.length - a.planets.length),
    aspects: chart.aspects
      .filter((a) => BIG_THREE.includes(a.a.key) || BIG_THREE.includes(a.b.key))
      .sort((a, b) => a.orb - b.orb)
      .slice(0, 3),
  }
}

import { describe, expect, it } from 'vitest'
import { easter, regionDays, regionYear } from '../regionHolidays'

const names = (y: number, m: number, d: number) => regionDays('fr', y, m, d).map((x) => x.local)

describe('easter', () => {
  it('matches known Easter Sundays', () => {
    expect(easter(2024)).toEqual([3, 31])
    expect(easter(2025)).toEqual([4, 20])
    expect(easter(2026)).toEqual([4, 5])
    expect(easter(2038)).toEqual([4, 25]) // the latest possible
    expect(easter(2285)).toEqual([3, 22]) // the earliest possible
  })
})

describe('France', () => {
  it('has the 11 jours fériés each year', () => {
    for (const year of [2025, 2026, 2027]) {
      const off = [...regionYear('fr', year).values()].flat().filter((d) => d.kind === 'public')
      expect(off).toHaveLength(11)
    }
  })

  it('puts the movable days where the French calendar does (2026)', () => {
    expect(names(2026, 4, 6)).toEqual(['Lundi de Pâques'])
    expect(names(2026, 5, 14)).toEqual(['Ascension'])
    expect(names(2026, 5, 24)).toEqual(['Pentecôte'])
    expect(names(2026, 5, 25)).toEqual(['Lundi de Pentecôte'])
    expect(names(2026, 2, 17)).toEqual(['Mardi gras'])
    expect(names(2026, 4, 3)).toEqual(['Vendredi saint'])
  })

  it('moves Fête des mères off Pentecost', () => {
    // 2026: last Sunday of May is 31 May, Pentecost is 24 May
    expect(names(2026, 5, 31)).toEqual(['Fête des mères'])
    // 2023: Pentecost was the last Sunday of May (28 May), so Fête des mères moved to 4 June
    expect(names(2023, 6, 4)).toEqual(['Fête des mères'])
    expect(names(2023, 5, 28)).toEqual(['Pentecôte'])
  })

  it('knows the clock changes and Fête des pères', () => {
    expect(names(2026, 3, 29)).toEqual(["Passage à l'heure d'été"])
    expect(names(2026, 10, 25)).toEqual(["Passage à l'heure d'hiver"])
    expect(names(2026, 6, 21)).toEqual(['Fête des pères', 'Fête de la musique'])
  })

  it('lists days off before notable days, and nothing for no region', () => {
    expect(regionDays('fr', 2026, 7, 14)[0]).toMatchObject({ name: '法国国庆日', en: 'Bastille Day', kind: 'public' })
    expect(regionDays('fr', 2026, 12, 26)[0]).toMatchObject({ kind: 'regional', noteEn: 'Day off in Alsace-Moselle only' })
    expect(regionDays('none', 2026, 7, 14)).toEqual([])
  })
})

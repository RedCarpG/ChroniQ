import { useMemo } from 'react'
import { CITIES } from '../lib/solarTime'
import { cityPlace, type StarPlace } from '../lib/starPrefs'
import { WORLD_CITIES, allTimeZones } from '../lib/worldCities'
import { useT } from '../settingsContext'

/**
 * A place for 星盘 and 天象: a city (China or overseas), or custom coordinates
 * and time zone (also how a located 我的位置 shows).
 */
export function PlacePicker({
  place,
  onChange,
  label,
}: {
  place: StarPlace
  onChange: (p: StarPlace) => void
  /** Already in the UI language; 出生地 by default */
  label?: string
}) {
  const t = useT()
  const known = findCity(place.name)
  const custom = !known
  const zones = useMemo(allTimeZones, [])
  return (
    <>
      <label>
        {label ?? t('出生地')}
        <select
          value={custom ? '' : place.name}
          onChange={(e) => {
            const c = findCity(e.target.value)
            if (c) onChange(cityPlace(c))
            else onChange({ ...place, name: '自定义' })
          }}
        >
          <optgroup label={t('中国')}>
            {CITIES.map((c) => (
              <option key={c.name} value={c.name}>
                {t(c.name)}
              </option>
            ))}
          </optgroup>
          {WORLD_CITIES.map((r) => (
            <optgroup key={r.region} label={t(r.region)}>
              {r.cities.map((c) => (
                <option key={c.name} value={c.name}>
                  {t(c.name)}
                </option>
              ))}
            </optgroup>
          ))}
          <option value="">{t('自定义经纬度…')}</option>
        </select>
      </label>
      {custom && (
        <>
          <label>
            {t('纬度（南为负）')}
            <input
              type="number"
              className="narrow"
              min={-90}
              max={90}
              step={0.01}
              value={place.latitude}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (e.target.value !== '' && Math.abs(v) <= 90) onChange({ ...place, latitude: v })
              }}
            />
          </label>
          <label>
            {t('经度（西为负）')}
            <input
              type="number"
              className="narrow"
              min={-180}
              max={180}
              step={0.01}
              value={place.longitude}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (e.target.value !== '' && Math.abs(v) <= 180) onChange({ ...place, longitude: v })
              }}
            />
          </label>
          <label>
            {t('时区')}
            <select value={place.timeZone} onChange={(e) => onChange({ ...place, timeZone: e.target.value })}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </>
  )
}

const findCity = (name: string) =>
  CITIES.find((c) => c.name === name) ?? WORLD_CITIES.flatMap((r) => r.cities).find((c) => c.name === name)

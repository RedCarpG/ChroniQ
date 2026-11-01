import { useState } from 'react'
import { loadSkyPlace, saveSkyPlace, type StarPlace } from '../lib/starPrefs'
import { useT } from '../settingsContext'
import { PlacePicker } from './PlacePicker'
import { SkyView, type SkyMoment } from './SkyView'
import { useLocate } from './useLocate'

/**
 * 天象 page: the sky over a place right now (此刻天空), drawn as the page's
 * backdrop. (The planets on their orbits, 太阳系, have a page of their own.) The place is the page's own, starting from the 星盘
 * birthplace; 定位 asks the browser where the viewer is.
 */
export function SkyPage({ fallbackPlace, moment }: { fallbackPlace: StarPlace; /** Opened from 天象预告: the moment to show */ moment?: SkyMoment | null }) {
  const t = useT()
  const [place, setPlaceState] = useState<StarPlace>(() => loadSkyPlace(fallbackPlace))
  const setPlace = (next: StarPlace) => {
    setPlaceState(next)
    saveSkyPlace(next)
  }
  const { locating, locate } = useLocate(setPlace)

  return (
    <div className="bazi-layout sky-page">
      <SkyView
        place={place}
        moment={moment}
        placeControls={
          <>
            <PlacePicker label={t('观测地')} place={place} onChange={setPlace} />
            <button type="button" className="ghost" onClick={locate} disabled={locating === 'busy'}>
              {locating === 'busy' ? t('定位中…') : t('📍 用我的位置')}
            </button>
            {locating === 'failed' && <small className="muted">{t('无法取得位置（可能未授权），请从列表中选择城市。')}</small>}
          </>
        }
      />
    </div>
  )
}

// 起盘's line under the chart (useCasting): what the layer just come in is, and 跳过; once all are in,
// 重看起盘 to cast it again.
import { useT } from '../settingsContext'
import type { useCasting } from './useCasting'

export function CastLine({ cast, captions }: { cast: ReturnType<typeof useCasting>; captions: string[] }) {
  const t = useT()
  return (
    <p className="ts-cast" aria-live="polite">
      {cast.casting ? (
        <>
          <span key={cast.stage} className="ts-cast-line">
            {captions[cast.stage - 1]}
          </span>
          <button type="button" onClick={cast.skip}>
            {t('跳过')}
          </button>
        </>
      ) : (
        <button type="button" onClick={cast.again}>
          {t('重看起盘')}
        </button>
      )}
    </p>
  )
}

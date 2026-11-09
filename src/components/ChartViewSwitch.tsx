// 简洁 / 详细 for the charts (八字, 紫微, 星盘): one choice for all three, kept in this browser, as
// those who want the 神煞, the 杂曜 or every aspect usually want them on every chart.
import { useT } from '../settingsContext'
import { useStoredFlag } from './useStoredFlag'

const CHART_FULL_KEY = 'chroniq-chart-full'

/** Whether the charts show everything (详细), and the switch between that and 简洁 */
export const useChartFull = () => useStoredFlag(CHART_FULL_KEY, false)

export function ChartViewSwitch({ full, onToggle, className }: { full: boolean; onToggle: () => void; className?: string }) {
  const t = useT()
  return (
    <div className={['seg small chart-view', className].filter(Boolean).join(' ')} role="group" aria-label={t('显示内容')}>
      <button type="button" className={full ? undefined : 'on'} aria-pressed={!full} onClick={() => full && onToggle()}>
        {t('简洁')}
      </button>
      <button type="button" className={full ? 'on' : undefined} aria-pressed={full} onClick={() => full || onToggle()}>
        {t('详细')}
      </button>
    </div>
  )
}

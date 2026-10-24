import type { ZiweiStar } from '../lib/ziwei'
import { BRIGHTNESS_INFO, MUTAGEN_INFO, SANFANG_INFO, STAR_INFO } from '../lib/ziweiInfo'
import { useT, useTerm } from '../settingsContext'
import { InfoTip, TipLine } from './InfoTip'

/** A star on the 紫微 board, explained on hover together with its 亮度 and 四化 in this chart. */
export function StarTip({ star: s, className }: { star: ZiweiStar; className: string }) {
  const term = useTerm()
  const t = useT()
  const label = <span className={className}>{term(s.name)}</span>
  const info = STAR_INFO[s.name]
  if (!info) return label
  return (
    <InfoTip className="plain" label={label} title={term(s.name)}>
      <TipLine name={t('类别')}>
        {info.group}
        {s.element && ` · ${t('五行属{element}', { element: s.element })}`}
      </TipLine>
      <TipLine name={t('星性')}>{info.nature}</TipLine>
      {s.brightness && BRIGHTNESS_INFO[s.brightness] && (
        <TipLine name={t('亮度')}>
          {term(s.brightness)}：{BRIGHTNESS_INFO[s.brightness]}
        </TipLine>
      )}
      {s.mutagen && MUTAGEN_INFO[s.mutagen] && <TipLine name={`化${term(s.mutagen)}`}>{MUTAGEN_INFO[s.mutagen]}</TipLine>}
      <small>{t('传统说法，仅供参考')}</small>
    </InfoTip>
  )
}

/** The words 三方四正, explained on hover. */
export function SanFangTip() {
  const term = useTerm()
  const t = useT()
  return (
    <InfoTip label={term('三方四正')} title={term('三方四正')}>
      <span>{SANFANG_INFO}</span>
      <span className="muted">{t('悬停或点按任一宫位，即可在盘上看到它的{sanfang}。', { sanfang: term('三方四正') })}</span>
    </InfoTip>
  )
}

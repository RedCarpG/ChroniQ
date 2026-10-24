import { SHENSHA_INFO } from '../lib/shenshaInfo'
import { useT, useTerm } from '../settingsContext'
import { InfoTip, TipLine } from './InfoTip'

/** 神煞 name that shows its 查法 and meaning in a bubble. */
export function ShenShaTip({ name }: { name: string }) {
  const t = useT()
  const term = useTerm()
  const info = SHENSHA_INFO[name]
  if (!info) return <>{term(name)}</>
  return (
    <InfoTip label={term(name)} title={term(name)}>
      <TipLine name={t('查法')}>{info.rule}</TipLine>
      <TipLine name={t('含义')}>{info.meaning}</TipLine>
      <small>{t('传统说法，仅供参考')}</small>
    </InfoTip>
  )
}

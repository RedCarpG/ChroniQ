import { useCallback, useRef, useState } from 'react'
import { useTerm } from '../settingsContext'
import { useDismiss } from './useDismiss'

const REPO = 'https://github.com/RedCarpG/web-paipan-ChroniQ'

/** Footer badges: the author, and an About panel with what the site is and where its code lives. */
export function AboutBadges() {
  const term = useTerm()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  return (
    <div className="about-badges" ref={ref}>
      <a className="badge-pill" href="https://github.com/RedCarpG" target="_blank" rel="noreferrer">
        by RedCarpG
      </a>
      <button
        type="button"
        className="badge-pill"
        aria-expanded={open}
        aria-controls="about-panel"
        onClick={() => setOpen((o) => !o)}
      >
        About
      </button>
      {open && (
        <div id="about-panel" className="about-panel" role="dialog" aria-label="About">
          <strong className="about-title">
            星曆 <span className="muted">ChroniQ</span>
          </strong>
          <p>中国传统历法与命理排盘的网页工具，打开即用，不需要注册。</p>
          <ul>
            <li>
              <b>{term('日历')}</b>：公历、农历、节气、干支，月 / 周 / 年视图
            </li>
            <li>
              <b>{term('八字排盘')}</b>：四柱、十神、神煞、刑冲合会、{term('大运')}流年流月流日
            </li>
            <li>
              <b>{term('紫微斗数')}</b>：十二宫命盘、{term('三方四正')}、星曜解释、大限至流时
            </li>
            <li>
              <b>{term('星盘')}</b>：西洋占星本命盘，行星、宫位与相位，行运、推运、合盘与组合盘
            </li>
          </ul>
          <p className="muted">
            不同流派的取法可在「流派设置」中切换，并注明出处。命盘只保存在你自己的浏览器里，不会上传。结果仅供参考。
          </p>
          <p className="about-links">
            <a href={REPO} target="_blank" rel="noreferrer">
              GitHub 源代码
            </a>
            <a href={`${REPO}/blob/main/docs/schools.md`} target="_blank" rel="noreferrer">
              流派说明
            </a>
            <a href={`${REPO}/issues`} target="_blank" rel="noreferrer">
              反馈问题
            </a>
          </p>
          <p className="muted about-credits">
            制作：<a href="https://github.com/RedCarpG">RedCarpG</a> · 历法 <a href="https://github.com/6tail/tyme4ts">tyme4ts</a> ·
            紫微 <a href="https://github.com/SylarLong/iztro">iztro</a> · 星盘{' '}
            <a href="https://github.com/cosinekitty/astronomy">astronomy-engine</a>
          </p>
        </div>
      )}
    </div>
  )
}

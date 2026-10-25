import { useCallback, useRef, useState } from 'react'
import { useT, useTerm } from '../settingsContext'
import { install, useInstallState } from '../pwa'
import { useDismiss } from './useDismiss'

const REPO = 'https://github.com/RedCarpG/ChroniQ'
const CREDIT_LINKS: Record<string, [string, string]> = {
  author: ['RedCarpG', 'https://github.com/RedCarpG'],
  tyme: ['tyme4ts', 'https://github.com/6tail/tyme4ts'],
  iztro: ['iztro', 'https://github.com/SylarLong/iztro'],
  astronomy: ['astronomy-engine', 'https://github.com/cosinekitty/astronomy'],
}

/** Footer badges: the author, and an About panel with what the site is and where its code lives. */
export function AboutBadges() {
  const term = useTerm()
  const t = useT()
  // Page names are interface text; term() still turns the 紫微 etc. in them to 繁體
  const page = (name: string) => term(t(name))
  // The credits line, with a link in each {slot}
  const credits = t('制作：{author} · 历法 {tyme} · 紫微 {iztro} · 星盘 {astronomy}')
    .split(/\{(\w+)\}/)
    .map((part, i) =>
      i % 2 === 0 ? (
        part
      ) : (
        <a key={part} href={CREDIT_LINKS[part]?.[1]}>
          {CREDIT_LINKS[part]?.[0]}
        </a>
      ),
    )
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const installState = useInstallState()

  return (
    <div className="about-badges" ref={ref}>
      <a className="foot-link" href="https://github.com/RedCarpG" target="_blank" rel="noreferrer">
        by RedCarpG
      </a>
      <span className="foot-sep" aria-hidden="true">
        ✦
      </span>
      <button
        type="button"
        className="foot-link"
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
          <p>{t('中国传统历法与命理排盘的网页工具，打开即用，不需要注册。')}</p>
          <ul>
            <li>
              <b>{page('日历')}</b>
              {t('：公历、农历、节气、干支，月 / 周 / 年视图')}
            </li>
            <li>
              <b>{page('天象')}</b>
              {t('：此刻天空的星图，星座与星官，可拖动转动时间')}
            </li>
            <li>
              <b>{page('太阳系')}</b>
              {t('：行星在轨道上的位置与运行')}
            </li>
            <li>
              <b>{page('八字排盘')}</b>
              {t('：四柱、十神、神煞、刑冲合会、{dayun}流年流月流日', { dayun: term('大运') })}
            </li>
            <li>
              <b>{page('紫微斗数')}</b>
              {t('：十二宫命盘、{sanfang}、星曜解释、大限至流时', { sanfang: term('三方四正') })}
            </li>
            <li>
              <b>{page('星盘')}</b>
              {t('：西洋占星本命盘，行星、宫位与相位，行运、推运、合盘与组合盘')}
            </li>
          </ul>
          <p className="muted">
            {t('不同流派的取法可在「流派设置」中切换，并注明出处。命盘只保存在你自己的浏览器里，不会上传。结果仅供参考。')}
          </p>
          <div className="about-install">
            {installState === 'installed' ? (
              <span className="muted">{t('✓ 已作为应用安装，离线也能使用。')}</span>
            ) : installState === 'available' ? (
              <>
                <button type="button" className="ghost" onClick={install}>
                  {t('安装到桌面 / 主屏幕')}
                </button>
                <span className="muted">{t('像应用一样打开，离线也能使用。')}</span>
              </>
            ) : installState === 'ios' ? (
              <span className="muted">
                {t('安装到主屏幕：在 Safari 中点「分享」→「添加到主屏幕」。打开过一次后，离线也能使用。')}
              </span>
            ) : (
              <span className="muted">{t('打开过一次后，离线也能使用；支持的浏览器可从地址栏安装为应用。')}</span>
            )}
          </div>
          <p className="about-links">
            <a href={REPO} target="_blank" rel="noreferrer">
              {t('GitHub 源代码')}
            </a>
            <a href={`${REPO}/blob/main/docs/schools.md`} target="_blank" rel="noreferrer">
              {t('流派说明')}
            </a>
            <a href={`${REPO}/issues`} target="_blank" rel="noreferrer">
              {t('反馈问题')}
            </a>
          </p>
          <p className="muted about-credits">{credits}</p>
        </div>
      )}
    </div>
  )
}

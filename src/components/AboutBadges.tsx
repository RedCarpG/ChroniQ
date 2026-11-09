import { useCallback, useRef, useState } from 'react'
import { useT, useTerm } from '../settingsContext'
import { install, useInstallState } from '../pwa'
import { useDismiss } from './useDismiss'
import { PAGE_GROUPS } from './PageMenu'

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
          <p>{t('历法、天象与命理的网页工具：农历黄历和真实的星空，八字、紫微与星盘排盘。打开即用，不需要注册，全部在浏览器里计算。')}</p>
          {/* Every page, in the menu's groups, from the menu's own list, so a new page is here too */}
          {PAGE_GROUPS.map((g) => (
            <div key={g.title} className="about-group">
              <h4>{page(g.title)}</h4>
              <ul>
                {g.pages.map((p) => (
                  <li key={p.page}>
                    <b>{page(p.name)}</b>
                    {t('：{note}', { note: page(p.desc) })}
                  </li>
                ))}
              </ul>
            </div>
          ))}
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

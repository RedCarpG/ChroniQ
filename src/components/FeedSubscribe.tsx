// 订阅日历: the site's own calendar (lib/skyFeed, written at build time) to subscribe to once, so a
// phone's calendar keeps the 节气 and the sky's events up to date by itself.
import { useEffect, useState } from 'react'
import { feedUrls, type FeedLanguage } from '../lib/feedPath'
import { useSettings, useT } from '../settingsContext'

export function FeedSubscribe() {
  const t = useT()
  const { language, script } = useSettings()
  const lang: FeedLanguage = language === 'en' ? 'en' : language === 'zh-Hant' || script === 'trad' ? 'zh-Hant' : 'zh-Hans'
  const urls = feedUrls(lang, document.baseURI)
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')
  useEffect(() => {
    if (copied === 'idle') return
    const id = setTimeout(() => setCopied('idle'), 2400)
    return () => clearTimeout(id)
  }, [copied])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(urls.https)
      setCopied('done')
    } catch {
      setCopied('failed')
    }
  }
  return (
    <section className="sky-forecast-file feed-subscribe">
      <h4>{t('订阅日历')}</h4>
      <small className="muted">{t('节气、月相、流星雨、月食与行星冲日。订阅一次，手机日历会自己更新，不必每年重新导入。')}</small>
      <div className="feed-subscribe-actions">
        <a className="button primary" href={urls.webcal}>
          {t('订阅')}
        </a>
        <button type="button" className="ghost" onClick={copy}>
          {copied === 'done' ? t('已复制') : t('复制订阅地址')}
        </button>
      </div>
      {copied === 'failed' && <input className="feed-subscribe-url" readOnly value={urls.https} onFocus={(e) => e.target.select()} aria-label={t('订阅地址')} />}
      <details className="muted">
        <summary>{t('如何订阅')}</summary>
        <small>{t('iPhone、Mac 和 Outlook 点「订阅」即可。Google 日历请复制地址，在网页版「其他日历 → 通过网址添加」中粘贴。时刻按各地时间显示；行星冲日等天象各地都看得到，月食只在当时月亮已升起的地方可见。')}</small>
      </details>
    </section>
  )
}

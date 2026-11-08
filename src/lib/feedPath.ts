// Where the 订阅日历 (lib/skyFeed.ts, written at build time) is on the site: apart from it, so the
// page can link to it without loading what works the feed out.

export type FeedLanguage = 'zh-Hans' | 'zh-Hant' | 'en'
export const FEED_LANGUAGES: FeedLanguage[] = ['zh-Hans', 'zh-Hant', 'en']
/** The feed's path from the site's root */
export const feedPath = (lang: FeedLanguage) => `calendar/chroniq-${lang}.ics`

/** The feed's address from a page of the site: https for copying, webcal for a phone to subscribe */
export function feedUrls(lang: FeedLanguage, base: string) {
  const https = new URL(feedPath(lang), base).href
  return { https, webcal: https.replace(/^https?:/, 'webcal:') }
}

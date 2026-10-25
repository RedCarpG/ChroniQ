import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { CalendarView } from './components/CalendarView'
import { BaziView } from './components/BaziView'
import { AboutBadges } from './components/AboutBadges'
import { Logo } from './components/Logo'
import { PageMenu, type Page } from './components/PageMenu'
import { SavedChartsDrawer } from './components/SavedCharts'
import { SettingsMenu } from './components/SettingsMenu'
import { useOnline } from './pwa'
import { ExportButton } from './components/ExportButton'
import { ShareButton } from './components/ShareButton'
import { smoothUpdate } from './components/smoothUpdate'
import { SPLASH_FADE_IN_MS, SplashOverlay, SplashSignal, holdSplash } from './components/Splash'
import type { BaziInput } from './lib/bazi'
import { loadLastInput, saveLastInput } from './lib/savedCharts'
import { parseShareHash } from './lib/shareLink'
import { loadSchools, saveSchools, type SchoolSettings } from './lib/schools'
import { loadZiweiSchools, saveZiweiSchools, type ZiweiSchoolSettings } from './lib/ziweiSchools'
import { loadStarSettings, saveStarSettings, type StarSettings } from './lib/starPrefs'
import { DEFAULT_PLACE } from './lib/place'
import { applyScale, applyTheme, loadSettings, saveSettings, type Settings } from './lib/settings'
import { SettingsContext } from './settingsContext'
import { translate, type Vars } from './i18n'
import { play, setSoundEnabled, startClickSounds } from './sound'

type Tab = Page
/** Order of the pages, which sets the way a page switch slides. */
const TAB_ORDER: Tab[] = ['calendar', 'sky', 'moon', 'solar', 'bazi', 'ziwei', 'star']

// 紫微斗数 pulls in iztro (~150 KB gzip); load it only when the tab is opened.
const loadZiwei = () => import('./components/ZiweiView')
const ZiweiView = lazy(() => loadZiwei().then((m) => ({ default: m.ZiweiView })))
// 星盘 pulls in astronomy-engine; likewise only loaded when its tab opens.
const loadStar = () => import('./components/StarChartView')
const StarChartView = lazy(() => loadStar().then((m) => ({ default: m.StarChartView })))
/** The tabs whose code loads on first visit, and which of them have loaded */
// 天象 too (astronomy-engine and the star catalogue)
const loadSky = () => import('./components/SkyPage')
const SkyPage = lazy(() => loadSky().then((m) => ({ default: m.SkyPage })))
// 太阳系, its own page since the sky became the 天象 page's backdrop
const loadSolar = () => import('./components/SolarSystemView')
const SolarSystemView = lazy(() => loadSolar().then((m) => ({ default: m.SolarSystemView })))
// 观月, with its maps of the Moon
const loadMoon = () => import('./components/MoonPage')
const MoonPage = lazy(() => loadMoon().then((m) => ({ default: m.MoonPage })))
const LOADERS: Partial<Record<Tab, () => Promise<unknown>>> = { ziwei: loadZiwei, star: loadStar, sky: loadSky, moon: loadMoon, solar: loadSolar }
const loadedTabs = new Set<Tab>()
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// A share link opens its chart once; the hash is then dropped, so a reload or
// the user's own edits are not overridden by it again.
const shared = parseShareHash(location.hash)
if (location.hash) history.replaceState(null, '', location.pathname + location.search)

export function App() {
  const online = useOnline()
  const [tab, setTab] = useState<Tab>(shared?.tab ?? 'calendar')
  // Switching pages slides the old one out and the new one in, towards the
  // side of the new tab (styles.css: [data-vt='page']).
  const goTab = (next: Tab) => {
    if (next === tab) return
    const root = document.documentElement
    root.dataset.pageDir = TAB_ORDER.indexOf(next) > TAB_ORDER.indexOf(tab) ? 'next' : 'back'
    // First visit to a page whose code is not loaded yet: put the loading screen
    // up first, load the code, and switch under it, rather than sliding into a
    // page that is still loading.
    const load = LOADERS[next]
    if (load && !loadedTabs.has(next)) {
      const release = holdSplash()
      Promise.all([load(), sleep(SPLASH_FADE_IN_MS)])
        .then(() => {
          loadedTabs.add(next)
          setTab(next)
        })
        .finally(release)
      return
    }
    smoothUpdate('page', () => setTab(next))
  }
  const [baziInput, setBaziInput] = useState<BaziInput>(() => {
    if (shared) return shared.input
    const last = loadLastInput()
    if (last) return last
    const now = new Date()
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      gender: 1,
    }
  })
  // Remember the latest birth data so the chart is back after a reload.
  useEffect(() => saveLastInput(baziInput), [baziInput])
  const [schools, setSchools] = useState<SchoolSettings>(loadSchools)
  const changeSchools = (next: SchoolSettings) => {
    setSchools(next)
    saveSchools(next)
  }
  // Loading a saved chart remounts the 八字 / 紫微 view so its 运 picks start fresh.
  const [loads, setLoads] = useState(0)
  const loadChart = (next: BaziInput) => {
    setBaziInput(next)
    setLoads((n) => n + 1)
  }
  const [starSettings, setStarSettings] = useState<StarSettings>(loadStarSettings)
  const changeStarSettings = (next: StarSettings) => {
    setStarSettings(next)
    saveStarSettings(next)
  }
  const [ziweiSchools, setZiweiSchools] = useState<ZiweiSchoolSettings>(loadZiweiSchools)
  const changeZiweiSchools = (next: ZiweiSchoolSettings) => {
    setZiweiSchools(next)
    saveZiweiSchools(next)
  }
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const changeSettings = (next: Settings) => {
    setSettings(next)
    saveSettings(next)
  }
  // App sits outside the settings context it provides, so it reads the language itself
  const t = (text: string, vars?: Vars) => translate(settings.language, text, vars)
  const [creditBefore, creditAfter] = t('历法数据由 {lib} 提供 · 仅供参考').split('{lib}')
  useEffect(() => applyTheme(settings.theme), [settings.theme])
  useEffect(() => {
    document.documentElement.lang = settings.language === 'en' ? 'en' : 'zh-CN'
  }, [settings.language])
  useEffect(() => applyScale(settings.uiScale), [settings.uiScale])
  // The interface sounds: one listener for the page's clicks, and a chime to say they are back on
  useEffect(() => startClickSounds(), [])
  const soundWas = useRef(settings.sound)
  useEffect(() => {
    setSoundEnabled(settings.sound === 'on')
    if (settings.sound === 'on' && soundWas.current === 'off') play('on')
    soundWas.current = settings.sound
  }, [settings.sound])
  // The decorative stars (starfield.ts) step aside on the 天象 page, whose backdrop is the real sky,
  // and on the 八字 and 星盘 pages for the sky of the moment of birth (BirthSky)
  const realSky = tab === 'sky' || ((tab === 'bazi' || tab === 'star') && settings.birthSky === 'show')
  useEffect(() => {
    document.querySelector('.starfield')?.classList.toggle('aside', realSky)
  }, [realSky])
  // The top bar's height, for pages laid out to fill the window under it (the calendar)
  const appRef = useRef<HTMLDivElement>(null)
  const topbarRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const app = appRef.current
    const bar = topbarRef.current
    if (!app || !bar) return
    const set = () => app.style.setProperty('--topbar-h', `${bar.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(bar)
    return () => ro.disconnect()
  }, [])

  return (
    <SettingsContext.Provider value={settings}>
      <div className={`app page-${tab}`} ref={appRef}>
        <header className="topbar" ref={topbarRef}>
          <h1>
            <Logo />
            星曆
            <span className="brand-en">ChroniQ</span>
          </h1>
          <div className="topbar-right">
            <PageMenu page={tab} onPick={goTab} />
            {tab !== 'calendar' && tab !== 'sky' && tab !== 'moon' && tab !== 'solar' && (
              <>
                <ExportButton chart={{ tab, input: baziInput }} />
                <ShareButton chart={{ tab, input: baziInput }} />
              </>
            )}
            <SettingsMenu settings={settings} onChange={changeSettings} />
          </div>
        </header>
        <main>
          {tab === 'calendar' ? (
            <CalendarView
              onShow={(key, show) => changeSettings({ ...settings, [key]: show ? 'show' : 'hide' })}
              onWeekStart={(weekStart) => changeSettings({ ...settings, weekStart })}
              onPickBazi={(day) => {
                setBaziInput((prev) => ({ ...prev, year: day.getYear(), month: day.getMonth(), day: day.getDay() }))
                goTab('bazi')
              }}
            />
          ) : tab === 'bazi' ? (
            <BaziView
              key={loads}
              input={baziInput}
              onChange={setBaziInput}
              schools={schools}
              onSchoolsChange={changeSchools}
            />
          ) : tab === 'sky' ? (
            <Suspense fallback={<SplashSignal />}>
              <SkyPage fallbackPlace={baziInput.place ?? DEFAULT_PLACE} />
            </Suspense>
          ) : tab === 'moon' ? (
            <Suspense fallback={<SplashSignal />}>
              <MoonPage fallbackPlace={baziInput.place ?? DEFAULT_PLACE} />
            </Suspense>
          ) : tab === 'solar' ? (
            <Suspense fallback={<SplashSignal />}>
              <SolarSystemView />
            </Suspense>
          ) : tab === 'star' ? (
            <Suspense fallback={<SplashSignal />}>
              <StarChartView
                key={loads}
                input={baziInput}
                onChange={setBaziInput}
                settings={starSettings}
                onSettingsChange={changeStarSettings}
              />
            </Suspense>
          ) : (
            <Suspense fallback={<SplashSignal />}>
              <ZiweiView
                key={loads}
                input={baziInput}
                onChange={setBaziInput}
                schools={ziweiSchools}
                onSchoolsChange={changeZiweiSchools}
              />
            </Suspense>
          )}
        </main>
        <footer className="muted">
          {!online && <span className="offline-badge">{t('离线中 · 排盘与天象照常可用')}</span>}
          <span>
            {creditBefore}
            <a href="https://github.com/6tail/tyme4ts">tyme4ts</a>
            {creditAfter}
          </span>
          <AboutBadges />
        </footer>
      </div>
      {/* Outside .app: the drawer is fixed to the screen edge and takes the zoom itself */}
      {tab !== 'sky' && tab !== 'moon' && tab !== 'solar' && <SavedChartsDrawer input={baziInput} onLoad={loadChart} calendar={tab === 'calendar'} />}
      <SplashOverlay />
    </SettingsContext.Provider>
  )
}

import { Suspense, lazy, useEffect, useState } from 'react'
import { CalendarView } from './components/CalendarView'
import { BaziView } from './components/BaziView'
import { AboutBadges } from './components/AboutBadges'
import { Logo } from './components/Logo'
import { SavedChartsDrawer } from './components/SavedCharts'
import { SettingsMenu } from './components/SettingsMenu'
import { ShareButton } from './components/ShareButton'
import { smoothUpdate } from './components/smoothUpdate'
import { SPLASH_FADE_IN_MS, SplashOverlay, SplashSignal, holdSplash } from './components/Splash'
import type { BaziInput } from './lib/bazi'
import { loadLastInput, saveLastInput } from './lib/savedCharts'
import { parseShareHash } from './lib/shareLink'
import { loadSchools, saveSchools, type SchoolSettings } from './lib/schools'
import { loadZiweiSchools, saveZiweiSchools, type ZiweiSchoolSettings } from './lib/ziweiSchools'
import {
  loadStarPlace,
  loadStarSettings,
  saveStarPlace,
  saveStarSettings,
  type StarPlace,
  type StarSettings,
} from './lib/starPrefs'
import { applyScale, applyTheme, loadSettings, saveSettings, type Settings } from './lib/settings'
import { toTrad } from './lib/trad'
import { SettingsContext } from './settingsContext'

type Tab = 'calendar' | 'bazi' | 'ziwei' | 'star'
/** Left-to-right order of the tabs, which sets the way a page switch slides. */
const TAB_ORDER: Tab[] = ['calendar', 'bazi', 'ziwei', 'star']

// 紫微斗数 pulls in iztro (~150 KB gzip); load it only when the tab is opened.
const loadZiwei = () => import('./components/ZiweiView')
const ZiweiView = lazy(() => loadZiwei().then((m) => ({ default: m.ZiweiView })))
// 星盘 pulls in astronomy-engine; likewise only loaded when its tab opens.
const loadStar = () => import('./components/StarChartView')
const StarChartView = lazy(() => loadStar().then((m) => ({ default: m.StarChartView })))
/** The tabs whose code loads on first visit, and which of them have loaded */
const LOADERS: Partial<Record<Tab, () => Promise<unknown>>> = { ziwei: loadZiwei, star: loadStar }
const loadedTabs = new Set<Tab>()
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// A share link opens its chart once; the hash is then dropped, so a reload or
// the user's own edits are not overridden by it again.
const shared = parseShareHash(location.hash)
if (location.hash) history.replaceState(null, '', location.pathname + location.search)

export function App() {
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
  // A shared birthplace is shown but not saved over the user's own.
  const [starPlace, setStarPlace] = useState<StarPlace>(() => shared?.place ?? loadStarPlace(baziInput.longitude))
  const changeStarPlace = (next: StarPlace) => {
    setStarPlace(next)
    saveStarPlace(next)
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
  useEffect(() => applyTheme(settings.theme), [settings.theme])
  useEffect(() => applyScale(settings.uiScale), [settings.uiScale])
  const term = settings.script === 'trad' ? toTrad : (s: string) => s

  return (
    <SettingsContext.Provider value={settings}>
      <div className="app">
        <header className="topbar">
          <h1>
            <Logo />
            星曆
            <span className="brand-en">ChroniQ</span>
          </h1>
          <div className="topbar-right">
            <nav className="tabs">
              <button className={tab === 'calendar' ? 'on' : undefined} onClick={() => goTab('calendar')}>
                {term('日历')}
              </button>
              <button className={tab === 'bazi' ? 'on' : undefined} onClick={() => goTab('bazi')}>
                {term('八字排盘')}
              </button>
              <button className={tab === 'ziwei' ? 'on' : undefined} onClick={() => goTab('ziwei')}>
                {term('紫微斗数')}
              </button>
              <button className={tab === 'star' ? 'on' : undefined} onClick={() => goTab('star')}>
                {term('星盘')}
              </button>
            </nav>
            {tab !== 'calendar' && (
              <ShareButton chart={{ tab, input: baziInput, place: tab === 'star' ? starPlace : undefined }} />
            )}
            <SettingsMenu settings={settings} onChange={changeSettings} />
          </div>
        </header>
        <main>
          {tab === 'calendar' ? (
            <CalendarView
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
          ) : tab === 'star' ? (
            <Suspense fallback={<SplashSignal />}>
              <StarChartView
                key={loads}
                input={baziInput}
                onChange={setBaziInput}
                place={starPlace}
                onPlaceChange={changeStarPlace}
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
          <span>
            历法数据由 <a href="https://github.com/6tail/tyme4ts">tyme4ts</a> 提供 · 仅供参考
          </span>
          <AboutBadges />
        </footer>
      </div>
      {/* Outside .app: the drawer is fixed to the screen edge and takes the zoom itself */}
      {tab !== 'calendar' && <SavedChartsDrawer input={baziInput} onLoad={loadChart} />}
      <SplashOverlay />
    </SettingsContext.Provider>
  )
}

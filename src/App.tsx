import { Fragment, Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CalendarView } from './components/CalendarView'
import { AboutBadges } from './components/AboutBadges'
import { Logo } from './components/Logo'
import { PageNav, type Page } from './components/PageMenu'
import { SavedChartsDrawer } from './components/SavedCharts'
import { SettingsMenu } from './components/SettingsMenu'
import { applyUpdate, useOnline, useUpdateReady } from './pwa'
import { ExportButton } from './components/ExportButton'
import { ShareButton } from './components/ShareButton'
import { smoothUpdate } from './components/smoothUpdate'
import { SPLASH_FADE_IN_MS, SplashOverlay, SplashSignal, holdSplash } from './components/Splash'
import type { BaziInput } from './lib/bazi'
import { loadLastInput, saveLastInput } from './lib/savedCharts'
import { parseShareHash } from './lib/shareLink'
import { loadSchools, saveSchools, type SchoolSettings } from './lib/schools'
import { loadZiweiSchools, saveZiweiSchools, type ZiweiSchoolSettings } from './lib/ziweiSchools'
import { loadQizhengSchools, saveQizhengSchools, type QizhengSchoolSettings } from './lib/qizhengSchools'
import { loadStarSettings, saveStarSettings, type StarSettings } from './lib/starPrefs'
import { DEFAULT_PLACE, type Place } from './lib/place'
import { toUtc } from './lib/timeZone'
import { TianshuAtmosphere } from './components/TianshuAtmosphere'
import { useSectionSnap } from './components/useSectionSnap'
import { applyScale, applyStyle, loadSettings, saveSettings, TIANSHU_REALM, type Settings } from './lib/settings'
import { SettingsContext } from './settingsContext'
import { hantReady, loadHant } from './lib/hant'
import { startHantDom } from './hantDom'
import { englishReady, loadEnglish, translate, type Vars } from './i18n'
import { play, setSoundEnabled, startClickSounds } from './sound'

type Tab = Page
type SkyMoment = import('./components/SkyView').SkyMoment
/** Order of the pages, which sets the way a page switch slides. */
const TAB_ORDER: Tab[] = ['today', 'calendar', 'sky', 'moon', 'solar', 'bazi', 'ziwei', 'qizheng', 'star', 'timeline']

// Calendar is the default page; load the 八字 UI only when it is opened.
const loadBazi = () => import('./components/BaziView')
const BaziView = lazy(() => loadBazi().then((m) => ({ default: m.BaziView })))

// 紫微斗数 pulls in iztro (~150 KB gzip); load it only when the tab is opened.
const loadZiwei = () => import('./components/ZiweiView')
const ZiweiView = lazy(() => loadZiwei().then((m) => ({ default: m.ZiweiView })))
// 七政四余 brings astronomy-engine, as 星盘 does
const loadQizheng = () => import('./components/QizhengView')
const QizhengView = lazy(() => loadQizheng().then((m) => ({ default: m.QizhengView })))
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
// 今日, with tonight's sky (astronomy-engine)
const loadToday = () => import('./components/TodayPage')
const TodayPage = lazy(() => loadToday().then((m) => ({ default: m.TodayPage })))
// 人生时间轴 brings iztro and astronomy-engine too
const loadTimeline = () => import('./components/TimelinePage')
const TimelinePage = lazy(() => loadTimeline().then((m) => ({ default: m.TimelinePage })))
// 观月, with its maps of the Moon
const loadMoon = () => import('./components/MoonPage')
const MoonPage = lazy(() => loadMoon().then((m) => ({ default: m.MoonPage })))
const LOADERS: Partial<Record<Tab, () => Promise<unknown>>> = { today: loadToday, timeline: loadTimeline, bazi: loadBazi, ziwei: loadZiwei, qizheng: loadQizheng, star: loadStar, sky: loadSky, moon: loadMoon, solar: loadSolar }
const loadedTabs = new Set<Tab>()
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// A share link opens its chart once; the hash is then dropped, so a reload or
// the user's own edits are not overridden by it again.
const shared = parseShareHash(location.hash)
if (location.hash) history.replaceState(null, '', location.pathname + location.search)

export function App() {
  const online = useOnline()
  const updateReady = useUpdateReady()
  const [loadError, setLoadError] = useState(false)
  const [tab, setTab] = useState<Tab>(shared?.tab ?? 'calendar')
  // Switching pages slides the old one out and the new one in, towards the
  // side of the new tab (styles.css: [data-vt='page']).
  // Opened from 天象预告: the moment the sky page starts at, for that visit
  const [skyMoment, setSkyMoment] = useState<SkyMoment | null>(null)
  // Opened from a day's Moon (日历, 今日): the day 观月 starts at; from a planet (今日): the one 太阳系 picks
  const [moonDay, setMoonDay] = useState<{ year: number; month: number; day: number } | number | null>(null)
  const [solarPlanet, setSolarPlanet] = useState<string | null>(null)
  // From a chart's 生辰月相海报: the Moon at the moment of birth, seen from the birthplace
  const [moonBirth, setMoonBirth] = useState<Place | null>(null)
  const viewMoon = (day: { year: number; month: number; day: number } | number | null) => {
    setMoonDay(day)
    setMoonBirth(null)
    goTab('moon')
  }
  const viewBirthMoon = (input: BaziInput) => {
    const place = input.place ?? DEFAULT_PLACE
    const { year, month, day, hour, minute } = input
    setMoonDay(toUtc({ year, month, day, hour, minute }, place.timeZone).date.getTime())
    setMoonBirth(place)
    goTab('moon')
  }
  const viewSolar = (planet: string) => {
    setSolarPlanet(planet)
    goTab('solar')
  }
  const goTab = (next: Tab) => {
    if (next === tab) return
    if (next !== 'sky') setSkyMoment(null)
    if (next !== 'moon') {
      setMoonDay(null)
      setMoonBirth(null)
    }
    if (next !== 'solar') setSolarPlanet(null)
    setLoadError(false)
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
        .catch(() => setLoadError(true))
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
  const [qizhengSchools, setQizhengSchools] = useState<QizhengSchoolSettings>(loadQizhengSchools)
  const changeQizhengSchools = (next: QizhengSchoolSettings) => {
    setQizhengSchools(next)
    saveQizhengSchools(next)
  }
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const changeSettings = (next: Settings) => {
    setSettings(next)
    saveSettings(next)
  }
  // App sits outside the settings context it provides, so it reads the language itself
  const t = (text: string, vars?: Vars) => translate(settings.language, text, vars)
  const [creditBefore, creditAfter] = t('历法数据由 {lib} 提供 · 仅供参考').split('{lib}')
  useEffect(() => {
    document.documentElement.lang = settings.language === 'en' ? 'en' : settings.language === 'zh-Hant' ? 'zh-Hant' : 'zh-CN'
  }, [settings.language])
  // 繁體中文: the page converted as it is shown, once OpenCC is in (the loading screen up till then)
  useLayoutEffect(() => {
    if (settings.language !== 'zh-Hant') return
    let stop: (() => void) | null = null
    let cancelled = false
    const release = hantReady() ? null : holdSplash()
    loadHant()
      .then(() => {
        if (!cancelled) stop = startHantDom()
      })
      .catch(() => {})
      .finally(() => release?.())
    return () => {
      cancelled = true
      stop?.()
    }
  }, [settings.language])
  // English: its dictionaries come in apart (the loading screen up till then), and the page is drawn
  // again in English once they are
  const [englishIn, setEnglishIn] = useState(englishReady)
  useLayoutEffect(() => {
    if (settings.language !== 'en' || englishIn) return
    let cancelled = false
    const release = holdSplash()
    loadEnglish()
      .then(() => {
        if (!cancelled) setEnglishIn(true)
      })
      .catch(() => {})
      .finally(() => release())
    return () => {
      cancelled = true
    }
  }, [settings.language, englishIn])
  // In Chinese the proper nouns follow the language; the 专有名词 choice is for English (a new value
  // once the English is in, so every part of the page reads it again)
  const shown: Settings = settings.language === 'en' ? { ...settings } : { ...settings, script: settings.language === 'zh-Hant' ? 'trad' : 'simp' }
  useEffect(() => applyScale(settings.uiScale), [settings.uiScale])
  // The interface sounds: one listener for the page's clicks, and a chime to say they are back on
  useEffect(() => startClickSounds(), [])
  const soundWas = useRef(settings.sound)
  useEffect(() => {
    setSoundEnabled(settings.sound === 'on')
    if (settings.sound === 'on' && soundWas.current === 'off') play('on')
    soundWas.current = settings.sound
  }, [settings.sound])
  // 天象, 观月 and 太阳系 are drawn over the whole screen, their controls laid over it (Immersive)
  const immersive = tab === 'sky' || tab === 'moon' || tab === 'solar'
  // The decorative stars (starfield.ts) step aside on those pages, which draw a sky of their own,
  // and on the 八字 and 星盘 pages for the sky of the moment of birth (BirthSky)
  const realSky = immersive || ((tab === 'bazi' || tab === 'qizheng' || tab === 'star') && settings.birthSky === 'show')
  useEffect(() => {
    document.querySelector('.starfield')?.classList.toggle('aside', realSky)
  }, [realSky])
  // 界面风格: the 天书 look draws the 命理 pages by night, over an atmosphere of its own (TianshuAtmosphere)
  const realm = settings.uiStyle === 'tianshu' ? TIANSHU_REALM[tab] : undefined
  useEffect(() => applyStyle(settings.uiStyle, tab, settings.theme), [settings.uiStyle, tab, settings.theme])
  // 天书's sections settle into place, gliding, when the page comes to rest near the top of one
  useSectionSnap(!!realm)
  // The top bar, folded up on the full-screen pages (each visit starts folded): the mouse at the top of the
  // screen brings it down, and it goes again a moment after the mouse leaves it, unless one of its
  // menus is open or it holds the focus; on a touch screen, the small tabs pull it down and fold it up.
  // 天书's 命理 pages fold it up too, the chart being the scene there: it comes down over the page,
  // wherever the page is scrolled (fold-bar)
  // (not on the 历法 pages 今日 and 日历, where the bar stays open: the way to every page, in sight)
  const foldable = immersive || (!!realm && tab !== 'today' && tab !== 'calendar')
  const [barShown, setBarShown] = useState(false)
  const barFolded = foldable && !barShown
  const barTimer = useRef(0)
  const showBar = () => {
    clearTimeout(barTimer.current)
    setBarShown(true)
  }
  const hideBarSoon = () => {
    clearTimeout(barTimer.current)
    barTimer.current = window.setTimeout(() => {
      const bar = topbarRef.current
      if (bar && (bar.matches(':hover') || bar.contains(document.activeElement))) return
      setBarShown(false)
    }, 500)
  }
  useEffect(() => () => clearTimeout(barTimer.current), [])
  // The footer, on every page, kept out of sight under the bottom edge: the mouse at the bottom of the
  // screen (or the small tab there) brings it up, and it goes again a moment after the mouse leaves
  // it, unless it holds the focus (the About panel open). Not in the page's flow, so no page is
  // scrolled to reach it (on the 天象 page, that took the top bar out of reach)
  const [footShown, setFootShown] = useState(false)
  const footRef = useRef<HTMLElement>(null)
  const footTimer = useRef(0)
  const showFoot = () => {
    clearTimeout(footTimer.current)
    setFootShown(true)
  }
  const hideFootSoon = () => {
    clearTimeout(footTimer.current)
    footTimer.current = window.setTimeout(() => {
      const foot = footRef.current
      if (foot && (foot.matches(':hover') || foot.contains(document.activeElement))) return
      setFootShown(false)
    }, 150)
  }
  useEffect(() => {
    // The bottom edge is watched rather than covered, so nothing at the foot of a page is kept from the pointer
    const onMove = (e: PointerEvent) => e.pointerType === 'mouse' && e.clientY >= window.innerHeight - 16 && showFoot()
    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('pointermove', onMove)
      clearTimeout(footTimer.current)
    }
  }, [])
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
    <SettingsContext.Provider value={shown}>
      {/* Leaving 繁體 builds the page afresh: its text was converted in place, and unchanged text is
          not rendered again */}
      <Fragment key={settings.language === 'zh-Hant' ? 'hant' : 'source'}>
      {updateReady && (
        <div className="update-bar" role="status">
          {t('有新版本')}
          <button type="button" onClick={applyUpdate}>
            {t('更新')}
          </button>
        </div>
      )}
      {loadError && <div role="alert">{t('页面加载失败，请重试或刷新页面。')} <button onClick={() => location.reload()}>{t('刷新页面')}</button></div>}
      <div className={`app page-${tab}${immersive ? ' immersive' : ''}${foldable && !immersive ? ' fold-bar' : ''}${barFolded ? ' bar-folded' : ''}`} ref={appRef}>
        {/* On the full-screen pages (and 天书's 命理 pages) the top bar folds up out of the way (folded at
            first): the mouse at the very top brings it down; a small tab pulls it down, and one under it
            folds it up again */}
        {foldable && (
          <div
            className="topbar-hotzone"
            aria-hidden="true"
            // A move in it too, not only coming in: the pointer may be there already
            onPointerEnter={(e) => e.pointerType === 'mouse' && showBar()}
            onPointerMove={(e) => e.pointerType === 'mouse' && barFolded && showBar()}
          />
        )}
        {barFolded && (
          <button
            type="button"
            className="topbar-fold down"
            aria-label={t('展开标题栏')}
            title={t('展开标题栏')}
            onPointerEnter={(e) => e.pointerType === 'mouse' && showBar()}
            onClick={() => setBarShown(true)}
          >
            <span aria-hidden="true">⌄</span>
          </button>
        )}
        <header
          className="topbar"
          ref={topbarRef}
          inert={barFolded}
          onPointerEnter={() => foldable && clearTimeout(barTimer.current)}
          onPointerLeave={(e) => foldable && e.pointerType === 'mouse' && hideBarSoon()}
          onBlur={(e) => foldable && !e.currentTarget.contains(e.relatedTarget as Node | null) && hideBarSoon()}
        >
          <h1>
            <Logo />
            星曆
            <span className="brand-en">ChroniQ</span>
          </h1>
          {/* On a phone it is the bar at the foot of the screen instead */}
          <PageNav page={tab} onPick={goTab} className="in-topbar" />
          <div className="topbar-right">
            {tab !== 'today' && tab !== 'timeline' && tab !== 'calendar' && tab !== 'sky' && tab !== 'moon' && tab !== 'solar' && (
              <>
                <ExportButton chart={{ tab, input: baziInput }} onViewMoon={() => viewBirthMoon(baziInput)} />
                <ShareButton chart={{ tab, input: baziInput }} />
              </>
            )}
            <SettingsMenu settings={settings} onChange={changeSettings} />
          </div>
          {foldable && (
            <button type="button" className="topbar-fold up" aria-label={t('收起标题栏')} title={t('收起标题栏')} onClick={() => setBarShown(false)}>
              <span aria-hidden="true">⌃</span>
            </button>
          )}
        </header>
        <main>
          {tab === 'calendar' ? (
            <CalendarView
              onShow={(key, show) => changeSettings({ ...settings, [key]: show ? 'show' : 'hide' })}
              onWeekStart={(weekStart) => changeSettings({ ...settings, weekStart })}
              skyPlace={baziInput.place ?? DEFAULT_PLACE}
              onViewSky={(moment) => {
                setSkyMoment(moment)
                goTab('sky')
              }}
              onPickBazi={(day) => {
                setBaziInput((prev) => ({ ...prev, year: day.getYear(), month: day.getMonth(), day: day.getDay() }))
                goTab('bazi')
              }}
              onViewMoon={(at) => viewMoon(typeof at === 'number' ? at : { year: at.getYear(), month: at.getMonth(), day: at.getDay() })}
            />
          ) : tab === 'today' ? (
            <Suspense fallback={<SplashSignal />}>
              <TodayPage
                fallbackPlace={baziInput.place ?? DEFAULT_PLACE}
                onViewSky={(moment) => {
                  setSkyMoment(moment)
                  goTab('sky')
                }}
                onViewMoon={() => viewMoon(null)}
                onViewSolar={viewSolar}
              />
            </Suspense>
          ) : tab === 'timeline' ? (
            <Suspense fallback={<SplashSignal />}>
              <TimelinePage key={loads} input={baziInput} schools={schools} ziweiSchools={ziweiSchools} onOpen={goTab} />
            </Suspense>
          ) : tab === 'bazi' ? (
            <Suspense fallback={<SplashSignal />}>
              <BaziView
                key={loads}
                input={baziInput}
                onChange={setBaziInput}
                schools={schools}
                onSchoolsChange={changeSchools}
              />
            </Suspense>
          ) : tab === 'sky' ? (
            <Suspense fallback={<SplashSignal />}>
              <SkyPage fallbackPlace={baziInput.place ?? DEFAULT_PLACE} moment={skyMoment} />
            </Suspense>
          ) : tab === 'moon' ? (
            <Suspense fallback={<SplashSignal />}>
              <MoonPage fallbackPlace={baziInput.place ?? DEFAULT_PLACE} day={moonDay} birthPlace={moonBirth} />
            </Suspense>
          ) : tab === 'solar' ? (
            <Suspense fallback={<SplashSignal />}>
              <SolarSystemView planet={solarPlanet} />
            </Suspense>
          ) : tab === 'qizheng' ? (
            <Suspense fallback={<SplashSignal />}>
              <QizhengView key={loads} input={baziInput} onChange={setBaziInput} schools={qizhengSchools} onSchoolsChange={changeQizhengSchools} />
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
                onColourChange={(ziweiColor) => changeSettings({ ...settings, ziweiColor })}
              />
            </Suspense>
          )}
        </main>
        {realm && <TianshuAtmosphere realm={realm} page={tab} />}
        <PageNav page={tab} onPick={goTab} className="at-foot" />
        {!footShown && (
          <button
            type="button"
            className="footer-tab"
            aria-label={t('展开页脚')}
            title={t('展开页脚')}
            onPointerEnter={(e) => e.pointerType === 'mouse' && showFoot()}
            onClick={showFoot}
          >
            <span aria-hidden="true">⌃</span>
          </button>
        )}
        <footer
          className={`muted${footShown ? ' shown' : ''}`}
          ref={footRef}
          inert={!footShown}
          onPointerEnter={() => clearTimeout(footTimer.current)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && hideFootSoon()}
          onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && hideFootSoon()}
        >
          <button type="button" className="footer-close" aria-label={t('收起页脚')} title={t('收起页脚')} onClick={() => setFootShown(false)}>
            <span aria-hidden="true">⌄</span>
          </button>
          {!online && <span className="offline-badge">{t('离线中 · 排盘与天象照常可用')}</span>}
          <span>
            {creditBefore}
            <a href="https://github.com/6tail/tyme4ts">tyme4ts</a>
            {creditAfter}
          </span>
          <span className="foot-sep" aria-hidden="true">
            ✦
          </span>
          <AboutBadges />
        </footer>
      </div>
      {/* Outside .app: the drawer is fixed to the screen edge and takes the zoom itself */}
      {/* On the 天象 page the drawer holds only the page's own 显示 */}
      {tab !== 'moon' && tab !== 'solar' && (
        <SavedChartsDrawer input={baziInput} onLoad={loadChart} calendar={tab === 'calendar' || tab === 'today'} charts={tab !== 'sky'} />
      )}
      <SplashOverlay />
      </Fragment>
    </SettingsContext.Provider>
  )
}

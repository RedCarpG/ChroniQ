import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { SPLASH_FADE_MS, SPLASH_MIN_MS } from './components/Splash'
import { setUpPwa } from './pwa'
import { startStarfield } from './starfield'
// The titles' typefaces (styles.css: 题字): Cormorant Garamond's Latin here; 思源宋体 below
import '@fontsource/cormorant-garamond/latin-600.css'
import './styles.css'

setUpPwa()
startStarfield()
// 思源宋体's rules (a hundred slices, each fetched only when a character in it is shown) come in a
// stylesheet of their own once the page is up, not in the one it waits for; till then, a system serif
void import('@fontsource/noto-serif-sc/600.css')
// The calendar detail's supporting text uses a lighter weight of the same family.
void import('@fontsource/noto-serif-sc/400.css')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The app is up: fade out the loading screen from index.html (once it has been
// up SPLASH_MIN_MS since the page opened), then drop it.
const splash = document.getElementById('splash')
if (splash) {
  const wait = Math.max(0, SPLASH_MIN_MS - performance.now())
  setTimeout(() => splash.classList.add('done'), wait)
  setTimeout(() => splash.remove(), wait + SPLASH_FADE_MS)
}

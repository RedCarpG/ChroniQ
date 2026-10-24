// Installing the app and working offline: registers the service worker
// (production builds only) and keeps the browser's install offer, so the
// About panel can show an 安装 button.
import { useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let offer: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function setUpPwa() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator)
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep the offer for the 安装 button instead of the browser's own banner.
    e.preventDefault()
    offer = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    offer = null
    notify()
  })
  window.addEventListener('online', notify)
  window.addEventListener('offline', notify)
}

const standalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

export type InstallState = 'installed' | 'available' | 'ios' | 'none'

function installState(): InstallState {
  if (standalone()) return 'installed'
  if (offer) return 'available'
  // iOS has no install offer: it is done from Safari's share menu.
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return 'ios'
  return 'none'
}

export const useInstallState = () => useSyncExternalStore(subscribe, installState)
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine)

/** Shows the browser's install dialog. */
export async function install() {
  if (!offer) return
  await offer.prompt()
  await offer.userChoice
  offer = null
  notify()
}

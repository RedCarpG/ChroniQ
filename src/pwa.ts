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

/** A new build's worker, installed and waiting for the pages on the old one to close */
let waiting: ServiceWorker | null = null
/** This page's build has been replaced on the server: a part of it not yet loaded could not be */
let stale = false

/**
 * Whether an error is a part of the page's build failing to load: the site has been deployed
 * again since the page was opened, and each deploy replaces every file. Worded differently by
 * Chrome, Safari and Firefox.
 */
export const isStaleBuild = (err: unknown) =>
  err instanceof Error && /dynamically imported module|Importing a module script failed|module script/i.test(err.message)

/**
 * Watches a registration for a new build. A worker installing with one already in charge is an
 * update; with none it is the first visit, which has nothing to replace.
 */
export function watchForUpdate(reg: ServiceWorkerRegistration, sw: Pick<ServiceWorkerContainer, 'controller'>, onReady: (worker: ServiceWorker) => void) {
  if (reg.waiting && sw.controller) onReady(reg.waiting)
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && sw.controller) onReady(worker)
    })
  })
}

function registerWorker() {
  const sw = navigator.serviceWorker
  // A new worker taking charge has dropped the old build's files: this page's lazy imports would
  // fail, so it reloads too. Not on the first visit, when the first worker takes charge.
  const hadController = !!sw.controller
  sw.addEventListener('controllerchange', () => {
    if (hadController) location.reload()
  })
  sw.register('./sw.js')
    .then((reg) => {
      watchForUpdate(reg, sw, (worker) => {
        waiting = worker
        notify()
      })
      // A tab left open sees a new build when it is come back to
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) reg.update().catch(() => {})
      })
    })
    .catch(() => {})
}

export function setUpPwa() {
  // A lazy part of the page failed to load (Vite says so for each): the page is from an older
  // build, so the 有新版本 note offers a reload. The error still goes to whoever asked for the part.
  window.addEventListener('vite:preloadError', () => {
    stale = true
    notify()
  })
  if (import.meta.env.PROD && 'serviceWorker' in navigator) window.addEventListener('load', registerWorker)
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
export const useUpdateReady = () => useSyncExternalStore(subscribe, () => waiting !== null || stale)
/** Puts the waiting build in charge and reloads, once it is active (the change of controller may have reloaded already) */
export function applyUpdate() {
  const worker = waiting
  // With no worker waiting (the page simply outlived its build), a reload is the update
  if (!worker) return location.reload()
  worker?.addEventListener('statechange', () => {
    if (worker.state === 'activated') location.reload()
  })
  worker?.postMessage('skipWaiting')
}
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine)

/** Shows the browser's install dialog. */
export async function install() {
  if (!offer) return
  await offer.prompt()
  await offer.userChoice
  offer = null
  notify()
}

import { useCallback, useEffect, useRef, useState } from 'react'

const BGM_SRC = '/audio/splash-bgm.mp3'
const MUTED_KEY = 'splash_muted'
const DEFAULT_VOLUME = 0.4
const MOBILE_VOLUME_SCALE = 0.7
const FADE_IN_MS = 1500
const ENTRY_FADE_MS = 1500
const SKIP_FADE_MS = 600
const BGM_STOP_DELAY_AFTER_DOOR = 2000 // Delay after the doors are fully open.

let activeSession = null

function readMuted() {
  try {
    return window.localStorage.getItem(MUTED_KEY) === '1'
  } catch {
    return false
  }
}

function storeMuted(muted) {
  try {
    window.localStorage.setItem(MUTED_KEY, muted ? '1' : '0')
  } catch {
    // Audio controls should still work when storage is blocked.
  }
}

function isMobileViewport() {
  return window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches
}

function cancelFade(session) {
  if (!session.fadeRaf) return
  window.cancelAnimationFrame(session.fadeRaf)
  session.fadeRaf = 0
}

function easeOutCubic(progress) {
  const clamped = Math.max(0, Math.min(1, progress))
  return 1 - Math.pow(1 - clamped, 3)
}

function fadeVolume(session, target, duration) {
  session.targetVolume = target
  session.fadeDuration = duration
  cancelFade(session)

  if (!session.started || session.muted || session.destroyed) {
    if (session.muted && session.audio) session.setVolume(0)
    return
  }

  const audio = session.audio
  const from = audio.volume
  const startedAt = performance.now()
  const step = now => {
    if (session.destroyed || session.muted) return
    const progress = Math.min(1, (now - startedAt) / duration)
    const easedProgress = easeOutCubic(progress)
    session.setVolume(from + (target - from) * easedProgress)
    if (progress < 1) session.fadeRaf = window.requestAnimationFrame(step)
    else session.fadeRaf = 0
  }
  session.fadeRaf = window.requestAnimationFrame(step)
}

function removeInteractionListeners(session) {
  if (!session.onFirstInteraction) return
  window.removeEventListener('pointerdown', session.onFirstInteraction)
  window.removeEventListener('keydown', session.onFirstInteraction)
  window.removeEventListener('touchstart', session.onFirstInteraction)
  session.onFirstInteraction = null
}

function startPlayback(session) {
  if (session.playRequested || session.destroyed) return
  session.playRequested = true

  let playback
  try {
    playback = session.audio.play()
  } catch (error) {
    session.playRequested = false
    console.warn('Splash background music could not start.', error)
    return
  }

  Promise.resolve(playback).then(() => {
    if (session.destroyed) return
    session.started = true
    removeInteractionListeners(session)
    if (session.muted) {
      session.setVolume(0)
      return
    }
    fadeVolume(session, session.targetVolume, session.fadeDuration)
  }).catch(error => {
    session.playRequested = false
    console.warn('Splash background music could not start.', error)
  })
}

function createSession() {
  const mobileScale = isMobileViewport() ? MOBILE_VOLUME_SCALE : 1
  const audio = new Audio()
  const setVolume = value => {
    audio.volume = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
    console.log('[bgm] volume =', audio.volume)
  }
  const session = {
    audio,
    setVolume,
    owners: 0,
    subscribers: new Set(),
    muted: readMuted(),
    started: false,
    playRequested: false,
    destroyed: false,
    fadeRaf: 0,
    fadeDuration: FADE_IN_MS,
    targetVolume: DEFAULT_VOLUME * mobileScale,
    stopDelayTimer: 0,
    destroyTimer: 0,
    persistAfterUnmount: false,
    onFirstInteraction: null,
    onError: null,
  }

  audio.loop = true
  audio.preload = 'auto'
  setVolume(0)
  session.onError = () => console.warn('Splash background music failed to load or decode.')
  audio.addEventListener('error', session.onError)
  audio.src = BGM_SRC
  audio.load()

  session.onFirstInteraction = () => startPlayback(session)
  window.addEventListener('pointerdown', session.onFirstInteraction, { passive: true })
  window.addEventListener('keydown', session.onFirstInteraction)
  window.addEventListener('touchstart', session.onFirstInteraction, { passive: true })
  return session
}

function destroySession(session) {
  if (session.destroyed) return
  session.destroyed = true
  removeInteractionListeners(session)
  cancelFade(session)
  window.clearTimeout(session.stopDelayTimer)
  window.clearTimeout(session.destroyTimer)
  session.audio.removeEventListener('error', session.onError)
  session.setVolume(0)
  session.audio.pause()
  session.audio.currentTime = 0
  session.audio.src = ''
  session.audio.load()
  session.audio = null
  session.subscribers.clear()
  if (activeSession === session) activeSession = null
}

function acquireSession(subscriber) {
  const session = activeSession || createSession()
  activeSession = session
  session.owners += 1
  session.subscribers.add(subscriber)
  return session
}

function releaseSession(session, subscriber) {
  if (session.destroyed) return
  session.subscribers.delete(subscriber)
  session.owners = Math.max(0, session.owners - 1)
  if (session.owners === 0 && !session.persistAfterUnmount) destroySession(session)
}

function publishMuted(session) {
  session.subscribers.forEach(subscriber => subscriber(session.muted))
}

export function useBgm() {
  const sessionRef = useRef(null)
  const [muted, setMuted] = useState(readMuted)

  useEffect(() => {
    let session
    try {
      session = acquireSession(setMuted)
    } catch (error) {
      console.warn('Splash background music is unavailable.', error)
      return undefined
    }
    sessionRef.current = session
    setMuted(session.muted)
    return () => {
      sessionRef.current = null
      releaseSession(session, setMuted)
    }
  }, [])

  const toggleMuted = useCallback(() => {
    const session = sessionRef.current
    const nextMuted = !(session?.muted ?? readMuted())
    storeMuted(nextMuted)
    if (!session) {
      setMuted(nextMuted)
      return
    }

    session.muted = nextMuted
    if (nextMuted) {
      cancelFade(session)
      session.setVolume(0)
    } else if (session.started) {
      fadeVolume(session, session.targetVolume, 240)
    }
    publishMuted(session)
  }, [])

  const fadeOutAndStop = useCallback((delay, duration) => {
    const session = sessionRef.current
    if (!session || session.destroyed) return
    session.persistAfterUnmount = true
    window.clearTimeout(session.stopDelayTimer)
    window.clearTimeout(session.destroyTimer)
    session.stopDelayTimer = window.setTimeout(() => {
      session.stopDelayTimer = 0
      fadeVolume(session, 0, duration)
      session.destroyTimer = window.setTimeout(() => destroySession(session), duration)
    }, delay)
  }, [])

  const scheduleStopAfterDoor = useCallback(() => {
    fadeOutAndStop(BGM_STOP_DELAY_AFTER_DOOR, ENTRY_FADE_MS)
  }, [fadeOutAndStop])

  const skipAndStop = useCallback(() => {
    fadeOutAndStop(0, SKIP_FADE_MS)
  }, [fadeOutAndStop])

  const stop = useCallback(() => {
    const session = sessionRef.current
    if (!session || session.destroyed) return
    destroySession(session)
    sessionRef.current = null
  }, [])

  return { muted, toggleMuted, scheduleStopAfterDoor, skipAndStop, stop }
}

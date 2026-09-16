import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'

const Splash3D = lazy(() => import('./components/Splash'))
const SPLASH_KEY = 'splash_seen'
const LOAD_TIMEOUT_MS = 10_000
const SKIP_DELAY_MS = 2_000

function isMobileViewport() {
  return window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches
}

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!context) return false
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

function shouldPlaySplash() {
  // The welcome scene is intentionally replayed on every desktop page load.
  // The stored marker is retained for compatibility, but no longer blocks a refresh.
  return !isMobileViewport() && hasWebGL()
}

function SplashLoading({ onSkip, startedAt }) {
  const [canSkip, setCanSkip] = useState(() => performance.now() - startedAt >= SKIP_DELAY_MS)

  useEffect(() => {
    if (canSkip) return
    const remaining = Math.max(0, SKIP_DELAY_MS - (performance.now() - startedAt))
    const timer = window.setTimeout(() => setCanSkip(true), remaining)
    return () => window.clearTimeout(timer)
  }, [canSkip, startedAt])

  return <div className="splash-fallback" role="status" aria-live="polite">
    <span>正在点亮书房...</span>
    <span className="splash-fallback-bar" aria-hidden="true"><i /></span>
    {canSkip && <button type="button" onClick={onSkip}>跳过动画</button>}
  </div>
}

class SplashErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('3D splash failed to load.', error)
    this.props.onError()
  }

  render() {
    if (this.state.failed) return null
    return this.props.children
  }
}

export default function App({ NotesApp }) {
  const [showSplash, setShowSplash] = useState(shouldPlaySplash)
  const [showHandoff, setShowHandoff] = useState(false)
  const startedAtRef = useRef(performance.now())
  const loadTimerRef = useRef(0)
  const handoffTimerRef = useRef(0)

  const finishSplash = useCallback((options = {}) => {
    try {
      window.localStorage.setItem(SPLASH_KEY, '1')
    } catch {
      // The notes app must still open when storage is blocked.
    }
    window.clearTimeout(loadTimerRef.current)
    if (options.reveal) {
      setShowHandoff(true)
      handoffTimerRef.current = window.setTimeout(() => setShowHandoff(false), 720)
    }
    setShowSplash(false)
  }, [])

  const handleReady = useCallback(() => {
    window.clearTimeout(loadTimerRef.current)
  }, [])

  useEffect(() => {
    if (!showSplash) return
    loadTimerRef.current = window.setTimeout(finishSplash, LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(loadTimerRef.current)
  }, [finishSplash, showSplash])

  useEffect(() => () => window.clearTimeout(handoffTimerRef.current), [])

  const fallback = <SplashLoading onSkip={finishSplash} startedAt={startedAtRef.current} />
  const splashView = showSplash
    ? <SplashErrorBoundary onError={finishSplash}>
      <Suspense fallback={fallback}>
        <Splash3D
          onFinish={finishSplash}
          onReady={handleReady}
          startedAt={startedAtRef.current}
        />
      </Suspense>
    </SplashErrorBoundary>
    : <NotesApp />

  return <>
    {splashView}
    {!showSplash && showHandoff && <div className="splash-handoff" aria-hidden="true" />}
  </>
}

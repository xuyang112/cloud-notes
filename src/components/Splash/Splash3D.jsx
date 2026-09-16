import { useCallback, useEffect, useRef, useState } from 'react'
import { createSplashScene } from './scene'
import { useBgm } from './useBgm'
import './Splash3D.css'

const SKIP_DELAY_MS = 2000

export default function Splash3D({ onFinish, onReady, startedAt }) {
  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const rendererRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rafRef = useRef(0)
  const runtimeRef = useRef(null)
  const [quality, setQuality] = useState('high')
  const [ready, setReady] = useState(false)
  const [entering, setEntering] = useState(false)
  const [canSkip, setCanSkip] = useState(() => performance.now() - startedAt >= SKIP_DELAY_MS)
  const { muted, toggleMuted, scheduleStopAfterDoor, skipAndStop, stop } = useBgm()

  const handleEntering = useCallback(({ skipped = false } = {}) => {
    setEntering(true)
    if (skipped) skipAndStop()
  }, [skipAndStop])

  const handleFinish = useCallback((options = {}) => {
    if (!options.reveal) stop()
    onFinish?.(options)
  }, [onFinish, stop])

  useEffect(() => {
    if (canSkip) return undefined
    const remaining = Math.max(0, SKIP_DELAY_MS - (performance.now() - startedAt))
    const timer = window.setTimeout(() => setCanSkip(true), remaining)
    return () => window.clearTimeout(timer)
  }, [canSkip, startedAt])

  useEffect(() => {
    if (!stageRef.current) return undefined
    const canvas = document.createElement('canvas')
    canvas.className = 'splash-canvas'
    stageRef.current.appendChild(canvas)
    canvasRef.current = canvas
    let runtime
    try {
      runtime = createSplashScene({
        canvas,
        rendererRef,
        sceneRef,
        cameraRef,
        rafRef,
        onReady: () => {
          setReady(true)
          onReady?.()
        },
        onEntering: handleEntering,
        onDoorOpened: scheduleStopAfterDoor,
        onFinish: handleFinish,
      })
      runtimeRef.current = runtime
    } catch (error) {
      console.error('3D splash initialization failed.', error)
      window.cancelAnimationFrame(rafRef.current)
      rendererRef.current?.renderLists?.dispose?.()
      rendererRef.current?.dispose?.()
      rendererRef.current?.forceContextLoss?.()
      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      stop()
      onFinish?.()
    }
    return () => {
      runtimeRef.current = null
      runtime?.dispose()
      canvas.remove()
      canvasRef.current = null
    }
  }, [handleEntering, handleFinish, onFinish, onReady, scheduleStopAfterDoor, stop])

  const toggleQuality = () => {
    const next = quality === 'high' ? 'low' : 'high'
    runtimeRef.current?.setQuality(next)
    setQuality(next)
  }

  return <div className={'splash-root' + (ready ? ' is-ready' : '') + (entering ? ' is-entering' : '')} data-quality={quality}>
    <div
      className="splash-stage"
      ref={stageRef}
      tabIndex={0}
      aria-label="3D 玻璃书房开屏，点击书房进入笔记站"
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          runtimeRef.current?.enter(true)
        }
      }}
    />
    <div className="splash-hero" aria-hidden="true">
      <div className="splash-eyebrow">CANGXINGE</div>
      <h1>玻璃<b>书房</b></h1>
    </div>
    <div className="splash-hint" aria-hidden="true">
      <div className="splash-tip"><span className="splash-tip-dot" />拖拽环视 · 点击书房开门进入</div>
    </div>
    <div className="splash-ring" aria-hidden="true" />
    <button className="splash-control splash-quality" type="button" onClick={toggleQuality}>画质：{quality === 'high' ? '高' : '低'}</button>
    <div className="splash-controls-right">
      <button
        className="splash-control splash-mute"
        type="button"
        aria-label={muted ? '取消静音' : '静音背景音乐'}
        aria-pressed={muted}
        title={muted ? '取消静音' : '静音背景音乐'}
        onClick={toggleMuted}
      >{muted ? '🔇' : '🔊'}</button>
      {canSkip && <button className="splash-control splash-skip" type="button" onClick={() => runtimeRef.current?.skip()}>跳过动画</button>}
    </div>
    <div className="splash-flash" aria-hidden="true" />
    <div className={'splash-boot' + (ready ? ' is-gone' : '')} role="status" aria-live="polite">
      <span>正在点亮书房...</span>
      <span className="splash-boot-bar" aria-hidden="true"><i /></span>
    </div>
  </div>
}

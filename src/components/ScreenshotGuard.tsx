import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { screenshotDetector } from '../core/security/ScreenshotDetector'
import { antiRecordingModule } from '../core/webgpu/AntiRecording'
import { useStore } from '../store/useStore'

interface Props { children: ReactNode }

export function ScreenshotGuard({ children }: Props) {
  const [blurAmount, setBlurAmount] = useState(0)
  const isAuthenticated = useStore(s => s.isAuthenticated)
  const timerRef = useRef<number>(0)
  const idleRef = useRef<number>(0)

  const clearBlur = useCallback(() => {
    setBlurAmount(0)
    clearTimeout(timerRef.current)
    clearTimeout(idleRef.current)
    // After 3s idle, start blur
    idleRef.current = window.setTimeout(() => {
      // Gradual blur over 5s: increase blur step by step
      let step = 0
      const totalSteps = 10
      const stepInterval = 500 // 5s / 10 = 500ms per step
      const maxBlur = 12
      
      const doStep = () => {
        step++
        if (step >= totalSteps) {
          setBlurAmount(maxBlur)
          return
        }
        // Ease-in curve: blur grows faster near the end
        const progress = step / totalSteps
        const eased = progress * progress // quadratic ease-in
        setBlurAmount(Math.round(eased * maxBlur))
        timerRef.current = window.setTimeout(doStep, stepInterval)
      }
      timerRef.current = window.setTimeout(doStep, stepInterval)
    }, 3000)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    // Auto-blur on idle
    clearBlur()

    const resetEvents = ['mousemove', 'mousedown', 'click', 'touchstart', 'touchmove', 'scroll', 'keydown']
    for (const ev of resetEvents) {
      document.addEventListener(ev, clearBlur, { passive: true })
    }

    // Screenshot detection (instant blur)
    screenshotDetector.initialize()
    antiRecordingModule.startMonitoring()

    const instantBlur = () => {
      setBlurAmount(12)
      clearTimeout(timerRef.current)
      clearTimeout(idleRef.current)
      // After screenshot detected, stay blurred for 3s then resume normal cycle
      idleRef.current = window.setTimeout(clearBlur, 3000)
    }

    screenshotDetector.on('screenshot', instantBlur)
    screenshotDetector.on('screenrecord', instantBlur)
    antiRecordingModule.on('camera_detected', instantBlur)
    antiRecordingModule.on('recording_detected', instantBlur)
    antiRecordingModule.on('photo_suspected', instantBlur)

    return () => {
      clearTimeout(timerRef.current)
      clearTimeout(idleRef.current)
      for (const ev of resetEvents) {
        document.removeEventListener(ev, clearBlur)
      }
      screenshotDetector.destroy()
      antiRecordingModule.stopMonitoring()
    }
  }, [isAuthenticated, clearBlur])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{
        width: '100%', height: '100%',
        filter: blurAmount > 0 ? 'blur(' + blurAmount + 'px) brightness(' + (1 - blurAmount * 0.03) + ')' : 'none',
        transition: 'filter 0.3s ease-out',
        pointerEvents: 'auto',
      }}>
        {children}
      </div>
    </div>
  )
}

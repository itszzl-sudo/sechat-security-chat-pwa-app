import { useEffect, useRef, useState, type ReactNode } from 'react'
import { screenshotDetector } from '../core/security/ScreenshotDetector'
import { antiRecordingModule } from '../core/webgpu/AntiRecording'
import { useStore } from '../store/useStore'

interface Props { children: ReactNode }

export function ScreenshotGuard({ children }: Props) {
  const [isBlurred, setIsBlurred] = useState(false)
  const [showWarning, setShowWarning] = useState(false) // unused, kept for compat
  const screenshotProtection = useStore(s => s.screenshotProtection)
  const isAuthenticated = useStore(s => s.isAuthenticated)
  const blurTimeoutRef = useRef<number>()

  useEffect(() => {
    if (!screenshotProtection) return
    if (!isAuthenticated) return
    screenshotDetector.initialize()
    antiRecordingModule.startMonitoring()

    const handleSecurityEvent = () => {
      setIsBlurred(true)
      // setShowWarning(true)
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = window.setTimeout(() => {
        setIsBlurred(false)
        setShowWarning(false)
      }, 3000)
    }

    screenshotDetector.on('screenshot', handleSecurityEvent)
    screenshotDetector.on('screenrecord', handleSecurityEvent)

    antiRecordingModule.on('camera_detected', () => {
      handleSecurityEvent()
    })
    antiRecordingModule.on('recording_detected', () => {
      handleSecurityEvent()
    })
    antiRecordingModule.on('photo_suspected', () => {
      handleSecurityEvent()
    })

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && 
          (e.key === '3' || e.key === '4' || e.key === '5' || e.key === 'Print')) {
        handleSecurityEvent()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(blurTimeoutRef.current)
      screenshotDetector.destroy()
      antiRecordingModule.stopMonitoring()
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [screenshotProtection])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{
        width: '100%', height: '100%',
        filter: isBlurred && isAuthenticated ? 'blur(8px) brightness(0.6)' : 'none',
        transition: 'filter 0.3s ease-in-out'
      }}>
        {children}
      </div>
      
          </div>
  )
}

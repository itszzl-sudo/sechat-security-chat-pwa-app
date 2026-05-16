import { useEffect, useRef, useState, type ReactNode } from 'react'
import { screenshotDetector } from '../core/security/ScreenshotDetector'
import { antiRecordingModule } from '../core/webgpu/AntiRecording'
import { useStore } from '../store/useStore'

interface Props { children: ReactNode }

export function ScreenshotGuard({ children }: Props) {
  const [isBlurred, setIsBlurred] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const screenshotProtection = useStore(s => s.screenshotProtection)
  const blurTimeoutRef = useRef<number>()

  useEffect(() => {
    if (!screenshotProtection) return
    screenshotDetector.initialize()
    antiRecordingModule.startMonitoring()

    const handleSecurityEvent = () => {
      setIsBlurred(true)
      setShowWarning(true)
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
        filter: isBlurred ? 'blur(24px) brightness(0.2) saturate(0)' : 'none',
        transition: 'filter 0.3s ease-in-out'
      }}>
        {children}
      </div>
      
      {showWarning && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, pointerEvents: 'none'
        }}>
          <div style={{
            background: '#1a1a2e', border: '2px solid #e94560',
            borderRadius: 16, padding: '24px 32px',
            textAlign: 'center', color: '#fff',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
            <h2 style={{ margin: '0 0 8px', color: '#e94560' }}>📸 Screenshot Detected!</h2>
            <p style={{ margin: 0, color: '#8899aa', fontSize: 14 }}>
              Content automatically blurred by SeChat security
            </p>
            <div style={{ marginTop: 12, fontSize: 11, color: '#5a6a7a' }}>
              Anti-screenshot protection active
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

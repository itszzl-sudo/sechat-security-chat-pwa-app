export class AntiRecordingModule {
  private startupTime = 0
  private static instance: AntiRecordingModule
  private callbacks: Map<string, Array<() => void>> = new Map()
  private isMonitoring = false
  private luxReadings: number[] = []
  private motionData: { x: number; y: number; z: number; time: number }[] = []
  private mediaSessionCheckInterval: number = 0
  private ambientSensor: any = null
  private orientationListener: ((e: DeviceOrientationEvent) => void) | null = null
  private motionListener: ((e: DeviceMotionEvent) => void) | null = null
  private visibilityListener: (() => void) | null = null
  private perfCheckInterval: number = 0

  private constructor() {}

  static getInstance(): AntiRecordingModule {
    if (!AntiRecordingModule.instance) {
      AntiRecordingModule.instance = new AntiRecordingModule()
    }
    return AntiRecordingModule.instance
  }

  startMonitoring(): void {
    if (this.isMonitoring) return
    this.startupTime = Date.now()
    this.isMonitoring = true

    // 1. Monitor ambient light for sudden changes (camera flash/preparation)
    this.startLightMonitoring()

    // 2. Monitor device orientation for sustained portrait while app in use
    this.startOrientationMonitoring()

    // 3. Monitor motion patterns that suggest external camera
    this.startMotionMonitoring()

    // 4. Monitor performance for recording overhead
    this.startPerformanceMonitoring()

    // 5. Monitor audio session for recording indicators
    this.startAudioSessionMonitoring()

    // 6. Visibility change detection
    this.startVisibilityMonitoring()

    console.log('[AntiRecording] Monitoring started')
  }

  private startLightMonitoring(): void {
    // Try using AmbientLightSensor API (available in some Chromium variants)
    try {
      const AmbientLightSensor = (window as any).AmbientLightSensor
      if (AmbientLightSensor) {
        this.ambientSensor = new AmbientLightSensor()
        this.ambientSensor.addEventListener('reading', () => {
          const lux = this.ambientSensor.illuminance
          this.luxReadings.push(lux)
          if (this.luxReadings.length > 20) {
            this.luxReadings.shift()
          }
          this.analyzeLightPatterns()
        })
        this.ambientSensor.start()
      }
    } catch (err) {
      // AmbientLightSensor not available, use fallback
    }

    // Fallback: Use screen brightness as proxy
    if (!this.ambientSensor) {
      // Monitor screen visibility and surrounding light via a hidden sensor
      setInterval(() => {
        // Estimate based on time of day and screen brightness API if available
        const screen = (window as any).screen
        if (screen && screen.availBrightness !== undefined) {
          this.luxReadings.push(screen.availBrightness)
          if (this.luxReadings.length > 20) {
            this.luxReadings.shift()
          }
          this.analyzeLightPatterns()
        }
      }, 1000)
    }
  }

  private analyzeLightPatterns(): void {
    if (this.luxReadings.length < 5) return

    const recent = this.luxReadings.slice(-3)
    const older = this.luxReadings.slice(-6, -3)
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length

    // Detect sudden light spike (camera flash)
    if (olderAvg > 0 && recentAvg > olderAvg * 3) {
      console.warn('[AntiRecording] Camera flash detected via light sensor!')
      this.emit('photo_suspected')
    }

    // Detect rapid light oscillations (camera trying to focus)
    if (this.luxReadings.length >= 10) {
      let oscillations = 0
      for (let i = 2; i < this.luxReadings.length; i++) {
        const diff1 = this.luxReadings[i] - this.luxReadings[i - 1]
        const diff2 = this.luxReadings[i - 1] - this.luxReadings[i - 2]
        if (Math.abs(diff1) > 5 && Math.abs(diff2) > 5 && diff1 * diff2 < 0) {
          oscillations++
        }
      }
      if (oscillations >= 3) {
        console.warn('[AntiRecording] Light oscillations detected - possible camera')
        this.emit('camera_detected')
      }
    }
  }

  private startOrientationMonitoring(): void {
    if (!window.DeviceOrientationEvent) return

    this.orientationListener = (event: DeviceOrientationEvent) => {
      const alpha = event.alpha || 0
      const beta = event.beta || 0
      const gamma = event.gamma || 0

      // Detect if device is held in an unusual orientation (like lying flat for photographing)
      const isFlat = Math.abs(beta) < 15 || Math.abs(beta - 180) < 15
      if (isFlat) {
        // Device is flat on surface - possible someone is using another camera
        this.motionData.push({
          x: gamma, y: beta, z: alpha, time: Date.now()
        })
        if (this.motionData.length > 10) {
          this.motionData.shift()
        }

        // Check if device has been flat for a sustained period
        if (this.motionData.length >= 10) {
          const recent = this.motionData.slice(-5)
          const sustained = recent.every(
            d => Math.abs(d.y) < 15 || Math.abs(d.y - 180) < 15
          )
          if (sustained) {
            console.warn('[AntiRecording] Device flat - possible external camera capture')
            this.emit('camera_detected')
          }
        }
      }
    }

    window.addEventListener('deviceorientation', this.orientationListener)
  }

  private startMotionMonitoring(): void {
    if (!window.DeviceMotionEvent) return

    this.motionListener = (event: DeviceMotionEvent) => {
      const accel = event.accelerationIncludingGravity
      if (!accel) return

      const x = accel.x || 0
      const y = accel.y || 0
      const z = accel.z || 0

      // Detect steady hand holding (someone holding phone steady to photograph)
      const totalAccel = Math.sqrt(x * x + y * y + z * z)
      const isSteady = Math.abs(totalAccel - 9.8) < 0.5

      if (isSteady) {
        // Very steady device might indicate it's being held still for a photo
        console.warn('[AntiRecording] Unusually steady device - possible photo capture')
        this.emit('photo_suspected')
      }
    }

    window.addEventListener('devicemotion', this.motionListener)
  }

  private startPerformanceMonitoring(): void {
    let lastTime = performance.now()
    let frameDrops = 0
    let checkCount = 0

    this.perfCheckInterval = window.setInterval(() => {
      if (!this.isMonitoring) return

      const now = performance.now()
      const delta = now - lastTime
      lastTime = now

      // Check for consistent frame pacing that suggests recording overhead
      if (delta > 100) {
        frameDrops++
      }
      checkCount++

      if (checkCount >= 10) {
        const dropRate = frameDrops / checkCount

        // High frame drop rate might indicate recording software overhead
        if (dropRate > 0.3) {
          console.warn('[AntiRecording] High frame drop rate - possible screen recording')
          this.emit('recording_detected')
        }

        frameDrops = 0
        checkCount = 0
      }
    }, 200)
  }

  private startAudioSessionMonitoring(): void {
    // Check if there's an active audio recording session
    this.mediaSessionCheckInterval = window.setInterval(() => {
      if (!this.isMonitoring) return

      // Navigator.mediaDevices can detect if a media stream is active
      if (navigator.mediaDevices && (navigator.mediaDevices as any).enumerateDevices) {
        navigator.mediaDevices.enumerateDevices().then(devices => {
          const audioInputs = devices.filter(d => d.kind === 'audioinput')
          // If there are multiple audio inputs active, might indicate recording
          if (audioInputs.length > 1) {
            console.warn('[AntiRecording] Multiple audio inputs - possible recording')
          }
        }).catch(() => {})
      }
    }, 5000)
  }

  private startVisibilityMonitoring(): void {
    this.visibilityListener = () => {
      if (document.hidden) {
        console.warn('[AntiRecording] App went to background - possible screen switch')
      }
    }
    document.addEventListener('visibilitychange', this.visibilityListener)
  }

  on(event: 'camera_detected' | 'recording_detected' | 'photo_suspected', callback: () => void): void {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, [])
    }
    this.callbacks.get(event)!.push(callback)
  }

  private emit(event: string): void {
    const cbs = this.callbacks.get(event)
    if (cbs) {
      cbs.forEach(cb => {
        try { cb() } catch (err) { console.error('[AntiRecording] callback error:', err) }
      })
    }
  }

  stopMonitoring(): void {
    this.isMonitoring = false

    if (this.ambientSensor) {
      try { this.ambientSensor.stop() } catch {}
      this.ambientSensor = null
    }

    if (this.orientationListener) {
      window.removeEventListener('deviceorientation', this.orientationListener)
      this.orientationListener = null
    }

    if (this.motionListener) {
      window.removeEventListener('devicemotion', this.motionListener)
      this.motionListener = null
    }

    if (this.perfCheckInterval) {
      clearInterval(this.perfCheckInterval)
      this.perfCheckInterval = 0
    }

    if (this.mediaSessionCheckInterval) {
      clearInterval(this.mediaSessionCheckInterval)
      this.mediaSessionCheckInterval = 0
    }

    if (this.visibilityListener) {
      document.removeEventListener('visibilitychange', this.visibilityListener)
      this.visibilityListener = null
    }

    this.luxReadings = []
    this.motionData = []

    console.log('[AntiRecording] Monitoring stopped')
  }

  destroy(): void {
    this.stopMonitoring()
    this.callbacks.clear()
  }
}

export const antiRecordingModule = AntiRecordingModule.getInstance()

export type SecurityEvent = 'screenshot' | 'screenrecord' | 'screenmirror' | 'unknown'

export class ScreenshotDetector {
  private callbacks: Map<string, Array<(event: SecurityEvent) => void>> = new Map()
  private isSecureMode = true
  private blurTimestamp = 0
  private static instance: ScreenshotDetector

  static getInstance(): ScreenshotDetector {
    if (!ScreenshotDetector.instance) {
      ScreenshotDetector.instance = new ScreenshotDetector()
    }
    return ScreenshotDetector.instance
  }

  initialize(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.blurTimestamp = Date.now()
        this.emit('screenshot')
      } else {
        const elapsed = Date.now() - this.blurTimestamp
        if (elapsed < 500 && elapsed > 50) this.emit('screenshot')
      }
    })

    window.addEventListener('blur', () => {
      this.blurTimestamp = Date.now()
      this.emit('screenshot')
    })

    try {
      const mq = window.matchMedia('(display-mode: standalone)')
      mq.addEventListener('change', () => this.emit('screenrecord'))
    } catch {}

    this.monitorScreenRecording()
    this.monitorVolumeButtons()

    document.addEventListener('contextmenu', (e) => e.preventDefault())
    document.addEventListener('copy', (e) => {
      if (this.isSecureMode) { e.preventDefault(); this.emit('screenshot') }
    })

    this.detectDevTools()
  }

  private monitorScreenRecording(): void {
    let lastTime = performance.now()
    setInterval(() => {
      const now = performance.now()
      lastTime = now
    }, 500)
  }

  private monitorVolumeButtons(): void {
    let lastVolumePress = 0
    document.addEventListener('volumechange', () => {
      const now = Date.now()
      if (now - lastVolumePress < 300) this.emit('screenshot')
      lastVolumePress = now
    })
  }

  private detectDevTools(): void {
    const element = new Image()
    Object.defineProperty(element, 'id', {
      get: () => { this.emit('screenshot'); return 'devtools-detected' }
    })
    console.log('%c', element)
  }

  on(event: string, callback: (event: SecurityEvent) => void): void {
    if (!this.callbacks.has(event)) this.callbacks.set(event, [])
    this.callbacks.get(event)!.push(callback)
  }

  private emit(event: SecurityEvent): void {
    this.callbacks.forEach((cbs) => cbs.forEach(cb => cb(event)))
  }

  setSecureMode(mode: boolean) { this.isSecureMode = mode }
  destroy() { this.callbacks.clear() }
}

export const screenshotDetector = ScreenshotDetector.getInstance()

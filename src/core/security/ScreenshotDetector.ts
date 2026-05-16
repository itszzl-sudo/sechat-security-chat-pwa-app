export type SecurityEvent = 'screenshot' | 'screenrecord' | 'screenmirror' | 'unknown'

export class ScreenshotDetector {
  private startupTime = 0
  private callbacks: Map<string, Array<(event: SecurityEvent) => void>> = new Map()
  private isSecureMode = true
  private blurTimestamp = 0
  private lastEmitTime = 0
  private cooldownMs = 2000
  private consecutiveBlurs = 0
  private isDesktop = false
  private static instance: ScreenshotDetector

  static getInstance(): ScreenshotDetector {
    if (!ScreenshotDetector.instance) {
      ScreenshotDetector.instance = new ScreenshotDetector()
    }
    return ScreenshotDetector.instance
  }

  initialize(): void {
    this.startupTime = Date.now()
    // Detect if running on desktop (not mobile PWA)
    this.isDesktop = !window.matchMedia('(display-mode: standalone)').matches
      && !('ontouchstart' in window)
      && navigator.maxTouchPoints <= 1

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.blurTimestamp = Date.now()
        // Don't emit immediately on hide — wait for return
      } else {
        const elapsed = Date.now() - this.blurTimestamp
        // Suspicious: very quick hide+show (< 500ms) could be screenshot
        // Normal tab switch is usually > 1000ms
        if (elapsed > 50 && elapsed < 500 && !this.isDesktop) {
          this.emit('screenshot')
        }
      }
    })

    // Desktop: higher threshold, only detect sustained absence + quick return
    window.addEventListener('blur', () => {
      this.blurTimestamp = Date.now()
      this.consecutiveBlurs++
      // Reset counter after 10 seconds of no blurs
      setTimeout(() => { this.consecutiveBlurs = Math.max(0, this.consecutiveBlurs - 1) }, 10000)
    })

    window.addEventListener('focus', () => {
      const elapsed = Date.now() - this.blurTimestamp
      // Desktop: only trigger if focus returns very quickly (< 300ms) AND has history of blurs
      // This catches Cmd+Shift+3/4 screenshot shortcuts without catching normal alt-tab
      if (elapsed > 30 && elapsed < 300 && this.consecutiveBlurs > 2) {
        this.emit('screenshot')
      }
    })

    // DevTools detection: less aggressive
    this.detectDevTools()

    // Copy prevention (don't emit screenshot for copy)
    document.addEventListener('copy', (e) => {
      if (this.isSecureMode) e.preventDefault()
    })

    // Context menu prevention
    document.addEventListener('contextmenu', (e) => e.preventDefault())

    // Desktop screenshot key combos only
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        // Cmd/Ctrl + Shift + 3/4/5 = macOS screenshot
        // Windows + Shift + S = Windows screenshot
        if (e.shiftKey && ['3', '4', '5'].includes(e.key)) {
          this.blurTimestamp = Date.now()
          setTimeout(() => {
            if (Date.now() - this.blurTimestamp < 1000) this.emit('screenshot')
          }, 100)
        }
      }
    })
  }

  private detectDevTools(): void {
    // Use a less aggressive method that only triggers when DevTools is actually open
    let devToolsOpen = false
    const check = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > 160
      const heightThreshold = window.outerHeight - window.innerHeight > 160
      const wasOpen = devToolsOpen
      devToolsOpen = widthThreshold || heightThreshold
      if (devToolsOpen && !wasOpen) {
        this.emit('screenshot')
      }
    }
    setInterval(check, 2000)
  }

  private emit(event: SecurityEvent): void {
    // Startup grace period: ignore events for first 3 seconds
    if (Date.now() - this.startupTime < 3000) return
    // Cooldown: don't emit more than once every 2 seconds
    const now = Date.now()
    if (now - this.lastEmitTime < this.cooldownMs) return
    this.lastEmitTime = now

    this.callbacks.forEach((cbs) => cbs.forEach(cb => cb(event)))
  }

  on(event: string, callback: (event: SecurityEvent) => void): void {
    if (!this.callbacks.has(event)) this.callbacks.set(event, [])
    this.callbacks.get(event)!.push(callback)
  }

  setSecureMode(mode: boolean) { this.isSecureMode = mode }
  destroy() { this.callbacks.clear() }
}

export const screenshotDetector = ScreenshotDetector.getInstance()

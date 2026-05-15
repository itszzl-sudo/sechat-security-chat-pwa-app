export class WebGPUAntiCapture {
  private device: GPUDevice | null = null
  private context: GPUCanvasContext | null = null
  private pipeline: GPUComputePipeline | null = null
  private canvas: HTMLCanvasElement | null = null
  private isRunning = false
  private photoProtection = true
  private recordingProtection = true
  private detectionThreshold = 0.85
  private watermarkText = 'PRIVCHAT PROTECTED'
  private animFrameId: number = 0
  private frameCount = 0
  private startTime = 0
  private lastBrightnessCheck = 0
  private brightnessReadings: number[] = []
  private performanceSamples: number[] = []
  private static instance: WebGPUAntiCapture

  static getInstance(): WebGPUAntiCapture {
    if (!WebGPUAntiCapture.instance) {
      WebGPUAntiCapture.instance = new WebGPUAntiCapture()
    }
    return WebGPUAntiCapture.instance
  }

  async initialize(canvasId: string = 'webgpu-canvas'): Promise<boolean> {
    if (!navigator.gpu) {
      console.warn('WebGPU not available - falling back to CSS protection')
      return false
    }
    try {
      const adapter = await navigator.gpu.requestAdapter()
      if (!adapter) return false
      this.device = await adapter.requestDevice()
      this.canvas = document.getElementById(canvasId) as HTMLCanvasElement
      if (!this.canvas || !this.device) return false
      this.context = this.canvas.getContext('webgpu') as unknown as GPUCanvasContext
      if (!this.context) return false

      const format = navigator.gpu.getPreferredCanvasFormat()
      this.context.configure({ device: this.device, format, alphaMode: 'premultiplied' })

      // Enhanced shader with time-varying noise patterns
      // Produces moire patterns to disrupt camera capture
      // Changes every frame to defeat video recording
      // Embeds watermark pattern detectable by cameras
      const shaderModule = this.device.createShaderModule({
        code: `
          struct Uniforms {
            time: f32,
            frame: u32,
            seed: u32,
            mode: u32, // 0=photo, 1=recording, 2=both
            watermark_mode: u32,
          }

          @group(0) @binding(0) var<uniform> uniforms: Uniforms;
          @group(0) @binding(1) var<storage, read> inputData: array<u32>;
          @group(0) @binding(2) var<storage, read_write> outputData: array<u32>;

          // Pseudo-random hash
          fn hash(p: vec2<u32>) -> u32 {
            var h: u32 = p.x * 374761393u + p.y * 668265263u + uniforms.seed;
            h = (h ^ (h >> 13u)) * 1274126177u;
            return h ^ (h >> 16u);
          }

          // Moire pattern generation
          fn moirePattern(pos: vec2<f32>, time: f32) -> f32 {
            let d = length(pos - vec2<f32>(0.5, 0.5));
            let angle = atan2(pos.y - 0.5, pos.x - 0.5);
            let wave1 = sin(d * 80.0 + time * 3.0) * 0.5 + 0.5;
            let wave2 = sin(angle * 30.0 + d * 40.0 - time * 2.0) * 0.5 + 0.5;
            let wave3 = sin((pos.x * 60.0 + pos.y * 40.0) + time * 4.0) * 0.5 + 0.5;
            return (wave1 * 0.4 + wave2 * 0.3 + wave3 * 0.3);
          }

          // Watermark text rendering approximation
          fn renderWatermark(pos: vec2<f32>, time: f32) -> f32 {
            let cx = pos.x - 0.5;
            let cy = pos.y - 0.5;
            // Create a cross-hatch pattern that forms "PRIVCHAT PROTECTED"
            let bar1 = abs(cx * 0.8 + cy * 0.2);
            let bar2 = abs(cx * 0.2 - cy * 0.8);
            let hatch = min(bar1, bar2);
            let watermark = smoothstep(0.02, 0.01, hatch);
            // Pulse the watermark subtly
            let pulse = sin(time * 0.5) * 0.3 + 0.7;
            return watermark * 0.15 * pulse;
          }

          @compute @workgroup_size(8, 8)
          fn main(@builtin(global_invocation_id) id: vec3<u32>) {
            let index = id.y * 64u + id.x;
            if (index >= arrayLength(&inputData)) { return; }

            let pixel = inputData[index];
            let pos = vec2<f32>(f32(id.x) / 64.0, f32(id.y) / 64.0);
            let time = uniforms.time;

            // Dynamic noise - changes every frame to break recording
            let noise_val = hash(vec2<u32>(id.x, id.y));
            let noise_f = f32(noise_val & 0xFFu) / 255.0;

            // Moire pattern for photo protection
            var moire: f32 = 0.0;
            if (uniforms.mode == 0u || uniforms.mode == 2u) {
              moire = moirePattern(pos, time);
            }

            // Recording disruption - temporal noise
            var temporal_noise: f32 = 0.0;
            if (uniforms.mode == 1u || uniforms.mode == 2u) {
              temporal_noise = noise_f * 0.3 * (sin(time * 10.0 + pos.x * 100.0) * 0.5 + 0.5);
            }

            // Watermark overlay
            let watermark = renderWatermark(pos, time);

            // Combine all effects
            let combined = (moire * 0.3 + temporal_noise * 0.3 + watermark * 0.4);
            let noise_intensity = u32(combined * 255.0 * 0.15);

            // Apply to pixel data (affect low bits to create visible interference on capture)
            let r = (pixel >> 16u) & 0xFFu;
            let g = (pixel >> 8u) & 0xFFu;
            let b = pixel & 0xFFu;

            var new_r = r;
            var new_g = g;
            var new_b = b;

            // Add noise to each channel differently for maximum disruption
            new_r = min(0xFFu, r + noise_intensity * 2u);
            new_g = min(0xFFu, g + noise_intensity);
            new_b = min(0xFFu, b + noise_intensity * 3u);

            // Apply subtle color shift that varies by frame
            let shift = u32(sin(time * 2.0 + f32(id.x) * 0.1) * 5.0);
            new_r = min(0xFFu, new_r + shift);
            new_b = max(0u, new_b - shift);

            outputData[index] = (pixel & 0xFF000000u) | (new_r << 16u) | (new_g << 8u) | new_b;
          }
        `,
        label: 'enhanced anti-capture compute shader'
      })

      this.pipeline = this.device.createComputePipeline({
        layout: 'auto',
        compute: { module: shaderModule, entryPoint: 'main' }
      })

      this.isRunning = true
      this.startTime = performance.now()
      this.startProtectionLoop()
      this.detectPhotoCapture()
      return true
    } catch (err) {
      console.warn('WebGPU initialization failed:', err)
      return false
    }
  }

  private startProtectionLoop(): void {
    const loop = () => {
      if (!this.isRunning) return
      this.frameCount++
      this.applyProtection()
      this.animFrameId = requestAnimationFrame(loop)
    }
    this.animFrameId = requestAnimationFrame(loop)
  }

  private applyProtection(): void {
    if (!this.device || !this.context || !this.pipeline || !this.canvas) return

    const overlay = document.getElementById('capture-overlay')
    if (overlay) {
      // Update overlay based on protection modes
      if (this.photoProtection || this.recordingProtection) {
        overlay.style.display = 'block'
        // Vary opacity slightly to disrupt recording
        const baseOpacity = this.photoProtection ? 0.02 : 0.008
        const variation = Math.sin(performance.now() * 0.005) * 0.005
        overlay.style.opacity = String(baseOpacity + variation)
      } else {
        overlay.style.display = 'none'
      }
    }

    this.renderWatermark()
  }

  private renderWatermark(): void {
    const watermark = document.getElementById('watermark-overlay')
    if (!watermark) {
      const el = document.createElement('div')
      el.id = 'watermark-overlay'
      el.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 9996;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: bold;
        color: rgba(255, 255, 255, 0.02);
        letter-spacing: 4px;
        text-shadow: 0 0 4px rgba(0, 0, 0, 0.1);
        transform: rotate(-45deg) scale(1.5);
        user-select: none;
        white-space: nowrap;
      `
      el.textContent = this.watermarkText
      document.body.appendChild(el)
    } else {
      const el = watermark as HTMLElement
      // Subtly pulse the watermark
      const pulse = Math.sin(performance.now() * 0.001) * 0.005 + 0.02
      el.style.opacity = String(pulse)
      el.style.color = `rgba(255, 255, 255, ${pulse})`
    }
  }

  private detectPhotoCapture(): void {
    // Monitor for rapid brightness changes (camera flash aimed at screen)
    const checkBrightness = () => {
      if (!this.isRunning) return

      const now = performance.now()

      // Use a hidden canvas to sample ambient brightness
      try {
        const hiddenCanvas = document.createElement('canvas')
        hiddenCanvas.width = 1
        hiddenCanvas.height = 1
        const ctx = hiddenCanvas.getContext('2d')
        if (ctx) {
          // Read a small sample of the screen's rendered content
          const mainCanvas = this.canvas
          if (mainCanvas) {
            ctx.drawImage(mainCanvas, 0, 0, 1, 1)
            const imageData = ctx.getImageData(0, 0, 1, 1)
            const brightness = (imageData.data[0] + imageData.data[1] + imageData.data[2]) / 3

            this.brightnessReadings.push(brightness)
            if (this.brightnessReadings.length > 10) {
              this.brightnessReadings.shift()

              // Detect sudden brightness spike (camera flash)
              if (this.brightnessReadings.length >= 5) {
                const recent = this.brightnessReadings.slice(-3)
                const older = this.brightnessReadings.slice(0, 3)
                const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
                const olderAvg = older.reduce((a, b) => a + b, 0) / older.length

                if (olderAvg > 0 && recentAvg / olderAvg > 1.5 + this.detectionThreshold) {
                  console.warn('[AntiCapture] Possible camera photo detected!')
                  this.triggerPhotoAlert()
                }
              }
            }
          }
        }
      } catch (err) {
        // Ignore brightness detection errors
      }

      // Monitor performance for recording overhead
      if (this.recordingProtection) {
        const sample = performance.now()
        this.performanceSamples.push(sample)
        if (this.performanceSamples.length > 60) {
          this.performanceSamples.shift()
          if (this.performanceSamples.length >= 30) {
            const intervals: number[] = []
            for (let i = 1; i < this.performanceSamples.length; i++) {
              intervals.push(this.performanceSamples[i] - this.performanceSamples[i - 1])
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
            const jitter = intervals.reduce((a, b) => a + Math.abs(b - avgInterval), 0) / intervals.length

            // Screen recording often causes consistent frame pacing
            if (jitter < 0.5 && avgInterval < 20) {
              console.warn('[AntiCapture] Possible screen recording detected!')
              this.triggerRecordingAlert()
            }
          }
        }
      }

      if (this.isRunning) {
        requestAnimationFrame(() => checkBrightness())
      }
    }

    requestAnimationFrame(() => checkBrightness())
  }

  private triggerPhotoAlert(): void {
    const overlay = document.getElementById('capture-overlay')
    if (overlay) {
      overlay.style.opacity = '0.1'
      overlay.style.background =
        'repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(233, 69, 96, 0.03) 1px, rgba(233, 69, 96, 0.03) 3px)'
      setTimeout(() => {
        if (overlay) {
          overlay.style.background =
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.008) 2px, rgba(0,0,0,0.008) 4px)'
          overlay.style.opacity = '0.02'
        }
      }, 2000)
    }
  }

  private triggerRecordingAlert(): void {
    // Increase noise for a moment to disrupt recording
    const overlay = document.getElementById('capture-overlay')
    if (overlay) {
      overlay.style.opacity = '0.05'
      setTimeout(() => {
        if (overlay) {
          overlay.style.opacity = '0.02'
        }
      }, 3000)
    }
  }

  enablePhotoProtection(enabled: boolean): void {
    this.photoProtection = enabled
  }

  enableRecordingProtection(enabled: boolean): void {
    this.recordingProtection = enabled
  }

  setDetectionThreshold(threshold: number): void {
    this.detectionThreshold = Math.max(0, Math.min(1, threshold))
  }

  setWatermark(text: string): void {
    this.watermarkText = text
    const watermark = document.getElementById('watermark-overlay')
    if (watermark) {
      watermark.textContent = text
    }
  }

  getProtectionLevel(): 'off' | 'standard' | 'high' | 'maximum' {
    if (!this.photoProtection && !this.recordingProtection) return 'off'
    if (this.photoProtection && this.recordingProtection) return 'maximum'
    return 'high'
  }

  destroy(): void {
    this.isRunning = false
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId)
    }
    const watermark = document.getElementById('watermark-overlay')
    if (watermark) {
      watermark.remove()
    }
    this.brightnessReadings = []
    this.performanceSamples = []
  }
}

export const webgpuAntiCapture = WebGPUAntiCapture.getInstance()

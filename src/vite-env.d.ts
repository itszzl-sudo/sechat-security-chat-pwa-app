/// <reference types="vite/client" />

interface Navigator {
  gpu?: {
    requestAdapter(): Promise<GPUAdapter | null>
    getPreferredCanvasFormat(): GPUTextureFormat
  }
}

interface GPUAdapter { requestDevice(): Promise<GPUDevice> }

interface GPUDevice {
  createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule
  createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline
  createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer
  createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout
  createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup
  createCommandEncoder(): GPUCommandEncoder
  queue: GPUQueue
}

interface GPUShaderModule { label?: string }
interface GPUComputePipeline { label?: string; getBindGroupLayout(index: number): GPUBindGroupLayout }
interface GPUCanvasContext { configure(configuration: GPUCanvasConfiguration): void; getCurrentTexture(): GPUTexture }
interface GPUCanvasConfiguration { device: GPUDevice; format: GPUTextureFormat; alphaMode: GPUTextureAlphaMode }
type GPUTextureFormat = string
type GPUTextureAlphaMode = 'premultiplied' | 'opaque'
interface GPUShaderModuleDescriptor { code: string; label?: string }
interface GPUComputePipelineDescriptor { layout: GPUAutoLayoutMode | GPUPipelineLayout; compute: GPUProgrammableStage }
type GPUAutoLayoutMode = 'auto'
interface GPUProgrammableStage { module: GPUShaderModule; entryPoint: string }
interface GPUBufferDescriptor { size: number; usage: GPUBufferUsageFlags; mappedAtCreation?: boolean }
interface GPUBindGroupLayoutDescriptor { entries: GPUBindGroupLayoutEntry[]; label?: string }
interface GPUBindGroupLayoutEntry { binding: number; visibility: GPUShaderStageFlags; buffer?: GPUBufferBindingLayout; texture?: GPUTextureBindingLayout; sampler?: GPUSamplerBindingLayout }
interface GPUBindGroupDescriptor { layout: GPUBindGroupLayout; entries: GPUBindGroupEntry[]; label?: string }
interface GPUBindGroupEntry { binding: number; resource: GPUBindingResource }
type GPUBindingResource = GPUBufferBinding | GPUTextureView
interface GPUBufferBinding { buffer: GPUBuffer; offset?: number; size?: number }
interface GPUCommandEncoder { beginComputePass(): GPUComputePassEncoder; finish(): GPUCommandBuffer }
interface GPUComputePassEncoder { setPipeline(pipeline: GPUComputePipeline): void; setBindGroup(index: number, bindGroup: GPUBindGroup): void; dispatchWorkgroups(x: number, y?: number, z?: number): void; end(): void }
interface GPUCommandBuffer {}
interface GPUQueue { submit(commandBuffers: GPUCommandBuffer[]): void; writeBuffer(buffer: GPUBuffer, bufferOffset: number, data: BufferSource, dataOffset?: number, size?: number): void }

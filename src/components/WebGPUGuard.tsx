import { useEffect, type ReactNode } from "react";
import { webgpuAntiCapture } from "../core/webgpu/AntiScreenCapture";
import { useStore } from "../store/useStore";

interface Props {
  children: ReactNode;
}

export function WebGPUGuard({ children }: Props) {
  const webgpuProtection = useStore((s) => s.webgpuProtection);

  useEffect(() => {
    if (!webgpuProtection) return;
    const init = async () => {
      const supported = await webgpuAntiCapture.initialize("webgpu-canvas");
      if (supported) {
        webgpuAntiCapture.enablePhotoProtection(true);
        webgpuAntiCapture.enableRecordingProtection(true);
      }
    };
    init();
    return () => {
      webgpuAntiCapture.destroy();
    };
  }, [webgpuProtection]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas
        id="webgpu-canvas"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          opacity: 0.015,
          zIndex: 9998,
          mixBlendMode: "difference",
        }}
      />
      <div
        id="capture-overlay"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          zIndex: 9997,
          display: "none",
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.008) 2px, rgba(0,0,0,0.008) 4px)",
          mixBlendMode: "overlay",
        }}
      />
      {children}
    </div>
  );
}

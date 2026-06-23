// 3D / AR Product Viewer — powered by @google/model-viewer
// Supports WebXR (Android), Quick Look (iOS), and desktop 3D orbit
// Loads the model-viewer web component from CDN on first use.

import { useEffect, useRef, useState } from "react";
import { Box, RotateCcw, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Extend JSX to recognise the <model-viewer> custom element
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "model-viewer": any;
    }
  }
}

const MODEL_VIEWER_CDN =
  "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";

function loadModelViewerScript(): Promise<void> {
  return new Promise((resolve) => {
    if (document.getElementById("mv-script")) { resolve(); return; }
    const s = document.createElement("script");
    s.id = "mv-script";
    s.type = "module";
    s.src = MODEL_VIEWER_CDN;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

interface ProductModelViewerProps {
  modelUrl: string;
  productName: string;
  posterUrl?: string; // optional thumbnail shown while model loads
  className?: string;
}

export const ProductModelViewer = ({
  modelUrl,
  productName,
  posterUrl,
  className,
}: ProductModelViewerProps) => {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const mvRef = useRef<HTMLElement>(null);

  useEffect(() => {
    loadModelViewerScript().then(() => setReady(true));
  }, []);

  const handleReset = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mvRef.current as any)?.resetTurntableRotation?.();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mvRef.current as any)?.jumpCameraToGoal?.();
  };

  return (
    <div
      className={cn(
        "relative w-full aspect-square rounded-xl overflow-hidden bg-muted/30 border border-border",
        className
      )}
    >
      {/* Loading skeleton */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 pointer-events-none">
          <Box className="h-10 w-10 text-muted-foreground/40 animate-pulse" />
          <p className="text-xs text-muted-foreground">Loading 3D model…</p>
        </div>
      )}

      {ready && (
        // @ts-expect-error model-viewer is a custom element
        <model-viewer
          ref={mvRef}
          src={modelUrl}
          alt={`3D model of ${productName}`}
          poster={posterUrl}
          ar
          ar-modes="webxr scene-viewer quick-look"
          camera-controls
          auto-rotate
          auto-rotate-delay="500"
          rotation-per-second="30deg"
          shadow-intensity="1"
          shadow-softness="0.8"
          environment-image="neutral"
          exposure="0.9"
          style={{ width: "100%", height: "100%", background: "transparent" }}
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
        >
          {/* AR button — shows on supported mobile browsers */}
          <Button
            slot="ar-button"
            size="sm"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 gap-1.5 shadow-elevated z-20 text-xs"
            variant="hero"
          >
            <Box className="h-3.5 w-3.5" />
            View in AR
          </Button>
        </model-viewer>
      )}

      {/* Reset camera button */}
      {ready && !loading && (
        <button
          onClick={handleReset}
          title="Reset camera"
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-20"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Fullscreen hint */}
      {ready && !loading && (
        <div className="absolute bottom-14 right-3 flex items-center gap-1 text-[10px] text-muted-foreground bg-background/70 backdrop-blur-sm px-2 py-1 rounded-full border border-border z-20">
          <Maximize2 className="h-2.5 w-2.5" />
          Drag to orbit · Scroll to zoom
        </div>
      )}
    </div>
  );
};

import { useEffect, useCallback, useState, useRef } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  images: string[];
  startIndex?: number;
  productName?: string;
  onClose: () => void;
}

export const ImageLightbox = ({ images, startIndex = 0, productName = "", onClose }: Props) => {
  const [idx, setIdx] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const touchStart = useRef<{ x: number; y: number; dist?: number } | null>(null);

  const prev = useCallback(() => {
    setIdx((i) => (i - 1 + images.length) % images.length);
    setZoom(1); setPan({ x: 0, y: 0 });
  }, [images.length]);

  const next = useCallback(() => {
    setIdx((i) => (i + 1) % images.length);
    setZoom(1); setPan({ x: 0, y: 0 });
  }, [images.length]);

  const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "+") setZoom((z) => Math.min(z + 0.5, 4));
      if (e.key === "-") setZoom((z) => Math.max(z - 0.5, 1));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose, prev, next]);

  // Mouse drag to pan when zoomed
  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart.current) return;
    setPan({ x: dragStart.current.px + e.clientX - dragStart.current.x, y: dragStart.current.py + e.clientY - dragStart.current.y });
  };
  const onMouseUp = () => { setIsDragging(false); dragStart.current = null; };

  // Touch swipe + pinch zoom
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      touchStart.current = { x: 0, y: 0, dist };
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStart.current.y);
    if (Math.abs(dx) > 50 && dy < 60 && zoom <= 1) { dx < 0 ? next() : prev(); }
    touchStart.current = null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStart.current?.dist != null) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const scale = dist / touchStart.current.dist;
      setZoom((z) => Math.min(Math.max(z * scale, 1), 4));
      touchStart.current.dist = dist;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ background: "rgba(0,0,0,0.95)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: "rgba(0,0,0,0.6)" }}>
        <div className="text-white/70 text-sm truncate max-w-[60%]">{productName}</div>
        <div className="flex items-center gap-1">
          <span className="text-white/50 text-xs mr-2">{idx + 1} / {images.length}</span>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => setZoom((z) => Math.max(z - 0.5, 1))} disabled={zoom <= 1}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-white/70 text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => setZoom((z) => Math.min(z + 0.5, 4))} disabled={zoom >= 4}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          {zoom > 1 && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/10" onClick={resetZoom}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/10 ml-1" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Main image */}
      <div
        className="flex-1 relative overflow-hidden flex items-center justify-center select-none"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchMove}
        style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
      >
        <img
          src={images[idx]}
          alt={productName}
          draggable={false}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transition: isDragging ? "none" : "transform 0.2s ease",
            userSelect: "none",
          }}
        />

        {/* Prev / Next */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full flex items-center justify-center text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)" }}
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full flex items-center justify-center text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)" }}
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="shrink-0 flex gap-2 overflow-x-auto px-4 py-3 justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          {images.map((url, i) => (
            <button
              key={i}
              onClick={() => { setIdx(i); resetZoom(); }}
              className="shrink-0 h-14 w-14 rounded-lg overflow-hidden transition-all"
              style={{
                border: i === idx ? "2px solid white" : "2px solid transparent",
                opacity: i === idx ? 1 : 0.55,
              }}
              aria-label={`Image ${i + 1}`}
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

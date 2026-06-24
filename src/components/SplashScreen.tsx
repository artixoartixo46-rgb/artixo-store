import { useEffect, useRef, useState } from "react";

/**
 * SplashScreen — plays intro.mp4 once per session.
 * After the video ends (or user taps/clicks), fades out and unmounts.
 */
export const SplashScreen = ({ onDone }: { onDone: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fading, setFading] = useState(false);

  const finish = () => {
    if (fading) return;
    setFading(true);
    // wait for CSS fade-out (600ms) then call onDone
    setTimeout(onDone, 600);
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // Auto-play muted (browsers allow muted autoplay)
    v.muted = true;
    v.play().catch(() => {
      // If autoplay blocked for any reason, skip after 1 second
      setTimeout(finish, 1000);
    });

    v.addEventListener("ended", finish);

    // Safety timeout — if video somehow hangs, skip after 12s
    const safetyTimer = setTimeout(finish, 12000);

    return () => {
      v.removeEventListener("ended", finish);
      clearTimeout(safetyTimer);
    };
  }, []);

  return (
    <div
      onClick={finish}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#f0f0f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "opacity 0.6s ease",
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <video
        ref={videoRef}
        src="/intro.mp4"
        playsInline
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      {/* Skip hint */}
      <div
        style={{
          position: "absolute",
          bottom: "28px",
          right: "24px",
          color: "rgba(0,0,0,0.45)",
          fontSize: "13px",
          fontFamily: "sans-serif",
          letterSpacing: "0.5px",
          userSelect: "none",
        }}
      >
        Tap to skip ›
      </div>
    </div>
  );
};

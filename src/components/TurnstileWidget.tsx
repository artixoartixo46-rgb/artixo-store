// Cloudflare Turnstile — invisible/managed bot protection widget
// Docs: https://developers.cloudflare.com/turnstile/
//
// Test keys (always pass — replace with real keys from Cloudflare dashboard):
//   Site key:   1x00000000000000000000AA
//   Secret key: 1x0000000000000000000000000000000AA

import { useEffect, useId, useRef } from "react";

const SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  /** "normal" shows a checkbox widget; "invisible" runs silently */
  appearance?: "normal" | "invisible";
  resetKey?: string | number; // change this to reset the widget
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: object) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

export const TurnstileWidget = ({
  onToken,
  onExpire,
  onError,
  appearance = "normal",
  resetKey,
}: TurnstileWidgetProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const uid = useId().replace(/:/g, "");

  const render = () => {
    if (!containerRef.current || !window.turnstile) return;
    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      appearance,
      callback: onToken,
      "expired-callback": () => { widgetIdRef.current = null; onExpire?.(); },
      "error-callback": () => { onError?.(); },
      theme: "auto",
      language: "en",
    });
  };

  useEffect(() => {
    // Load Turnstile script once
    if (!document.getElementById("cf-turnstile-script")) {
      window.onTurnstileLoad = render;
      const script = document.createElement("script");
      script.id = "cf-turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else if (window.turnstile) {
      render();
    }
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  // Reset widget when resetKey changes (e.g. after a failed submit)
  useEffect(() => {
    if (resetKey !== undefined) render();
  }, [resetKey]);

  return (
    <div
      ref={containerRef}
      id={`turnstile-${uid}`}
      className="flex justify-center my-1"
    />
  );
};

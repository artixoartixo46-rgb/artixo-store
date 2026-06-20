/**
 * ARTIXO Auto Error Reporter
 * Catches every JS/React error and sends to our AI-powered edge function.
 */

const EDGE_URL = "https://qzhcxtqkdcygzadcttyf.supabase.co/functions/v1/auto-fix-error";
const ANON_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6aGN4dHFrZGN5Z3phZGN0dHlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTAxODMsImV4cCI6MjA5MjIyNjE4M30.Brb46MYivYOs2aHreLDxUczXahPPZar_yQfXu-YOtp4";

// Dedupe — don't flood the server with the same error
const _reported = new Set<string>();

function fingerprint(message: string, stack?: string): string {
  const raw = (message + (stack?.split("\n")[1] ?? "")).replace(/\s+/g, " ").trim();
  // simple djb2 hash
  let h = 5381;
  for (let i = 0; i < Math.min(raw.length, 200); i++) {
    h = ((h << 5) + h) ^ raw.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

export interface ErrorPayload {
  error_type: string;
  message: string;
  stack?: string;
  url?: string;
  component?: string;
  user_agent?: string;
  fingerprint?: string;
}

export async function reportError(payload: ErrorPayload): Promise<void> {
  const fp = payload.fingerprint ?? fingerprint(payload.message, payload.stack);
  if (_reported.has(fp)) return;
  _reported.add(fp);

  // Fire-and-forget
  try {
    await fetch(EDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({
        ...payload,
        fingerprint: fp,
        url: payload.url ?? window.location.href,
        user_agent: payload.user_agent ?? navigator.userAgent,
      }),
    });
  } catch {
    // Never let the reporter itself throw
  }
}

/** Install global JS error handlers. Call once in main.tsx. */
export function installGlobalErrorHandlers(): void {
  // Unhandled JS errors
  window.addEventListener("error", (e) => {
    if (!e.error && !e.message) return;
    reportError({
      error_type: "uncaught",
      message: e.message || String(e.error),
      stack: e.error?.stack,
      component: `${e.filename}:${e.lineno}:${e.colno}`,
    });
  });

  // Unhandled promise rejections
  window.addEventListener("unhandledrejection", (e) => {
    const err = e.reason;
    const message = err instanceof Error ? err.message : String(err ?? "Unhandled rejection");
    reportError({
      error_type: "promise",
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });
  });

  // Network fetch errors (patch fetch to detect 5xx)
  const _origFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const res = await _origFetch(...args);
    if (res.status >= 500) {
      const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
      reportError({
        error_type: "network",
        message: `HTTP ${res.status} from ${url}`,
        url: window.location.href,
      });
    }
    return res;
  };
}

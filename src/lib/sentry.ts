/**
 * ARTIXO — Sentry Error Monitoring
 *
 * Set VITE_SENTRY_DSN in Vercel environment variables.
 * Get your DSN from: https://sentry.io → Project → Settings → Client Keys
 *
 * What this captures:
 *  - Unhandled JS errors (crashes, undefined, network failures)
 *  - Unhandled Promise rejections
 *  - React component errors (via ErrorBoundary in App.tsx)
 *  - Performance traces (page load, navigation, Supabase calls)
 *  - User context (user ID attached when logged in)
 */

import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENV = import.meta.env.MODE; // "production" | "development"

export function initSentry() {
  if (!DSN) {
    if (ENV === "development") {
      console.info("[Sentry] VITE_SENTRY_DSN not set — monitoring disabled in dev");
    }
    return;
  }

  Sentry.init({
    dsn: DSN,
    environment: ENV,
    release: `artixo@${import.meta.env.VITE_APP_VERSION ?? "1.0.0"}`,

    // Only send errors in production
    enabled: ENV === "production",

    // Capture 10 % of sessions for performance (free tier-safe)
    tracesSampleRate: 0.1,

    // Capture replays only on errors (very frugal)
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: false,
      }),
    ],

    // Ignore noisy non-actionable errors
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      /^Network Error$/,
      /^Failed to fetch$/,
      /^Load failed$/,
      "AbortError",
      // Supabase auth session noise
      "JWT expired",
      "invalid claim",
    ],

    // Strip PII from URLs before sending
    beforeSend(event) {
      if (event.request?.url) {
        try {
          const u = new URL(event.request.url);
          // Remove any token/key query params
          ["token", "access_token", "apikey", "key"].forEach((p) => u.searchParams.delete(p));
          event.request.url = u.toString();
        } catch {
          // ignore parse errors
        }
      }
      return event;
    },
  });
}

/** Call after the user logs in to attach their ID to all future events. */
export function setSentryUser(userId: string | null) {
  if (!DSN) return;
  if (userId) {
    Sentry.setUser({ id: userId });
  } else {
    Sentry.setUser(null);
  }
}

/** Manually capture a caught error with optional context. */
export function captureError(err: unknown, context?: Record<string, unknown>) {
  if (!DSN) { console.error("[Error]", err, context); return; }
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(err);
  });
}

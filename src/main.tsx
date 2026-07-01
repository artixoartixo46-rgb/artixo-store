import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "@/lib/sentry";
import { installGlobalErrorHandlers } from "@/lib/errorReporter";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Init Sentry FIRST — before any other code runs
initSentry();

// Install global JS + Promise + Network error handlers
installGlobalErrorHandlers();

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  // When a new SW takes control (after activate + claim), reload to get fresh JS
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        console.log("[SW] Registered:", reg.scope);
        // Force-check for updates immediately
        reg.update();
      })
      .catch((err) => console.warn("[SW] Registration failed:", err));
  });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <ErrorBoundary section="App root">
      <App />
    </ErrorBoundary>
  </HelmetProvider>
);

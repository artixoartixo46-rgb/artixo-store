import { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const PwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed or previously dismissed
    const wasDismissed = sessionStorage.getItem("pwa-prompt-dismissed");
    if (wasDismissed) return;

    // Check if already running as standalone PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show after 3s to not interrupt initial page load
      setTimeout(() => setShow(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    sessionStorage.setItem("pwa-prompt-dismissed", "1");
  };

  if (!show || dismissed) return null;

  return (
    <div
      className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-24 sm:w-[320px] z-40 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
      style={{ background: "#fff", border: "1px solid rgba(139,26,46,0.15)" }}
    >
      {/* Top accent */}
      <div className="h-1" style={{ background: "linear-gradient(90deg, #8B1A2E, #c0392b)" }} />

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #8B1A2E, #c0392b)" }}
          >
            <Smartphone className="h-6 w-6 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-tight">Install ARTIXO App</p>
            <p className="text-gray-500 text-xs mt-0.5 leading-snug">
              Shop faster & get offers — works offline too!
            </p>
          </div>

          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 -mt-0.5"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={handleInstall}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{ background: "linear-gradient(135deg, #8B1A2E, #c0392b)" }}
          >
            <Download className="h-4 w-4" />
            Install Free
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 rounded-xl text-gray-500 text-sm font-medium bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};

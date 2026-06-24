import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ChatBot } from "@/components/ChatBot";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useAuth } from "@/hooks/useAuth";
import artixoLogo from "@/assets/artixo-logo.png";

const MaintenancePage = () => {
  const { settings } = useSiteSettings();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-rose-900 via-rose-800 to-orange-600 text-white p-8 text-center">
      <img src={artixoLogo} alt="ARTIXO" className="h-20 w-20 object-contain mb-6 drop-shadow-xl" />
      <div className="text-5xl mb-4">🔧</div>
      <h1 className="text-3xl font-bold mb-3">{settings.maintenance_title || "We'll be back soon!"}</h1>
      <p className="text-white/80 max-w-md text-base leading-relaxed mb-4">
        {settings.maintenance_message || "We're performing scheduled maintenance. Thank you for your patience."}
      </p>
      {settings.maintenance_eta && (
        <div className="mt-2 px-5 py-2.5 bg-white/15 rounded-full text-sm font-medium backdrop-blur-sm border border-white/25">
          ⏰ Expected back: {settings.maintenance_eta}
        </div>
      )}
      <p className="mt-8 text-white/40 text-xs">— The ARTIXO Team</p>
    </div>
  );
};

export const Layout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const { settings } = useSiteSettings();
  const { roles } = useAuth();
  const isAdmin = pathname.startsWith("/admin");
  const isAdminUser = roles.includes("admin");

  if (isAdmin) {
    return <div className="min-h-screen bg-muted/30">{children}</div>;
  }

  // Maintenance mode — admins bypass it
  if (settings.maintenance_mode === "true" && !isAdminUser) {
    return <MaintenancePage />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBar />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <ChatBot />
      <PwaInstallPrompt />
    </div>
  );
};

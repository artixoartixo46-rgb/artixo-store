import { Link } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { X } from "lucide-react";
import { useState } from "react";

export const AnnouncementBar = () => {
  const { settings } = useSiteSettings();
  const [dismissed, setDismissed] = useState(false);

  if (settings.announcement_enabled !== "true" || dismissed) return null;

  return (
    <div
      className="w-full py-2 px-4 text-center text-sm font-medium text-white relative flex items-center justify-center gap-2"
      style={{ background: settings.announcement_bg }}
    >
      {settings.announcement_link ? (
        <Link to={settings.announcement_link} className="hover:underline flex-1 text-center">
          {settings.announcement_text}
        </Link>
      ) : (
        <span className="flex-1 text-center">{settings.announcement_text}</span>
      )}
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

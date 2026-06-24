import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, User, LogOut, Store, Shield, Settings, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import artixoLogo from "@/assets/artixo-logo.png";
import { NotificationBell } from "@/components/NotificationBell";
import { PushNotificationBell } from "@/components/PushNotificationBell";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { AiSearchBar } from "@/components/AiSearchBar";

export const Header = () => {
  const { user, roles, signOut } = useAuth();
  const { count } = useCart();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const logoSrc = settings.site_logo || artixoLogo;

  const isSeller = roles.includes("seller");
  const isAdmin = roles.includes("admin");

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/20 shadow-[0_2px_20px_rgba(0,0,0,0.08)]"
      style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
    >
      {/* ── Row 1: Logo + Actions ── */}
      <div className="container flex h-14 items-center gap-2">

        {/* Logo */}
        <Link to="/" className="flex items-center shrink-0 mr-1">
          <img
            src={logoSrc}
            alt={settings.site_name || "Artixo"}
            className="h-9 md:h-11 w-auto max-w-[80px] md:max-w-[130px] object-contain"
          />
        </Link>

        {/* Desktop search bar */}
        <div className="hidden sm:flex flex-1 max-w-xl">
          <AiSearchBar />
        </div>

        {/* Spacer on mobile */}
        <div className="flex-1 sm:hidden" />

        {/* Action icons */}
        <div className="flex items-center gap-0.5">

          {/* Notification bells */}
          {user && <NotificationBell />}
          {user && <span className="hidden sm:inline-flex"><PushNotificationBell /></span>}

          {/* Cart */}
          {!isAdmin && (
            <Link to="/cart">
              <button className="relative flex items-center justify-center h-9 w-9 rounded-full hover:bg-black/5 transition-colors">
                <ShoppingCart className="h-5 w-5 text-foreground/80" />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4.5 min-w-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #8B1A2E, #c0392b)" }}>
                    {count}
                  </span>
                )}
              </button>
            </Link>
          )}

          {/* User menu */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-black/5 transition-colors">
                  <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: "linear-gradient(135deg, #8B1A2E, #c0392b)" }}>
                    {user.email?.[0]?.toUpperCase() ?? <User className="h-4 w-4" />}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mt-1 rounded-2xl shadow-xl border border-white/60 bg-white/95 backdrop-blur-xl">
                <DropdownMenuLabel className="truncate text-xs text-muted-foreground font-normal px-3 pt-3 pb-1">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAdmin ? (
                  <DropdownMenuItem onClick={() => navigate("/admin")} className="rounded-xl mx-1">
                    <Shield className="h-4 w-4 mr-2" /> Admin Panel
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/orders")} className="rounded-xl mx-1">My Orders</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/settings")} className="rounded-xl mx-1">
                      <Settings className="h-4 w-4 mr-2" /> Settings
                    </DropdownMenuItem>
                    {isSeller && (
                      <DropdownMenuItem onClick={() => navigate("/seller")} className="rounded-xl mx-1">
                        <Store className="h-4 w-4 mr-2" /> Seller Dashboard
                      </DropdownMenuItem>
                    )}
                    {!isSeller && (
                      <DropdownMenuItem onClick={() => navigate("/become-seller")} className="rounded-xl mx-1">
                        <Store className="h-4 w-4 mr-2" /> Become a Seller
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => navigate("/affiliate")} className="rounded-xl mx-1">
                      <Gift className="h-4 w-4 mr-2" /> Affiliate Program
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="rounded-xl mx-1 mb-1 text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth">
              <button className="ml-1 text-xs font-semibold px-4 py-2 rounded-full text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: "linear-gradient(135deg, #8B1A2E, #c0392b)" }}>
                Sign in
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* ── Row 2 (mobile only): Always-visible search bar ── */}
      <div className="sm:hidden px-4 pb-3">
        <AiSearchBar />
      </div>
    </header>
  );
};

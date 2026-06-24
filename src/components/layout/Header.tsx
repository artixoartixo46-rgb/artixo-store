import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ShoppingCart, User, LogOut, Store, Shield, Settings, Gift, X } from "lucide-react";
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
  const [searchOpen, setSearchOpen] = useState(false);

  const isSeller = roles.includes("seller");
  const isAdmin = roles.includes("admin");

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: searchOpen ? "none" : "0 1px 12px rgba(0,0,0,0.07)",
          borderBottom: searchOpen ? "none" : "1px solid rgba(0,0,0,0.06)",
        }}
      >
        {/* Main row */}
        <div className="flex items-center px-3 h-14">

          {/* Logo */}
          <Link to="/" className="shrink-0">
            <img
              src={logoSrc}
              alt={settings.site_name || "Artixo"}
              className="h-9 w-auto max-w-[72px] object-contain"
            />
          </Link>

          <div className="flex-1" />

          {/* Desktop search bar (hidden on mobile) */}
          <div className="hidden sm:flex flex-1 max-w-xl mx-4">
            <AiSearchBar />
          </div>

          {/* Icons */}
          <div className="flex items-center gap-0.5">

            {/* Search icon — mobile only */}
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="sm:hidden flex items-center justify-center h-9 w-9 rounded-full hover:bg-black/5 transition-colors"
              aria-label="Search"
            >
              {searchOpen
                ? <X className="h-5 w-5 text-foreground/75" />
                : <Search className="h-5 w-5 text-foreground/75" />
              }
            </button>

            {user && <NotificationBell />}
            {user && <span className="hidden sm:inline-flex"><PushNotificationBell /></span>}

            {/* Cart */}
            {!isAdmin && (
              <Link to="/cart">
                <button className="relative flex items-center justify-center h-9 w-9 rounded-full hover:bg-black/5 transition-colors">
                  <ShoppingCart className="h-5 w-5 text-foreground/75" />
                  {count > 0 && (
                    <span
                      className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg, #8B1A2E, #c0392b)" }}
                    >
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
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: "linear-gradient(135deg, #8B1A2E, #c0392b)" }}
                    >
                      {user.email?.[0]?.toUpperCase() ?? "U"}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 mt-1 rounded-2xl shadow-xl border border-white/60 bg-white/95 backdrop-blur-xl">
                  <DropdownMenuLabel className="truncate text-xs text-muted-foreground font-normal px-3 pt-3 pb-1">
                    {user.email}
                  </DropdownMenuLabel>
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
                <button
                  className="ml-1 text-xs font-semibold px-3 py-1.5 rounded-full text-white transition-all hover:opacity-90 active:scale-95 whitespace-nowrap"
                  style={{ background: "linear-gradient(135deg, #8B1A2E, #c0392b)" }}
                >
                  Sign in
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* Search overlay — slides down on mobile when search icon tapped */}
        <div
          className={`sm:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            searchOpen ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
          }`}
          style={{ borderTop: searchOpen ? "1px solid rgba(0,0,0,0.06)" : "none" }}
        >
          <div className="px-4 py-3">
            <AiSearchBar onSearch={() => setSearchOpen(false)} />
          </div>
        </div>
      </header>
    </>
  );
};

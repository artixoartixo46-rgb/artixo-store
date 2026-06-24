import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, User, LogOut, Store, Shield, Settings, Gift, Search, X } from "lucide-react";
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const isSeller = roles.includes("seller");
  const isAdmin = roles.includes("admin");

  return (
    <header className="sticky top-0 z-40 w-full glass border-b border-white/30 shadow-glass">
      {/* Main header row */}
      <div className="container flex h-14 md:h-16 items-center gap-2 md:gap-4">
        <Link to="/" className="flex items-center shrink-0">
          <img src={logoSrc} alt={settings.site_name || "Artixo"} className="h-10 md:h-14 w-auto max-w-[100px] md:max-w-[140px] object-contain" />
        </Link>

        {/* Desktop search — hidden on small screens */}
        <div className="hidden sm:flex flex-1">
          <AiSearchBar />
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 ml-auto">
          {/* Mobile search toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            onClick={() => setMobileSearchOpen((v) => !v)}
            aria-label="Search"
          >
            {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>

          {user && <NotificationBell />}
          {user && <PushNotificationBell />}
          {!isAdmin && (
            <Link to="/cart">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {count > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 min-w-5 p-0 flex items-center justify-center bg-primary text-primary-foreground text-xs">
                    {count}
                  </Badge>
                )}
              </Button>
            </Link>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAdmin ? (
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <Shield className="h-4 w-4 mr-2" /> Admin Panel
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/orders")}>
                      My Orders
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/settings")}>
                      <Settings className="h-4 w-4 mr-2" /> Notification Settings
                    </DropdownMenuItem>
                    {isSeller && (
                      <DropdownMenuItem onClick={() => navigate("/seller")}>
                        <Store className="h-4 w-4 mr-2" /> Seller Dashboard
                      </DropdownMenuItem>
                    )}
                    {!isSeller && (
                      <DropdownMenuItem onClick={() => navigate("/become-seller")}>
                        <Store className="h-4 w-4 mr-2" /> Become a Seller
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => navigate("/affiliate")}>
                      <Gift className="h-4 w-4 mr-2" /> Affiliate Program
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth">
              <Button variant="hero" size="sm" className="text-xs sm:text-sm px-3 sm:px-4">Sign in</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile search bar — full width, slides in below header */}
      {mobileSearchOpen && (
        <div className="sm:hidden border-t border-white/20 px-3 py-2 bg-background/80 backdrop-blur-md">
          <AiSearchBar onSearch={() => setMobileSearchOpen(false)} />
        </div>
      )}
    </header>
  );
};

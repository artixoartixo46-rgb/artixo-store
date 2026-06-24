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
    <header className="sticky top-0 z-40 w-full glass border-b border-white/30 shadow-glass">

      {/* ── Row 1: Logo + Actions ── */}
      <div className="container flex h-12 md:h-14 items-center gap-2 md:gap-4">
        <Link to="/" className="flex items-center shrink-0">
          <img
            src={logoSrc}
            alt={settings.site_name || "Artixo"}
            className="h-8 md:h-12 w-auto max-w-[72px] md:max-w-[130px] object-contain"
          />
        </Link>

        {/* Desktop search bar — centre of row 1 on md+ */}
        <div className="hidden sm:flex flex-1">
          <AiSearchBar />
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-0.5 sm:gap-1 ml-auto">
          {user && <NotificationBell />}
          {user && <span className="hidden sm:inline-flex"><PushNotificationBell /></span>}

          {!isAdmin && (
            <Link to="/cart">
              <Button variant="ghost" size="icon" className="relative h-9 w-9">
                <ShoppingCart className="h-5 w-5" />
                {count > 0 && (
                  <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 p-0 flex items-center justify-center bg-primary text-primary-foreground text-[10px]">
                    {count}
                  </Badge>
                )}
              </Button>
            </Link>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate text-xs">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAdmin ? (
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <Shield className="h-4 w-4 mr-2" /> Admin Panel
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/orders")}>My Orders</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/settings")}>
                      <Settings className="h-4 w-4 mr-2" /> Settings
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
              <Button variant="hero" size="sm" className="text-xs px-3 h-8">Sign in</Button>
            </Link>
          )}
        </div>
      </div>

      {/* ── Row 2 (mobile only): Always-visible search bar ── */}
      <div className="sm:hidden px-3 pb-2.5">
        <AiSearchBar />
      </div>

    </header>
  );
};

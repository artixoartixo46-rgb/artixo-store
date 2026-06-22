import { lazy, Suspense, useEffect } from "react";
import { useReferralCapture } from "@/hooks/useReferral";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { SiteSettingsProvider } from "@/hooks/useSiteSettings";
import { Layout } from "@/components/layout/Layout";
import * as Sentry from "@sentry/react";

// ── Route-based code splitting — each page loads only when visited ──────────
const Index           = lazy(() => import("./pages/Index"));
const Auth            = lazy(() => import("./pages/Auth"));
const Products        = lazy(() => import("./pages/Products"));
const ProductDetail   = lazy(() => import("./pages/ProductDetail"));
const Cart            = lazy(() => import("./pages/Cart"));
const Checkout        = lazy(() => import("./pages/Checkout"));
const Orders          = lazy(() => import("./pages/Orders"));
const BecomeSeller    = lazy(() => import("./pages/BecomeSeller"));
const SellerDashboard = lazy(() => import("./pages/SellerDashboard"));
const AdminPanel      = lazy(() => import("./pages/AdminPanel"));
const Privacy         = lazy(() => import("./pages/Privacy"));
const RefundPolicy    = lazy(() => import("./pages/RefundPolicy"));
const Settings        = lazy(() => import("./pages/Settings"));
const FitProfile      = lazy(() => import("./pages/FitProfile"));
const TryOn           = lazy(() => import("./pages/TryOn"));
const FitAnalysis     = lazy(() => import("./pages/FitAnalysis"));
const SellerStorefront   = lazy(() => import("./pages/SellerStorefront"));
const AffiliateDashboard = lazy(() => import("./pages/AffiliateDashboard"));
const NotFound           = lazy(() => import("./pages/NotFound"));

// Capture ?ref= referral code on any page load
function ReferralCapture() { useReferralCapture(); return null; }

// ── Optimised QueryClient — smart caching + retry for all Supabase calls ────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:           1000 * 60 * 5,   // data stays fresh 5 min
      gcTime:              1000 * 60 * 15,  // cache kept 15 min
      retry:               2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000), // exponential back-off
      refetchOnWindowFocus: false,
      refetchOnReconnect:   true,
    },
    mutations: {
      retry: 1,
    },
  },
});

// ── Lightweight full-page skeleton while a lazy chunk loads ─────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
    </div>
  </div>
);

// Fallback UI shown when an uncaught React error is captured by Sentry
const SentryFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background p-8 text-center">
    <div className="max-w-sm">
      <div className="text-4xl mb-4">⚠️</div>
      <h2 className="font-display text-2xl mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-6 text-sm">
        Our team has been notified. Please refresh the page to continue.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Refresh page
      </button>
    </div>
  </div>
);

const App = () => (
  <Sentry.ErrorBoundary fallback={<SentryFallback />} showDialog={false}>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" richColors />
      <BrowserRouter>
        <AuthProvider>
          <SiteSettingsProvider>
            <CartProvider>
              <Layout>
                <ReferralCapture />
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/"                       element={<Index />} />
                    <Route path="/auth"                   element={<Auth />} />
                    <Route path="/products"               element={<Products />} />
                    <Route path="/product/:id"            element={<ProductDetail />} />
                    <Route path="/cart"                   element={<Cart />} />
                    <Route path="/checkout"               element={<Checkout />} />
                    <Route path="/orders"                 element={<Orders />} />
                    <Route path="/become-seller"          element={<BecomeSeller />} />
                    <Route path="/seller"                 element={<SellerDashboard />} />
                    <Route path="/seller/:id"             element={<SellerStorefront />} />
                    <Route path="/admin"                  element={<AdminPanel />} />
                    <Route path="/privacy"                element={<Privacy />} />
                    <Route path="/refund-policy"          element={<RefundPolicy />} />
                    <Route path="/settings"               element={<Settings />} />
                    <Route path="/fit-profile"            element={<FitProfile />} />
                    <Route path="/product/:id/tryon"      element={<TryOn />} />
                    <Route path="/product/:id/fit-analysis" element={<FitAnalysis />} />
                    <Route path="/affiliate"              element={<AffiliateDashboard />} />
                    <Route path="*"                       element={<NotFound />} />
                  </Routes>
                </Suspense>
              </Layout>
            </CartProvider>
          </SiteSettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </Sentry.ErrorBoundary>
);

export default App;

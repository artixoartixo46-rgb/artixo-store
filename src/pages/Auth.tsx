import { useState, useEffect } from "react";
import { useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import artixoLogo from "@/assets/artixo-logo.png";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { ShieldCheck } from "lucide-react";

const Auth = () => {
  const { user, roles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [callbackTimedOut, setCallbackTimedOut] = useState(false);

  // CAPTCHA state — separate tokens for sign-in and sign-up tabs
  const [signInToken, setSignInToken] = useState<string | null>(null);
  const [signUpToken, setSignUpToken] = useState<string | null>(null);
  const [signInReset, setSignInReset] = useState(0);
  const [signUpReset, setSignUpReset] = useState(0);

  const redirectTo = searchParams.get("redirect") || "/";
  const safeRedirect = redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/";

  const isOAuthCallback =
    !callbackTimedOut && (window.location.search.includes("code=") || window.location.hash.includes("access_token"));

  useEffect(() => {
    if (window.location.hash.includes("error")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    if (window.location.search.includes("code=") || window.location.hash.includes("access_token")) {
      const t = setTimeout(() => {
        window.history.replaceState(null, "", window.location.pathname);
        setCallbackTimedOut(true);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, []);

  if (authLoading || isOAuthCallback) {
    return (
      <div className="container py-12 max-w-md flex flex-col items-center gap-4">
        <img src={artixoLogo} alt="Artixo" className="h-16 w-16 object-contain animate-pulse" />
        <p className="text-muted-foreground text-sm">Signing you in...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to={roles.includes("admin") ? "/admin" : safeRedirect} replace />;
  }

  const logAuthError = (scope: string, err: any) => {
    console.error("[Auth:" + scope + "]", err);
  };

  const friendlyMessage = (scope: string, err: any) => {
    const msg = (err?.message || "").toLowerCase();
    if (msg.includes("invalid login") || msg.includes("invalid credentials")) return "Incorrect email or password.";
    if (msg.includes("email not confirmed")) return "Please verify your email before signing in.";
    if (msg.includes("already") || msg.includes("registered")) return "Account already exists. Please sign in instead.";
    if (msg.includes("network") || msg.includes("failed to fetch")) return "Network error. Check your connection and try again.";
    if (msg.includes("rate") || msg.includes("too many")) return "Too many attempts. Please wait a moment and try again.";
    if (scope === "google") return "Google sign-in failed. Please try again.";
    return err?.message || "Sign in failed. Please try again.";
  };

  const showAuthError = (scope: string, err: any, retry: () => void) => {
    logAuthError(scope, err);
    const message = friendlyMessage(scope, err);
    toast.error(message, { duration: 8000, action: { label: "Retry", onClick: () => retry() } });
  };

  // Server-side CAPTCHA verification
  const verifyCaptcha = async (token: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/verify-captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      return data.ok === true;
    } catch {
      // If verification endpoint fails, allow through (non-blocking UX)
      return true;
    }
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInToken) {
      toast.error("Please complete the security check below.");
      return;
    }
    setLoading(true);
    try {
      const captchaOk = await verifyCaptcha(signInToken);
      if (!captchaOk) {
        toast.error("Security check failed. Please try again.");
        setSignInToken(null);
        setSignInReset(r => r + 1);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back!");
      navigate(safeRedirect, { replace: true });
    } catch (err) {
      setSignInToken(null);
      setSignInReset(r => r + 1);
      showAuthError("signIn", err, () => signIn(e));
    } finally { setLoading(false); }
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpToken) {
      toast.error("Please complete the security check below.");
      return;
    }
    setLoading(true);
    try {
      const captchaOk = await verifyCaptcha(signUpToken);
      if (!captchaOk) {
        toast.error("Security check failed. Please try again.");
        setSignUpToken(null);
        setSignUpReset(r => r + 1);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin + "/", data: { full_name: fullName } },
      });
      if (error) throw error;
      toast.success("Account created! Welcome to ARTIXO");
      navigate(safeRedirect, { replace: true });
    } catch (err) {
      setSignUpToken(null);
      setSignUpReset(r => r + 1);
      showAuthError("signUp", err, () => signUp(e));
    } finally { setLoading(false); }
  };

  const google = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/auth" },
      });
      if (error) { showAuthError("google", error, google); setLoading(false); }
    } catch (err) {
      showAuthError("google", err as any, google);
      setLoading(false);
    }
  };

  return (
    <div className="container py-12 max-w-md">
      <Card className="p-8 shadow-elevated">
        <div className="text-center mb-6">
          <img src={artixoLogo} alt="Artixo" className="mx-auto h-16 w-16 object-contain mb-3" />
          <h1 className="font-display text-2xl font-bold">Welcome to ARTIXO</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in or create your account</p>
        </div>

        <Button variant="outline" className="w-full mb-4 gap-2" onClick={google} disabled={loading}>
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? "Signing in..." : "Continue with Google"}
        </Button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or with email</span></div>
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>

          {/* ── Sign in ─────────────────────────────────────────── */}
          <TabsContent value="signin">
            <form onSubmit={signIn} className="space-y-4">
              <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>

              {/* CAPTCHA */}
              <TurnstileWidget
                onToken={setSignInToken}
                onExpire={() => setSignInToken(null)}
                onError={() => setSignInToken(null)}
                resetKey={signInReset}
              />

              <Button
                type="submit"
                variant="hero"
                className="w-full gap-2"
                disabled={loading || !signInToken}
              >
                <ShieldCheck className="h-4 w-4" />
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </TabsContent>

          {/* ── Sign up ─────────────────────────────────────────── */}
          <TabsContent value="signup">
            <form onSubmit={signUp} className="space-y-4">
              <div><Label>Full name</Label><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>

              {/* CAPTCHA */}
              <TurnstileWidget
                onToken={setSignUpToken}
                onExpire={() => setSignUpToken(null)}
                onError={() => setSignUpToken(null)}
                resetKey={signUpReset}
              />

              <Button
                type="submit"
                variant="hero"
                className="w-full gap-2"
                disabled={loading || !signUpToken}
              >
                <ShieldCheck className="h-4 w-4" />
                {loading ? "Creating..." : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-1.5 mt-4 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3 w-3" />
          Protected by Cloudflare Turnstile
        </div>
      </Card>
    </div>
  );
};

export default Auth;

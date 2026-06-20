import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setSentryUser } from "@/lib/sentry";

type Role = "admin" | "seller" | "customer" | "pending_seller";
type RoleRow = { role: Role };

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: Role[];
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

const fetchRoles = async (userId: string): Promise<Role[]> => {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error || !data) return [];
  return (data as RoleRow[]).map((r) => r.role);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const roleRequestRef = useRef(0);

  const applySession = (s: Session | null, markReady = false) => {
    const requestId = ++roleRequestRef.current;
    const nextUser = s?.user ?? null;

    setSession(s);
    setUser(nextUser);
    setSentryUser(nextUser?.id ?? null); // tag Sentry events with user ID

    if (!nextUser) {
      setRoles([]);
      if (markReady) setLoading(false);
      return;
    }

    fetchRoles(nextUser.id)
      .then((r) => {
        if (mountedRef.current && roleRequestRef.current === requestId) setRoles(r);
      })
      .finally(() => {
        if (mountedRef.current && roleRequestRef.current === requestId && markReady) setLoading(false);
      });
  };

  const loadRoles = async (u: User | null) => {
    if (!u) {
      setRoles([]);
      return;
    }
    const requestId = ++roleRequestRef.current;
    const r = await fetchRoles(u.id);
    if (mountedRef.current && roleRequestRef.current === requestId) setRoles(r);
  };

  useEffect(() => {
    mountedRef.current = true;

    // 1. Subscribe FIRST so we don't miss SIGNED_IN from URL detection
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mountedRef.current) return;

      if (event === "SIGNED_OUT") {
        applySession(null, true);
        return;
      }

      // Keep auth callbacks non-blocking; role loading finishes readiness separately.
      applySession(s, event === "INITIAL_SESSION" || event === "SIGNED_IN");
    });

    // 2. Then check existing session (also handles ?code=... in URL via detectSessionInUrl)
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (!mountedRef.current) return;
        applySession(s, true);
      })
      .catch(() => {
        if (!mountedRef.current) return;
        applySession(null, true);
      });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRoles([]);
  };

  const refreshRoles = async () => {
    if (!user) return;
    const r = await fetchRoles(user.id);
    if (mountedRef.current) setRoles(r);
  };

  return (
    <Ctx.Provider value={{ user, session, roles, loading, signOut, refreshRoles }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

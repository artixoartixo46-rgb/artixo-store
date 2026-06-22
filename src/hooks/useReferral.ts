// Referral tracking hook
// Reads ?ref=CODE from URL, saves to localStorage for 30 days
// Used at checkout to credit the affiliate

import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const KEY = "artixo_ref";
const TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

export function useReferralCapture() {
  const [params] = useSearchParams();
  useEffect(() => {
    const code = params.get("ref");
    if (code && code.trim()) {
      localStorage.setItem(KEY, JSON.stringify({ code: code.trim().toUpperCase(), ts: Date.now() }));
    }
  }, [params]);
}

export function getStoredReferral(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { code, ts } = JSON.parse(raw);
    if (Date.now() - ts > TTL) { localStorage.removeItem(KEY); return null; }
    return code as string;
  } catch { return null; }
}

export function clearStoredReferral() {
  localStorage.removeItem(KEY);
}

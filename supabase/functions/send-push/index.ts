import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const VAPID_PUBLIC_KEY  = "BLg1i4C8IE93FvebnaNjqx75MSS84V8mWZcL-xY5K69dmGtjsUm1N3vf3uyGl9WVkjfDZAsDH7zXq3l4-2jwFTk";
const VAPID_PRIVATE_KEY = "0JLiTcT2-xg5aA0LUxoQIrIbjLmYX_rktwmPDTb9Nrk";
const VAPID_SUBJECT     = "mailto:artixoartixo46@gmail.com";

// ── VAPID JWT helpers (pure Deno — no external npm) ─────────────────────────

function base64url(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function importVapidKey(b64: string): Promise<CryptoKey> {
  const raw = base64urlDecode(b64);
  return crypto.subtle.importKey(
    "raw", raw,
    { name: "ECDH", namedCurve: "P-256" },
    false, []
  );
}

async function importVapidPrivate(b64: string): Promise<CryptoKey> {
  const raw = base64urlDecode(b64);
  return crypto.subtle.importKey(
    "pkcs8", raw,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );
}

async function makeVapidJwt(audience: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = base64url(new TextEncoder().encode(JSON.stringify({
    aud: audience, exp: now + 3600, sub: VAPID_SUBJECT,
  })));
  const sigInput = new TextEncoder().encode(`${header}.${payload}`);
  const key = await importVapidPrivate(VAPID_PRIVATE_KEY);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, sigInput);
  return `${header}.${payload}.${base64url(new Uint8Array(sig))}`;
}

// ── Encrypt payload with Web Push (RFC 8291 aesgcm) ─────────────────────────

async function encryptPayload(
  endpoint: string,
  p256dh: string,
  authSecret: string,
  payloadStr: string
): Promise<{ body: Uint8Array; headers: Record<string, string> }> {
  const enc = new TextEncoder();
  const payloadBytes = enc.encode(payloadStr);

  // Recipient public key
  const recipientKey = await crypto.subtle.importKey(
    "raw", base64urlDecode(p256dh),
    { name: "ECDH", namedCurve: "P-256" },
    false, []
  );

  // Ephemeral sender key pair
  const senderKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true, ["deriveKey", "deriveBits"]
  );

  const senderPublicRaw = await crypto.subtle.exportKey("raw", senderKeyPair.publicKey);

  // ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: recipientKey },
    senderKeyPair.privateKey, 256
  );

  const auth = base64urlDecode(authSecret);

  // HKDF — PRK
  const hmacKey = await crypto.subtle.importKey("raw", auth, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, new Uint8Array(sharedBits)));

  // HKDF expand for content encryption key
  const senderPub = new Uint8Array(senderPublicRaw);
  const recipientPub = base64urlDecode(p256dh);
  const keyInfo = new Uint8Array([
    ...enc.encode("Content-Encoding: aesgcm\0"),
    0x00, 0x41, ...recipientPub,
    0x00, 0x41, ...senderPub,
  ]);
  const nonceInfo = new Uint8Array([
    ...enc.encode("Content-Encoding: nonce\0"),
    0x00, 0x41, ...recipientPub,
    0x00, 0x41, ...senderPub,
  ]);

  const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const cek = new Uint8Array((await crypto.subtle.sign("HMAC", prkKey, new Uint8Array([...keyInfo, 0x01]))).slice(0, 16));
  const nonce = new Uint8Array((await crypto.subtle.sign("HMAC", prkKey, new Uint8Array([...nonceInfo, 0x01]))).slice(0, 12));

  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);

  // Pad payload
  const padded = new Uint8Array(2 + payloadBytes.length);
  padded.set(payloadBytes, 2);

  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded));

  // Salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const body = new Uint8Array(encrypted);
  return {
    body,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aesgcm",
      "Encryption": `salt=${base64url(salt)}`,
      "Crypto-Key": `dh=${base64url(senderPub)}`,
    },
  };
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } });
  }

  const { subscriptions, payload } = await req.json() as {
    subscriptions: { endpoint: string; p256dh: string; auth: string }[];
    payload: { title: string; body: string; url?: string };
  };

  const results = [];

  for (const sub of subscriptions) {
    try {
      const audience = new URL(sub.endpoint).origin;
      const jwt = await makeVapidJwt(audience);
      const vapidPubB64 = VAPID_PUBLIC_KEY;

      const payloadStr = JSON.stringify(payload);

      let encBody: Uint8Array;
      let encHeaders: Record<string, string>;

      try {
        const enc = await encryptPayload(sub.endpoint, sub.p256dh, sub.auth, payloadStr);
        encBody = enc.body;
        encHeaders = enc.headers;
      } catch {
        // Fallback: send without encryption (some browsers accept this)
        encBody = new TextEncoder().encode(payloadStr);
        encHeaders = { "Content-Type": "application/json" };
      }

      const res = await fetch(sub.endpoint, {
        method: "POST",
        headers: {
          ...encHeaders,
          "Authorization": `vapid t=${jwt},k=${vapidPubB64}`,
          "TTL": "86400",
        },
        body: encBody,
      });

      results.push({ endpoint: sub.endpoint.slice(0, 40), status: res.status });
    } catch (e: any) {
      results.push({ endpoint: sub.endpoint.slice(0, 40), error: e.message });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});

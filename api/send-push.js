// Vercel serverless function — Web Push sender
// POST /api/send-push  { subscriptions: [{endpoint, p256dh, auth}], payload: {title, body, url} }

const VAPID_PUBLIC_KEY  = "BLg1i4C8IE93FvebnaNjqx75MSS84V8mWZcL-xY5K69dmGtjsUm1N3vf3uyGl9WVkjfDZAsDH7zXq3l4-2jwFTk";
const VAPID_PRIVATE_KEY = "0JLiTcT2-xg5aA0LUxoQIrIbjLmYX_rktwmPDTb9Nrk";
const VAPID_SUBJECT     = "mailto:artixoartixo46@gmail.com";

// ── Helpers ──────────────────────────────────────────────────────────────────

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function b64urlDecode(s) {
  return Buffer.from(s, "base64url");
}

async function makeVapidJwt(audience) {
  const { createSign } = await import("crypto");
  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64url(Buffer.from(JSON.stringify({ aud: audience, exp: now + 3600, sub: VAPID_SUBJECT })));
  const sigInput = `${header}.${payload}`;

  // Import EC private key (raw → pkcs8-like via Node crypto)
  const { KeyObject } = await import("crypto");
  const privRaw = b64urlDecode(VAPID_PRIVATE_KEY);

  // Build DER-encoded PKCS8 EC key from raw 32-byte scalar
  // OID for EC + P-256 OID + private key
  const der = Buffer.concat([
    Buffer.from("3041020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420", "hex"),
    privRaw,
  ]);

  const { createPrivateKey } = await import("crypto");
  const ecKey = createPrivateKey({ key: der, format: "der", type: "pkcs8" });

  const sign = createSign("SHA256");
  sign.update(sigInput);
  const derSig = sign.sign(ecKey);

  // Convert DER signature to raw R||S (64 bytes)
  let offset = 2;
  const rLen = derSig[3]; offset = 4;
  const r = derSig.slice(offset, offset + rLen); offset += rLen;
  const sLen = derSig[offset + 1]; offset += 2;
  const s = derSig.slice(offset, offset + sLen);

  const rawSig = Buffer.concat([
    Buffer.from(r).slice(-32).toString("hex").padStart(64, "0").match(/.{2}/g).map(h => parseInt(h, 16)),
    Buffer.from(s).slice(-32).toString("hex").padStart(64, "0").match(/.{2}/g).map(h => parseInt(h, 16)),
  ].map(arr => Buffer.from(arr)));

  return `${sigInput}.${b64url(rawSig)}`;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    return res.status(200).end();
  }
  if (req.method !== "POST") return res.status(405).end();

  const { subscriptions = [], payload } = req.body ?? {};

  const results = [];

  for (const sub of subscriptions) {
    try {
      const audience = new URL(sub.endpoint).origin;
      const jwt = await makeVapidJwt(audience);

      const body = JSON.stringify(payload);

      const r = await fetch(sub.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
          "TTL": "86400",
        },
        body,
      });

      results.push({ endpoint: sub.endpoint.slice(0, 40), status: r.status });
    } catch (e) {
      results.push({ endpoint: sub.endpoint.slice(0, 40), error: e.message });
    }
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ ok: true, results });
}

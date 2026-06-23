// Vercel serverless — POST /api/verify-captcha
// Verifies a Cloudflare Turnstile token server-side.
// Env var required: TURNSTILE_SECRET_KEY (set in Vercel dashboard, never exposed to client)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { token, remoteip } = req.body ?? {};

  if (!token) {
    return res.status(400).json({ ok: false, error: "Missing token" });
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;

  // If no secret is configured, fall through (dev / test mode with test keys)
  if (!secret || secret.startsWith("1x000000")) {
    return res.status(200).json({ ok: true, dev: true });
  }

  try {
    const form = new URLSearchParams();
    form.append("secret", secret);
    form.append("response", token);
    if (remoteip) form.append("remoteip", remoteip);

    const cfRes = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      }
    );

    const data = await cfRes.json();

    if (!data.success) {
      return res.status(403).json({ ok: false, error: "CAPTCHA verification failed", codes: data["error-codes"] });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[verify-captcha]", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
}

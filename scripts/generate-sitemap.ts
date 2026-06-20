// Runs before `vite dev` and `vite build`; writes public/sitemap.xml.
import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://artixo.store";
const SUPABASE_URL = "https://qzhcxtqkdcygzadcttyf.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6aGN4dHFrZGN5Z3phZGN0dHlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTAxODMsImV4cCI6MjA5MjIyNjE4M30.Brb46MYivYOs2aHreLDxUczXahPPZar_yQfXu-YOtp4";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/products", changefreq: "daily", priority: "0.9" },
  { path: "/become-seller", changefreq: "monthly", priority: "0.6" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/refund-policy", changefreq: "yearly", priority: "0.3" },
];

async function fetchRest(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) {
    console.warn(`sitemap: failed to fetch ${path} (${res.status})`);
    return [];
  }
  return res.json();
}

async function buildEntries(): Promise<SitemapEntry[]> {
  const entries = [...staticEntries];

  try {
    const cats = await fetchRest("categories?select=slug");
    for (const c of cats) {
      if (c?.slug) entries.push({ path: `/products?category=${c.slug}`, changefreq: "weekly", priority: "0.7" });
    }
  } catch (e) {
    console.warn("sitemap: categories fetch error", e);
  }

  try {
    const products = await fetchRest("products?select=id,updated_at&status=eq.approved");
    for (const p of products) {
      entries.push({
        path: `/product/${p.id}`,
        lastmod: p.updated_at ? new Date(p.updated_at).toISOString().split("T")[0] : undefined,
        changefreq: "weekly",
        priority: "0.8",
      });
    }
  } catch (e) {
    console.warn("sitemap: products fetch error", e);
  }

  return entries;
}

function render(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

const entries = await buildEntries();
writeFileSync(resolve("public/sitemap.xml"), render(entries));
console.log(`sitemap.xml written (${entries.length} entries)`);

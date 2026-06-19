# ARTIXO STORE — Project Details

## Tech Stack
- React 18 + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (backend / auth / database)
- Vercel (hosting)
- Resend (email)

---

## Supabase — ACTIVE PROJECT (Old / Correct One)

| Field | Value |
|-------|-------|
| Project ID | `djmrevzcetdpjzbggavj` |
| Project URL | `https://djmrevzcetdpjzbggavj.supabase.co` |
| Org | artixoartixo46-rgb's Org |
| Dashboard | https://supabase.com/dashboard/project/djmrevzcetdpjzbggavj |
| DB Password | `nCq1ZwciRCQEmqZt` |
| Anon (JWT) Key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqbXJldnpjZXRkcGp6YmdnYXZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTk5NjIsImV4cCI6MjA5NjU3NTk2Mn0.QxA_F92I9otKySh_eSGdHY-8Nwm9ZqRmgL4nas00ifE` |

> ⚠️ This project has all the product data and banners.

### Tables needed
- `products`
- `banners`
- `site_settings`
- `user_roles` ← needs to be created (see SQL below)

---

## Supabase — OLD WRONG PROJECT (Empty, do not use)

| Field | Value |
|-------|-------|
| Project ID | `qzhcxtqkdcygzadcttyf` |
| Org | dishanthandinho-dotcom's Org |

> ❌ This was incorrectly connected before. Now reverted.

---

## Vercel Project

| Field | Value |
|-------|-------|
| Project Name | `artixo-store` |
| Team | `artixoartixo46-rgbs-projects` |
| Dashboard | https://vercel.com/artixoartixo46-rgbs-projects/artixo-store |
| Env Vars Page | https://vercel.com/artixoartixo46-rgbs-projects/artixo-store/settings/environment-variables |

### Current Vercel Env Vars (updated)
```
VITE_SUPABASE_URL        = https://djmrevzcetdpjzbggavj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID = djmrevzcetdpjzbggavj
VITE_GOOGLE_OAUTH_ENABLED = true
RESEND_API_KEY           = re_Awbv8p9s_GQDan3M8C7KkAFTb3pAjXMvK
```

---

## Local .env File

Location: `C:\Users\Dino\Desktop\ARTIXO STORE\.env`

```env
VITE_SUPABASE_PROJECT_ID="djmrevzcetdpjzbggavj"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqbXJldnpjZXRkcGp6YmdnYXZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTk5NjIsImV4cCI6MjA5NjU3NTk2Mn0.QxA_F92I9otKySh_eSGdHY-8Nwm9ZqRmgL4nas00ifE"
VITE_SUPABASE_URL="https://djmrevzcetdpjzbggavj.supabase.co"
RESEND_API_KEY="re_Awbv8p9s_GQDan3M8C7KkAFTb3pAjXMvK"
VITE_GOOGLE_OAUTH_ENABLED="true"
```

---

## SQL — Create user_roles table (run in Supabase SQL Editor)

```sql
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own role"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert roles"
  ON user_roles FOR INSERT
  WITH CHECK (true);
```

SQL Editor link:
https://supabase.com/dashboard/project/djmrevzcetdpjzbggavj/sql/new

---

## Git Remote

```
https://github.com/artixoartixo46-rgb/artixo-store.git
```
> ⚠️ Token is stored in git config only — do not commit credentials.

---

## Pending Tasks

- [ ] Run `user_roles` SQL in Supabase (link above)
- [ ] Verify live site loads products/banners
- [ ] Check Google OAuth is enabled in `djmrevzcetdpjzbggavj` Auth → Providers
- [ ] Check `site_settings` RLS has admin write policy

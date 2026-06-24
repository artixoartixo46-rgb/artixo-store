-- ============================================================
-- Fix site_settings RLS + seed all missing keys
-- Run this in Supabase SQL Editor for project djmrevzcetdpjzbggavj
-- ============================================================

-- 1. Fix RLS: allow admins via EITHER user_roles OR profiles.role
DROP POLICY IF EXISTS "Admin write" ON site_settings;
CREATE POLICY "Admin write" ON site_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. Seed ALL settings keys (new ones added after initial setup)
INSERT INTO site_settings (key, value) VALUES
  ('banner_height',           '600'),
  ('banner_object_fit',       'cover'),
  ('banner_object_position',  'center'),
  ('banner_overlay_opacity',  '50'),
  ('banner_show_text',        'true'),
  ('banner_text_position',    'left'),
  ('banner_text_color',       '#ffffff'),
  ('site_logo',               ''),
  ('seo_title',               'ARTIXO — Sri Lanka''s Online Marketplace'),
  ('seo_description',         'Sri Lanka''s premier online marketplace — shop electronics, fashion, home goods and more.'),
  ('seo_og_image',            ''),
  ('footer_copyright',        '© {year} ARTIXO — Made with ❤️ in Sri Lanka'),
  ('footer_email',            'support@artixo.lk'),
  ('footer_phone',            '+94 11 000 0000'),
  ('footer_address',          'Colombo, Sri Lanka 🇱🇰'),
  ('maintenance_mode',        'false'),
  ('maintenance_title',       'We''ll be back soon!'),
  ('maintenance_message',     'We''re performing scheduled maintenance. Thank you for your patience.'),
  ('maintenance_eta',         ''),
  ('currency_symbol',         'Rs.'),
  ('vat_percentage',          '0'),
  ('tax_inclusive',           'true'),
  ('default_commission_rate', '5'),
  ('show_flash_sale',         'true'),
  ('show_newsletter',         'true'),
  ('show_why_shop',           'true'),
  ('show_categories',         'true'),
  ('facebook_url',            ''),
  ('instagram_url',           ''),
  ('tiktok_url',              ''),
  ('whatsapp_number',         ''),
  ('free_delivery_min',       '2500'),
  ('delivery_fee',            '350'),
  ('announcement_enabled',    'false'),
  ('announcement_text',       '🎉 Free delivery on orders over Rs. 2,500!'),
  ('announcement_bg',         '#8D153A'),
  ('announcement_link',       '/products'),
  ('primary_color',           '#FFD100'),
  ('secondary_color',         '#8D153A'),
  ('accent_color',            '#0D9488'),
  ('site_name',               'ARTIXO'),
  ('site_tagline',            'Sri Lanka''s #1 Multi-Vendor Marketplace'),
  ('support_email',           'support@artixo.lk'),
  ('support_phone',           '+94 11 000 0000'),
  ('address',                 'Colombo, Sri Lanka')
ON CONFLICT (key) DO NOTHING;

-- 3. Verify
SELECT count(*) as total_keys FROM site_settings;

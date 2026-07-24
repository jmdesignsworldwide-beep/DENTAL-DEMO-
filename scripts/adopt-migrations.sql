-- ══════════════════════════════════════════════════════════════════════
--  El ÚLTIMO SQL manual que corres. Se ejecuta UNA sola vez en el SQL Editor.
--
--  Qué hace: le dice a Supabase cuáles migraciones YA aplicaste a mano, para
--  que `supabase db push` (el auto-deploy desde Vercel) NO intente volver a
--  correrlas. De aquí en adelante, cada migración nueva se aplica sola en el
--  deploy de producción — sin volver a tocar el SQL Editor.
--
--  Cómo funciona: Supabase lleva el registro de migraciones aplicadas en la
--  tabla supabase_migrations.schema_migrations. Como tú aplicaste 0000–0018 a
--  mano (por el SQL Editor), esa tabla no lo sabe. Aquí la "sembramos" con esas
--  versiones. `db push` verá 0000–0018 como aplicadas y solo correrá lo nuevo.
-- ══════════════════════════════════════════════════════════════════════

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version    text primary key,
  statements text[],
  name       text
);

insert into supabase_migrations.schema_migrations (version, name) values
  ('0000', 'init'),
  ('0001', 'dashboard'),
  ('0002', 'patients'),
  ('0003', 'appointment_status'),
  ('0004', 'appointments'),
  ('0005', 'clinical'),
  ('0006', 'odontogram'),
  ('0007', 'anatomy'),
  ('0008', 'invoice_status'),
  ('0009', 'billing'),
  ('0010', 'treatments'),
  ('0011', 'inventory'),
  ('0012', 'waiting_room'),
  ('0013', 'patient_portal'),
  ('0014', 'staff_payroll'),
  ('0015', 'notifications'),
  ('0016', 'settings'),
  ('0017', 'treatment_budgets'),
  ('0018', 'communications')
  -- ── ¿Ya corriste 0019 (security_hardening) a mano en el SQL Editor? ──
  --   • Si SÍ: quita el "--" de la línea de abajo para marcarla como aplicada.
  --   • Si NO: déjala comentada; el auto-deploy la aplicará solo.
  -- , ('0019', 'security_hardening')
on conflict (version) do nothing;

-- Verificación: deberías ver las versiones sembradas.
select version, name from supabase_migrations.schema_migrations order by version;

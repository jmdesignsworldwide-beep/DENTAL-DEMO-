-- ══════════════════════════════════════════════════════════════════════
--  Identidades de prueba para la auditoría de seguridad (Tanda 21)
--  Crea 5 sujetos: uno por rol + uno desactivado. Idempotente.
--  NOTA: se ejecuta contra una base SHADOW/branch o el harness local, nunca
--  contra producción. Las UUID son fijas para que attacks.sql las referencie.
-- ══════════════════════════════════════════════════════════════════════

-- El guard `guard_profile_update` (correctamente) impide cambiar rol/activo por
-- vías normales. Para SEMBRAR las identidades de prueba lo desactivamos solo
-- durante el setup (requiere conexión dueña/elevada — es una herramienta de
-- auditoría, no una ruta de la app). Se reactiva al final.
alter table public.profiles disable trigger user;

insert into auth.users (id, email) values
  ('a5170000-0000-0000-0000-000000000001', 'audit.owner@demo.local'),
  ('a5170000-0000-0000-0000-000000000002', 'audit.dentista@demo.local'),
  ('a5170000-0000-0000-0000-000000000003', 'audit.recepcion@demo.local'),
  ('a5170000-0000-0000-0000-000000000004', 'audit.asistente@demo.local'),
  ('a5170000-0000-0000-0000-000000000005', 'audit.inactivo@demo.local')
on conflict (id) do nothing;

insert into public.profiles (id, nombre, rol, activo) values
  ('a5170000-0000-0000-0000-000000000001', 'Auditoría Owner',       'owner',        true),
  ('a5170000-0000-0000-0000-000000000002', 'Auditoría Dentista',    'dentista',     true),
  ('a5170000-0000-0000-0000-000000000003', 'Auditoría Recepción',   'recepcionista',true),
  ('a5170000-0000-0000-0000-000000000004', 'Auditoría Asistente',   'asistente',    true),
  ('a5170000-0000-0000-0000-000000000005', 'Auditoría Inactivo',    'asistente',    false)
on conflict (id) do update
  set rol = excluded.rol, activo = excluded.activo, nombre = excluded.nombre;

alter table public.profiles enable trigger user;

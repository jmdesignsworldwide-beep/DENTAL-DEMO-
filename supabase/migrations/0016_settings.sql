-- ══════════════════════════════════════════════════════════════════════
--  TANDA 16 — Configuración (control total del sistema)
--  Amplía clinic_settings con identidad, horarios y config de citas;
--  añade feriados dominicanos, usuarios del sistema (demo) y abre políticas
--  de owner sobre las secuencias NCF. RLS + FORCE, deny by default.
-- ══════════════════════════════════════════════════════════════════════

alter table public.clinic_settings
  add column if not exists direccion            text,
  add column if not exists telefono             text,
  add column if not exists email                text,
  add column if not exists rnc                  text,
  add column if not exists sitio_web            text,
  add column if not exists redes                jsonb not null default '{}'::jsonb,
  add column if not exists nivel_privacidad     text not null default 'inicial'
                             check (nivel_privacidad in ('completo', 'inicial', 'solo_nombre')),
  add column if not exists horario_semanal      jsonb not null default '{}'::jsonb,
  add column if not exists citas_config         jsonb not null default '{}'::jsonb,
  add column if not exists recordatorio_plantilla text,
  add column if not exists ncf_alerta_umbral    integer not null default 1000,
  add column if not exists last_backup_at       timestamptz;

update public.clinic_settings set
  direccion = coalesce(direccion, 'Av. Winston Churchill #90, Piantini, Santo Domingo'),
  telefono  = coalesce(telefono, '809-555-0100'),
  email     = coalesce(email, 'contacto@clinica.do'),
  rnc       = coalesce(rnc, '1-31-00000-0'),
  sitio_web = coalesce(sitio_web, 'www.clinicadental.do'),
  redes     = case when redes = '{}'::jsonb
                then '{"instagram":"@clinicadental.rd","facebook":"ClinicaDentalRD"}'::jsonb
                else redes end,
  horario_semanal = case when horario_semanal = '{}'::jsonb then
    '{"lun":{"abre":"08:00","cierra":"18:00","desc":["13:00","14:00"]},"mar":{"abre":"08:00","cierra":"18:00","desc":["13:00","14:00"]},"mie":{"abre":"08:00","cierra":"18:00","desc":["13:00","14:00"]},"jue":{"abre":"08:00","cierra":"18:00","desc":["13:00","14:00"]},"vie":{"abre":"08:00","cierra":"18:00","desc":["13:00","14:00"]},"sab":{"abre":"08:00","cierra":"13:00","desc":null},"dom":null}'::jsonb
    else horario_semanal end,
  citas_config = case when citas_config = '{}'::jsonb then
    '{"duracion_default":30,"intervalo_slot":30,"dias_anticipacion":60,"buffer_min":10,"cancelacion_horas":24,"recordatorio_horas":24,"recordatorio_canal":"whatsapp"}'::jsonb
    else citas_config end,
  recordatorio_plantilla = coalesce(recordatorio_plantilla,
    'Hola {paciente}, le recordamos su cita el {fecha} a las {hora} con {odontologo}. Clínica Dental. Responda CONFIRMAR para confirmar.'),
  last_backup_at = coalesce(last_backup_at, now() - interval '6 hours')
where id = 1;

-- ─── Feriados dominicanos (año en curso) ──────────────────────────────
create table if not exists public.clinic_holidays (
  id         uuid primary key default gen_random_uuid(),
  fecha      date not null unique,
  nombre     text not null,
  respetado  boolean not null default true
);
alter table public.clinic_holidays enable row level security;
alter table public.clinic_holidays force  row level security;

drop policy if exists clinic_holidays_select on public.clinic_holidays;
create policy clinic_holidays_select on public.clinic_holidays
  for select to authenticated using (public.is_active());
drop policy if exists clinic_holidays_write on public.clinic_holidays;
create policy clinic_holidays_write on public.clinic_holidays
  for update to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
drop policy if exists clinic_holidays_insert on public.clinic_holidays;
create policy clinic_holidays_insert on public.clinic_holidays
  for insert to authenticated with check (public.my_role() = 'owner');
grant select, insert, update on public.clinic_holidays to authenticated;

insert into public.clinic_holidays (fecha, nombre) values
  ((date_trunc('year', current_date) + interval '0 day')::date,   'Año Nuevo'),
  ((date_trunc('year', current_date) + interval '5 day')::date,   'Día de Reyes'),
  ((date_trunc('year', current_date) + interval '20 day')::date,  'Día de la Altagracia'),
  ((date_trunc('year', current_date) + interval '25 day')::date,  'Día de Duarte'),
  ((date_trunc('year', current_date) + interval '57 day')::date,  'Día de la Independencia'),
  ((date_trunc('year', current_date) + interval '120 day')::date, 'Día del Trabajo'),
  ((date_trunc('year', current_date) + interval '227 day')::date, 'Día de la Restauración'),
  ((date_trunc('year', current_date) + interval '266 day')::date, 'Día de las Mercedes'),
  ((date_trunc('year', current_date) + interval '309 day')::date, 'Día de la Constitución'),
  ((date_trunc('year', current_date) + interval '358 day')::date, 'Navidad')
on conflict (fecha) do nothing;

-- ─── Usuarios del sistema (demo de gestión de accesos) ────────────────
create table if not exists public.app_users (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  email          text not null,
  rol            text not null default 'asistente'
                   check (rol in ('owner', 'dentista', 'recepcionista', 'asistente')),
  estado         text not null default 'activo' check (estado in ('activo', 'inactivo')),
  ultimo_acceso  timestamptz,
  dispositivo    text,
  created_at     timestamptz not null default now()
);
alter table public.app_users enable row level security;
alter table public.app_users force  row level security;

drop policy if exists app_users_select on public.app_users;
create policy app_users_select on public.app_users
  for select to authenticated using (public.my_role() = 'owner');
drop policy if exists app_users_insert on public.app_users;
create policy app_users_insert on public.app_users
  for insert to authenticated with check (public.my_role() = 'owner');
drop policy if exists app_users_update on public.app_users;
create policy app_users_update on public.app_users
  for update to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
grant select, insert, update on public.app_users to authenticated;

insert into public.app_users (nombre, email, rol, estado, ultimo_acceso, dispositivo) values
  ('Dra. Carmen Objío',      'carmen.objio@clinica.do',   'owner',        'activo',   now() - interval '8 minutes',  'MacBook Pro · Santo Domingo'),
  ('Dra. Carolina Espaillat','carolina.espaillat@clinica.do','dentista',   'activo',   now() - interval '2 hours',    'iPhone 15 · Santiago'),
  ('Dr. Rafael Objío',       'rafael.objio@clinica.do',   'dentista',     'activo',   now() - interval '1 day',      'iPad Air · Santo Domingo'),
  ('Scarlet Batista',        'scarlet.batista@clinica.do','recepcionista','activo',   now() - interval '25 minutes', 'Windows 11 · Recepción'),
  ('Yamilet Cabrera',        'yamilet.cabrera@clinica.do','asistente',    'inactivo', now() - interval '18 days',    'Android · Santo Domingo')
on conflict do nothing;

-- ─── Políticas de owner sobre las secuencias NCF ──────────────────────
drop policy if exists ncf_sequences_select on public.ncf_sequences;
create policy ncf_sequences_select on public.ncf_sequences
  for select to authenticated using (public.my_role() = 'owner');
drop policy if exists ncf_sequences_update on public.ncf_sequences;
create policy ncf_sequences_update on public.ncf_sequences
  for update to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
grant select, update on public.ncf_sequences to authenticated;

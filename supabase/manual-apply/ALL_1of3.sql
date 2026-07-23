-- ══════════════════════════════════════════════════════════════════
--  APLICACIÓN MANUAL — CORRIDA 1 de 3   (migraciones 0000 → 0003)
--  Pega TODO este archivo en el SQL Editor de Supabase y dale Run.
--  Debe terminar sin error antes de correr el archivo 2 de 3.
--  (El enum de 0003 se confirma aquí; 0004 lo usa en la corrida 2.)
-- ══════════════════════════════════════════════════════════════════

-- ─────────── 0000_init.sql ───────────
-- ══════════════════════════════════════════════════════════════════════
--  SISTEMA DENTAL — Migración cero
--  Fort Knox desde la línea uno:
--    · RLS + FORCE en TODAS las tablas · deny by default · nunca USING(true)
--    · auditoría inmutable (sólo INSERT/SELECT, DELETE/UPDATE bloqueados en DB)
--    · triggers de perfil y anti-escalada de privilegios
--  Las migraciones nacen cerradas. Nunca se abren y cierran después.
-- ══════════════════════════════════════════════════════════════════════

-- ─── Enum de roles ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'role_type') then
    create type public.role_type as enum
      ('owner', 'dentista', 'recepcionista', 'asistente');
  end if;
end $$;

-- ─── Tabla profiles ───────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null default '',
  rol         public.role_type not null default 'asistente',
  activo      boolean not null default false,   -- deny by default: el owner activa
  avatar_url  text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles force  row level security;

-- ─── Tabla activity_log (auditoría inmutable) ─────────────────────────
create table if not exists public.activity_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity      text,
  entity_id   text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.activity_log enable row level security;
alter table public.activity_log force  row level security;

create index if not exists activity_log_actor_idx   on public.activity_log (actor_id);
create index if not exists activity_log_created_idx  on public.activity_log (created_at desc);

-- ─── Helper SECURITY DEFINER: rol del usuario actual sin recursión RLS ─
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = 'owner' and activo
  );
$$;

revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

-- ─── Políticas: profiles (deny by default, jamás USING(true)) ──────────
drop policy if exists profiles_select_own   on public.profiles;
drop policy if exists profiles_select_owner on public.profiles;
drop policy if exists profiles_update_own   on public.profiles;
drop policy if exists profiles_owner_all    on public.profiles;

-- Cada quien ve su propio perfil…
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- …y el owner ve todos.
create policy profiles_select_owner on public.profiles
  for select to authenticated
  using (public.is_owner());

-- Cada quien puede actualizar su propia fila (rol/activo protegidos por trigger).
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- El owner puede insertar/actualizar/eliminar cualquier perfil.
create policy profiles_owner_all on public.profiles
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- ─── Trigger anti-escalada: no-owner no cambia rol ni activo ──────────
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_owner() then
    return new;
  end if;
  if (new.rol is distinct from old.rol)
     or (new.activo is distinct from old.activo)
     or (new.id is distinct from old.id) then
    raise exception 'No autorizado a modificar rol, activo o id';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ─── Trigger: crear perfil al registrar usuario ───────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nombre)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Políticas: activity_log (sólo INSERT/SELECT) ─────────────────────
drop policy if exists activity_insert on public.activity_log;
drop policy if exists activity_select on public.activity_log;

create policy activity_insert on public.activity_log
  for insert to authenticated
  with check (auth.uid() is not null);

-- Sólo el owner lee el registro de auditoría.
create policy activity_select on public.activity_log
  for select to authenticated
  using (public.is_owner());

-- Sin políticas de UPDATE/DELETE → denegado por RLS.

-- ─── Inmutabilidad reforzada a nivel DB (bloquea incluso service_role) ─
create or replace function public.block_mutations()
returns trigger
language plpgsql
as $$
begin
  raise exception 'activity_log es inmutable: operación % bloqueada', tg_op;
end;
$$;

drop trigger if exists activity_no_update on public.activity_log;
drop trigger if exists activity_no_delete on public.activity_log;
create trigger activity_no_update
  before update on public.activity_log
  for each row execute function public.block_mutations();
create trigger activity_no_delete
  before delete on public.activity_log
  for each row execute function public.block_mutations();

-- ─── Grants explícitos (RLS sigue siendo la puerta real) ──────────────
grant select, insert, update on public.profiles     to authenticated;
grant select, insert         on public.activity_log to authenticated;
-- Nunca update/delete sobre activity_log:
revoke update, delete on public.activity_log from authenticated, anon;

-- ══════════════════════════════════════════════════════════════════════
--  Seed manual del owner (correr UNA vez tras crear el usuario en Auth):
--
--    update public.profiles
--       set rol = 'owner', activo = true, nombre = 'Dra. Nombre Apellido'
--     where id = (select id from auth.users where email = 'owner@clinica.do');
--
--  No se hardcodea aquí para no dejar credenciales ni datos en la migración.
-- ══════════════════════════════════════════════════════════════════════


-- ─────────── 0001_dashboard.sql ───────────
-- ══════════════════════════════════════════════════════════════════════
--  TANDA 2 — Dashboard
--  Tablas mínimas viables para poblar los KPIs, la banda de citas y el
--  feed. Se completan en sus tandas (patients→T3, appointments→T4,
--  invoices→T8). RLS + FORCE desde la creación, deny by default.
--  Nace cerrada: nunca se abre y cierra después.
-- ══════════════════════════════════════════════════════════════════════

-- ─── Enums ────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'appointment_status') then
    create type public.appointment_status as enum
      ('confirmada', 'sala_espera', 'en_sillon', 'completada', 'cancelada', 'no_show');
  end if;
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type public.invoice_status as enum ('pagada', 'pendiente', 'anulada');
  end if;
end $$;

-- ─── Helpers de autorización (SECURITY DEFINER, sin recursión RLS) ─────
create or replace function public.is_active()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and activo
  );
$$;
revoke all on function public.is_active() from public, anon;
grant execute on function public.is_active() to authenticated;

create or replace function public.my_role()
returns public.role_type
language sql stable security definer set search_path = public as $$
  select rol from public.profiles where id = auth.uid() and activo;
$$;
revoke all on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

-- ─── patients (mínimo viable — se completa en Tanda 3) ────────────────
create table if not exists public.patients (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  telefono    text,
  email       text,
  es_vip      boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.patients enable row level security;
alter table public.patients force  row level security;
create index if not exists patients_created_idx on public.patients (created_at desc);

-- ─── appointments (mínimo viable — se completa en Tanda 4) ────────────
--  dentista_id es opcional aquí; para el demo se muestra dentista_nombre
--  (denormalizado) hasta que el módulo de personal ligue perfiles reales.
create table if not exists public.appointments (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patients (id) on delete cascade,
  dentista_id     uuid references public.profiles (id) on delete set null,
  dentista_nombre text,
  fecha           date not null,
  hora            time not null,
  tratamiento     text not null,
  estado          public.appointment_status not null default 'confirmada',
  created_at      timestamptz not null default now()
);
alter table public.appointments enable row level security;
alter table public.appointments force  row level security;
create index if not exists appointments_fecha_idx on public.appointments (fecha, hora);
create index if not exists appointments_estado_idx on public.appointments (estado);

-- ─── invoices (mínimo viable — se completa en Tanda 8) ────────────────
create table if not exists public.invoices (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients (id) on delete cascade,
  monto       numeric(12, 2) not null check (monto >= 0),
  estado      public.invoice_status not null default 'pendiente',
  fecha       date not null default current_date,
  created_at  timestamptz not null default now()
);
alter table public.invoices enable row level security;
alter table public.invoices force  row level security;
create index if not exists invoices_fecha_idx on public.invoices (fecha desc);
create index if not exists invoices_estado_idx on public.invoices (estado);

-- ─── Políticas (deny by default, jamás USING(true)) ───────────────────
-- Pacientes y citas: visibles para todo el personal activo.
drop policy if exists patients_select on public.patients;
create policy patients_select on public.patients
  for select to authenticated using (public.is_active());

drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments
  for select to authenticated using (public.is_active());

-- Facturación: sensible → solo owner y recepción.
drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
  for select to authenticated
  using (public.my_role() in ('owner', 'recepcionista'));

grant select on public.patients     to authenticated;
grant select on public.appointments to authenticated;
grant select on public.invoices     to authenticated;

-- ══════════════════════════════════════════════════════════════════════
--  SEED — datos dominicanos realistas (relativos a CURRENT_DATE)
--  Se ejecuta como rol de migración (bypassa RLS). Idempotente por id.
-- ══════════════════════════════════════════════════════════════════════

insert into public.patients (id, nombre, telefono, email, es_vip, created_at) values
  ('00000000-0000-0000-0000-000000000001','María Altagracia Peña','809-555-0142','maria.pena@gmail.com', true,  now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000002','José Ramón Fernández','829-555-0198','jrfernandez@hotmail.com', false, now() - interval '4 days'),
  ('00000000-0000-0000-0000-000000000003','Carmen Yolanda Reyes','849-555-0177','cyreyes@gmail.com', false, now() - interval '5 days'),
  ('00000000-0000-0000-0000-000000000004','Luis Manuel Jiménez','809-555-0210','luismj@gmail.com', false, now() - interval '7 days'),
  ('00000000-0000-0000-0000-000000000005','Rosa Elena Martínez','829-555-0233','rosae.martinez@gmail.com', false, now() - interval '9 days'),
  ('00000000-0000-0000-0000-000000000006','Juan Carlos Rodríguez','809-555-0256','jcrodriguez@outlook.com', false, now() - interval '11 days'),
  ('00000000-0000-0000-0000-000000000007','Ana Mercedes Santos','849-555-0281','anamsantos@gmail.com', false, now() - interval '13 days'),
  ('00000000-0000-0000-0000-000000000008','Pedro Antonio Guzmán','809-555-0299','paguzman@gmail.com', false, now() - interval '16 days'),
  ('00000000-0000-0000-0000-000000000009','Yamilette Vásquez','829-555-0312','yami.vasquez@gmail.com', true,  now() - interval '18 days'),
  ('00000000-0000-0000-0000-000000000010','Francisco Alberto Núñez','809-555-0334','fanunez@gmail.com', false, now() - interval '20 days'),
  ('00000000-0000-0000-0000-000000000011','Altagracia Fermín','849-555-0358','a.fermin@gmail.com', false, now() - interval '22 days'),
  ('00000000-0000-0000-0000-000000000012','Ramón Emilio de la Cruz','809-555-0371','redelacruz@gmail.com', false, now() - interval '26 days'),
  ('00000000-0000-0000-0000-000000000013','Wilkin Encarnación','829-555-0390','wilkin.enc@gmail.com', false, now() - interval '31 days'),
  ('00000000-0000-0000-0000-000000000014','Scarlet Batista','849-555-0410','scarlet.batista@gmail.com', false, now() - interval '35 days'),
  ('00000000-0000-0000-0000-000000000015','Manuel de Jesús Then','809-555-0432','mdjthen@gmail.com', false, now() - interval '39 days'),
  ('00000000-0000-0000-0000-000000000016','Yohanna Paulino','829-555-0455','yohanna.p@gmail.com', false, now() - interval '43 days'),
  ('00000000-0000-0000-0000-000000000017','Elvis Danilo Ureña','809-555-0478','elvis.urena@gmail.com', false, now() - interval '47 days'),
  ('00000000-0000-0000-0000-000000000018','Massiel Ramírez','849-555-0491','massiel.ramirez@gmail.com', true,  now() - interval '52 days'),
  ('00000000-0000-0000-0000-000000000019','Starling Marte','809-555-0514','starling.marte@gmail.com', true,  now() - interval '56 days'),
  ('00000000-0000-0000-0000-000000000020','Nurys Cabrera','829-555-0537','nurys.cabrera@gmail.com', false, now() - interval '61 days')
on conflict (id) do nothing;

-- Citas de HOY — cubren todos los estados con código de color en la banda.
insert into public.appointments (id, patient_id, dentista_nombre, fecha, hora, tratamiento, estado) values
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Dra. Carolina Espaillat', current_date, '08:00','Profilaxis dental','completada'),
  ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Dr. Rafael Objío',       current_date, '08:30','Resina compuesta','completada'),
  ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003','Dra. Carolina Espaillat', current_date, '09:00','Endodoncia','en_sillon'),
  ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004','Dra. Patricia Read',      current_date, '09:30','Limpieza dental','sala_espera'),
  ('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000005','Dr. Rafael Objío',       current_date, '10:00','Corona de porcelana','confirmada'),
  ('10000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000006','Dra. Patricia Read',      current_date, '10:30','Blanqueamiento','confirmada'),
  ('10000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000007','Dra. Carolina Espaillat', current_date, '11:00','Extracción simple','no_show'),
  ('10000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000008','Dr. Rafael Objío',       current_date, '11:30','Ortodoncia (ajuste)','confirmada'),
  ('10000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000009','Dra. Patricia Read',      current_date, '14:00','Implante (evaluación)','confirmada'),
  ('10000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000010','Dra. Patricia Read',      current_date, '14:30','Limpieza dental','cancelada')
on conflict (id) do nothing;

-- Próximas citas — siguientes días.
insert into public.appointments (id, patient_id, dentista_nombre, fecha, hora, tratamiento, estado) values
  ('10000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000011','Dra. Carolina Espaillat', current_date + 1, '09:00','Limpieza dental','confirmada'),
  ('10000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000012','Dr. Rafael Objío',       current_date + 1, '10:00','Resina compuesta','confirmada'),
  ('10000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000013','Dra. Carolina Espaillat', current_date + 2, '09:30','Endodoncia','confirmada'),
  ('10000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000014','Dra. Patricia Read',      current_date + 2, '11:00','Blanqueamiento','confirmada'),
  ('10000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000015','Dr. Rafael Objío',       current_date + 3, '08:30','Corona de porcelana','confirmada'),
  ('10000000-0000-0000-0000-000000000016','00000000-0000-0000-0000-000000000016','Dra. Carolina Espaillat', current_date + 4, '10:30','Profilaxis dental','confirmada'),
  ('10000000-0000-0000-0000-000000000017','00000000-0000-0000-0000-000000000017','Dra. Patricia Read',      current_date + 5, '09:00','Extracción simple','confirmada'),
  ('10000000-0000-0000-0000-000000000018','00000000-0000-0000-0000-000000000018','Dr. Rafael Objío',       current_date + 6, '14:00','Ortodoncia (ajuste)','confirmada')
on conflict (id) do nothing;

-- Facturas pagadas — este mes y el anterior (alimentan KPI de ingresos + tendencia).
-- 3 por paciente cada mes, montos de precios dentales reales en RD$.
insert into public.invoices (patient_id, monto, estado, fecha)
select
  p.id,
  (array[1800, 2000, 2500, 3500, 8000, 12000, 18000, 25000, 45000])[1 + floor(random() * 9)::int],
  'pagada',
  (date_trunc('month', current_date)::date
    + (floor(random() * greatest(extract(day from current_date)::int - 1, 1)))::int)
from public.patients p, generate_series(1, 3);

insert into public.invoices (patient_id, monto, estado, fecha)
select
  p.id,
  (array[1800, 2000, 2500, 3500, 8000, 12000, 18000, 25000])[1 + floor(random() * 8)::int],
  'pagada',
  (date_trunc('month', current_date - interval '1 month')::date
    + (floor(random() * 27))::int)
from public.patients p, generate_series(1, 3);

-- Facturas pendientes (para futuros KPIs de cobranza).
insert into public.invoices (patient_id, monto, estado, fecha)
select p.id, 6500, 'pendiente', current_date - (floor(random() * 5))::int
from public.patients p
where p.es_vip = false
limit 5;

-- Feed de actividad — visible para owner (RLS). actor en meta (sin FK a perfiles).
insert into public.activity_log (actor_id, action, entity, meta, created_at) values
  (null, 'completó la cita de María Altagracia Peña', 'appointment', '{"actor":"Dra. Carolina Espaillat"}', now() - interval '8 minutes'),
  (null, 'registró un pago de RD$ 12,000',            'invoice',     '{"actor":"Recepción"}',               now() - interval '21 minutes'),
  (null, 'movió a Luis Manuel Jiménez a sala de espera','appointment','{"actor":"Recepción"}',              now() - interval '34 minutes'),
  (null, 'inició tratamiento de endodoncia',           'appointment', '{"actor":"Dra. Carolina Espaillat"}', now() - interval '52 minutes'),
  (null, 'creó el paciente Nurys Cabrera',             'patient',     '{"actor":"Recepción"}',               now() - interval '1 hour 18 minutes'),
  (null, 'agendó una cita para Scarlet Batista',       'appointment', '{"actor":"Recepción"}',               now() - interval '2 hours'),
  (null, 'emitió factura a Yamilette Vásquez',         'invoice',     '{"actor":"Recepción"}',               now() - interval '3 hours 5 minutes'),
  (null, 'actualizó el odontograma de Pedro Guzmán',   'patient',     '{"actor":"Dr. Rafael Objío"}',        now() - interval '4 hours'),
  (null, 'marcó no-show de Ana Mercedes Santos',       'appointment', '{"actor":"Recepción"}',               now() - interval '5 hours 22 minutes'),
  (null, 'registró nuevo paciente VIP Starling Marte', 'patient',     '{"actor":"Dra. Patricia Read"}',      now() - interval '6 hours');


-- ─────────── 0002_patients.sql ───────────
-- ══════════════════════════════════════════════════════════════════════
--  TANDA 3 — Pacientes (CRM completo)
--  Amplía patients con el expediente completo. RLS + FORCE ya activos
--  (T2); aquí se añaden columnas, índices, políticas de escritura por rol,
--  una vista de estadísticas (security_invoker) y Storage privado de fotos.
--  Nace cerrada: las políticas se definen restrictivas de una vez.
-- ══════════════════════════════════════════════════════════════════════

-- ─── Columnas del expediente ──────────────────────────────────────────
alter table public.patients
  add column if not exists cedula                        text,
  add column if not exists fecha_nacimiento              date,
  add column if not exists direccion                     text,
  add column if not exists tipo_sangre                   text,
  add column if not exists alergias                      text,
  add column if not exists medicamentos                  text,
  add column if not exists condiciones                   text,
  add column if not exists seguro                        text,
  add column if not exists poliza                        text,
  add column if not exists contacto_emergencia_nombre    text,
  add column if not exists contacto_emergencia_telefono  text,
  add column if not exists activo                         boolean not null default true,
  add column if not exists notas                          text,
  add column if not exists foto_path                      text,
  add column if not exists created_by                     uuid references public.profiles (id) on delete set null;

-- Cédula única (formato dominicano ###-#######-#) cuando está presente.
create unique index if not exists patients_cedula_key
  on public.patients (cedula) where cedula is not null;

-- Índices de búsqueda por nombre / teléfono.
create index if not exists patients_nombre_idx
  on public.patients using gin (to_tsvector('spanish', nombre));
create index if not exists patients_telefono_idx on public.patients (telefono);
create index if not exists patients_activo_idx   on public.patients (activo);

-- ─── Políticas de escritura por rol (lectura ya existe: patients_select) ─
--  Escriben owner, recepcionista y dentista. Asistente: solo lectura.
drop policy if exists patients_insert on public.patients;
create policy patients_insert on public.patients
  for insert to authenticated
  with check (public.my_role() in ('owner', 'recepcionista', 'dentista'));

drop policy if exists patients_update on public.patients;
create policy patients_update on public.patients
  for update to authenticated
  using (public.my_role() in ('owner', 'recepcionista', 'dentista'))
  with check (public.my_role() in ('owner', 'recepcionista', 'dentista'));

-- Sin política de DELETE → borrado duro imposible. Se desactiva (activo=false).

grant insert, update on public.patients to authenticated;

-- ─── Vista de estadísticas por paciente (respeta RLS del usuario) ─────
--  security_invoker: cada subconsulta corre con los permisos del que
--  consulta (un dentista no ve montos de facturas → total = 0).
create or replace view public.patient_overview
with (security_invoker = on) as
select
  p.*,
  (select max(a.fecha) from public.appointments a
     where a.patient_id = p.id and a.estado = 'completada'
       and a.fecha <= current_date)                              as ultima_visita,
  (select count(*) from public.appointments a
     where a.patient_id = p.id and a.estado = 'completada')       as num_tratamientos,
  (select min(a.fecha) from public.appointments a
     where a.patient_id = p.id and a.fecha >= current_date
       and a.estado in ('confirmada', 'sala_espera', 'en_sillon')) as proxima_cita,
  coalesce((select sum(i.monto) from public.invoices i
     where i.patient_id = p.id and i.estado = 'pagada'), 0)       as total_gastado
from public.patients p;

grant select on public.patient_overview to authenticated;

-- ─── Storage privado para fotos (defensivo: no rompe si faltan permisos) ─
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('patient-photos', 'patient-photos', false)
  on conflict (id) do nothing;

  drop policy if exists "patient_photos_select" on storage.objects;
  create policy "patient_photos_select" on storage.objects
    for select to authenticated
    using (bucket_id = 'patient-photos' and public.is_active());

  drop policy if exists "patient_photos_insert" on storage.objects;
  create policy "patient_photos_insert" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'patient-photos'
      and public.my_role() in ('owner', 'recepcionista', 'dentista'));

  drop policy if exists "patient_photos_update" on storage.objects;
  create policy "patient_photos_update" on storage.objects
    for update to authenticated
    using (bucket_id = 'patient-photos'
      and public.my_role() in ('owner', 'recepcionista', 'dentista'));
exception when insufficient_privilege or undefined_table then
  raise notice 'Storage no configurado por esta conexión; crea el bucket patient-photos (privado) y sus políticas manualmente.';
end $$;

-- ══════════════════════════════════════════════════════════════════════
--  SEED — 45 pacientes con cédulas de checksum válido (formato RD)
-- ══════════════════════════════════════════════════════════════════════

-- Helper temporal: genera una cédula dominicana con dígito verificador válido.
create or replace function public.demo_cedula(base bigint)
returns text language plpgsql as $$
declare ten text; i int; digit int; s int := 0; d int;
begin
  ten := lpad((base % 10000000000)::text, 10, '0');
  for i in 1..10 loop
    digit := substr(ten, i, 1)::int * (case when i % 2 = 1 then 1 else 2 end);
    if digit > 9 then digit := digit - 9; end if;
    s := s + digit;
  end loop;
  d := (10 - (s % 10)) % 10;
  return substr(ten, 1, 3) || '-' || substr(ten, 4, 7) || '-' || d::text;
end $$;

-- Completa el expediente de los 20 pacientes sembrados en T2.
with numbered as (
  select id, row_number() over (order by created_at) as rn
  from public.patients where cedula is null
)
update public.patients p set
  cedula = public.demo_cedula(40200000000 + n.rn * 7919),
  fecha_nacimiento = (date '1958-01-01' + (n.rn * 397) * interval '1 day')::date,
  direccion = (array[
    'C/ Duarte #45, Gazcue, Santo Domingo',
    'Av. 27 de Febrero #210, Santiago',
    'C/ El Sol #88, Los Jardines, Santiago',
    'Av. Independencia #150, Bella Vista, SD',
    'C/ Mella #12, San Pedro de Macorís',
    'Av. Estrella Sadhalá #33, Santiago',
    'C/ Beller #7, Puerto Plata',
    'Av. Winston Churchill #90, Piantini, SD'
  ])[1 + n.rn % 8],
  tipo_sangre = (array['O+','A+','B+','O-','A-','AB+','B-','AB-'])[1 + n.rn % 8],
  seguro = (array['ARS Humano','ARS SeNaSa','ARS Universal','Mapfre Salud','ARS Palic','ARS Monumental'])[1 + n.rn % 6],
  poliza = 'POL-' || lpad((100000 + n.rn * 337)::text, 6, '0'),
  contacto_emergencia_nombre = (array[
    'Josefina Peña','Manuel Fernández','Ana Reyes','Carlos Jiménez',
    'Luisa Martínez','Pedro Rodríguez','Rosa Santos','Miguel Guzmán'
  ])[1 + n.rn % 8],
  contacto_emergencia_telefono = '809-' || lpad((6000000 + n.rn * 971)::text, 7, '0'),
  alergias = case when n.rn % 4 = 0 then
    (array['Penicilina','Látex','Anestesia local (lidocaína)','Sulfas'])[1 + n.rn % 4]
    else null end,
  medicamentos = case when n.rn % 5 = 0 then
    (array['Warfarina (anticoagulante)','Losartán 50mg','Metformina 850mg','Aspirina 100mg'])[1 + n.rn % 4]
    else null end,
  condiciones = case when n.rn % 6 = 0 then
    (array['Diabetes tipo 2','Hipertensión arterial','Cardiopatía','Embarazo (2do trimestre)'])[1 + n.rn % 4]
    else null end,
  notas = case when n.rn % 3 = 0 then 'Paciente puntual. Prefiere citas en la mañana.' else null end,
  activo = (n.rn % 11 <> 0)
from numbered n
where n.id = p.id;

-- Inserta 25 pacientes nuevos con expediente completo.
insert into public.patients
  (nombre, telefono, email, es_vip, cedula, fecha_nacimiento, direccion,
   tipo_sangre, alergias, medicamentos, condiciones, seguro, poliza,
   contacto_emergencia_nombre, contacto_emergencia_telefono, activo, notas, created_at)
select
  d.nombre,
  '809-' || lpad((7000000 + d.i * 613)::text, 7, '0'),
  lower(replace(d.nombre, ' ', '.')) || '@gmail.com',
  (d.i % 7 = 0),
  public.demo_cedula(00100000000 + d.i * 6131),
  (date '1962-03-01' + (d.i * 421) * interval '1 day')::date,
  (array[
    'C/ José Reyes #23, Zona Colonial, SD',
    'Av. Luperón #77, Herrera, SD Oeste',
    'C/ Restauración #55, La Vega',
    'Av. Circunvalación #101, Punta Cana',
    'C/ Sánchez #34, Moca',
    'Av. Hermanas Mirabal #66, Salcedo',
    'C/ Duvergé #9, Barahona',
    'Av. Máximo Gómez #180, Villa Consuelo, SD'
  ])[1 + d.i % 8],
  (array['O+','A+','B+','O-','A-','AB+','B-','AB-'])[1 + d.i % 8],
  case when d.i % 4 = 1 then
    (array['Penicilina','Látex','Ibuprofeno','Sulfas'])[1 + d.i % 4] else null end,
  case when d.i % 5 = 2 then
    (array['Warfarina (anticoagulante)','Enalapril 10mg','Levotiroxina','Clopidogrel'])[1 + d.i % 4] else null end,
  case when d.i % 6 = 3 then
    (array['Hipertensión arterial','Diabetes tipo 2','Asma','Cardiopatía isquémica'])[1 + d.i % 4] else null end,
  (array['ARS Humano','ARS SeNaSa','ARS Universal','Mapfre Salud','ARS Palic','ARS Monumental'])[1 + d.i % 6],
  'POL-' || lpad((200000 + d.i * 449)::text, 6, '0'),
  (array['Yaneris Objío','Frank Mercedes','Delia Difó','Ramón Peguero','Sonia Severino'])[1 + d.i % 5],
  '829-' || lpad((5000000 + d.i * 733)::text, 7, '0'),
  true,
  case when d.i % 3 = 0 then 'Referido por otro paciente.' else null end,
  now() - (d.i * 5) * interval '1 day'
from (values
  ('Genesis Objío', 1), ('Kelvin Mercedes', 2), ('Anny Carolina Difó', 3),
  ('Robinson Peguero', 4), ('Yaquelin Severino', 5), ('Deivi Concepción', 6),
  ('Miguelina Abreu', 7), ('Fior Daliza Rosario', 8), ('Nelson Javier Ureña', 9),
  ('Katherine Frías', 10), ('Ambiorix Tejada', 11), ('Yudelka Beltré', 12),
  ('Franklin Mejía', 13), ('Dahiana Guerrero', 14), ('Esmeralda Pujols', 15),
  ('Wander Cordero', 16), ('Yeison Aybar', 17), ('Perla Montero', 18),
  ('Cristian Javier Polanco', 19), ('Noelia Castillo', 20), ('Bienvenido Sánchez', 21),
  ('Rafelina Disla', 22), ('Junior Alcántara', 23), ('Yokasta Feliz', 24),
  ('Domingo Antonio Pérez', 25)
) as d(nombre, i)
on conflict (cedula) do nothing;

-- El helper era solo para el seed: se elimina para no dejar superficie extra.
drop function if exists public.demo_cedula(bigint);


-- ─────────── 0003_appointment_status.sql ───────────
-- ══════════════════════════════════════════════════════════════════════
--  TANDA 4 — Estados de cita (parte 1/2)
--  Se añaden los valores nuevos del enum en su PROPIA migración: Postgres
--  no permite usar un valor de enum recién agregado dentro de la misma
--  transacción que lo crea. Aplicar este archivo ANTES del 0004.
-- ══════════════════════════════════════════════════════════════════════

alter type public.appointment_status add value if not exists 'pendiente';
alter type public.appointment_status add value if not exists 'seguimiento';

-- Nota: 'sala_espera' se interpreta como "en sala de espera" y 'en_sillon'
-- como "en curso / en el sillón" — se conservan para no romper T2/T3.



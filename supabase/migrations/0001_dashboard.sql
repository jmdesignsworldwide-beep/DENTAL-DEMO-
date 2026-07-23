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

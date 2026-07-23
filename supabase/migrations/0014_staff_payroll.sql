-- ══════════════════════════════════════════════════════════════════════
--  TANDA 14 — Personal y Nómina
--  Roster del equipo (perfiles, salario, comisión, horario), ausencias y
--  estado de pago de nómina por período. Datos sensibles: SOLO el owner.
--  RLS + FORCE, deny by default. Nace cerrada.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.staff (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  rol                text not null check (rol in ('dentista', 'asistente', 'recepcionista')),
  especialidad       text,
  exequatur          text,
  telefono           text,
  email              text,
  fecha_ingreso      date not null default current_date,
  estado             text not null default 'activo'
                       check (estado in ('activo', 'vacaciones', 'licencia', 'inactivo')),
  foto_path          text,
  salario_base       numeric(12,2) not null default 0,
  comision_pct       numeric(5,2) not null default 0 check (comision_pct >= 0 and comision_pct <= 100),
  horas_extra        numeric(12,2) not null default 0,
  otras_deducciones  numeric(12,2) not null default 0,
  color              text not null default '#0066CC',
  horario            jsonb not null default '{}'::jsonb,
  orden              integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.staff enable row level security;
alter table public.staff force  row level security;

drop policy if exists staff_select on public.staff;
create policy staff_select on public.staff
  for select to authenticated using (public.my_role() = 'owner');
drop policy if exists staff_insert on public.staff;
create policy staff_insert on public.staff
  for insert to authenticated with check (public.my_role() = 'owner');
drop policy if exists staff_update on public.staff;
create policy staff_update on public.staff
  for update to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
-- Sin DELETE: el personal se marca inactivo, no se borra.
grant select, insert, update on public.staff to authenticated;

-- ─── Ausencias (vacaciones / licencias / ausencias) ───────────────────
create table if not exists public.staff_absences (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid not null references public.staff (id) on delete cascade,
  tipo          text not null check (tipo in ('vacaciones', 'licencia', 'ausencia')),
  fecha_inicio  date not null,
  fecha_fin     date not null,
  motivo        text,
  created_at    timestamptz not null default now()
);
alter table public.staff_absences enable row level security;
alter table public.staff_absences force  row level security;
create index if not exists staff_absences_staff_idx on public.staff_absences (staff_id);

drop policy if exists staff_absences_select on public.staff_absences;
create policy staff_absences_select on public.staff_absences
  for select to authenticated using (public.my_role() = 'owner');
drop policy if exists staff_absences_write on public.staff_absences;
create policy staff_absences_write on public.staff_absences
  for insert to authenticated with check (public.my_role() = 'owner');
grant select, insert on public.staff_absences to authenticated;

-- ─── Estado de pago de nómina por período ─────────────────────────────
create table if not exists public.payroll_status (
  staff_id    uuid not null references public.staff (id) on delete cascade,
  periodo     text not null,               -- ej. 'mensual:2026-07'
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'pagada')),
  monto_neto  numeric(12,2),
  pagada_at   timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (staff_id, periodo)
);
alter table public.payroll_status enable row level security;
alter table public.payroll_status force  row level security;

drop policy if exists payroll_status_select on public.payroll_status;
create policy payroll_status_select on public.payroll_status
  for select to authenticated using (public.my_role() = 'owner');
drop policy if exists payroll_status_insert on public.payroll_status;
create policy payroll_status_insert on public.payroll_status
  for insert to authenticated with check (public.my_role() = 'owner');
drop policy if exists payroll_status_update on public.payroll_status;
create policy payroll_status_update on public.payroll_status
  for update to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
grant select, insert, update on public.payroll_status to authenticated;

-- ══════════════════════════════════════════════════════════════════════
--  SEED — equipo con nombres y especialidades reales dominicanas.
--  Los tres primeros coinciden con los dentistas ya sembrados en citas,
--  así el panel de rendimiento se alimenta de datos reales.
-- ══════════════════════════════════════════════════════════════════════
insert into public.staff
  (id, nombre, rol, especialidad, exequatur, telefono, email, fecha_ingreso, estado,
   salario_base, comision_pct, horas_extra, otras_deducciones, color, horario, orden)
values
  ('b0000000-0000-0000-0000-000000000001', 'Dra. Carolina Espaillat', 'dentista', 'Ortodoncista',
   'EXQ-18420', '809-412-7788', 'carolina.espaillat@clinica.do', date '2019-03-11', 'activo',
   85000, 12, 0, 0, '#0066CC',
   '{"lun":["08:00","18:00"],"mar":["08:00","18:00"],"mie":["08:00","18:00"],"jue":["08:00","18:00"],"vie":["08:00","18:00"],"sab":["08:00","13:00"]}'::jsonb, 1),

  ('b0000000-0000-0000-0000-000000000002', 'Dr. Rafael Objío', 'dentista', 'Endodoncista',
   'EXQ-15093', '809-556-2341', 'rafael.objio@clinica.do', date '2017-08-02', 'activo',
   80000, 15, 0, 8000, '#8B5CF6',
   '{"lun":["08:00","18:00"],"mar":["08:00","18:00"],"mie":["08:00","18:00"],"jue":["08:00","18:00"],"vie":["08:00","18:00"]}'::jsonb, 2),

  ('b0000000-0000-0000-0000-000000000003', 'Dra. Patricia Read', 'dentista', 'Odontopediatra',
   'EXQ-21876', '829-703-9910', 'patricia.read@clinica.do', date '2021-01-18', 'activo',
   70000, 10, 0, 0, '#00C896',
   '{"lun":["08:00","18:00"],"mar":["08:00","18:00"],"mie":["08:00","18:00"],"jue":["08:00","18:00"],"vie":["08:00","18:00"],"sab":["08:00","13:00"]}'::jsonb, 3),

  ('b0000000-0000-0000-0000-000000000004', 'Dr. Manuel Antonio Guzmán', 'dentista', 'Cirujano maxilofacial',
   'EXQ-13540', '809-330-4521', 'manuel.guzman@clinica.do', date '2016-05-23', 'licencia',
   95000, 18, 0, 0, '#EF4444',
   '{"mar":["08:00","14:00"],"jue":["08:00","14:00"]}'::jsonb, 4),

  ('b0000000-0000-0000-0000-000000000005', 'Dra. Rosángela Fermín', 'dentista', 'Periodoncista',
   'EXQ-24118', '829-441-6677', 'rosangela.fermin@clinica.do', date '2022-09-05', 'vacaciones',
   72000, 12, 0, 5000, '#F59E0B',
   '{"lun":["08:00","14:00"],"mie":["08:00","14:00"]}'::jsonb, 5),

  ('b0000000-0000-0000-0000-000000000006', 'Yamilet Cabrera', 'asistente', 'Asistente dental',
   null, '809-208-1194', 'yamilet.cabrera@clinica.do', date '2020-11-16', 'activo',
   28000, 0, 2500, 0, '#14B8A6',
   '{"lun":["08:00","18:00"],"mar":["08:00","18:00"],"mie":["08:00","18:00"],"jue":["08:00","18:00"],"vie":["08:00","18:00"],"sab":["08:00","13:00"]}'::jsonb, 6),

  ('b0000000-0000-0000-0000-000000000007', 'Scarlet Batista', 'recepcionista', 'Recepción y caja',
   null, '829-615-3302', 'scarlet.batista@clinica.do', date '2023-02-27', 'activo',
   32000, 0, 0, 3000, '#C9A84C',
   '{"lun":["08:00","18:00"],"mar":["08:00","18:00"],"mie":["08:00","18:00"],"jue":["08:00","18:00"],"vie":["08:00","18:00"],"sab":["08:00","13:00"]}'::jsonb, 7)
on conflict (id) do nothing;

-- Ausencias que explican los estados y crean cobertura visible.
insert into public.staff_absences (staff_id, tipo, fecha_inicio, fecha_fin, motivo)
select v.staff_id, v.tipo, v.fi, v.ff, v.motivo from (values
  ('b0000000-0000-0000-0000-000000000005'::uuid, 'vacaciones', current_date - 2, current_date + 8, 'Vacaciones programadas'),
  ('b0000000-0000-0000-0000-000000000004'::uuid, 'licencia',   current_date - 5, current_date + 5, 'Licencia médica'),
  ('b0000000-0000-0000-0000-000000000006'::uuid, 'ausencia',   current_date + 3, current_date + 3, 'Cita personal')
) as v(staff_id, tipo, fi, ff, motivo)
where not exists (
  select 1 from public.staff_absences a
  where a.staff_id = v.staff_id and a.fecha_inicio = v.fi and a.tipo = v.tipo
);

-- Marca como pagadas un par de nóminas del mes en curso (estado mixto en el demo).
insert into public.payroll_status (staff_id, periodo, estado, monto_neto, pagada_at)
select v.staff_id, 'mensual:' || to_char(current_date, 'YYYY-MM'), 'pagada', v.neto, now() - interval '2 days'
from (values
  ('b0000000-0000-0000-0000-000000000006'::uuid, 25120.00),
  ('b0000000-0000-0000-0000-000000000007'::uuid, 28430.00)
) as v(staff_id, neto)
on conflict (staff_id, periodo) do nothing;

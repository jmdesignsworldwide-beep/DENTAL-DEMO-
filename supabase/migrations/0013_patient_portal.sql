-- ══════════════════════════════════════════════════════════════════════
--  TANDA 13 — Portal del Paciente (mockup móvil)
--  Módulo visual: el portal se muestra DENTRO del sistema al personal.
--  Añade planes de tratamiento por etapas (progreso visual que ningún
--  competidor local ofrece) y deja tres pacientes demo en estados claros:
--  con plan + balance, con plan + al día, y sin plan + al día.
--  RLS + FORCE, deny by default. Nace cerrada.
-- ══════════════════════════════════════════════════════════════════════

-- ─── Planes de tratamiento (cabecera) ─────────────────────────────────
create table if not exists public.treatment_plans (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.patients (id) on delete cascade,
  titulo             text not null,
  tipo               text not null,
  estado             text not null default 'activo'
                       check (estado in ('activo', 'completado', 'pausado')),
  fecha_inicio       date not null default current_date,
  fecha_fin_estimada date,
  costo_total        numeric(12,2),
  notas              text,
  created_at         timestamptz not null default now(),
  created_by         uuid references public.profiles (id) on delete set null,
  updated_at         timestamptz not null default now()
);
alter table public.treatment_plans enable row level security;
alter table public.treatment_plans force  row level security;
create index if not exists treatment_plans_patient_idx
  on public.treatment_plans (patient_id);

drop policy if exists treatment_plans_select on public.treatment_plans;
create policy treatment_plans_select on public.treatment_plans
  for select to authenticated using (public.is_active());
drop policy if exists treatment_plans_insert on public.treatment_plans;
create policy treatment_plans_insert on public.treatment_plans
  for insert to authenticated
  with check (public.my_role() in ('owner', 'dentista'));
drop policy if exists treatment_plans_update on public.treatment_plans;
create policy treatment_plans_update on public.treatment_plans
  for update to authenticated
  using (public.my_role() in ('owner', 'dentista'))
  with check (public.my_role() in ('owner', 'dentista'));
-- Sin DELETE: los planes se pausan/completan, no se borran.
grant select, insert, update on public.treatment_plans to authenticated;

-- ─── Etapas del plan (progreso visual) ────────────────────────────────
create table if not exists public.treatment_plan_stages (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.treatment_plans (id) on delete cascade,
  orden        integer not null,
  titulo       text not null,
  descripcion  text,
  estado       text not null default 'pendiente'
                 check (estado in ('pendiente', 'en_progreso', 'completada')),
  fecha        date,
  created_at   timestamptz not null default now()
);
alter table public.treatment_plan_stages enable row level security;
alter table public.treatment_plan_stages force  row level security;
create index if not exists treatment_plan_stages_plan_idx
  on public.treatment_plan_stages (plan_id, orden);

drop policy if exists tps_select on public.treatment_plan_stages;
create policy tps_select on public.treatment_plan_stages
  for select to authenticated using (public.is_active());
drop policy if exists tps_insert on public.treatment_plan_stages;
create policy tps_insert on public.treatment_plan_stages
  for insert to authenticated
  with check (public.my_role() in ('owner', 'dentista'));
drop policy if exists tps_update on public.treatment_plan_stages;
create policy tps_update on public.treatment_plan_stages
  for update to authenticated
  using (public.my_role() in ('owner', 'dentista'))
  with check (public.my_role() in ('owner', 'dentista'));
grant select, insert, update on public.treatment_plan_stages to authenticated;

-- ══════════════════════════════════════════════════════════════════════
--  SEED — planes coherentes con pacientes ya sembrados (UUID fijos)
--  ...0001 María Altagracia Peña · ...0003 · ...0005
-- ══════════════════════════════════════════════════════════════════════

-- Plan de ORTODONCIA para María Altagracia Peña (...0001) — en curso.
insert into public.treatment_plans (id, patient_id, titulo, tipo, estado, fecha_inicio, fecha_fin_estimada, costo_total, notas)
values
  ('a0000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-000000000001',
   'Ortodoncia con brackets metálicos', 'ortodoncia', 'activo',
   current_date - 150, current_date + 240, 120000,
   'Tratamiento de alineación completo. Ajustes mensuales.')
on conflict (id) do nothing;

insert into public.treatment_plan_stages (plan_id, orden, titulo, descripcion, estado, fecha)
select 'a0000000-0000-0000-0000-0000000000a1', s.orden, s.titulo, s.descripcion, s.estado, s.fecha
from (values
  (1, 'Evaluación y estudio', 'Radiografías, fotos y toma de impresiones.', 'completada',  current_date - 150),
  (2, 'Colocación de brackets', 'Instalación del aparato en arco superior e inferior.', 'completada', current_date - 120),
  (3, 'Alineación inicial', 'Primeros arcos y nivelación de piezas.', 'completada', current_date - 80),
  (4, 'Ajustes mensuales', 'Fase activa de movimiento. Cita cada 4 semanas.', 'en_progreso', current_date - 20),
  (5, 'Cierre de espacios', 'Corrección fina de la mordida y espacios.', 'pendiente', null),
  (6, 'Retiro y retenedores', 'Remoción de brackets y entrega de retenedores.', 'pendiente', null)
) as s(orden, titulo, descripcion, estado, fecha)
where not exists (
  select 1 from public.treatment_plan_stages t
  where t.plan_id = 'a0000000-0000-0000-0000-0000000000a1' and t.orden = s.orden
);

-- Plan de ENDODONCIA para el paciente ...0003 — en curso, al día.
insert into public.treatment_plans (id, patient_id, titulo, tipo, estado, fecha_inicio, fecha_fin_estimada, costo_total, notas)
values
  ('a0000000-0000-0000-0000-0000000000a3',
   '00000000-0000-0000-0000-000000000003',
   'Endodoncia multirradicular (pieza 26)', 'endodoncia', 'activo',
   current_date - 24, current_date + 20, 18000,
   'Tratamiento de conducto en molar superior izquierdo.')
on conflict (id) do nothing;

insert into public.treatment_plan_stages (plan_id, orden, titulo, descripcion, estado, fecha)
select 'a0000000-0000-0000-0000-0000000000a3', s.orden, s.titulo, s.descripcion, s.estado, s.fecha
from (values
  (1, 'Apertura y limpieza', 'Acceso, remoción de pulpa y limpieza de conductos.', 'completada', current_date - 24),
  (2, 'Medicación intracanal', 'Desinfección y medicación entre sesiones.', 'en_progreso', current_date - 6),
  (3, 'Obturación y corona', 'Sellado de conductos y corona de porcelana.', 'pendiente', null)
) as s(orden, titulo, descripcion, estado, fecha)
where not exists (
  select 1 from public.treatment_plan_stages t
  where t.plan_id = 'a0000000-0000-0000-0000-0000000000a3' and t.orden = s.orden
);

-- ══════════════════════════════════════════════════════════════════════
--  SEED — estados de cuenta para los tres casos del demo
-- ══════════════════════════════════════════════════════════════════════

-- ...0001: factura de ortodoncia con balance pendiente (pago en cuotas).
do $$
declare v_inv uuid; v_sub numeric(12,2);
begin
  if not exists (
    select 1 from public.invoices
    where patient_id = '00000000-0000-0000-0000-000000000001'
      and notas = 'Plan de ortodoncia — pago en cuotas'
  ) then
    v_sub := round(120000 / 1.18, 2);
    insert into public.invoices
      (patient_id, monto, estado, fecha, ncf, tipo_ncf, subtotal, descuento_global, itbis, total, notas)
    values
      ('00000000-0000-0000-0000-000000000001', 120000, 'pagada_parcial',
       current_date - 90, public.next_ncf('B02'), 'B02',
       v_sub, 0, 120000 - v_sub, 120000, 'Plan de ortodoncia — pago en cuotas')
    returning id into v_inv;

    insert into public.invoice_items
      (invoice_id, descripcion, cantidad, precio_unitario, descuento_item, subtotal)
    values
      (v_inv, 'Ortodoncia con brackets metálicos — plan completo', 1, v_sub, 0, v_sub);

    insert into public.payments (invoice_id, metodo, monto, fecha) values
      (v_inv, 'efectivo',      15000, current_date - 85),
      (v_inv, 'transferencia', 15000, current_date - 55),
      (v_inv, 'tarjeta',       15000, current_date - 25);
    -- Balance pendiente: 120,000 − 45,000 = RD$ 75,000
  end if;
end $$;

-- ...0003 y ...0005: quedan completamente al día (pendientes → pagadas).
with saldadas as (
  update public.invoices
     set estado = 'pagada',
         metodo_pago = coalesce(metodo_pago, 'efectivo')
   where patient_id in (
           '00000000-0000-0000-0000-000000000003',
           '00000000-0000-0000-0000-000000000005')
     and estado in ('pendiente', 'pagada_parcial')
  returning id, total, fecha
)
insert into public.payments (invoice_id, metodo, monto, fecha)
select s.id, 'efectivo', s.total, s.fecha
from saldadas s
where not exists (select 1 from public.payments p where p.invoice_id = s.id);

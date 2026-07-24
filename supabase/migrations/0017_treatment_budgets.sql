-- ══════════════════════════════════════════════════════════════════════
--  TANDA 19 — Presupuestos y Planes de Tratamiento
--  Nombres SIN colisión con treatment_plans (Tanda 13, portal del paciente):
--  aquí son "treatment_budgets" (presupuestos que cierran ventas).
--  Se integra con patients, treatments, appointments, invoice_items.
--  RLS + FORCE, deny by default. Inmutabilidad de ítems aceptados y de la
--  bitácora del presupuesto a nivel DB. Versionado por enlace, sin sobrescribir.
-- ══════════════════════════════════════════════════════════════════════

-- ─── Presupuesto (cabecera) ───────────────────────────────────────────
create table if not exists public.treatment_budgets (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          uuid not null references public.patients (id) on delete cascade,
  odontologo_id       uuid references public.profiles (id) on delete set null,
  odontologo_nombre   text,
  titulo              text not null default 'Plan de tratamiento',
  diagnostico_general text,
  estado              text not null default 'borrador'
                        check (estado in ('borrador','presentado','aceptado',
                                          'aceptado_parcial','rechazado','vencido','completado')),
  fecha_vencimiento   date,
  descuento_global    numeric(12,2) not null default 0 check (descuento_global >= 0),
  total_estimado      numeric(12,2) not null default 0,
  notas               text,
  motivo_rechazo      text,
  version             integer not null default 1,
  version_de          uuid references public.treatment_budgets (id) on delete set null,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  presentado_at       timestamptz,
  respondido_at       timestamptz,
  updated_at          timestamptz not null default now()
);
alter table public.treatment_budgets enable row level security;
alter table public.treatment_budgets force  row level security;
create index if not exists tb_patient_idx on public.treatment_budgets (patient_id);
create index if not exists tb_estado_idx  on public.treatment_budgets (estado);

-- Todo el personal activo ve los presupuestos (la columna de diagnóstico se
-- filtra en el servidor para recepción/asistente). Escritura: owner/dentista.
drop policy if exists tb_select on public.treatment_budgets;
create policy tb_select on public.treatment_budgets
  for select to authenticated using (public.is_active());
drop policy if exists tb_insert on public.treatment_budgets;
create policy tb_insert on public.treatment_budgets
  for insert to authenticated with check (public.my_role() in ('owner','dentista'));
drop policy if exists tb_update on public.treatment_budgets;
create policy tb_update on public.treatment_budgets
  for update to authenticated
  using (public.my_role() in ('owner','dentista','recepcionista'))
  with check (public.my_role() in ('owner','dentista','recepcionista'));
-- Sin DELETE: los presupuestos se marcan rechazado/vencido, no se borran.
grant select, insert, update on public.treatment_budgets to authenticated;

-- ─── Ítems del presupuesto ────────────────────────────────────────────
create table if not exists public.treatment_budget_items (
  id               uuid primary key default gen_random_uuid(),
  budget_id        uuid not null references public.treatment_budgets (id) on delete cascade,
  tratamiento_id   uuid references public.treatments (id) on delete set null,
  diente_fdi       smallint,
  superficie       text,
  descripcion      text not null,
  cantidad         integer not null default 1 check (cantidad > 0),
  precio_unitario  numeric(12,2) not null default 0 check (precio_unitario >= 0),
  descuento_item   numeric(12,2) not null default 0 check (descuento_item >= 0),
  subtotal         numeric(12,2) not null default 0,
  duracion_min     integer not null default 30,
  prioridad        text not null default 'necesario' check (prioridad in ('urgente','necesario','electivo')),
  fase             smallint not null default 1,
  fase_nombre      text,
  opcion_grupo     text,                       -- ítems con el mismo grupo = alternativas (comparativa)
  orden            integer not null default 0,
  estado_item      text not null default 'pendiente'
                     check (estado_item in ('pendiente','aceptado','rechazado','agendado','completado')),
  motivo_rechazo   text,
  cita_id          uuid references public.appointments (id) on delete set null,
  invoice_item_id  uuid references public.invoice_items (id) on delete set null,
  created_at       timestamptz not null default now()
);
alter table public.treatment_budget_items enable row level security;
alter table public.treatment_budget_items force  row level security;
create index if not exists tbi_budget_idx on public.treatment_budget_items (budget_id);

drop policy if exists tbi_select on public.treatment_budget_items;
create policy tbi_select on public.treatment_budget_items
  for select to authenticated using (public.is_active());
drop policy if exists tbi_insert on public.treatment_budget_items;
create policy tbi_insert on public.treatment_budget_items
  for insert to authenticated with check (public.my_role() in ('owner','dentista'));
drop policy if exists tbi_update on public.treatment_budget_items;
create policy tbi_update on public.treatment_budget_items
  for update to authenticated
  using (public.my_role() in ('owner','dentista','recepcionista'))
  with check (public.my_role() in ('owner','dentista','recepcionista'));
drop policy if exists tbi_delete on public.treatment_budget_items;
create policy tbi_delete on public.treatment_budget_items
  for delete to authenticated using (public.my_role() in ('owner','dentista'));
grant select, insert, update, delete on public.treatment_budget_items to authenticated;

-- Inmutabilidad de ítems aceptados: una vez aceptado/agendado/completado, no se
-- puede cambiar precio ni descripción (eso exige una versión nueva del plan).
create or replace function public.budget_item_guard()
returns trigger language plpgsql as $$
begin
  if old.estado_item in ('aceptado','agendado','completado')
     and (old.precio_unitario is distinct from new.precio_unitario
          or old.descripcion is distinct from new.descripcion
          or old.tratamiento_id is distinct from new.tratamiento_id) then
    raise exception 'Ítem ya aceptado: precio y descripción son inmutables. Crea una versión nueva del presupuesto.';
  end if;
  return new;
end $$;
drop trigger if exists budget_item_guard_upd on public.treatment_budget_items;
create trigger budget_item_guard_upd before update on public.treatment_budget_items
  for each row execute function public.budget_item_guard();

-- Bloqueo de DELETE de ítems ya aceptados (histórico).
create or replace function public.budget_item_no_del_accepted()
returns trigger language plpgsql as $$
begin
  if old.estado_item in ('aceptado','agendado','completado') then
    raise exception 'No se borra un ítem ya aceptado del presupuesto.';
  end if;
  return old;
end $$;
drop trigger if exists budget_item_no_del on public.treatment_budget_items;
create trigger budget_item_no_del before delete on public.treatment_budget_items
  for each row execute function public.budget_item_no_del_accepted();

-- ─── Bitácora del presupuesto (inmutable: solo INSERT/SELECT) ──────────
create table if not exists public.treatment_budget_events (
  id          bigint generated always as identity primary key,
  budget_id   uuid not null references public.treatment_budgets (id) on delete cascade,
  tipo        text not null,
  detalle     text,
  usuario_id  uuid references public.profiles (id) on delete set null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
alter table public.treatment_budget_events enable row level security;
alter table public.treatment_budget_events force  row level security;
create index if not exists tbe_budget_idx on public.treatment_budget_events (budget_id, created_at desc);

drop policy if exists tbe_select on public.treatment_budget_events;
create policy tbe_select on public.treatment_budget_events
  for select to authenticated using (public.is_active());
drop policy if exists tbe_insert on public.treatment_budget_events;
create policy tbe_insert on public.treatment_budget_events
  for insert to authenticated with check (public.is_active());
grant select, insert on public.treatment_budget_events to authenticated;

create or replace function public.block_budget_events()
returns trigger language plpgsql as $$
begin
  raise exception 'La bitácora del presupuesto es inmutable: operación % bloqueada', tg_op;
end $$;
drop trigger if exists tbe_no_upd on public.treatment_budget_events;
drop trigger if exists tbe_no_del on public.treatment_budget_events;
create trigger tbe_no_upd before update on public.treatment_budget_events
  for each row execute function public.block_budget_events();
create trigger tbe_no_del before delete on public.treatment_budget_events
  for each row execute function public.block_budget_events();

-- ══════════════════════════════════════════════════════════════════════
--  SEED — 13 presupuestos reales en todos los estados del ciclo de venta.
--  Precios tomados del catálogo (treatments) por nombre, así el demo queda
--  siempre consistente con la lista de precios. Pacientes: los sembrados en
--  T2 (…0001–…0020). Odontólogos por nombre (profiles solo tiene al dueño).
--  Uno con comparativa de opciones (opcion_grupo) y uno versionado (v2).
-- ══════════════════════════════════════════════════════════════════════

-- Helper temporal: precio del catálogo por nombre (evita repetir montos).
create or replace function public.demo_precio(p_nombre text)
returns numeric language sql stable as $$
  select coalesce((select precio from public.treatments where nombre = p_nombre limit 1), 0);
$$;

-- ─── Cabeceras ────────────────────────────────────────────────────────
insert into public.treatment_budgets
  (id, patient_id, odontologo_nombre, titulo, diagnostico_general, estado,
   fecha_vencimiento, descuento_global, notas, motivo_rechazo, version, version_de,
   created_at, presentado_at, respondido_at)
values
  -- 1. Borrador (aún se está armando)
  ('bbbbbbbb-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',
   'Dra. Carolina Espaillat','Rehabilitación oral integral',
   'Múltiples caries, ausencia de pieza 16 y desgaste generalizado. Plan por fases.',
   'borrador', null, 0,
   'Pendiente de agregar la fase de estética antes de presentar.', null, 1, null,
   now() - interval '2 days', null, null),
  -- 2. Presentado (esperando respuesta del paciente)
  ('bbbbbbbb-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',
   'Dr. Rafael Objío','Plan de ortodoncia con brackets',
   'Apiñamiento dentario anterosuperior. Clase I. Ortodoncia fija 18–24 meses.',
   'presentado', current_date + 15, 5000,
   'Incluye control mensual el primer año. Financiamiento disponible.', null, 1, null,
   now() - interval '6 days', now() - interval '5 days', null),
  -- 3. Aceptado (aceptación total)
  ('bbbbbbbb-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003',
   'Dra. Patricia Read','Endodoncia y corona en pieza 46',
   'Pulpitis irreversible en 46 con destrucción coronaria extensa.',
   'aceptado', current_date + 20, 0,
   'Paciente aceptó el plan completo. Iniciar por la endodoncia.', null, 1, null,
   now() - interval '10 days', now() - interval '9 days', now() - interval '7 days'),
  -- 4. Aceptado parcial (aceptó parte)
  ('bbbbbbbb-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004',
   'Dra. Carolina Espaillat','Estética de sonrisa',
   'Tinción generalizada y diastema anterior. Interés estético.',
   'aceptado_parcial', current_date + 30, 2000,
   'Aceptó el blanqueamiento; pospone las carillas para más adelante.', null, 1, null,
   now() - interval '12 days', now() - interval '11 days', now() - interval '8 days'),
  -- 5. Rechazado (será re-presentado como v2 → #14)
  ('bbbbbbbb-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000005',
   'Dr. Rafael Objío','Implante unitario pieza 26',
   'Ausencia de 26. Indicado implante osteointegrado.',
   'rechazado', current_date - 5, 0,
   null, 'Costo fuera de presupuesto en este momento. Solicita alternativa.', 1, null,
   now() - interval '25 days', now() - interval '24 days', now() - interval '20 days'),
  -- 6. Vencido (se presentó y no respondió a tiempo)
  ('bbbbbbbb-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000006',
   'Dra. Patricia Read','Rehabilitación posterior',
   'Caries en 36 y 37, cálculo generalizado.',
   'vencido', current_date - 3, 0,
   'No hubo respuesta antes del vencimiento. Recontactar.', null, 1, null,
   now() - interval '40 days', now() - interval '38 days', null),
  -- 7. Completado (todo ejecutado)
  ('bbbbbbbb-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000007',
   'Dra. Carolina Espaillat','Restauración de dos piezas',
   'Caries oclusales en 14 y 15.',
   'completado', current_date - 30, 0,
   'Tratamiento finalizado. Control en 6 meses.', null, 1, null,
   now() - interval '60 days', now() - interval '58 days', now() - interval '55 days'),
  -- 8. Presentado (periodoncia)
  ('bbbbbbbb-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000008',
   'Dr. Rafael Objío','Tratamiento periodontal por cuadrantes',
   'Periodontitis crónica moderada generalizada. Bolsas 4–6 mm.',
   'presentado', current_date + 12, 3000,
   'Cuatro sesiones de raspado y alisado, una por cuadrante.', null, 1, null,
   now() - interval '4 days', now() - interval '3 days', null),
  -- 9. Aceptado (prevención)
  ('bbbbbbbb-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000009',
   'Dra. Patricia Read','Plan preventivo anual',
   'Paciente sano. Programa de mantenimiento y prevención.',
   'aceptado', current_date + 45, 0,
   'Dos limpiezas al año más aplicación de flúor.', null, 1, null,
   now() - interval '8 days', now() - interval '7 days', now() - interval '6 days'),
  -- 10. Borrador (cirugía)
  ('bbbbbbbb-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000010',
   'Dra. Carolina Espaillat','Extracción de cordales',
   'Terceros molares 38 y 48 retenidos, indicada exodoncia.',
   'borrador', null, 0,
   'Confirmar con radiografía panorámica antes de presentar.', null, 1, null,
   now() - interval '1 day', null, null),
  -- 11. Presentado CON COMPARATIVA DE OPCIONES (reemplazo de pieza 16)
  ('bbbbbbbb-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000011',
   'Dr. Rafael Objío','Reemplazo de pieza 16 — opciones',
   'Ausencia de primer molar superior derecho (16). Se presentan tres alternativas.',
   'presentado', current_date + 21, 0,
   'El paciente elige una de las tres opciones (A, B o C).', null, 1, null,
   now() - interval '3 days', now() - interval '2 days', null),
  -- 12. Aceptado (odontopediatría)
  ('bbbbbbbb-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000012',
   'Dra. Patricia Read','Atención odontopediátrica',
   'Paciente pediátrico con caries en molares temporales.',
   'aceptado', current_date + 25, 500,
   'Manejo de conducta favorable. Sellantes preventivos incluidos.', null, 1, null,
   now() - interval '9 days', now() - interval '8 days', now() - interval '5 days'),
  -- 13. Presentado (diseño de sonrisa premium)
  ('bbbbbbbb-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000013',
   'Dra. Carolina Espaillat','Diseño de sonrisa con carillas',
   'Solicitud estética. Seis carillas de porcelana anterosuperiores.',
   'presentado', current_date + 18, 10000,
   'Incluye diseño digital previo (mock-up). Garantía de 5 años.', null, 1, null,
   now() - interval '5 days', now() - interval '4 days', null),
  -- 14. VERSIÓN 2 del #5 rechazado (alternativa más económica)
  ('bbbbbbbb-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000005',
   'Dr. Rafael Objío','Reemplazo pieza 26 — alternativa (v2)',
   'Ausencia de 26. Alternativa a implante: puente fijo de tres unidades.',
   'presentado', current_date + 21, 4000,
   'Versión revisada tras el rechazo del implante. Opción más accesible.',
   null, 2, 'bbbbbbbb-0000-0000-0000-000000000005',
   now() - interval '18 days', now() - interval '17 days', null)
on conflict (id) do nothing;

-- ─── Ítems (subtotal = precio_unitario*cantidad − descuento_item) ──────
insert into public.treatment_budget_items
  (budget_id, tratamiento_id, diente_fdi, superficie, descripcion, cantidad,
   precio_unitario, descuento_item, subtotal, duracion_min, prioridad,
   fase_nombre, opcion_grupo, orden, estado_item)
select
  x.budget_id::uuid,
  (select id from public.treatments where nombre = x.trat limit 1),
  x.fdi, x.sup, coalesce(x.descripcion, x.trat), x.cant,
  public.demo_precio(x.trat), x.desc_item,
  public.demo_precio(x.trat) * x.cant - x.desc_item,
  (select duracion_min from public.treatments where nombre = x.trat limit 1),
  x.prioridad, x.fase_nombre, x.opcion_grupo, x.orden, x.estado_item
from (values
  -- Budget 1 (borrador): rehabilitación por fases
  ('bbbbbbbb-0000-0000-0000-000000000001','Destartraje (detartraje)',null::smallint,null::text,null::text,1,0::numeric,'urgente','Fase 1 — Higiene',null::text,1,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000001','Resina compuesta (2+ superficies)',36::smallint,'MOD','Resina en pieza 36',1,0::numeric,'necesario','Fase 2 — Restauración',null,2,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000001','Resina compuesta (1 superficie)',37::smallint,'O','Resina en pieza 37',1,0::numeric,'necesario','Fase 2 — Restauración',null,3,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000001','Implante dental (unitario)',16::smallint,null,'Implante en pieza 16',1,0::numeric,'electivo','Fase 3 — Rehabilitación',null,4,'pendiente'),
  -- Budget 2 (presentado): ortodoncia
  ('bbbbbbbb-0000-0000-0000-000000000002','Brackets metálicos (instalación)',null,null,'Instalación de brackets superior e inferior',1,0::numeric,'necesario','Fase 1 — Instalación',null,1,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000002','Ajuste mensual de ortodoncia',null,null,'Controles mensuales (12 meses)',12,0::numeric,'necesario','Fase 2 — Controles',null,2,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000002','Retenedores',null,null,'Retenedores post-ortodoncia',1,0::numeric,'necesario','Fase 3 — Retención',null,3,'pendiente'),
  -- Budget 3 (aceptado): endodoncia + corona → items aceptados
  ('bbbbbbbb-0000-0000-0000-000000000003','Endodoncia multirradicular',46::smallint,null,'Endodoncia en molar 46',1,0::numeric,'urgente','Fase 1 — Endodoncia',null,1,'aceptado'),
  ('bbbbbbbb-0000-0000-0000-000000000003','Corona metal-porcelana',46::smallint,null,'Corona sobre 46',1,0::numeric,'necesario','Fase 2 — Corona',null,2,'aceptado'),
  -- Budget 4 (aceptado_parcial): blanqueamiento aceptado, carillas rechazadas
  ('bbbbbbbb-0000-0000-0000-000000000004','Blanqueamiento en consultorio',null,null,'Blanqueamiento profesional',1,0::numeric,'electivo','Fase 1 — Blanqueamiento',null,1,'aceptado'),
  ('bbbbbbbb-0000-0000-0000-000000000004','Carilla de porcelana',11::smallint,null,'Carilla en 11',1,0::numeric,'electivo','Fase 2 — Carillas',null,2,'rechazado'),
  ('bbbbbbbb-0000-0000-0000-000000000004','Carilla de porcelana',21::smallint,null,'Carilla en 21',1,0::numeric,'electivo','Fase 2 — Carillas',null,3,'rechazado'),
  -- Budget 5 (rechazado): implante
  ('bbbbbbbb-0000-0000-0000-000000000005','Implante dental (unitario)',26::smallint,null,'Implante en pieza 26',1,0::numeric,'necesario','Fase única',null,1,'rechazado'),
  ('bbbbbbbb-0000-0000-0000-000000000005','Corona de porcelana (libre de metal)',26::smallint,null,'Corona sobre implante 26',1,0::numeric,'necesario','Fase única',null,2,'rechazado'),
  -- Budget 6 (vencido): restauración posterior
  ('bbbbbbbb-0000-0000-0000-000000000006','Destartraje (detartraje)',null,null,null,1,0::numeric,'necesario','Fase 1',null,1,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000006','Resina compuesta (2+ superficies)',36::smallint,'MOD',null,1,0::numeric,'necesario','Fase 2',null,2,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000006','Resina compuesta (1 superficie)',37::smallint,'O',null,1,0::numeric,'necesario','Fase 2',null,3,'pendiente'),
  -- Budget 7 (completado): dos resinas → completadas
  ('bbbbbbbb-0000-0000-0000-000000000007','Resina compuesta (1 superficie)',14::smallint,'O','Resina en 14',1,0::numeric,'necesario','Fase única',null,1,'completado'),
  ('bbbbbbbb-0000-0000-0000-000000000007','Resina compuesta (1 superficie)',15::smallint,'O','Resina en 15',1,0::numeric,'necesario','Fase única',null,2,'completado'),
  -- Budget 8 (presentado): periodoncia por cuadrantes
  ('bbbbbbbb-0000-0000-0000-000000000008','Curetaje y alisado radicular',null,null,'Cuadrante 1 (superior derecho)',1,0::numeric,'necesario','Cuadrante 1',null,1,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000008','Curetaje y alisado radicular',null,null,'Cuadrante 2 (superior izquierdo)',1,0::numeric,'necesario','Cuadrante 2',null,2,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000008','Curetaje y alisado radicular',null,null,'Cuadrante 3 (inferior izquierdo)',1,0::numeric,'necesario','Cuadrante 3',null,3,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000008','Curetaje y alisado radicular',null,null,'Cuadrante 4 (inferior derecho)',1,0::numeric,'necesario','Cuadrante 4',null,4,'pendiente'),
  -- Budget 9 (aceptado): preventivo → aceptado
  ('bbbbbbbb-0000-0000-0000-000000000009','Limpieza dental (profilaxis)',null,null,'Primera limpieza',1,0::numeric,'necesario','Semestre 1',null,1,'aceptado'),
  ('bbbbbbbb-0000-0000-0000-000000000009','Limpieza dental (profilaxis)',null,null,'Segunda limpieza',1,0::numeric,'necesario','Semestre 2',null,2,'aceptado'),
  ('bbbbbbbb-0000-0000-0000-000000000009','Aplicación de flúor',null,null,'Aplicación de flúor',1,0::numeric,'electivo','Semestre 1',null,3,'aceptado'),
  -- Budget 10 (borrador): cordales
  ('bbbbbbbb-0000-0000-0000-000000000010','Extracción de cordal (muela del juicio)',38::smallint,null,'Exodoncia de 38',1,0::numeric,'necesario','Fase única',null,1,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000010','Extracción de cordal (muela del juicio)',48::smallint,null,'Exodoncia de 48',1,0::numeric,'necesario','Fase única',null,2,'pendiente'),
  -- Budget 11 (COMPARATIVA): tres opciones para reemplazar 16
  ('bbbbbbbb-0000-0000-0000-000000000011','Implante dental (unitario)',16::smallint,null,'Opción A: Implante + corona',1,0::numeric,'necesario','Opción A — Implante','reemplazo_16',1,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000011','Corona de porcelana (libre de metal)',16::smallint,null,'Opción A: corona sobre implante',1,0::numeric,'necesario','Opción A — Implante','reemplazo_16',2,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000011','Puente fijo (por unidad)',16::smallint,null,'Opción B: Puente fijo de 3 unidades',3,0::numeric,'necesario','Opción B — Puente','reemplazo_16',3,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000011','Incrustación (inlay/onlay)',16::smallint,null,'Opción C: mantener espacio (provisional)',1,0::numeric,'electivo','Opción C — Provisional','reemplazo_16',4,'pendiente'),
  -- Budget 12 (aceptado): odontopediatría
  ('bbbbbbbb-0000-0000-0000-000000000012','Resina en diente temporal',54::smallint,'O','Resina en 54',1,0::numeric,'necesario','Fase 1',null,1,'aceptado'),
  ('bbbbbbbb-0000-0000-0000-000000000012','Corona de acero (pediátrica)',55::smallint,null,'Corona en 55',1,0::numeric,'necesario','Fase 1',null,2,'aceptado'),
  ('bbbbbbbb-0000-0000-0000-000000000012','Sellante de fosas y fisuras',null,null,'Sellantes preventivos (4 piezas)',4,0::numeric,'electivo','Fase 2 — Prevención',null,3,'aceptado'),
  -- Budget 13 (presentado): 6 carillas
  ('bbbbbbbb-0000-0000-0000-000000000013','Diseño de sonrisa (evaluación)',null,null,'Diseño digital previo (mock-up)',1,0::numeric,'necesario','Fase 1 — Diseño',null,1,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000013','Carilla de porcelana',13::smallint,null,'Carilla en 13',1,0::numeric,'necesario','Fase 2 — Carillas',null,2,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000013','Carilla de porcelana',12::smallint,null,'Carilla en 12',1,0::numeric,'necesario','Fase 2 — Carillas',null,3,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000013','Carilla de porcelana',11::smallint,null,'Carilla en 11',1,0::numeric,'necesario','Fase 2 — Carillas',null,4,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000013','Carilla de porcelana',21::smallint,null,'Carilla en 21',1,0::numeric,'necesario','Fase 2 — Carillas',null,5,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000013','Carilla de porcelana',22::smallint,null,'Carilla en 22',1,0::numeric,'necesario','Fase 2 — Carillas',null,6,'pendiente'),
  ('bbbbbbbb-0000-0000-0000-000000000013','Carilla de porcelana',23::smallint,null,'Carilla en 23',1,0::numeric,'necesario','Fase 2 — Carillas',null,7,'pendiente'),
  -- Budget 14 (v2 presentado): puente en vez de implante
  ('bbbbbbbb-0000-0000-0000-000000000014','Puente fijo (por unidad)',26::smallint,null,'Puente fijo de 3 unidades (25-26-27)',3,0::numeric,'necesario','Fase única',null,1,'pendiente')
) as x(budget_id, trat, fdi, sup, descripcion, cant, desc_item, prioridad, fase_nombre, opcion_grupo, orden, estado_item);

-- Total estimado = suma de subtotales − descuento global (nunca negativo).
update public.treatment_budgets b set
  total_estimado = greatest(
    coalesce((select sum(i.subtotal) from public.treatment_budget_items i
              where i.budget_id = b.id), 0) - b.descuento_global, 0)
where b.id::text like 'bbbbbbbb-%';

-- ─── Bitácora de los eventos del ciclo (inmutable) ────────────────────
insert into public.treatment_budget_events (budget_id, tipo, detalle, created_at)
select b.id, 'creado', 'Presupuesto creado', b.created_at
from public.treatment_budgets b where b.id::text like 'bbbbbbbb-%';

insert into public.treatment_budget_events (budget_id, tipo, detalle, created_at)
select b.id, 'presentado', 'Presentado al paciente', b.presentado_at
from public.treatment_budgets b where b.id::text like 'bbbbbbbb-%' and b.presentado_at is not null;

insert into public.treatment_budget_events (budget_id, tipo, detalle, created_at)
select b.id,
  case b.estado
    when 'aceptado' then 'aceptado'
    when 'aceptado_parcial' then 'aceptado_parcial'
    when 'rechazado' then 'rechazado'
    when 'completado' then 'completado'
  end,
  case b.estado
    when 'aceptado' then 'Paciente aceptó el plan completo'
    when 'aceptado_parcial' then 'Paciente aceptó parte del plan'
    when 'rechazado' then coalesce(b.motivo_rechazo, 'Plan rechazado')
    when 'completado' then 'Tratamiento completado'
  end,
  b.respondido_at
from public.treatment_budgets b
where b.id::text like 'bbbbbbbb-%' and b.respondido_at is not null
  and b.estado in ('aceptado','aceptado_parcial','rechazado','completado');

insert into public.treatment_budget_events (budget_id, tipo, detalle, meta, created_at)
select b.id, 'version_creada',
  'Nueva versión (v' || b.version || ') a partir de un plan anterior',
  jsonb_build_object('version', b.version, 'version_de', b.version_de),
  b.created_at
from public.treatment_budgets b
where b.id::text like 'bbbbbbbb-%' and b.version_de is not null;

-- El helper era solo para el seed: se elimina para no dejar superficie extra.
drop function if exists public.demo_precio(text);

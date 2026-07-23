-- ══════════════════════════════════════════════════════════════════
--  APLICACIÓN MANUAL — CORRIDA 3 de 3   (migraciones 0009 → 0016)
--  Corre esto DESPUÉS de que la corrida 2 haya terminado sin error.
-- ══════════════════════════════════════════════════════════════════

-- ─────────── 0009_billing.sql ───────────
-- ══════════════════════════════════════════════════════════════════════
--  TANDA 8 — Facturación (parte 2/2)
--  Facturas con NCF simulado (B01/B02), ítems, pagos y secuencias NCF.
--  Facturas inmutables una vez emitidas: solo cambian de estado / se anulan
--  con motivo. Ítems y pagos inmutables. RLS + FORCE. Aplicar tras 0008.
-- ══════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type public.payment_method as enum
      ('efectivo', 'transferencia', 'tarjeta', 'seguro', 'mixto');
  end if;
end $$;

-- ─── Secuencias NCF ───────────────────────────────────────────────────
create table if not exists public.ncf_sequences (
  tipo              text primary key,
  prefijo           text not null,
  secuencia_actual  bigint not null default 0,
  secuencia_final   bigint not null
);
alter table public.ncf_sequences enable row level security;
alter table public.ncf_sequences force  row level security;
-- Sin políticas: nadie accede directo. Solo next_ncf() (SECURITY DEFINER).

insert into public.ncf_sequences (tipo, prefijo, secuencia_actual, secuencia_final) values
  ('B01', 'B01', 0, 50000000),
  ('B02', 'B02', 0, 50000000)
on conflict (tipo) do nothing;

-- Emisor atómico de NCF. SECURITY DEFINER: incrementa saltando RLS.
create or replace function public.next_ncf(p_tipo text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare seq bigint; pref text;
begin
  update public.ncf_sequences
     set secuencia_actual = secuencia_actual + 1
   where tipo = p_tipo and secuencia_actual < secuencia_final
   returning secuencia_actual, prefijo into seq, pref;
  if seq is null then
    raise exception 'Secuencia NCF agotada o tipo inválido: %', p_tipo;
  end if;
  return pref || lpad(seq::text, 8, '0');
end $$;
revoke all on function public.next_ncf(text) from public, anon;
grant execute on function public.next_ncf(text) to authenticated;

-- ─── Ampliación de invoices ───────────────────────────────────────────
alter table public.invoices
  add column if not exists ncf                 text,
  add column if not exists tipo_ncf            text not null default 'B02',
  add column if not exists subtotal            numeric(12,2) not null default 0,
  add column if not exists descuento_global    numeric(12,2) not null default 0,
  add column if not exists itbis               numeric(12,2) not null default 0,
  add column if not exists total               numeric(12,2) not null default 0,
  add column if not exists metodo_pago         public.payment_method,
  add column if not exists notas               text,
  add column if not exists motivo_cancelacion  text,
  add column if not exists created_by          uuid references public.profiles (id) on delete set null;

alter table public.invoices
  drop constraint if exists invoices_tipo_ncf_check;
alter table public.invoices
  add constraint invoices_tipo_ncf_check check (tipo_ncf in ('B01', 'B02')) not valid;

-- ─── invoice_items ────────────────────────────────────────────────────
create table if not exists public.invoice_items (
  id               uuid primary key default gen_random_uuid(),
  invoice_id       uuid not null references public.invoices (id) on delete cascade,
  tratamiento_id   uuid,
  descripcion      text not null,
  cantidad         integer not null default 1 check (cantidad > 0),
  precio_unitario  numeric(12,2) not null check (precio_unitario >= 0),
  descuento_item   numeric(12,2) not null default 0 check (descuento_item >= 0),
  subtotal         numeric(12,2) not null,
  created_at       timestamptz not null default now()
);
alter table public.invoice_items enable row level security;
alter table public.invoice_items force  row level security;
create index if not exists invoice_items_invoice_idx on public.invoice_items (invoice_id);

-- ─── payments ─────────────────────────────────────────────────────────
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.invoices (id) on delete cascade,
  metodo       public.payment_method not null,
  monto        numeric(12,2) not null check (monto > 0),
  referencia   text,
  fecha        date not null default current_date,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null
);
alter table public.payments enable row level security;
alter table public.payments force  row level security;
create index if not exists payments_invoice_idx on public.payments (invoice_id);
-- Voucher de transferencia único (evita duplicados).
create unique index if not exists payments_transferencia_ref_key
  on public.payments (referencia)
  where metodo = 'transferencia' and referencia is not null;

-- ══════════════════════════════════════════════════════════════════════
--  BACKFILL de facturas sembradas en T2 (antes de crear los triggers)
-- ══════════════════════════════════════════════════════════════════════
with inv as (
  select id, monto, estado, row_number() over (order by created_at) rn
  from public.invoices where ncf is null
)
update public.invoices i set
  ncf              = public.next_ncf('B02'),
  tipo_ncf         = 'B02',
  subtotal         = round(i.monto / 1.18, 2),
  descuento_global = 0,
  itbis            = round(i.monto - round(i.monto / 1.18, 2), 2),
  total            = i.monto,
  metodo_pago      = case when i.estado = 'pagada'
                       then (array['efectivo','transferencia','tarjeta','seguro'])[1 + (inv.rn % 4)]::public.payment_method
                       else null end
from inv where inv.id = i.id;

-- Un ítem por factura sembrada.
insert into public.invoice_items (invoice_id, descripcion, cantidad, precio_unitario, descuento_item, subtotal)
select id, 'Servicios odontológicos', 1, subtotal, 0, subtotal
from public.invoices
where ncf is not null
  and not exists (select 1 from public.invoice_items it where it.invoice_id = invoices.id);

-- Pago por cada factura pagada.
insert into public.payments (invoice_id, metodo, monto, fecha)
select id, coalesce(metodo_pago, 'efectivo'), total, fecha
from public.invoices
where estado = 'pagada'
  and not exists (select 1 from public.payments p where p.invoice_id = invoices.id);

-- NCF único (todas asignadas ya).
create unique index if not exists invoices_ncf_key
  on public.invoices (ncf) where ncf is not null;

-- ══════════════════════════════════════════════════════════════════════
--  INMUTABILIDAD (después del backfill)
-- ══════════════════════════════════════════════════════════════════════
create or replace function public.invoices_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Las facturas no se borran: anula con motivo.';
  end if;
  -- Campos financieros e identidad son inmutables tras emitir.
  if old.ncf is distinct from new.ncf
     or old.subtotal is distinct from new.subtotal
     or old.itbis is distinct from new.itbis
     or old.total is distinct from new.total
     or old.descuento_global is distinct from new.descuento_global
     or old.tipo_ncf is distinct from new.tipo_ncf
     or old.patient_id is distinct from new.patient_id then
    raise exception 'Factura emitida inmutable: solo cambia estado/pago/motivo.';
  end if;
  return new;
end $$;

drop trigger if exists invoices_guard_upd on public.invoices;
drop trigger if exists invoices_guard_del on public.invoices;
create trigger invoices_guard_upd before update on public.invoices
  for each row execute function public.invoices_guard();
create trigger invoices_guard_del before delete on public.invoices
  for each row execute function public.invoices_guard();

create or replace function public.block_billing_children()
returns trigger language plpgsql as $$
begin
  raise exception 'Registro de facturación inmutable: operación % bloqueada', tg_op;
end $$;

drop trigger if exists invoice_items_no_upd on public.invoice_items;
drop trigger if exists invoice_items_no_del on public.invoice_items;
create trigger invoice_items_no_upd before update on public.invoice_items
  for each row execute function public.block_billing_children();
create trigger invoice_items_no_del before delete on public.invoice_items
  for each row execute function public.block_billing_children();

drop trigger if exists payments_no_upd on public.payments;
drop trigger if exists payments_no_del on public.payments;
create trigger payments_no_upd before update on public.payments
  for each row execute function public.block_billing_children();
create trigger payments_no_del before delete on public.payments
  for each row execute function public.block_billing_children();

-- ══════════════════════════════════════════════════════════════════════
--  POLÍTICAS (facturación: owner y recepcionista)
-- ══════════════════════════════════════════════════════════════════════
-- invoices_select ya existe (T2). Añadimos escritura.
drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices
  for insert to authenticated
  with check (public.my_role() in ('owner', 'recepcionista'));
drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices
  for update to authenticated
  using (public.my_role() in ('owner', 'recepcionista'))
  with check (public.my_role() in ('owner', 'recepcionista'));

do $$
declare t text;
begin
  foreach t in array array['invoice_items','payments'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format($f$create policy %1$I_select on public.%1$I
      for select to authenticated
      using (public.my_role() in ('owner','recepcionista'))$f$, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format($f$create policy %1$I_insert on public.%1$I
      for insert to authenticated
      with check (public.my_role() in ('owner','recepcionista'))$f$, t);
  end loop;
end $$;

grant insert, update         on public.invoices      to authenticated;
grant select, insert         on public.invoice_items to authenticated;
grant select, insert         on public.payments      to authenticated;
revoke update, delete on public.invoice_items from authenticated, anon;
revoke update, delete on public.payments      from authenticated, anon;


-- ─────────── 0010_treatments.sql ───────────
-- ══════════════════════════════════════════════════════════════════════
--  TANDA 9 — Catálogo de tratamientos
--  Alimenta el selector de citas y los ítems de factura. RLS + FORCE.
--  Lectura: todo el personal activo. Escritura: solo owner (admin de precios).
--  Sin DELETE (se desactivan). Nace cerrada.
-- ══════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_type where typname = 'treatment_category') then
    create type public.treatment_category as enum (
      'preventiva', 'restauradora', 'endodoncia', 'periodoncia',
      'cirugia_oral', 'ortodoncia', 'estetica', 'odontopediatria'
    );
  end if;
end $$;

create table if not exists public.treatments (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  descripcion  text,
  categoria    public.treatment_category not null,
  duracion_min integer not null default 30 check (duracion_min between 5 and 600),
  precio       numeric(12,2) not null check (precio >= 0),
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null,
  updated_at   timestamptz not null default now()
);
alter table public.treatments enable row level security;
alter table public.treatments force  row level security;
create index if not exists treatments_categoria_idx on public.treatments (categoria);
create index if not exists treatments_activo_idx on public.treatments (activo);

-- ─── Políticas ────────────────────────────────────────────────────────
drop policy if exists treatments_select on public.treatments;
create policy treatments_select on public.treatments
  for select to authenticated using (public.is_active());

drop policy if exists treatments_insert on public.treatments;
create policy treatments_insert on public.treatments
  for insert to authenticated with check (public.my_role() = 'owner');

drop policy if exists treatments_update on public.treatments;
create policy treatments_update on public.treatments
  for update to authenticated
  using (public.my_role() = 'owner')
  with check (public.my_role() = 'owner');
-- Sin DELETE.

grant select, insert, update on public.treatments to authenticated;

-- Ahora que existe la tabla, ligamos las FKs opcionales (no rompen datos previos).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'appointments_tratamiento_fk'
  ) then
    alter table public.appointments
      add constraint appointments_tratamiento_fk
      foreign key (tratamiento_id) references public.treatments (id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'invoice_items_tratamiento_fk'
  ) then
    alter table public.invoice_items
      add constraint invoice_items_tratamiento_fk
      foreign key (tratamiento_id) references public.treatments (id) on delete set null;
  end if;
end $$;

-- ══════════════════════════════════════════════════════════════════════
--  SEED — 41 tratamientos dentales reales (precios del mercado dominicano)
-- ══════════════════════════════════════════════════════════════════════
insert into public.treatments (nombre, descripcion, categoria, duracion_min, precio) values
  -- Preventiva
  ('Evaluación y diagnóstico', 'Consulta inicial con revisión clínica completa.', 'preventiva', 30, 1000),
  ('Limpieza dental (profilaxis)', 'Remoción de placa y sarro, pulido dental.', 'preventiva', 45, 2500),
  ('Aplicación de flúor', 'Barniz de flúor para fortalecer el esmalte.', 'preventiva', 20, 1200),
  ('Sellante de fosas y fisuras', 'Sellado preventivo de superficies oclusales.', 'preventiva', 30, 1500),
  ('Destartraje (detartraje)', 'Eliminación de cálculo supra y subgingival.', 'preventiva', 60, 3000),
  -- Restauradora
  ('Resina compuesta (1 superficie)', 'Obturación estética de una superficie.', 'restauradora', 45, 3000),
  ('Resina compuesta (2+ superficies)', 'Obturación estética de varias superficies.', 'restauradora', 60, 4500),
  ('Incrustación (inlay/onlay)', 'Restauración indirecta de laboratorio.', 'restauradora', 60, 9000),
  ('Corona metal-porcelana', 'Corona con base metálica y frente estético.', 'restauradora', 90, 15000),
  ('Corona de porcelana (libre de metal)', 'Corona totalmente estética.', 'restauradora', 90, 18000),
  ('Puente fijo (por unidad)', 'Rehabilitación de dientes ausentes.', 'restauradora', 90, 16000),
  -- Endodoncia
  ('Endodoncia unirradicular', 'Tratamiento de conducto en diente de una raíz.', 'endodoncia', 75, 12000),
  ('Endodoncia birradicular', 'Tratamiento de conducto en diente de dos raíces.', 'endodoncia', 90, 15000),
  ('Endodoncia multirradicular', 'Tratamiento de conducto en molar.', 'endodoncia', 120, 18000),
  ('Retratamiento endodóntico', 'Repetición de tratamiento de conducto.', 'endodoncia', 120, 20000),
  ('Pulpotomía', 'Remoción parcial de la pulpa dental.', 'endodoncia', 45, 6000),
  -- Periodoncia
  ('Curetaje y alisado radicular', 'Por cuadrante, tratamiento de periodontitis.', 'periodoncia', 60, 4500),
  ('Cirugía periodontal', 'Colgajo periodontal por cuadrante.', 'periodoncia', 90, 12000),
  ('Mantenimiento periodontal', 'Control y limpieza de soporte periodontal.', 'periodoncia', 45, 3500),
  ('Injerto de encía', 'Injerto gingival para recesiones.', 'periodoncia', 90, 18000),
  -- Cirugía oral
  ('Extracción simple', 'Extracción de diente erupcionado.', 'cirugia_oral', 30, 2500),
  ('Extracción quirúrgica', 'Extracción con abordaje quirúrgico.', 'cirugia_oral', 60, 6000),
  ('Extracción de cordal (muela del juicio)', 'Extracción de tercer molar.', 'cirugia_oral', 60, 8000),
  ('Implante dental (unitario)', 'Colocación de implante de titanio.', 'cirugia_oral', 90, 45000),
  ('Frenectomía', 'Corrección quirúrgica del frenillo.', 'cirugia_oral', 45, 9000),
  -- Ortodoncia
  ('Brackets metálicos (instalación)', 'Instalación de aparatología fija metálica.', 'ortodoncia', 90, 35000),
  ('Brackets estéticos (cerámicos)', 'Instalación de brackets cerámicos.', 'ortodoncia', 90, 55000),
  ('Alineadores invisibles', 'Tratamiento completo con alineadores.', 'ortodoncia', 60, 120000),
  ('Ajuste mensual de ortodoncia', 'Control y activación mensual.', 'ortodoncia', 30, 2500),
  ('Retenedores', 'Retención post-ortodoncia (par).', 'ortodoncia', 45, 8000),
  -- Estética
  ('Blanqueamiento en consultorio', 'Blanqueamiento profesional con lámpara.', 'estetica', 60, 8000),
  ('Blanqueamiento con férulas (casa)', 'Kit de blanqueamiento domiciliario.', 'estetica', 30, 6000),
  ('Carilla de resina', 'Carilla directa de resina compuesta.', 'estetica', 60, 7000),
  ('Carilla de porcelana', 'Carilla indirecta de porcelana.', 'estetica', 90, 22000),
  ('Diseño de sonrisa (evaluación)', 'Planificación estética digital.', 'estetica', 45, 3500),
  -- Odontopediatría
  ('Consulta pediátrica', 'Evaluación odontológica infantil.', 'odontopediatria', 30, 1200),
  ('Profilaxis infantil', 'Limpieza dental para niños.', 'odontopediatria', 30, 1800),
  ('Resina en diente temporal', 'Obturación en dentición primaria.', 'odontopediatria', 40, 2500),
  ('Corona de acero (pediátrica)', 'Corona preformada para molar temporal.', 'odontopediatria', 45, 4000),
  ('Aplicación de flúor infantil', 'Barniz de flúor pediátrico.', 'odontopediatria', 20, 1000),
  ('Mantenedor de espacio', 'Aparato para conservar espacio dental.', 'odontopediatria', 45, 6000)
on conflict do nothing;


-- ─────────── 0011_inventory.sql ───────────
-- ══════════════════════════════════════════════════════════════════════
--  TANDA 10 — Inventario de materiales
--  Materiales, proveedores, movimientos (entrada/salida) inmutables y
--  recetas de consumo por tratamiento. RLS + FORCE. Nace cerrada.
-- ══════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_type where typname = 'material_category') then
    create type public.material_category as enum (
      'anestesia', 'restauracion', 'impresion', 'endodoncia', 'implantes',
      'ortodoncia', 'bioseguridad', 'instrumental', 'radiologia', 'consumibles'
    );
  end if;
end $$;

-- ─── Proveedores ──────────────────────────────────────────────────────
create table if not exists public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  contacto   text,
  telefono   text,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.suppliers enable row level security;
alter table public.suppliers force  row level security;

-- ─── Materiales ───────────────────────────────────────────────────────
create table if not exists public.materials (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  categoria          public.material_category not null,
  unidad             text not null default 'unidad',
  stock_actual       numeric(12,2) not null default 0 check (stock_actual >= 0),
  stock_minimo       numeric(12,2) not null default 0 check (stock_minimo >= 0),
  costo_unitario     numeric(12,2) not null default 0 check (costo_unitario >= 0),
  proveedor_id       uuid references public.suppliers (id) on delete set null,
  ultima_reposicion  date,
  activo             boolean not null default true,
  created_at         timestamptz not null default now(),
  created_by         uuid references public.profiles (id) on delete set null,
  updated_at         timestamptz not null default now()
);
alter table public.materials enable row level security;
alter table public.materials force  row level security;
create index if not exists materials_categoria_idx on public.materials (categoria);

-- ─── Movimientos (auditoría inmutable) ────────────────────────────────
create table if not exists public.material_movements (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials (id) on delete cascade,
  tipo        text not null check (tipo in ('entrada', 'salida')),
  cantidad    numeric(12,2) not null check (cantidad > 0),
  motivo      text,
  fecha       date not null default current_date,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null
);
alter table public.material_movements enable row level security;
alter table public.material_movements force  row level security;
create index if not exists material_movements_material_idx on public.material_movements (material_id, fecha desc);

-- ─── Recetas: materiales por tratamiento ──────────────────────────────
create table if not exists public.treatment_materials (
  id            uuid primary key default gen_random_uuid(),
  treatment_id  uuid not null references public.treatments (id) on delete cascade,
  material_id   uuid not null references public.materials (id) on delete cascade,
  cantidad      numeric(12,2) not null default 1 check (cantidad > 0),
  unique (treatment_id, material_id)
);
alter table public.treatment_materials enable row level security;
alter table public.treatment_materials force  row level security;

-- ─── Políticas ────────────────────────────────────────────────────────
-- Lectura para todo el personal activo.
do $$
declare t text;
begin
  foreach t in array array['suppliers','materials','material_movements','treatment_materials'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format($f$create policy %1$I_select on public.%1$I
      for select to authenticated using (public.is_active())$f$, t);
  end loop;
end $$;

-- Escritura de catálogo (materiales/proveedores/recetas): owner y recepción.
create policy suppliers_write on public.suppliers
  for insert to authenticated with check (public.my_role() in ('owner','recepcionista'));
create policy suppliers_update on public.suppliers
  for update to authenticated using (public.my_role() in ('owner','recepcionista'))
  with check (public.my_role() in ('owner','recepcionista'));
create policy materials_write on public.materials
  for insert to authenticated with check (public.my_role() in ('owner','recepcionista'));
create policy materials_update on public.materials
  for update to authenticated using (public.my_role() in ('owner','recepcionista'))
  with check (public.my_role() in ('owner','recepcionista'));
create policy treatment_materials_write on public.treatment_materials
  for insert to authenticated with check (public.my_role() = 'owner');

-- Movimientos: los registra el personal clínico y de caja.
create policy material_movements_insert on public.material_movements
  for insert to authenticated
  with check (public.my_role() in ('owner','recepcionista','asistente'));

grant select, insert, update on public.suppliers           to authenticated;
grant select, insert, update on public.materials           to authenticated;
grant select, insert         on public.material_movements  to authenticated;
grant select, insert         on public.treatment_materials to authenticated;
revoke update, delete on public.material_movements from authenticated, anon;

-- Inmutabilidad de movimientos.
create or replace function public.block_material_movements()
returns trigger language plpgsql as $$
begin
  raise exception 'Los movimientos de inventario son inmutables: % bloqueado', tg_op;
end $$;
drop trigger if exists material_movements_no_upd on public.material_movements;
drop trigger if exists material_movements_no_del on public.material_movements;
create trigger material_movements_no_upd before update on public.material_movements
  for each row execute function public.block_material_movements();
create trigger material_movements_no_del before delete on public.material_movements
  for each row execute function public.block_material_movements();

-- ══════════════════════════════════════════════════════════════════════
--  SEED — proveedores
-- ══════════════════════════════════════════════════════════════════════
insert into public.suppliers (id, nombre, contacto, telefono) values
  ('00000000-0000-0000-0002-000000000001','Depósito Dental Dominicano','Ana Mejía','809-555-1001'),
  ('00000000-0000-0000-0002-000000000002','Dental Import SRL','Carlos Peña','809-555-1002'),
  ('00000000-0000-0000-0002-000000000003','Suplidora Odontológica del Caribe','Rosa Núñez','829-555-1003'),
  ('00000000-0000-0000-0002-000000000004','MedDental RD','Luis Fernández','809-555-1004'),
  ('00000000-0000-0000-0002-000000000005','Casa del Dentista','Miguel Santos','849-555-1005'),
  ('00000000-0000-0000-0002-000000000006','Ortho Supply RD','Yamile Objío','809-555-1006'),
  ('00000000-0000-0000-0002-000000000007','BioDental Import','Pedro Guzmán','829-555-1007'),
  ('00000000-0000-0000-0002-000000000008','Implant Solutions RD','Scarlet Read','809-555-1008')
on conflict (id) do nothing;

-- ══════════════════════════════════════════════════════════════════════
--  SEED — 55 materiales dentales reales (algunos bajo mínimo)
-- ══════════════════════════════════════════════════════════════════════
with sup as (
  select array[
    '00000000-0000-0000-0002-000000000001','00000000-0000-0000-0002-000000000002',
    '00000000-0000-0000-0002-000000000003','00000000-0000-0000-0002-000000000004',
    '00000000-0000-0000-0002-000000000005','00000000-0000-0000-0002-000000000006',
    '00000000-0000-0000-0002-000000000007','00000000-0000-0000-0002-000000000008'
  ]::uuid[] as ids
),
m(nombre, categoria, unidad, stock_actual, stock_minimo, costo) as (values
  ('Lidocaína 2% con epinefrina (cartuchos)','anestesia','cartucho',45,50,55),
  ('Articaína 4% (cartuchos)','anestesia','cartucho',120,60,75),
  ('Mepivacaína 3% (cartuchos)','anestesia','cartucho',30,40,65),
  ('Aguja dental corta 27G','anestesia','caja',18,10,220),
  ('Aguja dental larga 27G','anestesia','caja',8,10,220),
  ('Benzocaína tópica 20%','anestesia','frasco',12,5,480),
  ('Resina compuesta A2','restauracion','jeringa',25,15,950),
  ('Resina compuesta A3','restauracion','jeringa',22,15,950),
  ('Resina compuesta B1','restauracion','jeringa',9,12,950),
  ('Resina fluida A2','restauracion','jeringa',14,10,780),
  ('Ionómero de vidrio','restauracion','set',7,5,1200),
  ('Ácido grabador 37%','restauracion','jeringa',30,20,260),
  ('Adhesivo dental (bonding)','restauracion','frasco',16,10,1450),
  ('Amalgama (cápsulas)','restauracion','caja',6,8,1600),
  ('Alginato','impresion','kg',20,10,620),
  ('Silicona de adición pesada','impresion','set',5,4,2400),
  ('Silicona liviana (light body)','impresion','cartucho',11,8,1350),
  ('Cubetas de impresión desechables','impresion','paquete',40,20,350),
  ('Yeso piedra tipo IV','impresion','kg',25,15,480),
  ('Cera para mordida','impresion','caja',14,8,420),
  ('Limas K #15-40 (serie)','endodoncia','set',12,10,680),
  ('Limas rotatorias ProTaper','endodoncia','set',4,5,3200),
  ('Gutapercha (puntas)','endodoncia','caja',18,10,540),
  ('Conos de papel absorbente','endodoncia','caja',22,12,380),
  ('Sellador endodóntico AH Plus','endodoncia','set',6,4,2100),
  ('Hipoclorito de sodio 5.25%','endodoncia','litro',8,6,240),
  ('EDTA 17%','endodoncia','frasco',5,5,560),
  ('Implante de titanio 3.5mm','implantes','unidad',10,6,12500),
  ('Implante de titanio 4.0mm','implantes','unidad',8,6,12500),
  ('Pilar de cicatrización','implantes','unidad',12,8,3800),
  ('Tornillo de cobertura','implantes','unidad',15,10,1800),
  ('Membrana de regeneración','implantes','unidad',3,4,6500),
  ('Injerto óseo (0.5g)','implantes','frasco',5,4,8900),
  ('Brackets metálicos (kit)','ortodoncia','kit',9,6,4200),
  ('Brackets cerámicos (kit)','ortodoncia','kit',4,4,7800),
  ('Arco NiTi 0.014','ortodoncia','paquete',20,12,520),
  ('Ligaduras elásticas','ortodoncia','bolsa',30,15,180),
  ('Bandas molares','ortodoncia','caja',7,6,980),
  ('Cadena elastomérica','ortodoncia','rollo',11,8,260),
  ('Guantes de nitrilo M (caja 100)','bioseguridad','caja',35,20,620),
  ('Guantes de nitrilo S (caja 100)','bioseguridad','caja',12,20,620),
  ('Mascarillas quirúrgicas (caja 50)','bioseguridad','caja',40,20,350),
  ('Gorros desechables','bioseguridad','paquete',18,10,240),
  ('Batas desechables','bioseguridad','paquete',9,10,780),
  ('Campos desechables','bioseguridad','paquete',25,15,320),
  ('Fresas de diamante (surtido)','instrumental','set',16,10,890),
  ('Fresas de carburo','instrumental','set',10,8,760),
  ('Espejo bucal #5','instrumental','unidad',30,15,180),
  ('Explorador dental','instrumental','unidad',22,12,160),
  ('Películas radiográficas periapicales','radiologia','caja',6,8,1250),
  ('Líquido revelador','radiologia','litro',4,3,420),
  ('Rollos de algodón','consumibles','paquete',50,25,220),
  ('Eyectores de saliva','consumibles','paquete',45,25,190),
  ('Vasos desechables','consumibles','paquete',30,20,150),
  ('Servilletas de paciente','consumibles','paquete',28,15,240)
)
insert into public.materials
  (nombre, categoria, unidad, stock_actual, stock_minimo, costo_unitario, proveedor_id, ultima_reposicion)
select
  m.nombre, m.categoria::public.material_category, m.unidad,
  m.stock_actual, m.stock_minimo, m.costo,
  (select ids from sup)[1 + ((row_number() over ()) % 8)::int],
  (current_date - (((row_number() over ()) * 3) % 55)::int)
from m
on conflict do nothing;

-- Movimientos recientes (consumo del mes).
insert into public.material_movements (material_id, tipo, cantidad, motivo, fecha)
select id, 'salida', (2 + ((row_number() over ())::int % 4)), 'Consumo en tratamientos',
  (date_trunc('month', current_date)::date + ((row_number() over ())::int % greatest(extract(day from current_date)::int - 1, 1)))
from public.materials
limit 24;

-- Recetas de consumo por tratamiento.
insert into public.treatment_materials (treatment_id, material_id, cantidad)
select t.id, mat.id, x.cantidad
from (values
  ('Resina compuesta (1 superficie)','Resina compuesta A2',1),
  ('Resina compuesta (1 superficie)','Ácido grabador 37%',1),
  ('Resina compuesta (1 superficie)','Adhesivo dental (bonding)',1),
  ('Extracción simple','Lidocaína 2% con epinefrina (cartuchos)',2),
  ('Extracción simple','Guantes de nitrilo M (caja 100)',1),
  ('Endodoncia unirradicular','Limas K #15-40 (serie)',1),
  ('Endodoncia unirradicular','Gutapercha (puntas)',1),
  ('Endodoncia unirradicular','Hipoclorito de sodio 5.25%',1),
  ('Limpieza dental (profilaxis)','Guantes de nitrilo M (caja 100)',1),
  ('Implante dental (unitario)','Implante de titanio 4.0mm',1),
  ('Implante dental (unitario)','Injerto óseo (0.5g)',1)
) as x(trat, mat, cantidad)
join public.treatments t on t.nombre = x.trat
join public.materials mat on mat.nombre = x.mat
on conflict (treatment_id, material_id) do nothing;


-- ─────────── 0012_waiting_room.sql ───────────
-- ══════════════════════════════════════════════════════════════════════
--  TANDA 12 — Sala de espera (kiosco TV)
--  Configuración de clínica (consumida aquí y editada en T16), tokens de
--  pantalla (acceso de solo lectura sin credenciales de usuario) y
--  contenido rotativo. RLS + FORCE. La pantalla lee vía cliente admin en
--  servidor tras validar el token, devolviendo SOLO campos mínimos.
-- ══════════════════════════════════════════════════════════════════════

-- ─── Configuración de la clínica (singleton) ──────────────────────────
create table if not exists public.clinic_settings (
  id                  smallint primary key default 1 check (id = 1),
  nombre              text not null default 'Clínica Dental',
  eslogan             text default 'Tu sonrisa, nuestra pasión',
  mensaje_bienvenida  text default 'Bienvenido. En breve será atendido.',
  color_acento        text not null default '#0066CC',
  logo_path           text,
  mostrar_foto        boolean not null default false,
  apellido_inicial    boolean not null default false,
  consultorios        integer not null default 1 check (consultorios between 1 and 12),
  hora_apertura       time not null default '08:00',
  hora_cierre         time not null default '18:00',
  emergency_active    boolean not null default false,
  emergency_message   text,
  emergency_severity  text not null default 'warning' check (emergency_severity in ('warning','danger')),
  updated_at          timestamptz not null default now()
);
alter table public.clinic_settings enable row level security;
alter table public.clinic_settings force  row level security;

drop policy if exists clinic_settings_select on public.clinic_settings;
create policy clinic_settings_select on public.clinic_settings
  for select to authenticated using (public.is_active());
drop policy if exists clinic_settings_update on public.clinic_settings;
create policy clinic_settings_update on public.clinic_settings
  for update to authenticated
  using (public.my_role() in ('owner','recepcionista'))
  with check (public.my_role() in ('owner','recepcionista'));
grant select, update on public.clinic_settings to authenticated;

insert into public.clinic_settings (id) values (1) on conflict (id) do nothing;

-- ─── Tokens de pantalla (kiosco sin sesión) ───────────────────────────
create table if not exists public.screen_tokens (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  nombre      text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null
);
alter table public.screen_tokens enable row level security;
alter table public.screen_tokens force  row level security;
-- Solo el owner administra tokens. La validación del kiosco corre en
-- servidor con el cliente admin (no depende de estas políticas).
drop policy if exists screen_tokens_select on public.screen_tokens;
create policy screen_tokens_select on public.screen_tokens
  for select to authenticated using (public.my_role() = 'owner');
drop policy if exists screen_tokens_insert on public.screen_tokens;
create policy screen_tokens_insert on public.screen_tokens
  for insert to authenticated with check (public.my_role() = 'owner');
drop policy if exists screen_tokens_update on public.screen_tokens;
create policy screen_tokens_update on public.screen_tokens
  for update to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
grant select, insert, update on public.screen_tokens to authenticated;

insert into public.screen_tokens (token, nombre) values
  ('DEMO-SALA-2026', 'Pantalla sala de espera (demo)')
on conflict (token) do nothing;

-- ─── Contenido rotativo de la pantalla ────────────────────────────────
create table if not exists public.waiting_room_content (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('consejo','anuncio','recordatorio')),
  titulo      text not null,
  cuerpo      text not null,
  activo      boolean not null default true,
  orden       integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.waiting_room_content enable row level security;
alter table public.waiting_room_content force  row level security;
drop policy if exists wrc_select on public.waiting_room_content;
create policy wrc_select on public.waiting_room_content
  for select to authenticated using (public.is_active());
drop policy if exists wrc_write on public.waiting_room_content;
create policy wrc_write on public.waiting_room_content
  for insert to authenticated with check (public.my_role() = 'owner');
drop policy if exists wrc_update on public.waiting_room_content;
create policy wrc_update on public.waiting_room_content
  for update to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
grant select, insert, update on public.waiting_room_content to authenticated;

insert into public.waiting_room_content (tipo, titulo, cuerpo, orden) values
  ('consejo','Cepíllate dos veces al día','Dedica al menos dos minutos en cada cepillado, con movimientos suaves y circulares.',1),
  ('consejo','No olvides el hilo dental','El hilo dental elimina la placa entre los dientes donde el cepillo no llega. Úsalo a diario.',2),
  ('consejo','Cambia tu cepillo','Reemplaza tu cepillo cada 3 meses o cuando las cerdas se vean desgastadas.',3),
  ('recordatorio','Visítanos cada 6 meses','Una limpieza profesional cada seis meses previene caries y enfermedad de las encías.',4),
  ('consejo','Cuida lo que comes','Reduce el azúcar y los refrescos. El agua es la mejor amiga de tu sonrisa.',5),
  ('anuncio','Blanqueamiento con 15% off','Este mes, luce una sonrisa más brillante con nuestro blanqueamiento profesional.',6),
  ('anuncio','Ortodoncia invisible','Ya disponible: alineadores transparentes. Endereza tus dientes sin que se noten.',7),
  ('anuncio','Sábados extendidos','Ahora atendemos los sábados hasta las 2:00 PM para tu comodidad.',8)
on conflict do nothing;


-- ─────────── 0013_patient_portal.sql ───────────
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


-- ─────────── 0014_staff_payroll.sql ───────────
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


-- ─────────── 0015_notifications.sql ───────────
-- ══════════════════════════════════════════════════════════════════════
--  TANDA 15 — Centro de Notificaciones
--  Feed de la clínica (visible al personal activo) con estado de lectura,
--  y preferencias por usuario y canal. RLS + FORCE, deny by default.
--  Nace cerrada.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null,
  prioridad   text not null default 'media' check (prioridad in ('alta', 'media', 'baja')),
  titulo      text not null,
  cuerpo      text,
  entity      text,
  entity_id   uuid,
  meta        jsonb not null default '{}'::jsonb,
  leida       boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.notifications enable row level security;
alter table public.notifications force  row level security;
create index if not exists notifications_created_idx on public.notifications (created_at desc);
create index if not exists notifications_leida_idx on public.notifications (leida);

-- El personal activo ve el feed y puede marcar leídas.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated using (public.is_active());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated using (public.is_active()) with check (public.is_active());
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert to authenticated with check (public.my_role() in ('owner', 'recepcionista'));
grant select, insert, update on public.notifications to authenticated;

-- ─── Preferencias por usuario y canal ─────────────────────────────────
create table if not exists public.notification_prefs (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  tipo        text not null,
  in_app      boolean not null default true,
  email       boolean not null default false,
  whatsapp    boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (user_id, tipo)
);
alter table public.notification_prefs enable row level security;
alter table public.notification_prefs force  row level security;

-- Cada quien administra SOLO sus propias preferencias.
drop policy if exists notification_prefs_select on public.notification_prefs;
create policy notification_prefs_select on public.notification_prefs
  for select to authenticated using (user_id = auth.uid());
drop policy if exists notification_prefs_insert on public.notification_prefs;
create policy notification_prefs_insert on public.notification_prefs
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists notification_prefs_update on public.notification_prefs;
create policy notification_prefs_update on public.notification_prefs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.notification_prefs to authenticated;

-- ══════════════════════════════════════════════════════════════════════
--  SEED — notificaciones coherentes con pacientes, stock y facturas reales.
--  Mezcla de tipos, prioridades y estados (leídas / no leídas).
-- ══════════════════════════════════════════════════════════════════════
insert into public.notifications (tipo, prioridad, titulo, cuerpo, entity, meta, leida, created_at)
values
  -- Ahora (< 1 hora)
  ('sala_espera', 'alta', 'María Altagracia Peña llegó', 'En sala de espera para su ajuste de ortodoncia.', 'appointment', '{"paciente":"María Altagracia Peña","telefono":"809-555-0142"}'::jsonb, false, now() - interval '4 minutes'),
  ('sala_espera', 'alta', 'Luis Manuel Jiménez llegó', 'En sala de espera para limpieza dental.', 'appointment', '{"paciente":"Luis Manuel Jiménez","telefono":"809-555-0198"}'::jsonb, false, now() - interval '11 minutes'),
  ('sala_espera', 'alta', 'Scarlet Batista llegó', 'En sala de espera para evaluación.', 'appointment', '{"paciente":"Scarlet Batista","telefono":"829-555-0177"}'::jsonb, false, now() - interval '18 minutes'),
  ('cita_proxima', 'alta', 'Cita en 1 hora — Pedro Guzmán', 'Endodoncia con el Dr. Rafael Objío a las 11:00 AM.', 'appointment', '{"paciente":"Pedro Guzmán","telefono":"809-555-0233"}'::jsonb, false, now() - interval '25 minutes'),
  ('pago_recibido', 'media', 'Pago recibido — RD$ 12,000', 'Yamilette Vásquez pagó su factura por corona de porcelana.', 'invoice', '{"monto":12000,"paciente":"Yamilette Vásquez"}'::jsonb, false, now() - interval '38 minutes'),

  -- Hoy
  ('stock_agotado', 'alta', 'Agujas dentales 27G agotadas', 'Sin existencias. Reponer antes de la próxima jornada.', 'material', '{"material":"Agujas dentales 27G"}'::jsonb, false, now() - interval '2 hours'),
  ('stock_bajo', 'media', 'Anestesia (lidocaína 2%) bajo mínimo', 'Quedan 8 cartuchos, el mínimo es 20.', 'material', '{"material":"Lidocaína 2% con epinefrina","existencia":8,"minimo":20}'::jsonb, false, now() - interval '3 hours'),
  ('stock_bajo', 'media', 'Resina compuesta A2 bajo mínimo', 'Quedan 3 jeringas, el mínimo es 10.', 'material', '{"material":"Resina compuesta A2","existencia":3,"minimo":10}'::jsonb, true, now() - interval '4 hours'),
  ('stock_bajo', 'media', 'Guantes de nitrilo (M) bajo mínimo', 'Quedan 2 cajas, el mínimo es 6.', 'material', '{"material":"Guantes de nitrilo M","existencia":2,"minimo":6}'::jsonb, false, now() - interval '5 hours'),
  ('cumpleanos', 'baja', 'Hoy cumple años Ana Mercedes Santos', 'Envíale una felicitación — detalle que fideliza.', 'patient', '{"paciente":"Ana Mercedes Santos","telefono":"809-555-0311"}'::jsonb, false, now() - interval '6 hours'),
  ('cita_cancelada', 'media', 'Cita cancelada — Starling Marte', 'Canceló su cita de blanqueamiento de las 3:00 PM.', 'appointment', '{"paciente":"Starling Marte"}'::jsonb, true, now() - interval '7 hours'),
  ('factura_vencida', 'alta', 'Factura vencida — RD$ 6,500', 'La factura de Nurys Cabrera lleva 32 días vencida.', 'invoice', '{"monto":6500,"paciente":"Nurys Cabrera","dias":32}'::jsonb, false, now() - interval '9 hours'),

  -- Esta semana
  ('seguimiento', 'media', 'Seguimiento pendiente — endodoncia', 'Pedro Guzmán necesita su cita de colocación de corona.', 'patient', '{"paciente":"Pedro Guzmán"}'::jsonb, false, now() - interval '2 days'),
  ('ncf_agotandose', 'media', 'Secuencia NCF B02 al 82%', 'Quedan pocas secuencias disponibles del tipo B02.', 'ncf', '{"tipo":"B02","uso":82}'::jsonb, true, now() - interval '3 days'),
  ('pago_recibido', 'media', 'Pago recibido — RD$ 18,000', 'Ramón Peguero abonó a su plan de tratamiento.', 'invoice', '{"monto":18000,"paciente":"Ramón Peguero"}'::jsonb, true, now() - interval '4 days'),
  ('cita_cancelada', 'media', 'No-show — Deivi Concepción', 'No asistió a su cita de profilaxis.', 'appointment', '{"paciente":"Deivi Concepción"}'::jsonb, true, now() - interval '5 days'),

  -- Anteriores
  ('seguimiento', 'media', 'Seguimiento pendiente — ortodoncia', 'Katherine Frías tiene ajuste pendiente hace 6 semanas.', 'patient', '{"paciente":"Katherine Frías"}'::jsonb, true, now() - interval '9 days'),
  ('factura_vencida', 'alta', 'Factura saldada — RD$ 4,200', 'Yaquelin Severino saldó su factura vencida.', 'invoice', '{"monto":4200,"paciente":"Yaquelin Severino"}'::jsonb, true, now() - interval '12 days')
on conflict do nothing;


-- ─────────── 0016_settings.sql ───────────
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


-- ══════════════════════════════════════════════════════════════════
--  RED DE SEGURIDAD: buckets privados (ya se crean en 0002/0005)
-- ══════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public) values ('patient-photos', 'patient-photos', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('clinical-files',  'clinical-files',  false) on conflict (id) do nothing;

-- ══════════════════════════════════════════════════════════════════
--  ACTIVAR TU USUARIO OWNER  — ⚠️ CAMBIA el correo y el nombre por los tuyos.
--  Requiere haber creado tu usuario en Authentication → Users.
-- ══════════════════════════════════════════════════════════════════
update public.profiles
   set rol = 'owner', activo = true, nombre = 'Dra. Nombre Apellido'
 where id = (select id from auth.users where email = 'TU-CORREO@ejemplo.com');

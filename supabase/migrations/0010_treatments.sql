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

-- APLICACIÓN MANUAL — CORRIDA 2 de 3 (0004 → 0008).

-- ─── 0004_appointments.sql ───
-- ══════════════════════════════════════════════════════════════════════
--  TANDA 4 — Citas y Calendario (parte 2/2)
--  Amplía appointments, añade anti-solapamiento por odontólogo, políticas
--  de escritura por rol, índices y seed del mes actual y pasado reciente.
--  Aplicar DESPUÉS del 0003 (valores de enum ya committeados).
-- ══════════════════════════════════════════════════════════════════════

-- ─── Columnas nuevas ──────────────────────────────────────────────────
alter table public.appointments
  add column if not exists duracion_min        integer not null default 30,
  add column if not exists tratamiento_id      uuid,          -- FK al catálogo en Tanda 9
  add column if not exists notas               text,
  add column if not exists motivo_cancelacion  text,
  add column if not exists recordatorio_enviado boolean not null default false,
  add column if not exists created_by          uuid references public.profiles (id) on delete set null;

alter table public.appointments
  add constraint appointments_duracion_valida
  check (duracion_min between 10 and 480) not valid;

-- Columnas generadas para el anti-solapamiento (inmutables → STORED).
alter table public.appointments
  add column if not exists dentista_key text
    generated always as (coalesce(dentista_id::text, dentista_nombre)) stored;

alter table public.appointments
  add column if not exists periodo tsrange
    generated always as (
      tsrange(
        (fecha + hora),
        (fecha + hora) + make_interval(mins => duracion_min)
      )
    ) stored;

create index if not exists appointments_fecha_hora_idx on public.appointments (fecha, hora);
create index if not exists appointments_dentista_idx    on public.appointments (dentista_key);
create index if not exists appointments_created_by_idx  on public.appointments (created_by);

-- ─── Anti-solapamiento por odontólogo (defensivo: no rompe si falta ext) ─
--  Solo aplica a estados "vivos"; historicos/anulados quedan exentos.
do $$
begin
  create extension if not exists btree_gist with schema extensions;
  begin
    alter table public.appointments
      add constraint appointments_no_overlap
      exclude using gist (dentista_key with =, periodo with &&)
      where (
        dentista_key is not null
        and estado in ('pendiente','confirmada','sala_espera','en_sillon','seguimiento')
      );
  exception when others then
    raise notice 'No se pudo crear la exclusión de solapamiento (%). La validación server-side lo cubre.', sqlerrm;
  end;
exception when others then
  raise notice 'btree_gist no disponible; el anti-solapamiento queda a cargo del servidor.';
end $$;

-- ─── Políticas de escritura por rol (lectura ya existe: appointments_select) ─
--  Escriben owner, recepcionista y dentista. Asistente: solo lectura.
drop policy if exists appointments_insert on public.appointments;
create policy appointments_insert on public.appointments
  for insert to authenticated
  with check (public.my_role() in ('owner', 'recepcionista', 'dentista'));

drop policy if exists appointments_update on public.appointments;
create policy appointments_update on public.appointments
  for update to authenticated
  using (public.my_role() in ('owner', 'recepcionista', 'dentista'))
  with check (public.my_role() in ('owner', 'recepcionista', 'dentista'));

-- Sin DELETE: las citas se cancelan (estado='cancelada'), nunca se borran.

grant insert, update on public.appointments to authenticated;

-- ══════════════════════════════════════════════════════════════════════
--  SEED — citas del mes actual y pasado reciente (8am–6pm, sin domingos)
--  Construido sin solapamientos de odontólogo: 3 slots separados 3h.
-- ══════════════════════════════════════════════════════════════════════
with pac as (
  select array[
    '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000008',
    '00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000014',
    '00000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000016',
    '00000000-0000-0000-0000-000000000017','00000000-0000-0000-0000-000000000018',
    '00000000-0000-0000-0000-000000000019','00000000-0000-0000-0000-000000000020'
  ]::uuid[] as ids
),
dents as (
  select * from (values
    ('Dra. Carolina Espaillat', 0),
    ('Dr. Rafael Objío', 1),
    ('Dra. Patricia Read', 2)
  ) as d(nombre, idx)
),
slots as (select * from generate_series(0, 2) as s(n)),
days as (
  select (current_date - 28 + off)::date as f
  from generate_series(0, 42) as off
  -- Excluye los días que 0001 siembra a mano (hoy..+6). Así la rejilla y las
  -- citas hechas a mano nunca comparten día para un mismo odontólogo y no se
  -- pueden solapar (respeta appointments_no_overlap en cualquier fecha).
  where (current_date - 28 + off)::date not between current_date and current_date + 6
)
insert into public.appointments
  (patient_id, dentista_nombre, fecha, hora, duracion_min, tratamiento, estado)
select
  (select ids from pac)[
    1 + ((extract(day from d.f)::int * 3 + dents.idx * 7 + slots.n) % 20)
  ],
  dents.nombre,
  d.f,
  (array[time '08:00', time '11:00', time '14:00'])[slots.n + 1]
    + (dents.idx * interval '20 minutes'),
  (array[30, 45, 60, 90])[1 + ((extract(day from d.f)::int + slots.n) % 4)],
  (array[
    'Limpieza dental','Resina compuesta','Endodoncia','Extracción simple',
    'Corona de porcelana','Blanqueamiento','Ortodoncia (ajuste)',
    'Profilaxis dental','Implante (evaluación)','Sellante dental'
  ])[1 + ((extract(day from d.f)::int + dents.idx + slots.n) % 10)],
  (case
    when d.f < current_date then
      (array['completada','completada','completada','no_show','cancelada'])[1 + ((extract(day from d.f)::int + slots.n) % 5)]::public.appointment_status
    when d.f = current_date then 'completada'::public.appointment_status
    else
      (array['pendiente','confirmada','confirmada','seguimiento'])[1 + ((extract(day from d.f)::int + slots.n) % 4)]::public.appointment_status
  end)
from days d
cross join dents
cross join slots
where extract(dow from d.f) <> 0;  -- sin domingos


-- ─── 0005_clinical.sql ───
-- ══════════════════════════════════════════════════════════════════════
--  TANDA 5 — Historia Clínica
--  Expediente clínico por visita. Inmutable una vez FIRMADO: las
--  correcciones se hacen con una entrada de enmienda. RLS + FORCE, deny
--  by default. Recepcionista/asistente NO acceden a notas clínicas.
--  Nace cerrada.
-- ══════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_type where typname = 'attachment_type') then
    create type public.attachment_type as enum
      ('foto_antes', 'foto_despues', 'radiografia', 'consentimiento');
  end if;
end $$;

-- ─── clinical_records ─────────────────────────────────────────────────
create table if not exists public.clinical_records (
  id                        uuid primary key default gen_random_uuid(),
  patient_id                uuid not null references public.patients (id) on delete cascade,
  odontologo_id             uuid references public.profiles (id) on delete set null,
  odontologo_nombre         text,
  cita_id                   uuid references public.appointments (id) on delete set null,
  fecha                     date not null default current_date,
  motivo_consulta           text,
  diagnostico               text,
  tratamiento_realizado     text,
  materiales_usados         text,
  notas_clinicas            text,
  presion_arterial          text,
  frecuencia_cardiaca       integer check (frecuencia_cardiaca between 20 and 250),
  medicamentos_recetados    text,
  proxima_cita_recomendada  date,
  firmada                   boolean not null default false,
  es_enmienda               boolean not null default false,
  enmienda_de               uuid references public.clinical_records (id) on delete set null,
  created_at                timestamptz not null default now(),
  created_by                uuid references public.profiles (id) on delete set null
);
alter table public.clinical_records enable row level security;
alter table public.clinical_records force  row level security;
create index if not exists clinical_records_patient_idx on public.clinical_records (patient_id, fecha desc);

-- ─── clinical_attachments ─────────────────────────────────────────────
create table if not exists public.clinical_attachments (
  id            uuid primary key default gen_random_uuid(),
  record_id     uuid not null references public.clinical_records (id) on delete cascade,
  tipo          public.attachment_type not null,
  storage_path  text not null,
  descripcion   text,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null
);
alter table public.clinical_attachments enable row level security;
alter table public.clinical_attachments force  row level security;
create index if not exists clinical_attachments_record_idx on public.clinical_attachments (record_id);

-- ─── Políticas: solo owner y odontólogo (recepción/asistente NO) ──────
drop policy if exists clinical_records_select on public.clinical_records;
create policy clinical_records_select on public.clinical_records
  for select to authenticated using (public.my_role() in ('owner', 'dentista'));

drop policy if exists clinical_records_insert on public.clinical_records;
create policy clinical_records_insert on public.clinical_records
  for insert to authenticated with check (public.my_role() in ('owner', 'dentista'));

drop policy if exists clinical_records_update on public.clinical_records;
create policy clinical_records_update on public.clinical_records
  for update to authenticated
  using (public.my_role() in ('owner', 'dentista'))
  with check (public.my_role() in ('owner', 'dentista'));
-- Sin DELETE.

drop policy if exists clinical_attachments_select on public.clinical_attachments;
create policy clinical_attachments_select on public.clinical_attachments
  for select to authenticated using (public.my_role() in ('owner', 'dentista'));

drop policy if exists clinical_attachments_insert on public.clinical_attachments;
create policy clinical_attachments_insert on public.clinical_attachments
  for insert to authenticated with check (public.my_role() in ('owner', 'dentista'));
-- Sin UPDATE/DELETE.

grant select, insert, update on public.clinical_records     to authenticated;
grant select, insert         on public.clinical_attachments to authenticated;
revoke update, delete on public.clinical_attachments from authenticated, anon;

-- ─── Inmutabilidad: una vez firmada, no se edita ni borra ─────────────
create or replace function public.clinical_record_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'La historia clínica es inmutable: no se puede borrar (usa una enmienda).';
  end if;
  if tg_op = 'UPDATE' and old.firmada then
    raise exception 'Entrada firmada e inmutable: crea una enmienda en lugar de editar.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists clinical_records_guard_upd on public.clinical_records;
drop trigger if exists clinical_records_guard_del on public.clinical_records;
create trigger clinical_records_guard_upd
  before update on public.clinical_records
  for each row execute function public.clinical_record_guard();
create trigger clinical_records_guard_del
  before delete on public.clinical_records
  for each row execute function public.clinical_record_guard();

create or replace function public.block_mutations_attach()
returns trigger language plpgsql as $$
begin
  raise exception 'Los adjuntos clínicos son inmutables: operación % bloqueada', tg_op;
end $$;
drop trigger if exists clinical_attachments_no_update on public.clinical_attachments;
drop trigger if exists clinical_attachments_no_delete on public.clinical_attachments;
create trigger clinical_attachments_no_update
  before update on public.clinical_attachments
  for each row execute function public.block_mutations_attach();
create trigger clinical_attachments_no_delete
  before delete on public.clinical_attachments
  for each row execute function public.block_mutations_attach();

-- ─── Storage privado de archivos clínicos (defensivo) ─────────────────
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('clinical-files', 'clinical-files', false)
  on conflict (id) do nothing;

  drop policy if exists "clinical_files_select" on storage.objects;
  create policy "clinical_files_select" on storage.objects
    for select to authenticated
    using (bucket_id = 'clinical-files' and public.my_role() in ('owner', 'dentista'));

  drop policy if exists "clinical_files_insert" on storage.objects;
  create policy "clinical_files_insert" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'clinical-files' and public.my_role() in ('owner', 'dentista'));
exception when insufficient_privilege or undefined_table then
  raise notice 'Storage no configurado por esta conexión; crea el bucket clinical-files (privado) manualmente.';
end $$;

-- ══════════════════════════════════════════════════════════════════════
--  SEED — historias clínicas para 15 pacientes, varias visitas por meses
-- ══════════════════════════════════════════════════════════════════════
with pac as (
  select p.id, p.pidx
  from unnest(array[
    '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000008',
    '00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000014',
    '00000000-0000-0000-0000-000000000015'
  ]::uuid[]) with ordinality as p(id, pidx)
),
visitas as (select * from generate_series(1, 3) as v(n))
insert into public.clinical_records
  (patient_id, odontologo_nombre, fecha, motivo_consulta, diagnostico,
   tratamiento_realizado, materiales_usados, notas_clinicas, presion_arterial,
   frecuencia_cardiaca, medicamentos_recetados, proxima_cita_recomendada, firmada)
select
  pac.id,
  (array['Dra. Carolina Espaillat','Dr. Rafael Objío','Dra. Patricia Read'])[1 + ((pac.pidx + v.n) % 3)],
  (current_date - ((v.n - 1) * 45 + (pac.pidx * 2))::int),
  (array[
    'Dolor en molar inferior derecho','Control y limpieza de rutina',
    'Sangrado de encías al cepillado','Sensibilidad al frío y al dulce',
    'Revisión post-tratamiento','Chequeo general y profilaxis'
  ])[1 + ((pac.pidx + v.n) % 6)],
  (array[
    'Caries dental oclusal en pieza 36','Gingivitis moderada generalizada',
    'Periodontitis crónica localizada','Pulpitis irreversible en pieza 46',
    'Cálculo supragingival','Sensibilidad dentinaria por abrasión'
  ])[1 + ((pac.pidx * 2 + v.n) % 6)],
  (array[
    'Obturación con resina compuesta','Profilaxis y detartraje completo',
    'Tratamiento de conducto (endodoncia)','Curetaje y alisado radicular',
    'Aplicación tópica de flúor','Ajuste oclusal y pulido'
  ])[1 + ((pac.pidx * 2 + v.n) % 6)],
  (array[
    'Resina A2, ácido grabador, adhesivo','Ultrasonido, pasta profiláctica, flúor',
    'Limas K, gutapercha, sellador AH Plus','Anestesia lidocaína 2%, curetas Gracey',
    'Barniz de flúor 5%','Fresa de pulido, pasta abrasiva'
  ])[1 + ((pac.pidx + v.n) % 6)],
  (array[
    'Paciente colabora bien. Se recomienda mejorar técnica de cepillado y uso de hilo dental.',
    'Buena evolución. Higiene oral adecuada. Continuar controles cada 6 meses.',
    'Se observa inflamación gingival leve. Reforzar higiene interproximal.',
    'Paciente refiere mejoría del dolor. Cicatrización favorable sin complicaciones.',
    'Se indica enjuague con clorhexidina por 7 días. Control en 2 semanas.'
  ])[1 + ((pac.pidx + v.n) % 5)],
  (array['118/76','120/80','122/78','128/84','116/74','124/82'])[1 + ((pac.pidx + v.n) % 6)],
  68 + ((pac.pidx * 3 + v.n * 5) % 22),
  (array[
    'Amoxicilina 500mg c/8h por 7 días','Ibuprofeno 400mg c/8h por 3 días',
    'Enjuague de clorhexidina 0.12% c/12h',NULL,'Paracetamol 500mg si hay dolor',NULL
  ])[1 + ((pac.pidx * 2 + v.n) % 6)],
  (current_date - ((v.n - 1) * 45 + (pac.pidx * 2))::int + 180),
  true
from pac cross join visitas as v;


-- ─── 0006_odontogram.sql ───
-- ══════════════════════════════════════════════════════════════════════
--  TANDA 6 — Odontograma interactivo
--  Estado dental por pieza (FDI), historial inmutable por diente y
--  snapshots por visita. RLS + FORCE. Acceso clínico: owner, odontólogo
--  y asistente (asiste con notas del odontograma). Nace cerrada.
-- ══════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tooth_status') then
    create type public.tooth_status as enum
      ('sano', 'tratado', 'caries', 'extraccion_necesaria',
       'corona', 'implante', 'endodoncia', 'ausente');
  end if;
end $$;

-- Estado actual de cada pieza.
create table if not exists public.tooth_states (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients (id) on delete cascade,
  fdi          smallint not null,
  estado       public.tooth_status not null default 'sano',
  superficies  text[] not null default '{}',
  nota         text,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles (id) on delete set null,
  unique (patient_id, fdi)
);
alter table public.tooth_states enable row level security;
alter table public.tooth_states force  row level security;
create index if not exists tooth_states_patient_idx on public.tooth_states (patient_id);

-- Historial inmutable por diente.
create table if not exists public.tooth_events (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients (id) on delete cascade,
  fdi          smallint not null,
  estado       public.tooth_status not null,
  superficies  text[] not null default '{}',
  nota         text,
  fecha        date not null default current_date,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null
);
alter table public.tooth_events enable row level security;
alter table public.tooth_events force  row level security;
create index if not exists tooth_events_patient_fdi_idx on public.tooth_events (patient_id, fdi, fecha desc);

-- Snapshots del odontograma por visita (histórico inmutable).
create table if not exists public.odontogram_snapshots (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients (id) on delete cascade,
  fecha        date not null default current_date,
  etiqueta     text,
  snapshot     jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null
);
alter table public.odontogram_snapshots enable row level security;
alter table public.odontogram_snapshots force  row level security;
create index if not exists odontogram_snapshots_patient_idx on public.odontogram_snapshots (patient_id, fecha desc);

-- ─── Políticas: owner, odontólogo y asistente ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['tooth_states','tooth_events','odontogram_snapshots'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format($f$create policy %1$I_select on public.%1$I
      for select to authenticated
      using (public.my_role() in ('owner','dentista','asistente'))$f$, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format($f$create policy %1$I_insert on public.%1$I
      for insert to authenticated
      with check (public.my_role() in ('owner','dentista','asistente'))$f$, t);
  end loop;
end $$;

-- tooth_states además permite UPDATE (estado actual); events y snapshots NO.
drop policy if exists tooth_states_update on public.tooth_states;
create policy tooth_states_update on public.tooth_states
  for update to authenticated
  using (public.my_role() in ('owner','dentista','asistente'))
  with check (public.my_role() in ('owner','dentista','asistente'));

grant select, insert, update on public.tooth_states        to authenticated;
grant select, insert         on public.tooth_events        to authenticated;
grant select, insert         on public.odontogram_snapshots to authenticated;
revoke update, delete on public.tooth_events        from authenticated, anon;
revoke update, delete on public.odontogram_snapshots from authenticated, anon;

-- Inmutabilidad de historial/snapshots (bloquea incluso service_role).
create or replace function public.block_odontogram_history()
returns trigger language plpgsql as $$
begin
  raise exception 'Registro de odontograma inmutable: operación % bloqueada', tg_op;
end $$;

drop trigger if exists tooth_events_no_upd on public.tooth_events;
drop trigger if exists tooth_events_no_del on public.tooth_events;
create trigger tooth_events_no_upd before update on public.tooth_events
  for each row execute function public.block_odontogram_history();
create trigger tooth_events_no_del before delete on public.tooth_events
  for each row execute function public.block_odontogram_history();

drop trigger if exists snapshots_no_upd on public.odontogram_snapshots;
drop trigger if exists snapshots_no_del on public.odontogram_snapshots;
create trigger snapshots_no_upd before update on public.odontogram_snapshots
  for each row execute function public.block_odontogram_history();
create trigger snapshots_no_del before delete on public.odontogram_snapshots
  for each row execute function public.block_odontogram_history();

-- ══════════════════════════════════════════════════════════════════════
--  SEED — María Altagracia Peña (paciente 001): estados variados = WOW
-- ══════════════════════════════════════════════════════════════════════
insert into public.tooth_states (patient_id, fdi, estado, superficies, nota) values
  ('00000000-0000-0000-0000-000000000001', 16, 'corona',                '{}',        'Corona de porcelana colocada en 2025.'),
  ('00000000-0000-0000-0000-000000000001', 26, 'endodoncia',            '{O}',       'Tratamiento de conducto completado.'),
  ('00000000-0000-0000-0000-000000000001', 36, 'caries',                '{O,M}',     'Caries oclusal y mesial. Requiere obturación.'),
  ('00000000-0000-0000-0000-000000000001', 46, 'implante',              '{}',        'Implante de titanio, integración exitosa.'),
  ('00000000-0000-0000-0000-000000000001', 11, 'tratado',               '{V}',       'Restauración con resina en superficie vestibular.'),
  ('00000000-0000-0000-0000-000000000001', 21, 'caries',                '{M}',       'Caries interproximal incipiente.'),
  ('00000000-0000-0000-0000-000000000001', 24, 'extraccion_necesaria',  '{}',        'Fractura radicular. Se recomienda extracción.'),
  ('00000000-0000-0000-0000-000000000001', 38, 'ausente',               '{}',        'Tercer molar extraído previamente.'),
  ('00000000-0000-0000-0000-000000000001', 48, 'ausente',               '{}',        'Tercer molar ausente.'),
  ('00000000-0000-0000-0000-000000000001', 14, 'corona',                '{}',        'Corona metal-porcelana.'),
  ('00000000-0000-0000-0000-000000000001', 37, 'endodoncia',            '{O}',       'Endodoncia y reconstrucción.'),
  ('00000000-0000-0000-0000-000000000001', 45, 'tratado',               '{O}',       'Obturación con amalgama antigua, en buen estado.')
on conflict (patient_id, fdi) do nothing;

-- Algunos estados para otros pacientes (para que no abran en blanco).
insert into public.tooth_states (patient_id, fdi, estado, superficies) values
  ('00000000-0000-0000-0000-000000000002', 36, 'caries', '{O}'),
  ('00000000-0000-0000-0000-000000000002', 11, 'corona', '{}'),
  ('00000000-0000-0000-0000-000000000003', 46, 'endodoncia', '{O}'),
  ('00000000-0000-0000-0000-000000000003', 24, 'caries', '{D}')
on conflict (patient_id, fdi) do nothing;

-- Historial por diente para el paciente 001 (deriva de los estados).
insert into public.tooth_events (patient_id, fdi, estado, superficies, nota, fecha)
select patient_id, fdi, estado, superficies, nota, (current_date - 120)
from public.tooth_states
where patient_id = '00000000-0000-0000-0000-000000000001';

-- Snapshot histórico (hace ~6 meses, menos tratamientos) para comparar evolución.
insert into public.odontogram_snapshots (patient_id, fecha, etiqueta, snapshot) values
  ('00000000-0000-0000-0000-000000000001', current_date - 180, 'Evaluación inicial',
   '[{"fdi":36,"estado":"caries","superficies":["O"]},
     {"fdi":21,"estado":"caries","superficies":["M"]},
     {"fdi":24,"estado":"caries","superficies":["O"]},
     {"fdi":16,"estado":"caries","superficies":["O"]},
     {"fdi":38,"estado":"ausente","superficies":[]},
     {"fdi":48,"estado":"ausente","superficies":[]}]'::jsonb);


-- ─── 0007_anatomy.sql ───
-- ══════════════════════════════════════════════════════════════════════
--  TANDA 7 — Diagrama anatómico del diente
--  Marcas de afectación por zona anatómica (esmalte, dentina, pulpa,
--  conducto, raíz, ápice). Estado actual editable + historial inmutable.
--  RLS + FORCE. Acceso clínico: owner, odontólogo, asistente. Nace cerrada.
-- ══════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_type where typname = 'affectation_type') then
    create type public.affectation_type as enum
      ('caries_superficial', 'caries_profunda', 'pulpitis',
       'absceso', 'fractura', 'desgaste');
  end if;
end $$;

-- Marcas actuales (una por paciente+diente+zona). Se pueden desmarcar.
create table if not exists public.anatomy_marks (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients (id) on delete cascade,
  fdi          smallint not null,
  zona         text not null,
  tipo         public.affectation_type not null,
  nota         text,
  record_id    uuid references public.clinical_records (id) on delete set null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles (id) on delete set null,
  unique (patient_id, fdi, zona)
);
alter table public.anatomy_marks enable row level security;
alter table public.anatomy_marks force  row level security;
create index if not exists anatomy_marks_patient_fdi_idx on public.anatomy_marks (patient_id, fdi);

-- Historial inmutable (marcado/desmarcado por visita).
create table if not exists public.anatomy_events (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients (id) on delete cascade,
  fdi          smallint not null,
  zona         text not null,
  tipo         public.affectation_type,
  accion       text not null default 'marco',
  nota         text,
  fecha        date not null default current_date,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null
);
alter table public.anatomy_events enable row level security;
alter table public.anatomy_events force  row level security;
create index if not exists anatomy_events_patient_fdi_idx on public.anatomy_events (patient_id, fdi, fecha desc);

-- ─── Políticas: owner, odontólogo y asistente ─────────────────────────
drop policy if exists anatomy_marks_select on public.anatomy_marks;
create policy anatomy_marks_select on public.anatomy_marks
  for select to authenticated using (public.my_role() in ('owner','dentista','asistente'));
drop policy if exists anatomy_marks_insert on public.anatomy_marks;
create policy anatomy_marks_insert on public.anatomy_marks
  for insert to authenticated with check (public.my_role() in ('owner','dentista','asistente'));
drop policy if exists anatomy_marks_update on public.anatomy_marks;
create policy anatomy_marks_update on public.anatomy_marks
  for update to authenticated
  using (public.my_role() in ('owner','dentista','asistente'))
  with check (public.my_role() in ('owner','dentista','asistente'));
drop policy if exists anatomy_marks_delete on public.anatomy_marks;
create policy anatomy_marks_delete on public.anatomy_marks
  for delete to authenticated using (public.my_role() in ('owner','dentista','asistente'));

drop policy if exists anatomy_events_select on public.anatomy_events;
create policy anatomy_events_select on public.anatomy_events
  for select to authenticated using (public.my_role() in ('owner','dentista','asistente'));
drop policy if exists anatomy_events_insert on public.anatomy_events;
create policy anatomy_events_insert on public.anatomy_events
  for insert to authenticated with check (public.my_role() in ('owner','dentista','asistente'));

grant select, insert, update, delete on public.anatomy_marks  to authenticated;
grant select, insert                 on public.anatomy_events to authenticated;
revoke update, delete on public.anatomy_events from authenticated, anon;

-- Inmutabilidad del historial anatómico.
create or replace function public.block_anatomy_history()
returns trigger language plpgsql as $$
begin
  raise exception 'Historial anatómico inmutable: operación % bloqueada', tg_op;
end $$;
drop trigger if exists anatomy_events_no_upd on public.anatomy_events;
drop trigger if exists anatomy_events_no_del on public.anatomy_events;
create trigger anatomy_events_no_upd before update on public.anatomy_events
  for each row execute function public.block_anatomy_history();
create trigger anatomy_events_no_del before delete on public.anatomy_events
  for each row execute function public.block_anatomy_history();

-- ══════════════════════════════════════════════════════════════════════
--  SEED — marcas anatómicas para María Altagracia Peña (paciente 001)
-- ══════════════════════════════════════════════════════════════════════
insert into public.anatomy_marks (patient_id, fdi, zona, tipo, nota) values
  ('00000000-0000-0000-0000-000000000001', 36, 'dentina',       'caries_profunda',    'Caries que alcanza dentina en cara oclusal.'),
  ('00000000-0000-0000-0000-000000000001', 21, 'esmalte',       'caries_superficial', 'Lesión incipiente en esmalte mesial.'),
  ('00000000-0000-0000-0000-000000000001', 26, 'camara_pulpar', 'pulpitis',           'Pulpitis previa, resuelta con endodoncia.'),
  ('00000000-0000-0000-0000-000000000001', 24, 'raiz',          'fractura',           'Fractura radicular vertical.'),
  ('00000000-0000-0000-0000-000000000001', 46, 'apice',         'absceso',            'Absceso periapical previo al implante.')
on conflict (patient_id, fdi, zona) do nothing;

insert into public.anatomy_events (patient_id, fdi, zona, tipo, accion, nota, fecha)
select patient_id, fdi, zona, tipo, 'marco', nota, current_date - 120
from public.anatomy_marks
where patient_id = '00000000-0000-0000-0000-000000000001';


-- ─── 0008_invoice_status.sql ───
-- ══════════════════════════════════════════════════════════════════════
--  TANDA 8 — Facturación (parte 1/2)
--  Añade el estado 'pagada_parcial' al enum en su PROPIA migración
--  (Postgres no permite usar un valor de enum recién creado en la misma
--  transacción). Aplicar ANTES del 0009.
-- ══════════════════════════════════════════════════════════════════════

alter type public.invoice_status add value if not exists 'pagada_parcial';



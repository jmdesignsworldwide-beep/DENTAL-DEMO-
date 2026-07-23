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
  select unnest(array[
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
from pac cross join visitas;

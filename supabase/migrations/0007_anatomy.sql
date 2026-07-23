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

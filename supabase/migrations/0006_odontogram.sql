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

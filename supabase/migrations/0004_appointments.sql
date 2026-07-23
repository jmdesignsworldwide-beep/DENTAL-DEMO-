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

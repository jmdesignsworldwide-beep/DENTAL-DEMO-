-- ══════════════════════════════════════════════════════════════════════
--  TANDA 3 — Pacientes (CRM completo)
--  Amplía patients con el expediente completo. RLS + FORCE ya activos
--  (T2); aquí se añaden columnas, índices, políticas de escritura por rol,
--  una vista de estadísticas (security_invoker) y Storage privado de fotos.
--  Nace cerrada: las políticas se definen restrictivas de una vez.
-- ══════════════════════════════════════════════════════════════════════

-- ─── Columnas del expediente ──────────────────────────────────────────
alter table public.patients
  add column if not exists cedula                        text,
  add column if not exists fecha_nacimiento              date,
  add column if not exists direccion                     text,
  add column if not exists tipo_sangre                   text,
  add column if not exists alergias                      text,
  add column if not exists medicamentos                  text,
  add column if not exists condiciones                   text,
  add column if not exists seguro                        text,
  add column if not exists poliza                        text,
  add column if not exists contacto_emergencia_nombre    text,
  add column if not exists contacto_emergencia_telefono  text,
  add column if not exists activo                         boolean not null default true,
  add column if not exists notas                          text,
  add column if not exists foto_path                      text,
  add column if not exists created_by                     uuid references public.profiles (id) on delete set null;

-- Cédula única (formato dominicano ###-#######-#) cuando está presente.
create unique index if not exists patients_cedula_key
  on public.patients (cedula) where cedula is not null;

-- Índices de búsqueda por nombre / teléfono.
create index if not exists patients_nombre_idx
  on public.patients using gin (to_tsvector('spanish', nombre));
create index if not exists patients_telefono_idx on public.patients (telefono);
create index if not exists patients_activo_idx   on public.patients (activo);

-- ─── Políticas de escritura por rol (lectura ya existe: patients_select) ─
--  Escriben owner, recepcionista y dentista. Asistente: solo lectura.
drop policy if exists patients_insert on public.patients;
create policy patients_insert on public.patients
  for insert to authenticated
  with check (public.my_role() in ('owner', 'recepcionista', 'dentista'));

drop policy if exists patients_update on public.patients;
create policy patients_update on public.patients
  for update to authenticated
  using (public.my_role() in ('owner', 'recepcionista', 'dentista'))
  with check (public.my_role() in ('owner', 'recepcionista', 'dentista'));

-- Sin política de DELETE → borrado duro imposible. Se desactiva (activo=false).

grant insert, update on public.patients to authenticated;

-- ─── Vista de estadísticas por paciente (respeta RLS del usuario) ─────
--  security_invoker: cada subconsulta corre con los permisos del que
--  consulta (un dentista no ve montos de facturas → total = 0).
create or replace view public.patient_overview
with (security_invoker = on) as
select
  p.*,
  (select max(a.fecha) from public.appointments a
     where a.patient_id = p.id and a.estado = 'completada'
       and a.fecha <= current_date)                              as ultima_visita,
  (select count(*) from public.appointments a
     where a.patient_id = p.id and a.estado = 'completada')       as num_tratamientos,
  (select min(a.fecha) from public.appointments a
     where a.patient_id = p.id and a.fecha >= current_date
       and a.estado in ('confirmada', 'sala_espera', 'en_sillon')) as proxima_cita,
  coalesce((select sum(i.monto) from public.invoices i
     where i.patient_id = p.id and i.estado = 'pagada'), 0)       as total_gastado
from public.patients p;

grant select on public.patient_overview to authenticated;

-- ─── Storage privado para fotos (defensivo: no rompe si faltan permisos) ─
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('patient-photos', 'patient-photos', false)
  on conflict (id) do nothing;

  drop policy if exists "patient_photos_select" on storage.objects;
  create policy "patient_photos_select" on storage.objects
    for select to authenticated
    using (bucket_id = 'patient-photos' and public.is_active());

  drop policy if exists "patient_photos_insert" on storage.objects;
  create policy "patient_photos_insert" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'patient-photos'
      and public.my_role() in ('owner', 'recepcionista', 'dentista'));

  drop policy if exists "patient_photos_update" on storage.objects;
  create policy "patient_photos_update" on storage.objects
    for update to authenticated
    using (bucket_id = 'patient-photos'
      and public.my_role() in ('owner', 'recepcionista', 'dentista'));
exception when insufficient_privilege or undefined_table then
  raise notice 'Storage no configurado por esta conexión; crea el bucket patient-photos (privado) y sus políticas manualmente.';
end $$;

-- ══════════════════════════════════════════════════════════════════════
--  SEED — 45 pacientes con cédulas de checksum válido (formato RD)
-- ══════════════════════════════════════════════════════════════════════

-- Helper temporal: genera una cédula dominicana con dígito verificador válido.
create or replace function public.demo_cedula(base bigint)
returns text language plpgsql as $$
declare ten text; i int; digit int; s int := 0; d int;
begin
  ten := lpad((base % 10000000000)::text, 10, '0');
  for i in 1..10 loop
    digit := substr(ten, i, 1)::int * (case when i % 2 = 1 then 1 else 2 end);
    if digit > 9 then digit := digit - 9; end if;
    s := s + digit;
  end loop;
  d := (10 - (s % 10)) % 10;
  return substr(ten, 1, 3) || '-' || substr(ten, 4, 7) || '-' || d::text;
end $$;

-- Completa el expediente de los 20 pacientes sembrados en T2.
with numbered as (
  select id, row_number() over (order by created_at) as rn
  from public.patients where cedula is null
)
update public.patients p set
  cedula = public.demo_cedula(40200000000 + n.rn * 7919),
  fecha_nacimiento = (date '1958-01-01' + (n.rn * 397) * interval '1 day')::date,
  direccion = (array[
    'C/ Duarte #45, Gazcue, Santo Domingo',
    'Av. 27 de Febrero #210, Santiago',
    'C/ El Sol #88, Los Jardines, Santiago',
    'Av. Independencia #150, Bella Vista, SD',
    'C/ Mella #12, San Pedro de Macorís',
    'Av. Estrella Sadhalá #33, Santiago',
    'C/ Beller #7, Puerto Plata',
    'Av. Winston Churchill #90, Piantini, SD'
  ])[1 + n.rn % 8],
  tipo_sangre = (array['O+','A+','B+','O-','A-','AB+','B-','AB-'])[1 + n.rn % 8],
  seguro = (array['ARS Humano','ARS SeNaSa','ARS Universal','Mapfre Salud','ARS Palic','ARS Monumental'])[1 + n.rn % 6],
  poliza = 'POL-' || lpad((100000 + n.rn * 337)::text, 6, '0'),
  contacto_emergencia_nombre = (array[
    'Josefina Peña','Manuel Fernández','Ana Reyes','Carlos Jiménez',
    'Luisa Martínez','Pedro Rodríguez','Rosa Santos','Miguel Guzmán'
  ])[1 + n.rn % 8],
  contacto_emergencia_telefono = '809-' || lpad((6000000 + n.rn * 971)::text, 7, '0'),
  alergias = case when n.rn % 4 = 0 then
    (array['Penicilina','Látex','Anestesia local (lidocaína)','Sulfas'])[1 + n.rn % 4]
    else null end,
  medicamentos = case when n.rn % 5 = 0 then
    (array['Warfarina (anticoagulante)','Losartán 50mg','Metformina 850mg','Aspirina 100mg'])[1 + n.rn % 4]
    else null end,
  condiciones = case when n.rn % 6 = 0 then
    (array['Diabetes tipo 2','Hipertensión arterial','Cardiopatía','Embarazo (2do trimestre)'])[1 + n.rn % 4]
    else null end,
  notas = case when n.rn % 3 = 0 then 'Paciente puntual. Prefiere citas en la mañana.' else null end,
  activo = (n.rn % 11 <> 0)
from numbered n
where n.id = p.id;

-- Inserta 25 pacientes nuevos con expediente completo.
insert into public.patients
  (nombre, telefono, email, es_vip, cedula, fecha_nacimiento, direccion,
   tipo_sangre, alergias, medicamentos, condiciones, seguro, poliza,
   contacto_emergencia_nombre, contacto_emergencia_telefono, activo, notas, created_at)
select
  d.nombre,
  '809-' || lpad((7000000 + d.i * 613)::text, 7, '0'),
  lower(replace(d.nombre, ' ', '.')) || '@gmail.com',
  (d.i % 7 = 0),
  public.demo_cedula(00100000000 + d.i * 6131),
  (date '1962-03-01' + (d.i * 421) * interval '1 day')::date,
  (array[
    'C/ José Reyes #23, Zona Colonial, SD',
    'Av. Luperón #77, Herrera, SD Oeste',
    'C/ Restauración #55, La Vega',
    'Av. Circunvalación #101, Punta Cana',
    'C/ Sánchez #34, Moca',
    'Av. Hermanas Mirabal #66, Salcedo',
    'C/ Duvergé #9, Barahona',
    'Av. Máximo Gómez #180, Villa Consuelo, SD'
  ])[1 + d.i % 8],
  (array['O+','A+','B+','O-','A-','AB+','B-','AB-'])[1 + d.i % 8],
  case when d.i % 4 = 1 then
    (array['Penicilina','Látex','Ibuprofeno','Sulfas'])[1 + d.i % 4] else null end,
  case when d.i % 5 = 2 then
    (array['Warfarina (anticoagulante)','Enalapril 10mg','Levotiroxina','Clopidogrel'])[1 + d.i % 4] else null end,
  case when d.i % 6 = 3 then
    (array['Hipertensión arterial','Diabetes tipo 2','Asma','Cardiopatía isquémica'])[1 + d.i % 4] else null end,
  (array['ARS Humano','ARS SeNaSa','ARS Universal','Mapfre Salud','ARS Palic','ARS Monumental'])[1 + d.i % 6],
  'POL-' || lpad((200000 + d.i * 449)::text, 6, '0'),
  (array['Yaneris Objío','Frank Mercedes','Delia Difó','Ramón Peguero','Sonia Severino'])[1 + d.i % 5],
  '829-' || lpad((5000000 + d.i * 733)::text, 7, '0'),
  true,
  case when d.i % 3 = 0 then 'Referido por otro paciente.' else null end,
  now() - (d.i * 5) * interval '1 day'
from (values
  ('Genesis Objío', 1), ('Kelvin Mercedes', 2), ('Anny Carolina Difó', 3),
  ('Robinson Peguero', 4), ('Yaquelin Severino', 5), ('Deivi Concepción', 6),
  ('Miguelina Abreu', 7), ('Fior Daliza Rosario', 8), ('Nelson Javier Ureña', 9),
  ('Katherine Frías', 10), ('Ambiorix Tejada', 11), ('Yudelka Beltré', 12),
  ('Franklin Mejía', 13), ('Dahiana Guerrero', 14), ('Esmeralda Pujols', 15),
  ('Wander Cordero', 16), ('Yeison Aybar', 17), ('Perla Montero', 18),
  ('Cristian Javier Polanco', 19), ('Noelia Castillo', 20), ('Bienvenido Sánchez', 21),
  ('Rafelina Disla', 22), ('Junior Alcántara', 23), ('Yokasta Feliz', 24),
  ('Domingo Antonio Pérez', 25)
) as d(nombre, i)
on conflict (cedula) where cedula is not null do nothing;

-- El helper era solo para el seed: se elimina para no dejar superficie extra.
drop function if exists public.demo_cedula(bigint);

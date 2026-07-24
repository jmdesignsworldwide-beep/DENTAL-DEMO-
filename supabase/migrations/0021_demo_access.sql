-- ══════════════════════════════════════════════════════════════════════
--  TANDA 22 — Capa de acceso temporal para demos (cuentas con vigencia)
--
--  Permite al owner REAL crear cuentas demo con usuario/contraseña y días de
--  vigencia. Una cuenta demo ve todo el sistema pero:
--    · no puede tocar Configuración, gestión de usuarios ni el panel de demos
--    · cuando expira, queda MUERTA a nivel de base de datos (no puede leer ni
--      escribir nada por API) — la expiración vive en is_active()/my_role(),
--      así que TODAS las políticas RLS la respetan automáticamente.
--  Fort Knox: la restricción no depende de la UI. Nada se confía al cliente.
-- ══════════════════════════════════════════════════════════════════════

-- ─── Columnas de la cuenta demo en el perfil ──────────────────────────
alter table public.profiles
  add column if not exists es_demo         boolean not null default false,
  add column if not exists demo_expira_at  timestamptz,
  add column if not exists ultimo_acceso   timestamptz,
  add column if not exists demo_usuario    text,
  add column if not exists demo_creado_por uuid references public.profiles (id) on delete set null;

create index if not exists profiles_es_demo_idx on public.profiles (es_demo) where es_demo;

-- ─── Helpers: la EXPIRACIÓN se centraliza aquí ────────────────────────
--  Un demo activo es válido solo si no expiró. is_active() y my_role()
--  gobiernan TODA la RLS del sistema → un demo expirado pierde acceso a todo.
create or replace function public.is_active()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and activo
      and (not es_demo or (demo_expira_at is not null and demo_expira_at > now()))
  );
$$;

create or replace function public.my_role()
returns public.role_type language sql stable security definer set search_path = public as $$
  select rol from public.profiles
  where id = auth.uid() and activo
    and (not es_demo or (demo_expira_at is not null and demo_expira_at > now()));
$$;

-- is_owner() = owner REAL: nunca un demo (aunque su rol sea 'owner' para poder
-- ver todo). Esto ya excluye a los demos de: gestión de perfiles/roles y de la
-- lectura del registro de auditoría.
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = 'owner' and activo and not es_demo
  );
$$;

-- ¿El usuario actual es una cuenta demo? (para excluirlo de áreas sensibles)
create or replace function public.is_demo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and es_demo);
$$;
revoke all on function public.is_demo() from public, anon;
grant execute on function public.is_demo() to authenticated;

-- ─── El guard anti-escalada ahora protege también las columnas demo ───
--  Un demo no puede auto-extenderse ni auto-activarse (solo el owner real).
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_owner() then
    return new;
  end if;
  if (new.rol is distinct from old.rol)
     or (new.activo is distinct from old.activo)
     or (new.id is distinct from old.id)
     or (new.es_demo is distinct from old.es_demo)
     or (new.demo_expira_at is distinct from old.demo_expira_at)
     or (new.demo_usuario is distinct from old.demo_usuario)
     or (new.demo_creado_por is distinct from old.demo_creado_por) then
    raise exception 'No autorizado a modificar rol, activo o parámetros de la cuenta';
  end if;
  return new;  -- ultimo_acceso y avatar/nombre propios sí se permiten
end $$;

-- ─── Áreas restringidas para demos: Configuración y Usuarios ──────────
--  Se les añade `and not is_demo()`. (Personal/Nómina: el demo solo lee.)
drop policy if exists clinic_settings_update on public.clinic_settings;
create policy clinic_settings_update on public.clinic_settings
  for update to authenticated
  using (public.my_role() in ('owner','recepcionista') and not public.is_demo())
  with check (public.my_role() in ('owner','recepcionista') and not public.is_demo());

drop policy if exists clinic_holidays_insert on public.clinic_holidays;
create policy clinic_holidays_insert on public.clinic_holidays
  for insert to authenticated
  with check (public.my_role() = 'owner' and not public.is_demo());
drop policy if exists clinic_holidays_write on public.clinic_holidays;
create policy clinic_holidays_write on public.clinic_holidays
  for update to authenticated
  using (public.my_role() = 'owner' and not public.is_demo())
  with check (public.my_role() = 'owner' and not public.is_demo());

drop policy if exists ncf_sequences_select on public.ncf_sequences;
create policy ncf_sequences_select on public.ncf_sequences
  for select to authenticated using (public.my_role() = 'owner' and not public.is_demo());
drop policy if exists ncf_sequences_update on public.ncf_sequences;
create policy ncf_sequences_update on public.ncf_sequences
  for update to authenticated
  using (public.my_role() = 'owner' and not public.is_demo())
  with check (public.my_role() = 'owner' and not public.is_demo());

drop policy if exists app_users_select on public.app_users;
create policy app_users_select on public.app_users
  for select to authenticated using (public.my_role() = 'owner' and not public.is_demo());
drop policy if exists app_users_insert on public.app_users;
create policy app_users_insert on public.app_users
  for insert to authenticated with check (public.my_role() = 'owner' and not public.is_demo());
drop policy if exists app_users_update on public.app_users;
create policy app_users_update on public.app_users
  for update to authenticated
  using (public.my_role() = 'owner' and not public.is_demo())
  with check (public.my_role() = 'owner' and not public.is_demo());

-- Personal/Nómina: el demo puede VER (vende el módulo) pero no ESCRIBIR.
drop policy if exists staff_insert on public.staff;
create policy staff_insert on public.staff
  for insert to authenticated with check (public.my_role() = 'owner' and not public.is_demo());
drop policy if exists staff_update on public.staff;
create policy staff_update on public.staff
  for update to authenticated
  using (public.my_role() = 'owner' and not public.is_demo())
  with check (public.my_role() = 'owner' and not public.is_demo());
drop policy if exists staff_absences_write on public.staff_absences;
create policy staff_absences_write on public.staff_absences
  for insert to authenticated with check (public.my_role() = 'owner' and not public.is_demo());
drop policy if exists payroll_status_insert on public.payroll_status;
create policy payroll_status_insert on public.payroll_status
  for insert to authenticated with check (public.my_role() = 'owner' and not public.is_demo());
drop policy if exists payroll_status_update on public.payroll_status;
create policy payroll_status_update on public.payroll_status
  for update to authenticated
  using (public.my_role() = 'owner' and not public.is_demo())
  with check (public.my_role() = 'owner' and not public.is_demo());

-- ══════════════════════════════════════════════════════════════════════
--  RESEED — restaurar los datos demo a su estado limpio con un botón
--  Se captura una FOTO de los datos transaccionales sembrados (schema
--  demo_baseline). reset_demo_data() vacía esas tablas y las restaura desde
--  la foto. Preserva: perfiles, configuración, catálogo, personal, plantillas
--  y el registro de auditoría (activity_log NO se toca).
-- ══════════════════════════════════════════════════════════════════════
create schema if not exists demo_baseline;

do $$
declare t text;
begin
  foreach t in array array[
    'patients','appointments','clinical_records','clinical_attachments',
    'tooth_states','tooth_events','odontogram_snapshots','anatomy_marks','anatomy_events',
    'invoices','invoice_items','payments',
    'treatment_budgets','treatment_budget_items','treatment_budget_events','treatment_budget_clinical',
    'scheduled_messages','communication_log','patient_communication_prefs','appointment_confirmations',
    'notifications','treatment_plans','treatment_plan_stages'
  ] loop
    execute format('drop table if exists demo_baseline.%I', t);
    execute format('create table demo_baseline.%I as table public.%I', t, t);
  end loop;
end $$;

create or replace function public.reset_demo_data()
returns void language plpgsql security definer set search_path = public, demo_baseline as $$
declare
  t text;
  tbls text[] := array[
    'patients','treatment_plans','treatment_plan_stages','appointments','invoices',
    'invoice_items','payments','clinical_records','clinical_attachments','tooth_states',
    'tooth_events','odontogram_snapshots','anatomy_marks','anatomy_events',
    'treatment_budgets','treatment_budget_items','treatment_budget_events',
    'treatment_budget_clinical','patient_communication_prefs','scheduled_messages',
    'appointment_confirmations','communication_log','notifications'
  ];
begin
  if not public.is_owner() then
    raise exception 'Solo el administrador puede resembrar los datos demo';
  end if;

  -- TRUNCATE (no RESTART IDENTITY, para no chocar con los ids restaurados);
  -- CASCADE + TRUNCATE ignoran los triggers BEFORE DELETE de inmutabilidad.
  truncate table
    public.patients, public.appointments, public.clinical_records, public.clinical_attachments,
    public.tooth_states, public.tooth_events, public.odontogram_snapshots,
    public.anatomy_marks, public.anatomy_events,
    public.invoices, public.invoice_items, public.payments,
    public.treatment_budgets, public.treatment_budget_items, public.treatment_budget_events,
    public.treatment_budget_clinical,
    public.scheduled_messages, public.communication_log, public.patient_communication_prefs,
    public.appointment_confirmations, public.notifications,
    public.treatment_plans, public.treatment_plan_stages
  cascade;

  -- Desactiva los triggers de usuario (guards de opt-out/inmutabilidad) durante
  -- la restauración masiva. Las FK (triggers de sistema) siguen activas, así que
  -- el orden padres→hijos se respeta. Si algo falla, el rollback los reactiva.
  foreach t in array tbls loop
    execute format('alter table public.%I disable trigger user', t);
  end loop;

  -- Restaurar en orden de dependencias (padres → hijos).
  insert into public.patients            select * from demo_baseline.patients;
  insert into public.treatment_plans     select * from demo_baseline.treatment_plans;
  insert into public.treatment_plan_stages select * from demo_baseline.treatment_plan_stages;
  -- appointments: excluye columnas generadas (dentista_key, periodo).
  insert into public.appointments
    (id, patient_id, dentista_id, dentista_nombre, fecha, hora, tratamiento, estado,
     created_at, duracion_min, tratamiento_id, notas, motivo_cancelacion,
     recordatorio_enviado, created_by)
  select id, patient_id, dentista_id, dentista_nombre, fecha, hora, tratamiento, estado,
     created_at, duracion_min, tratamiento_id, notas, motivo_cancelacion,
     recordatorio_enviado, created_by
  from demo_baseline.appointments;
  insert into public.invoices            select * from demo_baseline.invoices;
  insert into public.invoice_items       select * from demo_baseline.invoice_items;
  insert into public.payments            select * from demo_baseline.payments;
  insert into public.clinical_records    select * from demo_baseline.clinical_records;
  insert into public.clinical_attachments select * from demo_baseline.clinical_attachments;
  insert into public.tooth_states        select * from demo_baseline.tooth_states;
  insert into public.tooth_events        select * from demo_baseline.tooth_events;
  insert into public.odontogram_snapshots select * from demo_baseline.odontogram_snapshots;
  insert into public.anatomy_marks       select * from demo_baseline.anatomy_marks;
  insert into public.anatomy_events      select * from demo_baseline.anatomy_events;
  insert into public.treatment_budgets   select * from demo_baseline.treatment_budgets;
  insert into public.treatment_budget_items select * from demo_baseline.treatment_budget_items;
  insert into public.treatment_budget_events overriding system value
    select * from demo_baseline.treatment_budget_events;
  insert into public.treatment_budget_clinical select * from demo_baseline.treatment_budget_clinical;
  insert into public.patient_communication_prefs select * from demo_baseline.patient_communication_prefs;
  insert into public.scheduled_messages  select * from demo_baseline.scheduled_messages;
  insert into public.appointment_confirmations select * from demo_baseline.appointment_confirmations;
  insert into public.communication_log overriding system value
    select * from demo_baseline.communication_log;
  insert into public.notifications       select * from demo_baseline.notifications;

  foreach t in array tbls loop
    execute format('alter table public.%I enable trigger user', t);
  end loop;
end $$;
revoke all on function public.reset_demo_data() from public, anon;
grant execute on function public.reset_demo_data() to authenticated;

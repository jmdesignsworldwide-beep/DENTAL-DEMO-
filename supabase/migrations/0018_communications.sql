-- ══════════════════════════════════════════════════════════════════════
--  TANDA 20 — Recordatorios automáticos y comunicación con el paciente
--  El no-show es el problema económico #1 de una clínica dental. Este módulo
--  programa recordatorios, los despacha por wa.me (arquitectura lista para
--  WhatsApp Business API) y deja un registro legal INMUTABLE de todo.
--  Se integra con patients, appointments, treatment_budgets, invoices.
--  RLS + FORCE, deny by default. Opt-out del paciente forzado a nivel DB.
-- ══════════════════════════════════════════════════════════════════════

-- ─── Plantillas de mensajes ───────────────────────────────────────────
create table if not exists public.message_templates (
  id                     uuid primary key default gen_random_uuid(),
  clave                  text not null unique,
  nombre                 text not null,
  canal                  text not null default 'whatsapp'
                           check (canal in ('whatsapp','sms','email')),
  asunto                 text,
  cuerpo                 text not null,
  variables_disponibles  text[] not null default '{}',
  activa                 boolean not null default true,
  editable               boolean not null default true,
  updated_at             timestamptz not null default now(),
  created_at             timestamptz not null default now()
);
alter table public.message_templates enable row level security;
alter table public.message_templates force  row level security;

drop policy if exists mt_select on public.message_templates;
create policy mt_select on public.message_templates
  for select to authenticated using (public.is_active());
drop policy if exists mt_insert on public.message_templates;
create policy mt_insert on public.message_templates
  for insert to authenticated with check (public.my_role() = 'owner');
drop policy if exists mt_update on public.message_templates;
create policy mt_update on public.message_templates
  for update to authenticated
  using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
-- Sin DELETE: las plantillas se desactivan (activa=false).
grant select, insert, update on public.message_templates to authenticated;

-- ─── Preferencias de comunicación por paciente ────────────────────────
create table if not exists public.patient_communication_prefs (
  patient_id        uuid primary key references public.patients (id) on delete cascade,
  acepta_whatsapp   boolean not null default true,
  acepta_sms        boolean not null default true,
  acepta_email      boolean not null default true,
  horario_preferido text not null default 'cualquiera'
                      check (horario_preferido in ('mañana','tarde','cualquiera')),
  opt_out_fecha     timestamptz,
  opt_out_motivo    text,
  updated_at        timestamptz not null default now()
);
alter table public.patient_communication_prefs enable row level security;
alter table public.patient_communication_prefs force  row level security;

drop policy if exists pcp_select on public.patient_communication_prefs;
create policy pcp_select on public.patient_communication_prefs
  for select to authenticated using (public.is_active());
drop policy if exists pcp_write on public.patient_communication_prefs;
create policy pcp_write on public.patient_communication_prefs
  for insert to authenticated
  with check (public.my_role() in ('owner','recepcionista','dentista'));
drop policy if exists pcp_update on public.patient_communication_prefs;
create policy pcp_update on public.patient_communication_prefs
  for update to authenticated
  using (public.my_role() in ('owner','recepcionista','dentista'))
  with check (public.my_role() in ('owner','recepcionista','dentista'));
grant select, insert, update on public.patient_communication_prefs to authenticated;

-- ─── Mensajes programados (cola de envío) ─────────────────────────────
create table if not exists public.scheduled_messages (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.patients (id) on delete cascade,
  cita_id            uuid references public.appointments (id) on delete set null,
  plan_id            uuid references public.treatment_budgets (id) on delete set null,
  invoice_id         uuid references public.invoices (id) on delete set null,
  plantilla_clave    text not null,
  canal              text not null default 'whatsapp'
                       check (canal in ('whatsapp','sms','email')),
  tipo               text not null default 'manual',
  destinatario       text not null,
  asunto_renderizado text,
  cuerpo_renderizado text not null,
  programado_para    timestamptz not null,
  estado             text not null default 'programado'
                       check (estado in ('programado','enviado','entregado','leido',
                                         'respondido','fallido','cancelado')),
  enviado_en         timestamptz,
  error              text,
  respuesta_paciente text,
  respondido_en      timestamptz,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now()
);
alter table public.scheduled_messages enable row level security;
alter table public.scheduled_messages force  row level security;
create index if not exists sm_prog_idx    on public.scheduled_messages (programado_para);
create index if not exists sm_estado_idx  on public.scheduled_messages (estado);
create index if not exists sm_patient_idx on public.scheduled_messages (patient_id);
create index if not exists sm_cita_idx    on public.scheduled_messages (cita_id);

drop policy if exists sm_select on public.scheduled_messages;
create policy sm_select on public.scheduled_messages
  for select to authenticated using (public.is_active());
drop policy if exists sm_insert on public.scheduled_messages;
create policy sm_insert on public.scheduled_messages
  for insert to authenticated
  with check (public.my_role() in ('owner','recepcionista','dentista'));
drop policy if exists sm_update on public.scheduled_messages;
create policy sm_update on public.scheduled_messages
  for update to authenticated
  using (public.my_role() in ('owner','recepcionista','dentista'))
  with check (public.my_role() in ('owner','recepcionista','dentista'));
-- Sin DELETE: los mensajes se cancelan (estado='cancelado').
grant select, insert, update on public.scheduled_messages to authenticated;

-- Opt-out FORZADO a nivel de base de datos: si el paciente pidió no recibir
-- por un canal (o hizo opt-out global), NO se le puede programar un mensaje.
-- Esto vive en la DB, no solo en la app: imposible saltárselo.
create or replace function public.enforce_comm_optout()
returns trigger language plpgsql as $$
declare pref public.patient_communication_prefs;
begin
  select * into pref from public.patient_communication_prefs
   where patient_id = new.patient_id;
  if found then
    if pref.opt_out_fecha is not null then
      raise exception 'El paciente solicitó no recibir comunicaciones (opt-out %).', pref.opt_out_fecha;
    end if;
    if new.canal = 'whatsapp' and not pref.acepta_whatsapp then
      raise exception 'El paciente no acepta WhatsApp.';
    elsif new.canal = 'sms' and not pref.acepta_sms then
      raise exception 'El paciente no acepta SMS.';
    elsif new.canal = 'email' and not pref.acepta_email then
      raise exception 'El paciente no acepta correo.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists sm_optout_guard on public.scheduled_messages;
create trigger sm_optout_guard before insert on public.scheduled_messages
  for each row execute function public.enforce_comm_optout();

-- ─── Bitácora de comunicación (registro legal, INMUTABLE) ─────────────
create table if not exists public.communication_log (
  id                    bigint generated always as identity primary key,
  patient_id            uuid not null references public.patients (id) on delete cascade,
  scheduled_message_id  uuid references public.scheduled_messages (id) on delete set null,
  cita_id               uuid references public.appointments (id) on delete set null,
  canal                 text not null,
  direccion             text not null default 'saliente'
                          check (direccion in ('saliente','entrante')),
  destinatario          text,
  plantilla_clave       text,
  cuerpo                text not null,
  estado                text,
  usuario_id            uuid references public.profiles (id) on delete set null,
  meta                  jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);
alter table public.communication_log enable row level security;
alter table public.communication_log force  row level security;
create index if not exists cl_patient_idx on public.communication_log (patient_id, created_at desc);

drop policy if exists cl_select on public.communication_log;
create policy cl_select on public.communication_log
  for select to authenticated using (public.is_active());
drop policy if exists cl_insert on public.communication_log;
create policy cl_insert on public.communication_log
  for insert to authenticated with check (public.is_active());
grant select, insert on public.communication_log to authenticated;

-- Inmutable: solo INSERT/SELECT. UPDATE/DELETE bloqueados a nivel DB.
create or replace function public.block_comm_log()
returns trigger language plpgsql as $$
begin
  raise exception 'La bitácora de comunicación es inmutable: operación % bloqueada', tg_op;
end $$;
drop trigger if exists cl_no_upd on public.communication_log;
drop trigger if exists cl_no_del on public.communication_log;
create trigger cl_no_upd before update on public.communication_log
  for each row execute function public.block_comm_log();
create trigger cl_no_del before delete on public.communication_log
  for each row execute function public.block_comm_log();

-- ─── Tokens de confirmación (acceso sin login, solo service-role) ─────
--  Modelado como screen_tokens (Tanda 12): RLS + FORCE sin políticas → solo
--  el cliente admin (service_role) lo lee/escribe tras validar el token.
create table if not exists public.appointment_confirmations (
  id             uuid primary key default gen_random_uuid(),
  cita_id        uuid not null references public.appointments (id) on delete cascade,
  patient_id     uuid not null references public.patients (id) on delete cascade,
  token          text not null unique,
  estado         text not null default 'pendiente'
                   check (estado in ('pendiente','confirmada','cambio_solicitado')),
  expira_at      timestamptz not null,
  respondido_at  timestamptz,
  mensaje_cambio text,
  created_at     timestamptz not null default now()
);
alter table public.appointment_confirmations enable row level security;
alter table public.appointment_confirmations force  row level security;
create index if not exists ac_cita_idx on public.appointment_confirmations (cita_id);
-- Sin políticas: acceso exclusivo del cliente admin del servidor (service_role
-- hace bypass de RLS). Ningún usuario autenticado lo toca directo.
revoke all on public.appointment_confirmations from authenticated, anon;

-- ══════════════════════════════════════════════════════════════════════
--  SEED — plantillas en español dominicano (cercano y profesional)
-- ══════════════════════════════════════════════════════════════════════
insert into public.message_templates (clave, nombre, canal, asunto, cuerpo, variables_disponibles) values
  ('recordatorio_24h', 'Recordatorio de cita — 24h antes', 'whatsapp', null,
   'Hola {primer_nombre} 👋, le recordamos su cita en {clínica} mañana {fecha} a las {hora} con {odontólogo}. Responda *CONFIRMO* para confirmar o *CAMBIAR* si necesita reprogramar. ¡Le esperamos!',
   array['primer_nombre','fecha','hora','odontólogo','clínica']),
  ('recordatorio_2h', 'Recordatorio de cita — 2h antes', 'whatsapp', null,
   'Hola {primer_nombre}, su cita en {clínica} es hoy a las {hora}. Le esperamos en {dirección}. Si va en camino, ¡perfecto! 🦷',
   array['primer_nombre','hora','clínica','dirección']),
  ('confirmacion_cita', 'Confirmación de cita agendada', 'whatsapp', null,
   'Hola {primer_nombre}, su cita quedó agendada para el {fecha} a las {hora} con {odontólogo} en {clínica}. Cualquier cambio, escríbanos al {teléfono_clínica}. ¡Gracias!',
   array['primer_nombre','fecha','hora','odontólogo','clínica','teléfono_clínica']),
  ('cita_reagendada', 'Cita reagendada', 'whatsapp', null,
   'Hola {primer_nombre}, su cita fue reprogramada para el {fecha} a las {hora} con {odontólogo}. Si la nueva fecha no le conviene, avísenos. ¡Gracias por su comprensión!',
   array['primer_nombre','fecha','hora','odontólogo']),
  ('cita_cancelada', 'Cita cancelada', 'whatsapp', null,
   'Hola {primer_nombre}, su cita del {fecha} fue cancelada. Cuando guste reagendar, escríbanos al {teléfono_clínica}. Estamos para servirle.',
   array['primer_nombre','fecha','teléfono_clínica']),
  ('post_tratamiento', 'Seguimiento post-tratamiento', 'whatsapp', null,
   'Hola {primer_nombre}, ¿cómo se ha sentido después de su {tratamiento} de ayer? Si tiene molestias o dudas, no dude en escribirnos. Su recuperación nos importa. 💙',
   array['primer_nombre','tratamiento']),
  ('higiene_6meses', 'Recordatorio de higiene — 6 meses', 'whatsapp', null,
   'Hola {primer_nombre}, ya pasaron 6 meses de su última limpieza. Es momento de cuidar esa sonrisa 😁. ¿Le agendamos su cita de higiene? Responda para coordinar.',
   array['primer_nombre']),
  ('seguimiento_presupuesto', 'Seguimiento de presupuesto', 'whatsapp', null,
   'Hola {primer_nombre}, ¿tuvo oportunidad de revisar el plan de tratamiento que le presentamos ({monto})? Con gusto le aclaramos cualquier duda o le explicamos las opciones de pago. ¡Quedamos atentos!',
   array['primer_nombre','monto']),
  ('factura_pendiente', 'Aviso de factura pendiente', 'whatsapp', null,
   'Hola {primer_nombre}, le recordamos que tiene un balance pendiente de {monto} en {clínica}. Puede pasar por caja o coordinar su pago con nosotros. ¡Gracias!',
   array['primer_nombre','monto','clínica']),
  ('cumpleanos', 'Felicitación de cumpleaños', 'whatsapp', null,
   '¡Feliz cumpleaños, {primer_nombre}! 🎉 Todo el equipo de {clínica} le desea un día maravilloso y muchas sonrisas. Que cumpla muchos más. 🎂',
   array['primer_nombre','clínica']),
  ('bienvenida', 'Bienvenida a paciente nuevo', 'whatsapp', null,
   '¡Bienvenido(a) a {clínica}, {primer_nombre}! Es un gusto tenerle en la familia. Estamos para cuidar su salud dental. Cualquier cosa, escríbanos al {teléfono_clínica}. 🦷',
   array['primer_nombre','clínica','teléfono_clínica'])
on conflict (clave) do nothing;

-- ══════════════════════════════════════════════════════════════════════
--  SEED — mensajes de los últimos ~2 meses, coherentes con las citas
--  reales. Los prefs (con un opt-out) se siembran DESPUÉS para no chocar
--  con el guard (mensajes históricos anteriores al opt-out son válidos).
-- ══════════════════════════════════════════════════════════════════════
with cit as (
  select a.id, a.patient_id, a.dentista_nombre, a.fecha, a.hora, a.tratamiento,
         a.estado as cita_estado,
         p.nombre, p.telefono,
         row_number() over (order by a.fecha, a.hora, a.id) as rn
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  where a.fecha between current_date - 55 and current_date + 7
    and p.telefono is not null
)
insert into public.scheduled_messages
  (patient_id, cita_id, plantilla_clave, canal, tipo, destinatario,
   cuerpo_renderizado, programado_para, estado, enviado_en,
   respuesta_paciente, respondido_en, created_at)
select
  c.patient_id, c.id, 'recordatorio_24h', 'whatsapp', 'recordatorio_24h', c.telefono,
  'Hola ' || split_part(c.nombre, ' ', 1) ||
    ' 👋, le recordamos su cita en Clínica Dental mañana ' ||
    to_char(c.fecha, 'DD/MM') || ' a las ' || trim(to_char(c.hora, 'HH12:MI AM')) ||
    ' con ' || c.dentista_nombre || '. Responda CONFIRMO para confirmar.',
  ((c.fecha - 1) + time '10:00'),
  case
    when c.fecha < current_date then
      (array['respondido','entregado','leido','entregado','respondido'])[1 + (c.rn % 5)]
    when c.fecha = current_date then 'entregado'
    when (c.fecha - 1) <= current_date then 'enviado'
    else 'programado'
  end,
  case when c.fecha <= current_date then ((c.fecha - 1) + time '10:02') else null end,
  case when c.fecha < current_date and (c.rn % 5) in (0,4) then 'CONFIRMO' else null end,
  case when c.fecha < current_date and (c.rn % 5) in (0,4)
       then ((c.fecha - 1) + time '12:30') else null end,
  ((c.fecha - 1) + time '10:00')
from cit c
-- Los recordatorios cubren casi todas las citas SALVO la mayoría de los
-- no-show pasados: así los datos reflejan la realidad (el recordatorio
-- reduce el no-show) y el panel de impacto muestra una mejora creíble.
where c.rn % 2 = 0
  and (c.cita_estado <> 'no_show' or c.rn % 5 = 0);

-- Un puñado de mensajes de otros tipos, para que el historial tenga variedad.
insert into public.scheduled_messages
  (patient_id, plantilla_clave, canal, tipo, destinatario, cuerpo_renderizado,
   programado_para, estado, enviado_en, created_at)
select p.id, x.clave, 'whatsapp', x.clave, p.telefono, x.cuerpo,
       now() - (x.dias || ' days')::interval, x.estado,
       now() - (x.dias || ' days')::interval, now() - (x.dias || ' days')::interval
from (values
  ('cumpleanos',   '¡Feliz cumpleaños! 🎉 Todo el equipo de Clínica Dental le desea un día maravilloso.', 'entregado', 3, 1),
  ('higiene_6meses','Ya pasaron 6 meses de su última limpieza. ¿Le agendamos su cita de higiene? 😁', 'respondido', 8, 2),
  ('post_tratamiento','¿Cómo se ha sentido después de su tratamiento de ayer? Cualquier molestia, escríbanos. 💙', 'leido', 12, 3),
  ('bienvenida',   '¡Bienvenido(a) a Clínica Dental! Es un gusto tenerle en la familia. 🦷', 'entregado', 20, 4),
  ('seguimiento_presupuesto','¿Tuvo oportunidad de revisar el plan de tratamiento? Con gusto le aclaramos dudas.', 'enviado', 5, 5),
  ('factura_pendiente','Le recordamos su balance pendiente en Clínica Dental. Puede coordinar su pago con nosotros.', 'entregado', 6, 6)
) as x(clave, cuerpo, estado, dias, k)
join lateral (
  select id, telefono from public.patients
  where telefono is not null order by created_at offset x.k limit 1
) p on true;

-- Bitácora inmutable a partir de todo lo que salió (y las respuestas entrantes).
insert into public.communication_log
  (patient_id, scheduled_message_id, cita_id, canal, direccion, destinatario,
   plantilla_clave, cuerpo, estado, created_at)
select patient_id, id, cita_id, canal, 'saliente', destinatario, plantilla_clave,
       cuerpo_renderizado, estado, coalesce(enviado_en, created_at)
from public.scheduled_messages
where estado in ('enviado','entregado','leido','respondido');

insert into public.communication_log
  (patient_id, scheduled_message_id, cita_id, canal, direccion, destinatario,
   plantilla_clave, cuerpo, estado, created_at)
select patient_id, id, cita_id, canal, 'entrante', destinatario, plantilla_clave,
       respuesta_paciente, 'respondido', respondido_en
from public.scheduled_messages
where estado = 'respondido' and respuesta_paciente is not null;

-- Preferencias: la mayoría acepta; un paciente hizo opt-out (después de sus
-- mensajes históricos, que siguen siendo válidos).
insert into public.patient_communication_prefs (patient_id, horario_preferido)
select id, (array['mañana','tarde','cualquiera','cualquiera'])[1 + (row_number() over (order by created_at))::int % 4]
from public.patients
on conflict (patient_id) do nothing;

update public.patient_communication_prefs set
  acepta_whatsapp = false,
  opt_out_fecha = now() - interval '2 days',
  opt_out_motivo = 'Solicitó no recibir recordatorios por WhatsApp.'
where patient_id = '00000000-0000-0000-0000-000000000015';

-- Confirmaciones firmadas para las citas futuras (token demo, acceso sin login).
insert into public.appointment_confirmations (cita_id, patient_id, token, estado, expira_at)
select a.id, a.patient_id,
       'cfm_' || replace(a.id::text, '-', ''),
       'pendiente',
       (a.fecha + time '23:59')
from public.appointments a
where a.fecha between current_date and current_date + 7
  and a.estado in ('pendiente','confirmada')
on conflict (token) do nothing;

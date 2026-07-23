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

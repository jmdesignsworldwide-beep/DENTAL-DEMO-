-- ══════════════════════════════════════════════════════════════════════
--  TANDA 12 — Sala de espera (kiosco TV)
--  Configuración de clínica (consumida aquí y editada en T16), tokens de
--  pantalla (acceso de solo lectura sin credenciales de usuario) y
--  contenido rotativo. RLS + FORCE. La pantalla lee vía cliente admin en
--  servidor tras validar el token, devolviendo SOLO campos mínimos.
-- ══════════════════════════════════════════════════════════════════════

-- ─── Configuración de la clínica (singleton) ──────────────────────────
create table if not exists public.clinic_settings (
  id                  smallint primary key default 1 check (id = 1),
  nombre              text not null default 'Clínica Dental',
  eslogan             text default 'Tu sonrisa, nuestra pasión',
  mensaje_bienvenida  text default 'Bienvenido. En breve será atendido.',
  color_acento        text not null default '#0066CC',
  logo_path           text,
  mostrar_foto        boolean not null default false,
  apellido_inicial    boolean not null default false,
  consultorios        integer not null default 1 check (consultorios between 1 and 12),
  hora_apertura       time not null default '08:00',
  hora_cierre         time not null default '18:00',
  emergency_active    boolean not null default false,
  emergency_message   text,
  emergency_severity  text not null default 'warning' check (emergency_severity in ('warning','danger')),
  updated_at          timestamptz not null default now()
);
alter table public.clinic_settings enable row level security;
alter table public.clinic_settings force  row level security;

drop policy if exists clinic_settings_select on public.clinic_settings;
create policy clinic_settings_select on public.clinic_settings
  for select to authenticated using (public.is_active());
drop policy if exists clinic_settings_update on public.clinic_settings;
create policy clinic_settings_update on public.clinic_settings
  for update to authenticated
  using (public.my_role() in ('owner','recepcionista'))
  with check (public.my_role() in ('owner','recepcionista'));
grant select, update on public.clinic_settings to authenticated;

insert into public.clinic_settings (id) values (1) on conflict (id) do nothing;

-- ─── Tokens de pantalla (kiosco sin sesión) ───────────────────────────
create table if not exists public.screen_tokens (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  nombre      text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null
);
alter table public.screen_tokens enable row level security;
alter table public.screen_tokens force  row level security;
-- Solo el owner administra tokens. La validación del kiosco corre en
-- servidor con el cliente admin (no depende de estas políticas).
drop policy if exists screen_tokens_select on public.screen_tokens;
create policy screen_tokens_select on public.screen_tokens
  for select to authenticated using (public.my_role() = 'owner');
drop policy if exists screen_tokens_insert on public.screen_tokens;
create policy screen_tokens_insert on public.screen_tokens
  for insert to authenticated with check (public.my_role() = 'owner');
drop policy if exists screen_tokens_update on public.screen_tokens;
create policy screen_tokens_update on public.screen_tokens
  for update to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
grant select, insert, update on public.screen_tokens to authenticated;

insert into public.screen_tokens (token, nombre) values
  ('DEMO-SALA-2026', 'Pantalla sala de espera (demo)')
on conflict (token) do nothing;

-- ─── Contenido rotativo de la pantalla ────────────────────────────────
create table if not exists public.waiting_room_content (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('consejo','anuncio','recordatorio')),
  titulo      text not null,
  cuerpo      text not null,
  activo      boolean not null default true,
  orden       integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.waiting_room_content enable row level security;
alter table public.waiting_room_content force  row level security;
drop policy if exists wrc_select on public.waiting_room_content;
create policy wrc_select on public.waiting_room_content
  for select to authenticated using (public.is_active());
drop policy if exists wrc_write on public.waiting_room_content;
create policy wrc_write on public.waiting_room_content
  for insert to authenticated with check (public.my_role() = 'owner');
drop policy if exists wrc_update on public.waiting_room_content;
create policy wrc_update on public.waiting_room_content
  for update to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
grant select, insert, update on public.waiting_room_content to authenticated;

insert into public.waiting_room_content (tipo, titulo, cuerpo, orden) values
  ('consejo','Cepíllate dos veces al día','Dedica al menos dos minutos en cada cepillado, con movimientos suaves y circulares.',1),
  ('consejo','No olvides el hilo dental','El hilo dental elimina la placa entre los dientes donde el cepillo no llega. Úsalo a diario.',2),
  ('consejo','Cambia tu cepillo','Reemplaza tu cepillo cada 3 meses o cuando las cerdas se vean desgastadas.',3),
  ('recordatorio','Visítanos cada 6 meses','Una limpieza profesional cada seis meses previene caries y enfermedad de las encías.',4),
  ('consejo','Cuida lo que comes','Reduce el azúcar y los refrescos. El agua es la mejor amiga de tu sonrisa.',5),
  ('anuncio','Blanqueamiento con 15% off','Este mes, luce una sonrisa más brillante con nuestro blanqueamiento profesional.',6),
  ('anuncio','Ortodoncia invisible','Ya disponible: alineadores transparentes. Endereza tus dientes sin que se noten.',7),
  ('anuncio','Sábados extendidos','Ahora atendemos los sábados hasta las 2:00 PM para tu comodidad.',8)
on conflict do nothing;

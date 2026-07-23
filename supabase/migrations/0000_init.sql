-- ══════════════════════════════════════════════════════════════════════
--  SISTEMA DENTAL — Migración cero
--  Fort Knox desde la línea uno:
--    · RLS + FORCE en TODAS las tablas · deny by default · nunca USING(true)
--    · auditoría inmutable (sólo INSERT/SELECT, DELETE/UPDATE bloqueados en DB)
--    · triggers de perfil y anti-escalada de privilegios
--  Las migraciones nacen cerradas. Nunca se abren y cierran después.
-- ══════════════════════════════════════════════════════════════════════

-- ─── Enum de roles ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'role_type') then
    create type public.role_type as enum
      ('owner', 'dentista', 'recepcionista', 'asistente');
  end if;
end $$;

-- ─── Tabla profiles ───────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null default '',
  rol         public.role_type not null default 'asistente',
  activo      boolean not null default false,   -- deny by default: el owner activa
  avatar_url  text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles force  row level security;

-- ─── Tabla activity_log (auditoría inmutable) ─────────────────────────
create table if not exists public.activity_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity      text,
  entity_id   text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.activity_log enable row level security;
alter table public.activity_log force  row level security;

create index if not exists activity_log_actor_idx   on public.activity_log (actor_id);
create index if not exists activity_log_created_idx  on public.activity_log (created_at desc);

-- ─── Helper SECURITY DEFINER: rol del usuario actual sin recursión RLS ─
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = 'owner' and activo
  );
$$;

revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

-- ─── Políticas: profiles (deny by default, jamás USING(true)) ──────────
drop policy if exists profiles_select_own   on public.profiles;
drop policy if exists profiles_select_owner on public.profiles;
drop policy if exists profiles_update_own   on public.profiles;
drop policy if exists profiles_owner_all    on public.profiles;

-- Cada quien ve su propio perfil…
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- …y el owner ve todos.
create policy profiles_select_owner on public.profiles
  for select to authenticated
  using (public.is_owner());

-- Cada quien puede actualizar su propia fila (rol/activo protegidos por trigger).
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- El owner puede insertar/actualizar/eliminar cualquier perfil.
create policy profiles_owner_all on public.profiles
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- ─── Trigger anti-escalada: no-owner no cambia rol ni activo ──────────
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_owner() then
    return new;
  end if;
  if (new.rol is distinct from old.rol)
     or (new.activo is distinct from old.activo)
     or (new.id is distinct from old.id) then
    raise exception 'No autorizado a modificar rol, activo o id';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ─── Trigger: crear perfil al registrar usuario ───────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nombre)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Políticas: activity_log (sólo INSERT/SELECT) ─────────────────────
drop policy if exists activity_insert on public.activity_log;
drop policy if exists activity_select on public.activity_log;

create policy activity_insert on public.activity_log
  for insert to authenticated
  with check (auth.uid() is not null);

-- Sólo el owner lee el registro de auditoría.
create policy activity_select on public.activity_log
  for select to authenticated
  using (public.is_owner());

-- Sin políticas de UPDATE/DELETE → denegado por RLS.

-- ─── Inmutabilidad reforzada a nivel DB (bloquea incluso service_role) ─
create or replace function public.block_mutations()
returns trigger
language plpgsql
as $$
begin
  raise exception 'activity_log es inmutable: operación % bloqueada', tg_op;
end;
$$;

drop trigger if exists activity_no_update on public.activity_log;
drop trigger if exists activity_no_delete on public.activity_log;
create trigger activity_no_update
  before update on public.activity_log
  for each row execute function public.block_mutations();
create trigger activity_no_delete
  before delete on public.activity_log
  for each row execute function public.block_mutations();

-- ─── Grants explícitos (RLS sigue siendo la puerta real) ──────────────
grant select, insert, update on public.profiles     to authenticated;
grant select, insert         on public.activity_log to authenticated;
-- Nunca update/delete sobre activity_log:
revoke update, delete on public.activity_log from authenticated, anon;

-- ══════════════════════════════════════════════════════════════════════
--  Seed manual del owner (correr UNA vez tras crear el usuario en Auth):
--
--    update public.profiles
--       set rol = 'owner', activo = true, nombre = 'Dra. Nombre Apellido'
--     where id = (select id from auth.users where email = 'owner@clinica.do');
--
--  No se hardcodea aquí para no dejar credenciales ni datos en la migración.
-- ══════════════════════════════════════════════════════════════════════

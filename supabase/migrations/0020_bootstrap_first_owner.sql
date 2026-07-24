-- ══════════════════════════════════════════════════════════════════════
--  Bootstrap del primer owner — se acabó la activación manual por SQL
--
--  Antes: todo perfil nacía `asistente` + `activo=false` (deny by default), y
--  activar al primer owner exigía un UPDATE que el trigger anti-escalada
--  bloqueaba (auth.uid() nulo en el SQL Editor) → había que desactivar el
--  trigger a mano. Un enredo, y la causa del bucle de "cuenta inactiva".
--
--  Ahora: si NO existe todavía un owner activo, el PRIMER usuario que se
--  registra arranca como `owner` + `activo=true`. A partir de ahí, todo
--  registro nuevo sigue naciendo inactivo (deny by default) y lo activa el
--  owner desde la app. Sin SQL, sin desactivar triggers, sin bucles.
--
--  Seguridad: el auto-owner solo aplica cuando la clínica aún no tiene owner
--  (instalación nueva o base recién reseteada). Con un owner activo presente,
--  cualquier alta posterior queda inactiva hasta que el owner la habilite.
-- ══════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bootstrap boolean;
begin
  -- ¿La clínica todavía no tiene un owner activo?
  select not exists (
    select 1 from public.profiles where rol = 'owner' and activo
  ) into v_bootstrap;

  insert into public.profiles (id, nombre, rol, activo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    case when v_bootstrap then 'owner'::public.role_type
         else 'asistente'::public.role_type end,
    v_bootstrap
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- El trigger on_auth_user_created ya apunta a esta función; no hace falta
-- recrearlo. Revoca EXECUTE (higiene: es función de trigger).
revoke all on function public.handle_new_user() from public, anon, authenticated;

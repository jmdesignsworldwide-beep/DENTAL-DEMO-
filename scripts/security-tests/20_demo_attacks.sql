-- ══════════════════════════════════════════════════════════════════════
--  Ataques a la capa de ACCESO DEMO (Tanda 22). Cada uno DEBE fallar.
--  Prueba que la expiración y el aislamiento del demo viven en la DB, no
--  en la UI. Corre dentro de una transacción con ROLLBACK.
--  Requiere el esquema con la migración 0021 aplicada.
-- ══════════════════════════════════════════════════════════════════════
\pset pager off
begin;

-- Identidades: owner real, demo activo, demo vencido.
alter table public.profiles disable trigger user;
insert into auth.users (id,email) values
  ('d0000000-0000-0000-0000-000000000001','audit.owner2@demo.local'),
  ('d0000000-0000-0000-0000-000000000002','audit.demo.ok@demo.local'),
  ('d0000000-0000-0000-0000-000000000003','audit.demo.exp@demo.local')
on conflict (id) do nothing;
insert into public.profiles (id,nombre,rol,activo,es_demo,demo_expira_at) values
  ('d0000000-0000-0000-0000-000000000001','Owner Real','owner',        true, false, null),
  ('d0000000-0000-0000-0000-000000000002','Demo Activo','owner',       true, true,  now()+interval '7 days'),
  ('d0000000-0000-0000-0000-000000000003','Demo Vencido','owner',      true, true,  now()-interval '1 day')
on conflict (id) do update set rol=excluded.rol, activo=excluded.activo,
  es_demo=excluded.es_demo, demo_expira_at=excluded.demo_expira_at;
alter table public.profiles enable trigger user;

create or replace function pg_temp.cnt(sub text, q text) returns text language plpgsql as $$
declare n bigint; begin
  perform set_config('request.jwt.claim.sub', sub, true);
  set local role authenticated;
  begin execute 'select count(*) from '||q into n; reset role; return 'rows='||n;
  exception when others then reset role; return 'DENIED('||sqlstate||')'; end;
end $$;
create or replace function pg_temp.wr(sub text, sql text) returns text language plpgsql as $$
declare rc bigint; begin
  perform set_config('request.jwt.claim.sub', sub, true);
  set local role authenticated;
  begin execute sql; get diagnostics rc = row_count; reset role;
    return case when rc=0 then 'BLOQUEADO (0 filas)' else '!!! PERMITIDO' end;
  exception when others then reset role; return 'BLOQUEADO('||sqlstate||')'; end;
end $$;

\echo '── D1 · Demo VENCIDO no puede leer NADA (expiración a nivel DB) ──'
select 'demo vencido → patients (debe DENIED/0)' as prueba, pg_temp.cnt('d0000000-0000-0000-0000-000000000003','public.patients') as r
union all select 'demo vencido → citas', pg_temp.cnt('d0000000-0000-0000-0000-000000000003','public.appointments');

\echo '── D2 · Demo ACTIVO ve el sistema pero NO Config/Usuarios ──'
select 'demo activo → patients (debe ver)' as prueba, pg_temp.cnt('d0000000-0000-0000-0000-000000000002','public.patients') as r
union all select 'demo activo → app_users (config, debe 0)', pg_temp.cnt('d0000000-0000-0000-0000-000000000002','public.app_users')
union all select 'demo activo → clinic_settings write', pg_temp.wr('d0000000-0000-0000-0000-000000000002','update public.clinic_settings set nombre=''X'' where id=1')
union all select 'demo activo → ncf_sequences (debe 0)', pg_temp.cnt('d0000000-0000-0000-0000-000000000002','public.ncf_sequences');

\echo '── D3 · Demo no puede auto-extenderse ni resembrar ──'
select 'demo auto-extiende vigencia' as prueba,
  pg_temp.wr('d0000000-0000-0000-0000-000000000002',
    'update public.profiles set demo_expira_at=now()+interval ''99 days'' where id=''d0000000-0000-0000-0000-000000000002''') as r;

\echo '── D4 · Demo no puede escribir Nómina (solo ver) ──'
select 'demo → staff insert (debe bloqueado)' as prueba,
  pg_temp.wr('d0000000-0000-0000-0000-000000000002',
    'insert into public.staff (nombre, cargo, salario) values (''x'',''y'',1)') as r;

rollback;
\echo '── Fin. Interpretar: DENIED/BLOQUEADO/0 filas = el demo NO pudo. ──'

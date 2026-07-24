-- ══════════════════════════════════════════════════════════════════════
--  ATAQUES DE SEGURIDAD — Tanda 21. Cada prueba DEBE fallar (o volver vacía).
--  Simula cada rol con SET ROLE + claims JWT y captura el rechazo real.
--  Todo corre dentro de una transacción que SIEMPRE hace ROLLBACK: no
--  persiste nada, ni siquiera un ataque que (indebidamente) tuviera éxito.
--
--  Uso:
--    psql "<conn>" -f 00_setup_identities.sql
--    psql "<conn>" -f 10_attacks.sql
--  Identidades (de 00_setup_identities.sql):
--    owner .....a5170000-…-0001   dentista …0002   recepción …0003
--    asistente .…0004             inactivo …0005 (activo=false)
-- ══════════════════════════════════════════════════════════════════════
\set OWNER    '''a5170000-0000-0000-0000-000000000001'''
\set DENT     '''a5170000-0000-0000-0000-000000000002'''
\set RECEP    '''a5170000-0000-0000-0000-000000000003'''
\set ASIST    '''a5170000-0000-0000-0000-000000000004'''
\set INACT    '''a5170000-0000-0000-0000-000000000005'''

\pset pager off
\timing off
begin;

-- Helper: corre un COUNT como un rol/identidad y reporta filas o denegación.
-- El stub de auth.uid() lee current_setting('request.jwt.claim.sub'); es ESA
-- GUC la que debemos fijar (no el JSON 'request.jwt.claims'). Las funciones
-- is_active()/my_role() son SECURITY DEFINER y la leen dentro de las políticas.
create or replace function pg_temp.probe(
  p_role text, p_sub text, p_from text
) returns text language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_sub,''), true);
  execute format('set local role %I', p_role);
  execute format('select count(*) from %s', p_from) into n;
  reset role;
  return 'rows=' || n;
exception when others then
  reset role;
  return 'DENIED(' || sqlstate || '): ' || replace(sqlerrm, E'\n', ' ');
end $$;

-- Helper de escritura: reporta filas afectadas. Una UPDATE/DELETE que RLS
-- filtra a 0 filas cuenta como BLOQUEADO (no tocó nada), no como éxito.
create or replace function pg_temp.attempt(
  p_role text, p_sub text, p_sql text
) returns text language plpgsql as $$
declare rowc bigint;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_sub,''), true);
  execute format('set local role %I', p_role);
  execute p_sql;
  get diagnostics rowc = ROW_COUNT;
  reset role;
  if rowc = 0 then
    return 'BLOQUEADO (RLS filtró: 0 filas afectadas)';
  end if;
  return '!!! PERMITIDO ' || rowc || ' fila(s) (FALLO DE SEGURIDAD)';
exception when others then
  reset role;
  return 'BLOQUEADO(' || sqlstate || '): ' || replace(sqlerrm, E'\n', ' ');
end $$;

\echo '══════════ B1 · anon key contra todas las tablas (todas → vacío/denegado) ══════════'
do $$
declare t record; r text; bad int := 0;
begin
  for t in select tablename from pg_tables where schemaname='public' order by tablename loop
    r := pg_temp.probe('anon', null, 'public.'||quote_ident(t.tablename));
    if r like 'rows=%' and r <> 'rows=0' then
      raise notice 'B1 anon → % : FAIL (%)', t.tablename, r; bad := bad + 1;
    end if;
  end loop;
  if bad = 0 then raise notice 'B1 · anon no leyó NI UNA fila de NINGUNA de las % tablas: PASS',
    (select count(*) from pg_tables where schemaname='public');
  else raise notice 'B1 · % tabla(s) expuestas a anon: FAIL', bad; end if;
end $$;

\echo '══════════ B2 · Cruce de roles — LECTURA ══════════'
select 'B2 asistente → communication_log'      as prueba, pg_temp.probe('authenticated', :ASIST, 'public.communication_log')            as resultado
union all select 'B2 asistente → scheduled_messages',     pg_temp.probe('authenticated', :ASIST, 'public.scheduled_messages')
union all select 'B2 asistente → patient_comm_prefs',     pg_temp.probe('authenticated', :ASIST, 'public.patient_communication_prefs')
union all select 'B2 asistente → invoices',               pg_temp.probe('authenticated', :ASIST, 'public.invoices')
union all select 'B2 asistente → payments',               pg_temp.probe('authenticated', :ASIST, 'public.payments')
union all select 'B2 recepción → clinical_records',       pg_temp.probe('authenticated', :RECEP, 'public.clinical_records')
union all select 'B2 recepción → dx presupuesto (clínico)', pg_temp.probe('authenticated', :RECEP, 'public.treatment_budget_clinical')
union all select 'B2 asistente → dx presupuesto (clínico)', pg_temp.probe('authenticated', :ASIST, 'public.treatment_budget_clinical')
union all select 'B2 asistente → tooth_states (permitido)', pg_temp.probe('authenticated', :ASIST, 'public.tooth_states');

\echo '══════════ B3 · Cruce de roles — ESCRITURA (todas → BLOQUEADO) ══════════'
select 'B3 asistente crea factura' as prueba,
  pg_temp.attempt('authenticated', :ASIST,
   'insert into public.invoices (patient_id, monto, estado) values ((select id from public.patients limit 1), 100, ''pendiente'')') as resultado
union all select 'B3 asistente inserta pago',
  pg_temp.attempt('authenticated', :ASIST,
   'insert into public.payments (invoice_id, metodo, monto) values ((select id from public.invoices limit 1), ''efectivo'', 50)')
union all select 'B3 recepción firma historia clínica',
  pg_temp.attempt('authenticated', :RECEP,
   'insert into public.clinical_records (patient_id, firmada) values ((select id from public.patients limit 1), true)')
union all select 'B3 dentista cambia rol de otro perfil',
  pg_temp.attempt('authenticated', :DENT,
   'update public.profiles set rol=''owner'' where id=''a5170000-0000-0000-0000-000000000001''')
union all select 'B3 asistente edita catálogo de precios',
  pg_temp.attempt('authenticated', :ASIST,
   'update public.treatments set precio = 1 where true')
union all select 'B3 mensaje a paciente con OPT-OUT (guard DB)',
  pg_temp.attempt('authenticated', :RECEP,
   'insert into public.scheduled_messages (patient_id, plantilla_clave, canal, destinatario, cuerpo_renderizado, programado_para)
    values (''00000000-0000-0000-0000-000000000015'', ''recordatorio_24h'', ''whatsapp'', ''809'', ''x'', now())');

\echo '══════════ B4 · Usuario DESACTIVADO (activo=false) — todo denegado ══════════'
select 'B4 inactivo → patients (lectura)' as prueba, pg_temp.probe('authenticated', :INACT, 'public.patients') as resultado
union all select 'B4 inactivo crea cita',
  pg_temp.attempt('authenticated', :INACT,
   'insert into public.appointments (patient_id, fecha, hora, tratamiento) values ((select id from public.patients limit 1), current_date, ''09:00'', ''x'')');

\echo '══════════ B5 · INMUTABILIDAD — SQL directo, privilegios elevados (los 7 → error) ══════════'
-- Garantiza una fila de adjunto clínico para que el trigger BEFORE DELETE
-- (FOR EACH ROW) tenga sobre qué disparar (si no, borrar 0 filas no prueba nada).
insert into public.clinical_attachments (record_id, tipo, storage_path)
select id, 'radiografia', 'audit/probe.jpg' from public.clinical_records limit 1;

select 'B5 UPDATE activity_log' as prueba,
  pg_temp.attempt('postgres', null, 'update public.activity_log set action=''x'' where id=(select min(id) from public.activity_log)') as resultado
union all select 'B5 DELETE activity_log',
  pg_temp.attempt('postgres', null, 'delete from public.activity_log where id=(select min(id) from public.activity_log)')
union all select 'B5 UPDATE historia clínica FIRMADA',
  pg_temp.attempt('postgres', null, 'update public.clinical_records set diagnostico=''x'' where firmada=true')
union all select 'B5 DELETE clinical_attachments',
  pg_temp.attempt('postgres', null, 'delete from public.clinical_attachments where true')
union all select 'B5 UPDATE factura emitida',
  pg_temp.attempt('postgres', null, 'update public.invoices set total = 1 where ncf is not null')
union all select 'B5 UPDATE/ DELETE communication_log',
  pg_temp.attempt('postgres', null, 'delete from public.communication_log where id=(select min(id) from public.communication_log)')
union all select 'B5 UPDATE precio de ítem de presupuesto ACEPTADO',
  pg_temp.attempt('postgres', null, 'update public.treatment_budget_items set precio_unitario = 1 where estado_item=''aceptado''');

\echo '══════════ B7 · RPCs / funciones: EXECUTE de anon revocado en funciones sensibles ══════════'
select p.proname as funcion,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_puede_ejecutar,
       coalesce(array_to_string(p.proconfig, ','), '(sin search_path)') as config
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
order by 1;

rollback;
\echo '── Fin de ataques. Todo revertido (ROLLBACK). Interpretar arriba: PASS = el ataque falló. ──'

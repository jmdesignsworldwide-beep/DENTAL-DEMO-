-- ══════════════════════════════════════════════════════════════════════
--  TANDA 21 — Endurecimiento por hallazgos de la auditoría ejecutada
--  La auditoría (scripts/security-tests) ATACÓ el sistema y encontró 4
--  fugas reales de defensa en profundidad. Esta migración las cierra a
--  nivel de base de datos. Cada cambio corresponde a un hallazgo con
--  evidencia en docs/SECURITY-AUDIT-RESULTS.md.
-- ══════════════════════════════════════════════════════════════════════

-- ─── Hallazgo 1/2/3 · El asistente leía comunicaciones del paciente ───
--  communication_log / scheduled_messages / patient_communication_prefs
--  usaban is_active() → el asistente (activo) leía historial de mensajes,
--  cola y preferencias (nombres, teléfonos, contenido). El asistente no
--  participa en comunicaciones. Se restringe a owner/recepcionista/dentista.
drop policy if exists cl_select on public.communication_log;
create policy cl_select on public.communication_log
  for select to authenticated
  using (public.my_role() in ('owner','recepcionista','dentista'));

drop policy if exists sm_select on public.scheduled_messages;
create policy sm_select on public.scheduled_messages
  for select to authenticated
  using (public.my_role() in ('owner','recepcionista','dentista'));

drop policy if exists pcp_select on public.patient_communication_prefs;
create policy pcp_select on public.patient_communication_prefs
  for select to authenticated
  using (public.my_role() in ('owner','recepcionista','dentista'));

-- ─── Hallazgo 4 · El diagnóstico clínico del presupuesto era legible por
--  recepción/asistente vía API directa ────────────────────────────────
--  `treatment_budgets.diagnostico_general` es un dato CLÍNICO. La app lo
--  filtraba, pero un SELECT directo con token de recepción lo devolvía.
--  Se mueve a una tabla aparte con RLS que solo owner/dentista pueden leer:
--  ahora la protección vive en la DB, no solo en la app.
create table if not exists public.treatment_budget_clinical (
  budget_id           uuid primary key
                        references public.treatment_budgets (id) on delete cascade,
  diagnostico_general text,
  updated_at          timestamptz not null default now()
);
alter table public.treatment_budget_clinical enable row level security;
alter table public.treatment_budget_clinical force  row level security;

drop policy if exists tbc_select on public.treatment_budget_clinical;
create policy tbc_select on public.treatment_budget_clinical
  for select to authenticated
  using (public.my_role() in ('owner','dentista'));
drop policy if exists tbc_insert on public.treatment_budget_clinical;
create policy tbc_insert on public.treatment_budget_clinical
  for insert to authenticated
  with check (public.my_role() in ('owner','dentista'));
drop policy if exists tbc_update on public.treatment_budget_clinical;
create policy tbc_update on public.treatment_budget_clinical
  for update to authenticated
  using (public.my_role() in ('owner','dentista'))
  with check (public.my_role() in ('owner','dentista'));
grant select, insert, update on public.treatment_budget_clinical to authenticated;

-- Migra el diagnóstico existente y elimina la columna expuesta.
insert into public.treatment_budget_clinical (budget_id, diagnostico_general)
select id, diagnostico_general
from public.treatment_budgets
where diagnostico_general is not null
on conflict (budget_id) do nothing;

alter table public.treatment_budgets drop column if exists diagnostico_general;

-- ─── Endurecimiento · EXECUTE de funciones de trigger ─────────────────
--  guard_profile_update y handle_new_user son funciones de trigger; no
--  deben ser invocables directamente por anon/authenticated. (No es
--  explotable —fallan fuera de un trigger— pero se cierra por higiene.)
revoke all on function public.guard_profile_update() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

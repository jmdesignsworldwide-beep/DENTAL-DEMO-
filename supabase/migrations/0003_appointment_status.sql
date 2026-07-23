-- ══════════════════════════════════════════════════════════════════════
--  TANDA 4 — Estados de cita (parte 1/2)
--  Se añaden los valores nuevos del enum en su PROPIA migración: Postgres
--  no permite usar un valor de enum recién agregado dentro de la misma
--  transacción que lo crea. Aplicar este archivo ANTES del 0004.
-- ══════════════════════════════════════════════════════════════════════

alter type public.appointment_status add value if not exists 'pendiente';
alter type public.appointment_status add value if not exists 'seguimiento';

-- Nota: 'sala_espera' se interpreta como "en sala de espera" y 'en_sillon'
-- como "en curso / en el sillón" — se conservan para no romper T2/T3.

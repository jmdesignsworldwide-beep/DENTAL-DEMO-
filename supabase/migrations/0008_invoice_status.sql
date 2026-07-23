-- ══════════════════════════════════════════════════════════════════════
--  TANDA 8 — Facturación (parte 1/2)
--  Añade el estado 'pagada_parcial' al enum en su PROPIA migración
--  (Postgres no permite usar un valor de enum recién creado en la misma
--  transacción). Aplicar ANTES del 0009.
-- ══════════════════════════════════════════════════════════════════════

alter type public.invoice_status add value if not exists 'pagada_parcial';

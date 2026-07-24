#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
#  Auditoría de seguridad repetible — Tanda 21 (JM Nexus Designs)
#  Corre las identidades de prueba + los ataques contra un Postgres con el
#  esquema del sistema. Cada ataque DEBE fallar; la salida marca PASS/FAIL.
#
#  Contra el harness local (por defecto):
#      ./run.sh
#  Contra otra base (branch/shadow de Supabase — NUNCA producción con datos
#  reales sin querer): pásale una connection string:
#      DATABASE_URL='postgresql://user:pass@host:5432/db' ./run.sh
#
#  Requiere que el esquema (migraciones 0000–0019) ya esté aplicado en la base.
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"

if [[ -n "${DATABASE_URL:-}" ]]; then
  CONN="$DATABASE_URL"
else
  BASE="${BASE:-/home/pgtest/mig}"
  CONN="host=$BASE/sock port=5433 dbname=postgres user=postgres"
fi

echo "▶ Objetivo: ${DATABASE_URL:+<DATABASE_URL>}${DATABASE_URL:-$CONN}"
echo "▶ Sembrando identidades de prueba…"
psql "$CONN" -v ON_ERROR_STOP=1 -q -f 00_setup_identities.sql
echo "▶ Ejecutando ataques…"
psql "$CONN" -v ON_ERROR_STOP=0 -f 10_attacks.sql
echo "▶ Listo. Revisa arriba: PASS = el ataque fue rechazado."

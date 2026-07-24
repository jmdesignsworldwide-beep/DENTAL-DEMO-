# scripts/security-tests — Auditoría de seguridad repetible

Ataca la **capa de base de datos** del sistema simulando cada rol y captura el
rechazo real de cada intento. Diseñada para volver a correr la auditoría en un
minuto, en este proyecto y en cualquier futuro de JM Nexus Designs.

## Qué prueba

- **B1** — la llave pública (`anon`) no lee ni una fila de ninguna tabla.
- **B2** — cruce de roles en lectura (asistente/recepción no leen lo ajeno).
- **B3** — cruce de roles en escritura (incluye el guard de opt-out a nivel DB).
- **B4** — el usuario desactivado no puede nada.
- **B5** — inmutabilidad: 7 intentos de `UPDATE`/`DELETE` sobre tablas-registro,
  ejecutados con privilegios elevados, todos rechazados por trigger.
- **B7** — `SECURITY DEFINER` con `search_path` fijo y `EXECUTE` de `anon` revocado.

Cada ataque **debe fallar** (o volver vacío). La salida marca el veredicto.
Todo corre dentro de una transacción que **siempre** hace `ROLLBACK`: no
persiste nada, ni siquiera un ataque que (indebidamente) tuviera éxito.

## Cómo correr

Requiere el esquema (migraciones `0000`–`0019`) ya aplicado en la base objetivo.

```bash
# Contra el harness local de Postgres (por defecto):
./run.sh

# Contra otra base con el esquema aplicado (branch/shadow de Supabase —
# NUNCA producción con datos reales por accidente):
DATABASE_URL='postgresql://user:pass@host:5432/db' ./run.sh
```

El setup de identidades desactiva temporalmente el guard de `profiles` para
sembrar los 5 sujetos de prueba, por lo que necesita una conexión **dueña/
elevada** (p. ej. el rol `postgres`). Es una herramienta de auditoría, no una
ruta de la app.

## Archivos

| Archivo | Rol |
|---|---|
| `00_setup_identities.sql` | Crea 5 identidades: owner, dentista, recepción, asistente y un desactivado. Idempotente. |
| `10_attacks.sql` | Los ataques B1–B7. Imprime el veredicto de cada uno. |
| `run.sh` | Orquesta setup + ataques contra el objetivo. |
| `EVIDENCE-last-run.txt` | Última corrida capturada como evidencia. |

## Lo que NO cubre (requiere la instancia viva)

- Security Advisor de Supabase (correrlo en el panel).
- Expiración real de signed URLs de Storage y validación de MIME al subir.
- Prueba en incógnito de la URL de producción.

Ver `docs/SECURITY-AUDIT-RESULTS.md` para el reporte completo con evidencia,
hallazgos, correcciones y resumen ejecutivo.

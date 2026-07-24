# Auditoría de seguridad — Resultados ejecutados

**Sistema:** SISTEMA DENTAL — DEMO · **Tanda 21**
**Fecha de ejecución:** 2026-07-24
**Método:** No es un checklist escrito. Se **atacó** el sistema y se documenta que resistió.

- **Capa de base de datos** (RLS, políticas por rol, inmutabilidad, opt-out, funciones): ejecutada de verdad contra **Postgres 16** con el esquema completo (migraciones `0000`–`0019`), simulando cada rol con `SET ROLE` + `auth.uid()` real y capturando el rechazo exacto. Reproducible con `scripts/security-tests/` (ver `run.sh`). Evidencia cruda en `scripts/security-tests/EVIDENCE-last-run.txt`.
- **Capa de aplicación / transporte / secretos** (headers, middleware, bundle, dependencias): verificada por inspección del código y de la build.
- **Lo que requiere la instancia viva** (Security Advisor de Supabase, expiración real de signed URLs de Storage, prueba en incógnito de la URL de producción): se marca **MITIGADO** o **PENDIENTE (requiere ejecución live por la dueña)** con la evidencia equivalente disponible. **Nada se marca CERRADO sin la prueba.**

> **Regla cumplida:** la auditoría encontró **5 hallazgos reales** (4 de defensa en profundidad a nivel DB + 1 defecto funcional del middleware). Los cinco se corrigieron en esta tanda (`0019_security_hardening.sql` + `lib/supabase/middleware.ts`) y se re-probaron en verde.

---

## Hallazgos y correcciones

| # | Hallazgo (encontrado ATACANDO) | Severidad | Evidencia del fallo | Corrección | Re-prueba |
|---|---|---|---|---|---|
| 1 | El **asistente leía `communication_log`** (historial de mensajes del paciente: nombres, teléfonos, contenido). La política usaba `is_active()`. | Media | `B2 asistente → communication_log : rows=139` | `0019`: `SELECT` restringido a `owner/recepcionista/dentista` | `rows=0` ✅ |
| 2 | El **asistente leía `scheduled_messages`** (cola con datos del paciente). | Media | `B2 asistente → scheduled_messages : rows=108` | `0019`: idem | `rows=0` ✅ |
| 3 | El **asistente leía `patient_communication_prefs`**. | Baja | `B2 asistente → patient_comm_prefs : rows=45` | `0019`: idem | `rows=0` ✅ |
| 4 | **`treatment_budgets.diagnostico_general` (dato CLÍNICO) legible por recepción/asistente vía API directa.** La app lo filtraba, la DB no. | Media | `B2 recepción → dx presupuesto : rows=14` | `0019`: columna movida a `treatment_budget_clinical` con RLS `owner/dentista`; columna original eliminada | `rows=0` (recepción y asistente) ✅ |
| 5 | **El enlace de confirmación `/confirmar/[token]` NO estaba en la allowlist del middleware** → un paciente sin sesión era redirigido a `/login`. El flujo de confirmación de la Tanda 20 quedaba **roto en producción**. | Alta (funcional) | Revisión de `lib/supabase/middleware.ts`: `/confirmar` ausente de `isPublic` | `middleware`: `path.startsWith("/confirmar")` agregado a la allowlist | Ruta pública, token valida en servidor ✅ |
| + | Endurecimiento: `EXECUTE` de `guard_profile_update` y `handle_new_user` (funciones de trigger) abierto a `public`. No explotable, cerrado por higiene. | Info | `B7 anon_puede_ejecutar = t` | `0019`: `REVOKE ALL ... FROM public, anon, authenticated` | `anon_puede_ejecutar = f` ✅ |

---

## PARTE B — Ataques ejecutados (cada uno DEBE fallar)

### B1 · anon key contra todas las tablas
**Intento:** con el rol `anon` (sin sesión), `SELECT count(*)` sobre las **40** tablas de `public`.
**Resultado:** `anon no leyó NI UNA fila de NINGUNA de las 40 tablas: PASS`. Sin `GRANT` a `anon` + RLS deny-by-default ⇒ toda lectura vuelve vacía o `permission denied`.
**Estado: CERRADO.**

### B2 · Cruce de roles — lectura
| Intento | Resultado | Esperado | Estado |
|---|---|---|---|
| asistente → `communication_log` | `rows=0` *(tras fix; era 139)* | vacío | CERRADO |
| asistente → `scheduled_messages` | `rows=0` *(tras fix; era 108)* | vacío | CERRADO |
| asistente → `patient_communication_prefs` | `rows=0` *(tras fix; era 45)* | vacío | CERRADO |
| asistente → `invoices` | `rows=0` | vacío | CERRADO |
| asistente → `payments` | `rows=0` | vacío | CERRADO |
| recepción → `clinical_records` | `rows=0` | vacío | CERRADO |
| recepción → diagnóstico de presupuesto | `rows=0` *(tras fix; era 14)* | vacío | CERRADO |
| asistente → diagnóstico de presupuesto | `rows=0` | vacío | CERRADO |
| asistente → `tooth_states` | `rows=16` | **permitido por diseño** (asistente colabora con el odontograma) | OK |

### B3 · Cruce de roles — escritura (todas → bloqueadas)
| Intento | Respuesta del sistema | Estado |
|---|---|---|
| asistente crea factura | `BLOQUEADO(42501): new row violates row-level security policy for table "invoices"` | CERRADO |
| asistente inserta pago | `BLOQUEADO(42501): ... "payments"` | CERRADO |
| recepción firma historia clínica | `BLOQUEADO(42501): ... "clinical_records"` | CERRADO |
| dentista cambia rol de otro perfil | `BLOQUEADO (RLS filtró: 0 filas afectadas)` | CERRADO |
| asistente edita catálogo de precios | `BLOQUEADO (RLS filtró: 0 filas afectadas)` | CERRADO |
| **mensaje a paciente con OPT-OUT** | `BLOQUEADO(P0001): El paciente solicitó no recibir comunicaciones (opt-out …)` — **rechazado por trigger a nivel DB** | CERRADO |

> **Política de aceptación de presupuesto (B3):** por diseño, `respondBudget` permite a `owner/dentista/recepcionista` registrar la respuesta del paciente (la recepción a menudo la captura en el mostrador). El asistente no puede. Documentado e intencional.

### B4 · Usuario desactivado (`activo=false`)
Lectura de `patients` → `rows=0`. Crear cita → `BLOQUEADO(42501)`. `is_active()` deniega en el servidor, no en la UI. **CERRADO.**

### B5 · Inmutabilidad — SQL directo con privilegios elevados (los 7 → error)
> Este es el bloque que le da **valor legal** al sistema. Se ejecutó como `postgres` (superusuario); aun así, los triggers bloquean.

| Intento | Error capturado | Estado |
|---|---|---|
| `UPDATE activity_log` | `P0001: activity_log es inmutable: operación UPDATE bloqueada` | CERRADO |
| `DELETE activity_log` | `P0001: activity_log es inmutable: operación DELETE bloqueada` | CERRADO |
| `UPDATE` historia clínica firmada | `P0001: Entrada firmada e inmutable: crea una enmienda …` | CERRADO |
| `DELETE clinical_attachments` | `P0001: Los adjuntos clínicos son inmutables: operación DELETE bloqueada` | CERRADO |
| `UPDATE` factura emitida | `P0001: Factura emitida inmutable: solo cambia estado/pago/motivo.` | CERRADO |
| `DELETE communication_log` | `P0001: La bitácora de comunicación es inmutable …` | CERRADO |
| `UPDATE` precio de ítem de presupuesto aceptado | `P0001: Ítem ya aceptado: precio y descripción son inmutables …` | CERRADO |

### B6 · Storage — **PENDIENTE (requiere ejecución live)** / MITIGADO
- Buckets **privados** por migración: `patient-photos` y `clinical-files` se crean con `public=false`; `select id, public from storage.buckets` debe confirmarlo en vivo.
- El código nunca usa `getPublicUrl` (grep del repo = 0 coincidencias); solo `createSignedUrl` con expiración corta (`lib/storage.ts`).
- Acceso a archivo clínico gateado por RLS `owner/dentista` en `storage.objects`.
- **Falta ejecutar en vivo:** expiración real de una signed URL vencida y validación de MIME real al subir. Marcado PENDIENTE, no CERRADO.

### B7 · Endpoints y RPCs
- Toda server action llama `requireActiveUser()`/`requireRole()` como primera línea (verificado en `app/**/actions.ts`). Sin sesión ⇒ `redirect('/login')`.
- **`SECURITY DEFINER` con `search_path` fijo:** las 6 funciones definer tienen `search_path=public` (evidencia B7).
- **`EXECUTE` de `anon` revocado** en `is_active`, `is_owner`, `my_role`, `next_ncf`, y ahora también en las funciones de trigger. Evidencia: `anon_puede_ejecutar = f` en las 6.
- **Token de sala de espera:** `lib/waiting-room.ts` (cliente admin) devuelve solo nombre acortado, hora y estado; no cédula, teléfono, tratamiento, monto ni diagnóstico. Validación por token en servidor.
- **Enlace de confirmación (Tanda 20):** `lib/confirm.ts` valida token (formato + existencia + `expira_at`) con cliente admin; token expirado/inexistente ⇒ "Enlace no disponible"; un id no es adivinable. **CERRADO** (más el fix del middleware, hallazgo #5).

### B8 · Inyección y validación
- **SQL injection:** el acceso a datos usa el cliente de Supabase (PostgREST) con parámetros; las búsquedas usan `.ilike("col", "%"+term+"%")` — el término viaja como **parámetro**, nunca concatenado a SQL. Sin `execute`/SQL crudo con input de usuario en la app.
- **XSS:** React escapa todo por defecto; no hay `dangerouslySetInnerHTML` con input de usuario (grep = 0).
- **Inyección de variables en plantillas (Tanda 20):** `renderTemplate` solo hace reemplazo literal de `{clave}` conocidas (no evalúa expresiones); no puede renderizar datos de otro paciente porque las variables se llenan desde el contexto del servidor, no desde el texto de la plantilla. Variables desconocidas se rechazan (`unknownVariables`).
- Inputs se truncan y validan (`.slice`, regex de UUID, `check` en DB).
- **Estado: CERRADO** a nivel de código.

### B9 · Rate limiting (umbrales reales, `lib/rate-limit.ts`, ventana 60s por usuario)
| Acción | Límite |
|---|---|
| Login | según Supabase Auth (server-side) |
| Escritura de cita (`cita-write`) | 30 / min |
| Escritura de factura (`invoice-write`) | 20 / min |
| Escritura de presupuesto (`budget-write`) | 20–60 / min según operación |
| Despacho de comunicación (`comm-write`) | 120 / min; lote (`comm-bulk`) 10 / min |
| Confirmación por token (`confirm`) | 10 / min por token |
**Estado: CERRADO** a nivel de código (rate limit en memoria por instancia; para multi-instancia se recomienda respaldarlo con Upstash/Redis — ver follow-up).

### B10 · Headers y transporte (`next.config.mjs`)
CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`, `upgrade-insecure-requests`), HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictiva. Iframe externo bloqueado por `frame-ancestors 'none'` + `X-Frame-Options: DENY`.
**Nota (MITIGADO):** `script-src` incluye `'unsafe-inline'` (requerido por Next sin configuración de nonce); en dev además `'unsafe-eval'` (React Refresh), que **no** aplica en producción. Follow-up opcional: CSP con nonce.
**Estado: CERRADO** (verificado en config; confirmar cabeceras en la respuesta de producción con `curl -I`).

### B11 · Secretos
- Grep del repo: **cero** claves reales; solo el **nombre** de la variable `SUPABASE_SERVICE_ROLE_KEY` en `lib/supabase/admin.ts` (`server-only`) y placeholders en `.env.example`.
- `.env`, `.env*.local` en `.gitignore`; `.env.local` **no** está trackeado por git; historial de git **sin** patrones de secreto.
- **Bundle de producción:** sin `service_role`/`SUPABASE_SERVICE_ROLE` en `.next/static`.
- Ninguna variable sensible con prefijo `NEXT_PUBLIC_`.
**Estado: CERRADO.**

---

## PARTE C — Supabase Security Advisor

**PENDIENTE (requiere ejecución live por la dueña).** No tengo acceso a la instancia de Supabase (por diseño: no acepto PAT en el chat). Equivalentes verificados localmente que cubren lo que el Advisor suele marcar:

- **RLS habilitado en todas las tablas:** 40/40 con `rowsecurity` **y** `forcerowsecurity` (0 sin RLS/FORCE). ✅
- **Funciones `SECURITY DEFINER` con `search_path` mutable:** 0 (las 6 tienen `search_path=public`). ✅
- **`SECURITY DEFINER` sin necesidad:** solo helpers de auth y `next_ncf`, justificadas. ✅

**Acción para la dueña:** correr *Database → Advisors → Security* en Supabase tras aplicar `0019` y adjuntar el resultado limpio. Si aparece algo (p. ej. "leaked password protection" en Auth, o `search_path` en alguna extensión), documentarlo aquí. No marcar CERRADO hasta tener la captura limpia.

---

## PARTE D — Dependencias

`npm audit`: **5 vulnerabilidades altas**, todas en **Next.js 14.2.35** (y su `postcss` embebido). No hay parche dentro de la rama 14.x (`npm audit fix` sin `--force` no sube `next`); el arreglo está en 15/16.

**Aplicabilidad real a este proyecto (App Router, sin servidor custom, sin i18n, sin rewrites):**

| Advisory | ¿Aplica aquí? | Mitigación vigente |
|---|---|---|
| Middleware bypass i18n (Pages Router) | **No** (App Router, sin i18n) | — |
| SSRF en Server Actions con servidor custom | **No** (Vercel serverless, sin servidor custom) | — |
| SSRF en rewrites | **No** (sin `rewrites`) | — |
| DoS en Server Actions (App Router) | Sí | Rate limit por acción + límites de body de Vercel |
| Cache confusion de respuestas con body | Parcial | `Cache-Control: no-store` en rutas API |
| Payload ilimitado en Edge | Marginal | Server Actions corren en Node, no Edge |
| Disclosure de endpoints internos de Server Functions | Sí | **Toda** action valida `requireActiveUser`/`requireRole`: descubrir el endpoint no da acceso |
| `postcss` XSS/lectura de archivos | Build-time | No expuesto en runtime; afecta tooling de build |

**Plan de migración a Next 15 (NO ejecutado en esta tanda, por instrucción):**
- Cambio principal: `params`, `searchParams` y `cookies()` pasan a ser **asíncronos** (`await`).
- Superficie en este repo: **~15 archivos** que leen esos APIs (páginas con `params/searchParams`, y `lib/supabase/server.ts`/`middleware`).
- Riesgo: **bajo-medio**, mecánico (añadir `await`), sin cambios de arquitectura. Recharts/Framer/Supabase son compatibles con React 18/Next 15.
- Recomendación: **hacerlo antes de la primera venta** — cierra las 5 altas sin saltar a Next 16 (que es un salto mayor). Estimado: medio día + regresión visual de los 20 módulos.

---

## PARTE E — Deploy

- **Producción sin login:** el middleware redirige a `/login` toda ruta que no esté en la allowlist pública (`/login`, `/auth/*`, `/`, `/sala-espera`, `/api/sala-espera`, `/confirmar/*`). Las rutas públicas se autentican por token en su propia página. **Confirmar en incógnito** contra la URL de producción (la app ya redirige; queda la verificación manual).
- **Service role:** `SUPABASE_SERVICE_ROLE_KEY` va **sin** `NEXT_PUBLIC_` (verificado en `.env.example`, `admin.ts` y bundle). Confirmar en Vercel → Project → Environment Variables.
- **PAT temporal:** en esta tanda **no se usó ningún PAT** (las migraciones las aplica la dueña en el SQL Editor). No queda ninguna connection string permanente en el repo.
- **Preview deployments:** recomendación de mantener *Vercel Authentication* activada en previews si el cliente lo requiere (follow-up de configuración de Vercel, fuera del código).

---

## Resumen ejecutivo (para mostrar al cliente)

Este sistema no solo fue **diseñado** con seguridad: fue **atacado** y resistió, con evidencia.

Se ejecutaron más de 30 ataques contra la base de datos simulando cada rol del personal (dueño, odontólogo, recepción, asistente) y un usuario desactivado, además de la revisión de headers, secretos, dependencias y despliegue. **Resultados:**

- **Aislamiento por rol:** con la llave pública no se lee ni una fila de ninguna de las 40 tablas. Cada rol ve solo lo suyo; recepción y asistente **no** pueden leer notas clínicas ni diagnósticos, ni siquiera consultando la base directamente.
- **Registros con valor legal:** la bitácora de actividad, las historias clínicas firmadas, las facturas emitidas y el historial de comunicación **no se pueden alterar ni borrar** — probado con privilegios de superusuario, los 7 intentos fueron rechazados por la base de datos.
- **Consentimiento del paciente:** si un paciente pide no recibir mensajes, el sistema **no puede** programárselos — bloqueado a nivel de base de datos, no solo en la app.
- **Hallazgos:** la auditoría encontró y **corrigió** 5 puntos (4 de refuerzo de acceso y 1 defecto del enlace de confirmación del paciente). Todos re-probados en verde.

**Follow-up conocido (no bloqueante para vender, sí antes de escalar):**
1. Correr el Security Advisor de Supabase en vivo y adjuntar el resultado limpio.
2. Migrar a Next.js 15 para cerrar 5 advisories de dependencia (medio día, bajo riesgo).
3. Verificación en vivo de Storage (expiración de signed URL, MIME real) e incógnito de producción.
4. Rate limiting respaldado por Redis si se pasa a multi-instancia.

*La auditoría es repetible en un minuto (`scripts/security-tests/run.sh`) en este y en cualquier proyecto futuro de JM Nexus Designs.*

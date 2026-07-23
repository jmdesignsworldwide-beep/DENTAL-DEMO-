# Auditoría de Seguridad — Fort Knox Verificado (Tanda 18)

Esta auditoría **no construye** seguridad: la **prueba**. Cada punto se verifica
con evidencia concreta del repositorio. Lo que sólo puede confirmarse contra la
instancia viva de Supabase / Vercel de la dueña se marca **🔻 REQUIERE ENTORNO
EN VIVO** con el procedimiento exacto de prueba — nunca se marca cerrado algo que
no lo está.

**Leyenda:** ✅ Verificado en código · 🔻 Requiere entorno en vivo (dueña) · ⚠️ Abierto (con plan)

Fecha: 2026-07-23 · Rama: `claude/sistema-dental-demo-oxphzh`

---

## 1. Claves y secretos — ✅

| Punto | Estado | Evidencia |
|---|---|---|
| `service_role` sólo en servidor | ✅ | `grep service_role` en `app/ components/ lib/` → **única coincidencia: `lib/supabase/admin.ts`** |
| `admin.ts` con `import "server-only"` | ✅ | Línea 1 de `lib/supabase/admin.ts` es `import "server-only";` (el bundler falla si se importa en cliente) |
| Nada sensible con `NEXT_PUBLIC_` | ✅ | Las únicas vars públicas son `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ambas públicas por diseño; la anon key es inofensiva porque RLS la gobierna) |
| Cero secretos hardcodeados | ✅ | `grep -E "eyJ…|sk_live|sk_test|-----BEGIN"` en todo el código → sin coincidencias |
| `.env` ignorado | ✅ | `.gitignore` cubre `.env`, `.env*.local`, etc. `git ls-files` → sólo `.env.example` versionado |

🔻 **Prueba pendiente (dueña):** inspeccionar el bundle de producción (`.next/`) tras
el deploy y confirmar por búsqueda que la `service_role` key no aparece. Como `admin.ts`
usa `server-only`, Next rompe el build si se filtra al cliente — la garantía es estructural.

---

## 2. RLS — ✅

| Punto | Estado | Evidencia |
|---|---|---|
| RLS + FORCE en TODAS las tablas | ✅ | **32 tablas creadas · 32 `enable row level security` · 32 `force row level security`** (relación 1:1:1, sin excepción) |
| Cero `USING(true)` | ✅ | `grep -iE "using ?\(true\)"` en migraciones → sólo aparece en **comentarios** ("jamás `USING(true)`"), nunca en una política real |
| Deny by default | ✅ | La migración cero (`0000_init.sql`) activa RLS+FORCE antes de definir cualquier política; sin política, la tabla niega todo |

🔻 **Prueba pendiente (dueña):** desde el SQL editor o la API REST con la **anon key**,
`select * from <tabla>` sobre cada tabla → debe volver **vacío** (0 filas) o rechazado.
Repetir autenticado como un rol sin permiso sobre esa tabla.

---

## 3. Autorización por rol — ✅ (código) / 🔻 (prueba en vivo)

| Punto | Estado | Evidencia |
|---|---|---|
| `requireActiveUser()`/`requireRole()` en cada server action | ✅ | Barrido de todos los archivos con `"use server"`: **el único sin guard es `app/login/actions.ts`**, que es correcto (el login ocurre *antes* de existir sesión) |
| Autorización en SERVIDOR, no sólo UI | ✅ | `requireRole([...])` redirige en el servidor (`lib/auth.ts`); la UI oculta, pero el servidor es la barrera real |
| `requireActiveUser` exige `activo=true` | ✅ | `lib/auth.ts`: si `!profile.activo` → `redirect("/login?error=inactivo")` |
| Escritura de facturas: owner/recepcionista | ✅ | `invoices_insert` policy `with check (my_role() in ('owner','recepcionista'))` (0009) |
| Cambio de roles: sólo owner | ✅ | `changeUserRole` action → `requireRole(["owner"])`; `app_users` policies exigen `my_role()='owner'` |
| `clinical_records`: sólo owner/dentista | ✅ | Políticas de `clinical_records` restringen a esos roles (0005) |

🔻 **Pruebas pendientes (dueña), vía API directa con el token de cada rol:**
- Recepcionista `select` a `clinical_records` → vacío
- Asistente `insert` a `invoices` → rechazado
- Odontólogo `update` a `app_users.rol` → rechazado
- Usuario `activo=false` en cualquier acción → redirige a login
- `total_gastado` del paciente a un rol sin permiso → 0 (la vista `patient_overview` es `security_invoker`, así que cada subconsulta corre con los permisos del que consulta)

---

## 4. Inputs — ✅

| Punto | Estado | Evidencia |
|---|---|---|
| Sin SQL crudo con interpolación | ✅ | Todo el acceso usa el query builder de `@supabase/supabase-js` (parametrizado); no hay `sql\`\`` con concatenación de strings de usuario |
| Validación/sanitización en servidor | ✅ | Cada action valida: UUIDs por regex (`/^[0-9a-f-]{36}$/i`), montos con `Math.max(0, …)`, longitudes con `.slice(0, N)`, enums con listas blancas |
| Límites de tamaño en uploads | ✅ | Los uploads de fotos/adjuntos validan tamaño en el cliente y el bucket es privado; ver `lib/storage.ts` |

🔻 **Pruebas pendientes (dueña):** inyección (`' OR 1=1--`, `<script>`) en cada buscador
(el query builder ya escapa; confirmar sin efecto). Subir un `.exe` renombrado a `.jpg`
y confirmar rechazo por tipo MIME real.

---

## 5. Headers y transporte — ✅

Definidos en `next.config.mjs` (`async headers()` sobre `/:path*`):

- **CSP** completa (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `upgrade-insecure-requests`; `'unsafe-eval'` sólo en dev)
- **Strict-Transport-Security** `max-age=63072000; includeSubDomains; preload`
- **X-Frame-Options** `DENY`
- **X-Content-Type-Options** `nosniff`
- **Referrer-Policy** `strict-origin-when-cross-origin`
- **Permissions-Policy** `camera=(), microphone=(), geolocation=(), browsing-topics=()`
- `poweredByHeader: false`

🔻 **Prueba pendiente (dueña):** embeber la URL en vivo en un `<iframe>` externo →
debe bloquearse (X-Frame-Options DENY + `frame-ancestors 'none'`). Revisar la consola
del navegador buscando violaciones de CSP en cada pantalla.

---

## 6. Rate limiting — ✅

| Punto | Estado | Evidencia |
|---|---|---|
| Rate limit server-side por usuario | ✅ | `lib/rate-limit.ts`; aplicado en **todos** los módulos de acciones (facturación, citas, inventario, tratamientos, historia, pacientes, odontograma) y en la API de sala de espera |
| Rate limit específico en login | ✅ | `app/login/actions.ts` línea 37: `rateLimit(\`login:${ip}:${email}\`, {...})` |

🔻 **Prueba pendiente (dueña):** ráfaga de intentos de login fallidos → confirmar bloqueo
temporal tras el umbral.

---

## 7. Storage — ✅

| Punto | Estado | Evidencia |
|---|---|---|
| Buckets privados | ✅ | `patient-photos` (0002) y `clinical-files` (0005) creados con `public = false` |
| `createSignedUrl` con expiración corta | ✅ | `lib/patient-portal.ts` y `lib/waiting-room.ts` → `createSignedUrl(path, 300)` (5 min); `lib/storage.ts` firma con expiración parametrizada |
| Cero `getPublicUrl` | ✅ | `grep getPublicUrl` en código → sólo aparece en un comentario ("NUNCA `getPublicUrl`") |
| Políticas de storage con RLS | ✅ | `storage.objects` con políticas por bucket + rol (0002/0005) |

🔻 **Pruebas pendientes (dueña):** copiar una signed URL, esperar >5 min, recargar → falla.
Cambiar la ruta de la URL firmada al archivo de otro paciente → rechazado por la política.

---

## 8. Endpoints y RPCs — ✅

| Punto | Estado | Evidencia |
|---|---|---|
| Funciones `SECURITY DEFINER` con `search_path` fijo | ✅ | Todas las definer (`is_active`, `my_role`, `is_owner`, `next_ncf`, helpers de dashboard, `handle_new_user`) llevan `set search_path = public` |
| `EXECUTE` revocado de `anon`/`public` | ✅ | `revoke all on function … from public, anon` en `next_ncf`, `is_active`, `my_role` |
| Vistas con `security_invoker` | ✅ | `patient_overview` creada `with (security_invoker = on)` (0002) |
| Endpoints exigen sesión | ✅ | `/api/notifications` y `/api/sala-espera` validan sesión/token; middleware redirige rutas privadas a login |
| Token de sala → sólo campos mínimos | ✅ | `lib/waiting-room.ts` `buildScreen` devuelve un DTO mínimo (nombre + inicial, hora, estado) — **sin montos, cédulas ni diagnósticos**; la privacidad se filtra en el servidor, nunca en el frontend |

🔻 **Prueba pendiente (dueña):** llamar cada endpoint sin token → 401/redirect. Confirmar
que la respuesta del kiosco por token no incluye datos clínicos ni financieros.

---

## 9. Inmutabilidad a nivel DB — ✅

Triggers que lanzan excepción ante `UPDATE`/`DELETE`, verificados en las migraciones:

| Tabla | Trigger | Evidencia |
|---|---|---|
| `activity_log` | `block_mutations` | "activity_log es inmutable: operación % bloqueada" (0000) |
| `clinical_records` | `clinical_record_guard` | firmada → "crea una enmienda en lugar de editar" (0005) |
| `clinical_attachments` | `block_mutations_attach` | inmutable (0005) |
| `invoices` | `invoices_guard` | "Las facturas no se borran: anula con motivo" (0009) |
| `invoice_items` / `payments` | `block_billing_children` | inmutables (0009) |
| `tooth_events` / `odontogram_snapshots` | `block_odontogram_history` | inmutable (0006) |
| `anatomy_events` | `block_anatomy_history` | inmutable (0007) |
| `material_movements` | `block_material_movements` | inmutable (0011) |

🔻 **Prueba pendiente (dueña):** `UPDATE`/`DELETE` directos desde el SQL editor contra
`activity_log`, un `clinical_records` firmado y una factura emitida → los tres deben
fallar. Adjuntar el mensaje de error como evidencia.

---

## 10. Dependencias — ⚠️ ABIERTO (con plan)

`npm audit` reporta advisories en **Next.js** y en `glob` (transitivo vía
`eslint-config-next`, sólo dev).

- **Estado actual:** el proyecto está en **`next@14.2.35`, la última del canal 14.2.x**
  (confirmado con `npm view next@14 version`). Los advisories listados se corrigen en
  **Next 15+/16**, no hay backport a 14.2.x.
- **Por qué no se cerró aquí:** subir a Next 15 es un **cambio mayor con ruptura**
  — `params`, `searchParams` y `cookies()` pasan a ser asíncronos y hay que migrar
  ~10 rutas dinámicas + `lib/supabase/server.ts`. Hacerlo a ciegas en la pasada final,
  sin poder probar contra la DB en vivo, arriesga romper el producto ya entregado.
- **Mitigaciones vigentes:** varios advisories aplican a *self-hosted*, *Pages Router
  i18n* o *custom servers* — este sistema corre en **Vercel (gestionado)** con **App
  Router**, sin i18n de Pages ni servidor propio, y con uso mínimo de `next/image`
  (limitado por `remotePatterns` al host de Supabase). CSP, HSTS y buckets privados
  reducen la superficie.
- **Plan (follow-up rastreado):** migración a Next 15 (async `params`/`searchParams`/
  `cookies`) en una rama dedicada, con QA completo, fuera del alcance de esta demo.
- `glob`: sólo herramienta de desarrollo (lint); no llega a producción.

> Este punto se reporta **de frente como abierto**. No se marca cerrado.

---

## 11. Supabase Security Advisor — 🔻 REQUIERE ENTORNO EN VIVO

No se puede ejecutar sin la instancia de Supabase de la dueña.

**Procedimiento:** Dashboard → *Advisors* → *Security*. Correr completo, cerrar
**todas** las advertencias, volver a correr y confirmar limpio. Adjuntar la captura del
resultado limpio al PR. El diseño ya apunta a un Advisor limpio: RLS+FORCE en 32/32
tablas, definers con `search_path`, sin `USING(true)`, `security_invoker` en la vista.

---

## 12. PAT temporal — 🔻 REQUIERE CONFIRMACIÓN DE LA DUEÑA

Ningún PAT ni connection string permanente existe en el repo
(`grep` de `eyJ…`, `postgres://`, `sk_…` → sin coincidencias). El protocolo (generar PAT
temporal → aplicar migración → **revocar de inmediato**) es una acción operativa de la
dueña en Supabase. **Confirmar que cada PAT usado para aplicar las migraciones 0000–0016
fue revocado.**

---

## 13. Deploy — ✅ (app) / 🔻 (Vercel)

| Punto | Estado | Evidencia |
|---|---|---|
| La URL en vivo no expone datos sin login | ✅ | El middleware redirige toda ruta privada a `/login` (smoke test: `/dashboard`, `/configuracion`, `/personal`, `/notificaciones` → 307). Públicas: landing, `/login`, `/sala-espera` (autenticada por token/sesión dentro), `/design-system` (404 en prod) |
| PII siempre tras sesión | ✅ | `/portal/[id]` y `/imprimir/*` exigen sesión activa del personal |
| Vars de entorno de producción en Vercel | 🔻 | La dueña confirma en Vercel: `SUPABASE_SERVICE_ROLE_KEY` **sin** prefijo `NEXT_PUBLIC_`, URLs correctas |
| Preview deployments protegidos | 🔻 | La protección de previews es un ajuste de Vercel; la auth a nivel de app ya protege todo el PII independientemente |

---

## Resumen

- **Verificado en código (✅):** puntos 1, 2, 3, 4, 5, 6, 7, 8, 9, 13(app) — la
  arquitectura Fort Knox se cumplió en todo el sistema.
- **Requiere entorno en vivo de la dueña (🔻):** las *pruebas activas* de 2/3/4/5/6/7/8/9,
  el Security Advisor (11), la revocación del PAT (12) y los ajustes de Vercel (13).
- **Abierto y reportado de frente (⚠️):** dependencias (10) — Next.js en la última 14.2.x;
  remediación completa vía migración a Next 15+ como follow-up rastreado.

Nada se marcó cerrado sin evidencia. Los puntos que dependen de la instancia viva se
listan con su procedimiento exacto de prueba.

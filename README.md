# Clínica Dental — Sistema de Gestión (DEMO)

Sistema de gestión premium para clínicas dentales en República Dominicana.
Estándar: **monster, premium, flawless, high-end.**

> **Tanda 1 de 18 — Fundación.** Design System, Login, Cinematic Welcome,
> Layout y seguridad Fort Knox desde la línea uno.

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** (PostgreSQL + Auth + Storage) con RLS + FORCE
- **Framer Motion** (animaciones) · **lucide-react** (iconos)
- **Recharts** (llega en la Tanda 11)
- Deploy en **Vercel** con branch previews

## Estructura

```
app/
  (app)/               # rutas autenticadas (layout con sidebar + header)
    dashboard/         # dashboard (fundación; completo en Tanda 2)
  login/               # pantalla de ingreso premium + server action
  welcome/             # cinematic welcome (una vez tras login, con fail-safe)
  design-system/       # showcase de componentes (SOLO desarrollo)
components/
  ui/                  # librería: Button, Card, Input, Modal, Toast, KPICard…
  layout/              # sidebar, header, app-shell, nav-config
  brand/               # logo, aurora
  motion/              # count-up, stagger
lib/
  supabase/            # clientes server / browser / admin + middleware de sesión
  auth.ts              # requireActiveUser / requireRole (autorización en servidor)
  activity.ts          # logActivity (auditoría inmutable)
  rate-limit.ts        # rate limiting server-side
supabase/
  migrations/          # 0000_init.sql — migración cero (nace cerrada)
```

## Puesta en marcha local

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Copiar variables de entorno y rellenar con tu proyecto Supabase:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Descripción |
   |----------|-------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto (pública) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (pública, protegida por RLS) |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role — **SOLO servidor**, nunca `NEXT_PUBLIC_` |
   | `NEXT_PUBLIC_SITE_URL` | URL canónica del sitio |

3. Aplicar las migraciones en orden (**protocolo PAT temporal**):
   - Generar un PAT temporal en Supabase.
   - Aplicar en orden `0000_init.sql`, `0001_dashboard.sql` y
     `0002_patients.sql` (SQL Editor o `supabase db push`). La `0001`
     incluye el seed dominicano que enciende el dashboard; la `0002`
     completa el CRM de pacientes (45 pacientes con expediente completo).
   - La `0002` intenta crear el bucket privado **`patient-photos`** y sus
     políticas de Storage; si tu conexión no tiene permisos sobre `storage`,
     créalo manualmente (privado) y replica las políticas del archivo.
   - Citas: aplica `0003_appointment_status.sql` (añade estados) y **luego**,
     por separado, `0004_appointments.sql`. Postgres no permite usar un valor
     de enum recién creado en la misma transacción, por eso van en dos archivos
     — no los combines en una sola ejecución del SQL Editor.
   - Historia clínica: aplica `0005_clinical.sql`. Intenta crear el bucket
     privado **`clinical-files`** y sus políticas; si tu conexión no tiene
     permisos sobre `storage`, créalo manualmente (privado). Las entradas
     firmadas son inmutables a nivel de base de datos.
   - Odontograma: aplica `0006_odontogram.sql`. Siembra el paciente
     **María Altagracia Peña** con estados variados (caries, coronas,
     implantes, endodoncias, extracciones) para que el módulo abra impactante.
     El historial por diente y los snapshots son inmutables a nivel de DB.
   - Diagrama anatómico: aplica `0007_anatomy.sql`. Añade marcas de
     afectación por zona (esmalte, dentina, pulpa, conducto, raíz, ápice) con
     historial inmutable, sembradas también para María Altagracia Peña.
   - Facturación: aplica `0008_invoice_status.sql` (añade estado) y **luego**,
     por separado, `0009_billing.sql` (NCF, ítems, pagos, secuencias). La `0009`
     amplía y completa las facturas ya sembradas (les asigna NCF e ítems). Las
     facturas emitidas son inmutables (solo se anulan con motivo).
   - Catálogo: aplica `0010_treatments.sql`. Siembra 41 tratamientos reales
     en las 8 categorías y liga las FKs opcionales de citas y facturas. Solo el
     owner administra precios; el resto del personal lo consulta.
   - Inventario: aplica `0011_inventory.sql`. Proveedores, 55 materiales
     (algunos bajo mínimo para que las alertas se vean vivas), movimientos
     inmutables y recetas de consumo por tratamiento.
   - Sala de espera: aplica `0012_waiting_room.sql`. Añade la configuración de
     la clínica (singleton `clinic_settings`), los tokens de pantalla
     (`screen_tokens`, siembra el token demo `DEMO-SALA-2026`) y el contenido
     rotativo (`waiting_room_content`, 8 consejos/anuncios reales). Todas con
     RLS + FORCE. El kiosco TV en `/sala-espera` se autentica por token (acceso
     de solo lectura, sin credenciales de usuario) o por sesión del personal, y
     el servidor devuelve **solo** los campos mínimos de la sala vía cliente
     admin tras validar el token.
   - Portal del paciente: aplica `0013_patient_portal.sql`. Añade
     `treatment_plans` y `treatment_plan_stages` (progreso del tratamiento por
     etapas) con RLS + FORCE, y deja tres pacientes demo en estados claros:
     **María Altagracia Peña** con plan de ortodoncia en curso + balance
     pendiente, otro con endodoncia en fases y al día, y un tercero al día sin
     plan. El portal (`/portal-paciente`) se muestra dentro de un marco de
     teléfono; "Ver a pantalla completa" abre `/portal/[patientId]` (bare,
     protegido por sesión del personal) para entregarlo en el celular durante
     la demo. El teléfono lleva su propio toggle de tema, independiente del
     tema global.
   - Personal y nómina: aplica `0014_staff_payroll.sql`. Añade `staff`
     (roster con salario, comisión y horario), `staff_absences` y
     `payroll_status` (estado de pago por período), todas **solo para el
     owner** con RLS + FORCE. Siembra 7 empleados con nombres y
     especialidades dominicanas reales; los tres odontólogos coinciden con los
     dentistas ya sembrados en citas, así el panel de rendimiento se alimenta
     de datos reales. La nómina (`/personal`) calcula las deducciones con la
     normativa dominicana vigente (AFP 2.87% + SFS 3.04% e ISR por escala
     DGII, en `lib/payroll.ts`) y emite un volante de pago imprimible en
     `/imprimir/volante/[staffId]`.
   - Notificaciones: aplica `0015_notifications.sql`. Añade `notifications`
     (feed de la clínica, visible al personal activo, con estado de lectura) y
     `notification_prefs` (preferencias por usuario y canal — cada quien ve y
     edita solo las suyas), con RLS + FORCE. Siembra ~18 notificaciones
     coherentes con pacientes, stock y facturas reales, mezclando tipos,
     prioridades y estados. La campana del header (`/api/notifications`) usa
     realtime + polling, agrupa de forma inteligente (p. ej. "3 pacientes en
     sala de espera") y ofrece acciones rápidas in-situ; la página completa
     (`/notificaciones`) añade filtros, búsqueda y el panel de preferencias.
   - **Revocar el PAT inmediatamente.** Nunca dejarlo en chat, logs ni
     connection strings permanentes.

4. Crear el usuario owner en **Authentication → Users**, y activarlo una vez:

   ```sql
   update public.profiles
      set rol = 'owner', activo = true, nombre = 'Dra. Nombre Apellido'
    where id = (select id from auth.users where email = 'owner@clinica.do');
   ```

5. Arrancar:

   ```bash
   npm run dev       # http://localhost:3000
   ```

   Showcase de componentes en `/design-system` (solo en desarrollo).

## Seguridad — Fort Knox

Incorporada en todo, desde la migración cero:

- `service_role` **solo servidor** (`import "server-only"`), nunca `NEXT_PUBLIC_`.
- **RLS + FORCE** en todas las tablas · deny by default · nunca `USING(true)`.
- Autorización en el **servidor** (`requireActiveUser` / `requireRole`), no solo
  ocultando UI.
- Validación y sanitización de todos los inputs (server actions).
- **Security headers** en `next.config.mjs`: CSP, HSTS, X-Frame-Options,
  nosniff, Referrer-Policy, Permissions-Policy.
- **Rate limiting** server-side por usuario/IP en el login.
- Secretos solo en `.env.local` (git-ignored); en el repo solo `.env.example`.
- **Auditoría inmutable**: `activity_log` acepta solo INSERT/SELECT; UPDATE y
  DELETE bloqueados por RLS **y** por triggers a nivel de base de datos (incluso
  contra `service_role`).
- Trigger anti-escalada de privilegios: un no-owner no puede cambiar su `rol`
  ni `activo`.

### Nota de dependencias

Se fijó **Next.js 14.2.35** (parche de la vulnerabilidad crítica de Server
Actions). Advisories restantes de Next se cierran solo en Next 16 (cambio
mayor) — pendiente de decisión para una tanda de mantenimiento.

## Deploy a Vercel

1. Conectar el repositorio en Vercel.
2. Configurar las env vars del `.env.example` en el proyecto.
3. Deploy a **branch preview** y revisar en móvil real (390px) y ambos temas.
4. Correr **Supabase Security Advisor** y cerrar todas las advertencias antes
   de mergear.

## Scripts

```bash
npm run dev         # desarrollo
npm run build       # build de producción
npm run start       # servir build
npm run lint        # ESLint
npm run typecheck   # TypeScript sin emitir
```

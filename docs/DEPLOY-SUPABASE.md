# Migraciones automáticas de Supabase — Estándar JM Nexus Designs

Procedimiento estándar para que las migraciones de base de datos se apliquen
**solas al mergear a `main`**, sin pasos manuales. Replicable en cada proyecto
nuevo. Cero SQL pegado a mano, cero olvidos, cero "se me quedó sin aplicar".

> **Principio:** el esquema de la BD es código. Vive en `supabase/migrations/`,
> se revisa en PRs, y se aplica automáticamente al llegar a `main`. La única
> acción manual que queda es correr el **Security Advisor** después (Supabase no
> expone un endpoint estable para automatizarlo).

---

## Cómo funciona

- **Workflow:** `.github/workflows/supabase-migrations.yml`.
- **Disparo:** push a `main` que toque `supabase/migrations/**` (o `workflow_dispatch` a mano).
- **Acción:** instala la CLI de Supabase, enlaza el proyecto y corre `supabase db push`.
- **Idempotencia:** `db push` consulta `supabase_migrations.schema_migrations` y **solo aplica las que faltan**. Correr el workflow dos veces no repite nada.
- **Orden y transacciones:** aplica en orden por nombre de archivo, **cada migración en su propia transacción**. Por eso los cortes de enum (`ALTER TYPE ADD VALUE` en `0003`/`0008` usados en `0004`/`0009`) se respetan solos — a diferencia de pegar todo junto en el SQL Editor.
- **Fallo claro:** si una migración falla, la CLI imprime **qué archivo** y el **error SQL**, y el step termina en rojo. El workflow falla y no marca `main` como desplegado.

---

## Setup desde cero en un proyecto nuevo (una sola vez)

### 1. Crear los 3 secrets del repo

GitHub → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | De dónde sale |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase → **Account → Access Tokens** (https://supabase.com/dashboard/account/tokens) → *Generate new token*. Nómbralo `github-actions-migrations`. Autentica la CLI. |
| `SUPABASE_PROJECT_REF` | Supabase → **Project Settings → General → Reference ID** (los ~20 caracteres; también está en la URL del dashboard: `.../project/<REF>`). |
| `SUPABASE_DB_PASSWORD` | Supabase → **Project Settings → Database → Database password**. Es la contraseña de Postgres (la fijaste al crear el proyecto; ahí mismo puedes resetearla). **`db push` la necesita para conectarse a la BD** — el access token por sí solo no basta. |

> **Por qué 3 y no 2:** el `SUPABASE_ACCESS_TOKEN` autentica la CLI con la
> Management API (para enlazar), pero `supabase db push` **abre una conexión
> Postgres directa** que exige el password de la BD.

### 2. Tener estos archivos en el repo (ya incluidos aquí)

- `supabase/config.toml` — config mínima (la ref real se pasa por secret, no se escribe).
- `.github/workflows/supabase-migrations.yml` — el workflow.
- `supabase/migrations/*.sql` — tus migraciones.

### 3. Proteger `main`

Settings → **Branches → Branch protection rule** para `main`: exigir PR + review
antes de mergear. Esto es parte de la seguridad (ver más abajo).

### 4. Primer despliegue

Al mergear el primer PR que toque `supabase/migrations/**`, el workflow corre
solo. Si las migraciones **ya existían** en `main` antes de configurar esto
(como en este proyecto), dispáralo a mano una vez: **Actions → Supabase
Migrations → Run workflow**.

### 5. Convención de nombres (para proyectos nuevos)

Crea cada migración con `supabase migration new <nombre>` → genera el prefijo de
timestamp de 14 dígitos que la CLI espera. Mantén el orden por nombre.

---

## Verificar que aplicó bien

En el **SQL Editor** de Supabase:

```sql
-- Migraciones registradas por la CLI (una fila por archivo aplicado)
select version, name from supabase_migrations.schema_migrations order by version;

-- Tablas y RLS
select count(*) from pg_tables where schemaname = 'public';
select relname from pg_class
 where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;  -- 0 filas
select count(*) from pg_policies where schemaname = 'public';

-- Storage privado
select id, public from storage.buckets;  -- buckets con public = false
```

Y en GitHub: **Actions → última corrida de Supabase Migrations** debe estar en
verde, con el log "Aplicando migración …" por cada archivo nuevo.

---

## Security Advisor (paso manual de cierre)

Supabase no expone un endpoint estable para el Advisor, así que este paso queda
manual tras cada despliegue con cambios de esquema:

1. Dashboard → **Advisors → Security**.
2. Correr completo y **cerrar todas** las advertencias (RLS faltante, funciones
   sin `search_path`, políticas permisivas, etc.).
3. Volver a correr y confirmar limpio.

Un esquema bien construido (RLS + FORCE en todas las tablas, `SECURITY DEFINER`
con `search_path` fijo, sin `USING(true)`) debería salir limpio de una.

---

## Seguridad del token en Actions

- **Cifrado en reposo.** Los secrets de Actions se guardan cifrados; no son legibles desde la UI una vez creados.
- **Enmascarado en logs.** GitHub reemplaza automáticamente cualquier aparición del valor de un secret por `***` en los logs. El workflow además nunca hace `echo` de los tokens.
- **No están en el repo.** Viven en Settings, no en el código. La ref del proyecto se pasa por secret; `config.toml` solo lleva una etiqueta.
- **No se exponen a forks.** Los workflows disparados por `pull_request` desde un fork **no** reciben los secrets (default de GitHub). Solo corren con secrets los push/merge a ramas del propio repo.
- **Superficie:** quien pueda **pushear a `main`** o **editar el workflow** puede, en teoría, filtrar un secret con un step malicioso. Por eso el paso 3 (proteger `main` con PR + review) es parte de la seguridad, no un extra.
- **Higiene:** usa un token dedicado (`github-actions-migrations`), rótalo periódicamente, y revócalo si sospechas exposición.

---

## Problemas comunes

| Síntoma | Causa / arreglo |
|---|---|
| `Missing SUPABASE_DB_PASSWORD` o pide password | Falta el secret `SUPABASE_DB_PASSWORD` (paso 1). |
| `failed to connect` en `link` | Ref o password incorrectos. Verifica en Project Settings → Database. |
| La CLI se queja del formato de versión del archivo | Nombres no-timestamp. Renombra con `supabase migration new`, o fija una versión de CLI que los acepte en `supabase/setup-cli`. |
| Migración fuera de orden | `supabase db push --include-all` (agrega el flag en el workflow) para forzar aplicar versiones anteriores a la última remota. |
| Ya aplicaste migraciones a mano y la CLI quiere repetirlas | `schema_migrations` está vacío. Márcalas como aplicadas con `supabase migration repair --status applied <version>` por cada una, o deja que `db push` las re-aplique (las migraciones son idempotentes: `if not exists`, `on conflict do nothing`, `create or replace`). |

---

## TL;DR para un proyecto nuevo

1. `supabase migration new …` para cada cambio de esquema (commit en un PR).
2. Copia `.github/workflows/supabase-migrations.yml` y `supabase/config.toml`.
3. Crea los 3 secrets (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`).
4. Protege `main` con PR + review.
5. Merge → las migraciones se aplican solas. Corre el Security Advisor. Listo.

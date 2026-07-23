# Migraciones automáticas de Supabase — Estándar JM Nexus Designs

Igual que Vercel despliega la app al mergear a `main`, **Supabase aplica las
migraciones de la base de datos al mergear a `main`** — usando la integración
nativa de GitHub de Supabase. Sin CI custom, sin secrets que administrar.

> **Principio:** el esquema de la BD es código, vive en `supabase/migrations/`,
> se revisa en PRs, y Supabase lo aplica solo al llegar a `main`.

---

## Requisitos

- El repo tiene `supabase/config.toml` y `supabase/migrations/` (ya están aquí).
- **Plan Pro de Supabase.** La integración con GitHub para desplegar migraciones
  (Branching) es una función de pago. En el plan Free no está disponible el
  auto-deploy por git — en ese caso, aplicas las migraciones desde el **SQL
  Editor** (una por una, en orden `0000`→`0016`) o con `supabase db push` desde
  tu terminal, y luego la mantienes al día a mano.

---

## Configurar la integración (una sola vez)

1. **Supabase Dashboard → tu proyecto → Integrations** (o el menú de rama arriba
   a la izquierda, junto al nombre del proyecto → **Enable branching**).
2. Busca **GitHub** → **Connect** / **Authorize**.
3. Autoriza el **Supabase GitHub App** y dale acceso al repositorio
   **`jmdesignsworldwide-beep/dental-demo-`** (puedes limitarlo solo a ese repo).
4. En la configuración de la integración:
   - **Production branch:** `main`.
   - **Supabase directory:** `supabase` (es el default; ahí están `config.toml` y `migrations/`).
5. Guarda / habilita.

**Qué hace a partir de ahí:**
- **Merge a `main`** → Supabase aplica a la **base de datos de producción** las
  migraciones de `supabase/migrations/` que aún no estén registradas.
- **Abrir un PR** → crea una **rama de preview** con una BD efímera y corre las
  migraciones ahí, para probar antes de mergear.

---

## ¿Aplica las 16 pendientes en el primer sync?

**Sí — todas en el primer sync, sin correr nada a mano.** Supabase lleva su
propio historial (`supabase_migrations.schema_migrations`); como tu BD está
vacía, en el primer sync aplica las 17 en orden, **cada una en su propia
transacción** (por eso los cortes de enum `0003→0004` y `0008→0009` se respetan
solos). **No necesitas correr nada previo.**

Para forzar el primer sync sin esperar un merge nuevo: haz un commit trivial a
`main` que toque `supabase/migrations/` (o re-sincroniza desde el panel de la
integración).

---

## Verificar que aplicó

SQL Editor de Supabase:

```sql
select version, name from supabase_migrations.schema_migrations order by version; -- 17 filas
select count(*) from pg_tables where schemaname = 'public';                        -- 32
select relname from pg_class
 where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity; -- 0 filas
select count(*) from pg_policies where schemaname = 'public';                      -- ~90+
select id, public from storage.buckets;                                            -- buckets private (false)
```

---

## Activar tu usuario owner

Crea tu usuario en **Authentication → Users**, y actívalo una vez (SQL Editor):

```sql
update public.profiles set rol = 'owner', activo = true, nombre = 'Dra. Tu Nombre'
 where id = (select id from auth.users where email = 'TU-CORREO@ejemplo.com');
```

Cierra sesión, vuelve a entrar → ya verás el sistema completo.

---

## Security Advisor (cierre manual)

Tras cada despliegue con cambios de esquema: Dashboard → **Advisors → Security**
→ correr, cerrar todas las advertencias, volver a correr y confirmar limpio.

---

## Plan B (Free, o si la integración no aplica)

- **SQL Editor:** pega el contenido de `supabase/migrations/0000_init.sql`, Run;
  repite `0001`…`0016` **en orden, uno por uno** (no los juntes: el enum de
  `0003`/`0008` falla si van en la misma corrida).
- **CLI:** `supabase link --project-ref <REF>` + `supabase db push` desde tu
  terminal (requiere `SUPABASE_ACCESS_TOKEN` y `SUPABASE_DB_PASSWORD` en tu
  entorno local, nunca en el chat).

---

## TL;DR proyecto nuevo

1. `supabase migration new …` por cada cambio de esquema (en un PR).
2. Supabase → Integrations → conectar GitHub, production branch = `main`, directorio = `supabase`.
3. Merge → Supabase aplica solo. Corre el Security Advisor. Listo.

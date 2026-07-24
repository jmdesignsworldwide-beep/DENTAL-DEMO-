// ════════════════════════════════════════════════════════════════════════
//  Aplica las migraciones pendientes durante el build de PRODUCCIÓN de Vercel.
//  Se ejecuta vía el script `vercel-build` (ver package.json), antes de
//  `next build`. Así, al mergear a main → deploy de producción → las
//  migraciones nuevas se aplican solas. Cero SQL Editor.
//
//  Reglas de seguridad:
//   · Solo corre en producción (VERCEL_ENV === 'production'). En previews y en
//     local NO toca la base — un preview jamás modifica el esquema de prod.
//   · Si falta SUPABASE_DB_URL, no hace nada (no rompe el build).
//   · Si una migración falla, aborta el deploy A PROPÓSITO: no publicamos la
//     app contra un esquema a medias.
//
//  Variable requerida (se configura UNA vez en Vercel → Settings → Environment
//  Variables, scope Production; nunca en el código ni en chat):
//   · SUPABASE_DB_URL = connection string del **Session pooler** de Supabase
//     (Project Settings → Database → Connection string → "Session pooler").
//     Se usa el pooler porque es IPv4; la conexión "direct" es IPv6 y el build
//     de Vercel no la alcanza.
// ════════════════════════════════════════════════════════════════════════
import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV ?? "local";

if (env !== "production") {
  console.log(`▶ migrate-on-deploy: VERCEL_ENV=${env} → se saltan migraciones (solo corren en producción).`);
  process.exit(0);
}

if (!process.env.SUPABASE_DB_URL) {
  console.log(
    "▶ migrate-on-deploy: falta SUPABASE_DB_URL → se saltan las migraciones.\n" +
      "  Agrégala en Vercel (scope Production) con la connection string del Session pooler de Supabase.",
  );
  process.exit(0);
}

console.log("▶ migrate-on-deploy: aplicando migraciones pendientes (supabase db push)…");
try {
  // La URL viaja por variable de entorno (no se imprime en el comando).
  execSync('npx --yes supabase@latest db push --db-url "$SUPABASE_DB_URL"', {
    stdio: "inherit",
    shell: "/bin/bash",
    env: process.env,
  });
  console.log("✓ migrate-on-deploy: base de datos al día.");
} catch {
  console.error(
    "✗ migrate-on-deploy: falló `db push`. Se aborta el deploy a propósito " +
      "(no publicamos la app contra un esquema a medias). Revisa los logs de arriba.",
  );
  process.exit(1);
}

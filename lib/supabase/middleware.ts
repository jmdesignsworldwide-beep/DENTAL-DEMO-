import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Refresca la sesión de Supabase en cada request y protege rutas privadas.
 * Deny by default: cualquier ruta fuera de la lista pública exige sesión.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin credenciales configuradas no podemos autenticar — dejamos pasar sólo
  // rutas públicas para no romper el primer arranque local.
  if (!supabaseUrl || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Fallo de red/credenciales — tratamos como no autenticado y dejamos
    // que las rutas públicas sigan sirviendo (no rompemos con un 500).
    user = null;
  }

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/login" ||
    path.startsWith("/auth") ||
    path === "/" ||
    path === "/design-system" || // solo dev; en producción la página hace 404
    path === "/sala-espera" || // kiosco TV: se autentica por token o sesión dentro de la página
    path === "/api/sala-espera" || // endpoint de refresco del kiosco (token o sesión)
    path.startsWith("/confirmar") || // confirmación de cita del paciente: se autentica por token firmado en la página
    path.startsWith("/_next") ||
    path.startsWith("/favicon");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", path);
    return NextResponse.redirect(url);
  }

  // Usuario autenticado que visita /login → mándalo a la app.
  // PERO nunca cuando /login trae un ?error (p. ej. cuenta inactiva): ese es el
  // destino al que requireActiveUser manda a un usuario con sesión pero sin
  // acceso; rebotarlo a /dashboard crea un bucle infinito de redirecciones.
  if (user && path === "/login" && !request.nextUrl.searchParams.has("error")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

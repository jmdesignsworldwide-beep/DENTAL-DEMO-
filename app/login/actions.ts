"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export interface LoginState {
  error?: string;
}

// Validación server-side estricta — nunca confiar en el cliente.
function validate(email: string, password: string): string | null {
  if (!email || !password) return "Correo y contraseña son requeridos.";
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) return "El formato del correo no es válido.";
  if (email.length > 254) return "Correo demasiado largo.";
  if (password.length < 6) return "La contraseña es muy corta.";
  if (password.length > 200) return "Contraseña demasiado larga.";
  return null;
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const validationError = validate(email, password);
  if (validationError) return { error: validationError };

  // Rate limiting por IP + correo — mitiga fuerza bruta.
  const ip = headers().get("x-forwarded-for")?.split(",")[0] ?? "local";
  const { ok } = rateLimit(`login:${ip}:${email}`, {
    limit: 5,
    windowMs: 60_000,
  });
  if (!ok) {
    return {
      error: "Demasiados intentos. Espera un minuto e inténtalo de nuevo.",
    };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Mensaje genérico — no revelar si el correo existe.
    return { error: "Credenciales incorrectas. Verifica e intenta de nuevo." };
  }

  redirect("/welcome");
}

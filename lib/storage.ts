import "server-only";

import { createClient } from "@/lib/supabase/server";

const BUCKET = "patient-photos";

/**
 * URL firmada de corta duración para una foto privada. NUNCA getPublicUrl.
 * Devuelve null si no hay path o si falla (el UI cae a avatar de iniciales).
 */
export async function getSignedPhotoUrl(
  path: string | null,
  expiresIn = 3600,
): Promise<string | null> {
  if (!path) return null;
  try {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresIn);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export const PATIENT_PHOTOS_BUCKET = BUCKET;

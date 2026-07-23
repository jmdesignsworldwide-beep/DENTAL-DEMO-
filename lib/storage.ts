import "server-only";

import { createClient } from "@/lib/supabase/server";

const BUCKET = "patient-photos";
export const PATIENT_PHOTOS_BUCKET = BUCKET;
export const CLINICAL_FILES_BUCKET = "clinical-files";

/**
 * URL firmada de corta duración para un archivo privado. NUNCA getPublicUrl.
 * Devuelve null si no hay path o si falla.
 */
export async function getSignedUrl(
  bucket: string,
  path: string | null,
  expiresIn = 3600,
): Promise<string | null> {
  if (!path) return null;
  try {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/** Atajo para fotos de paciente (cae a avatar de iniciales si null). */
export function getSignedPhotoUrl(
  path: string | null,
  expiresIn = 3600,
): Promise<string | null> {
  return getSignedUrl(BUCKET, path, expiresIn);
}

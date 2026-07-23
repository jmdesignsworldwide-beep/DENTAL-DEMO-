import "server-only";

/**
 * Rate limiter en memoria (ventana deslizante simple) por clave.
 * Suficiente para el demo. En producción multi-instancia debe respaldarse
 * con un store compartido (p.ej. Upstash Redis) — la interfaz no cambia.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(
  key: string,
  { limit = 5, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t: number) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);

  // Limpieza oportunista para no crecer sin límite.
  if (buckets.size > 5000) {
    buckets.forEach((v, k) => {
      if (v.every((t: number) => now - t >= windowMs)) buckets.delete(k);
    });
  }

  if (hits.length > limit) {
    return { ok: false, retryAfter: Math.ceil(windowMs / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

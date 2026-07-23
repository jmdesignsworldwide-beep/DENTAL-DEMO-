import "server-only";

import { createClient } from "@/lib/supabase/server";
import { fmtHora12 } from "@/lib/dates";

// ─── Tipos serializables (server → client) ────────────────────────────
export interface PortalPatientLite {
  id: string;
  nombre: string;
  esVip: boolean;
  destacado: boolean;
}
export interface PortalStage {
  orden: number;
  titulo: string;
  descripcion: string | null;
  estado: "pendiente" | "en_progreso" | "completada";
  fecha: string | null;
}
export interface PortalPlan {
  titulo: string;
  tipo: string;
  costoTotal: number | null;
  fechaInicio: string;
  fechaFinEstimada: string | null;
  etapas: PortalStage[];
  etapaActual: number;
  progresoPct: number;
}
export interface PortalCita {
  fechaISO: string;
  fechaLarga: string;
  hora: string;
  horaISO: string;
  dentista: string;
  tratamiento: string;
  duracionMin: number;
  diasRestantes: number;
  cuenta: string;
}
export interface PortalHistItem {
  fechaISO: string;
  fechaCorta: string;
  tratamiento: string;
  dentista: string;
}
export interface PortalPago {
  fechaISO: string;
  fechaCorta: string;
  monto: number;
  metodo: string;
}
export interface PortalRecordatorio {
  key: string;
  titulo: string;
  cuerpo: string;
}
export interface PortalDiente {
  fdi: number;
  estado: string;
  etiqueta: string;
  color: string;
  nota: string | null;
}
export interface PortalResumenBoca {
  estado: string;
  etiqueta: string;
  color: string;
  count: number;
}
export interface PortalContacto {
  telefono: string;
  whatsapp: string;
  direccion: string;
  mapsUrl: string;
}
export interface PortalData {
  patient: {
    id: string;
    nombre: string;
    primerNombre: string;
    esVip: boolean;
    fotoUrl: string | null;
  };
  clinicaNombre: string;
  clinicaEslogan: string | null;
  colorAcento: string;
  proximaCita: PortalCita | null;
  plan: PortalPlan | null;
  historial: PortalHistItem[];
  cuenta: { balance: number; totalPagado: number; pagos: PortalPago[] };
  recordatorios: PortalRecordatorio[];
  boca: { dientes: PortalDiente[]; resumen: PortalResumenBoca[]; sanos: number };
  contacto: PortalContacto;
}

// Pacientes destacados del demo (datos sembrados coherentes: plan + balance,
// plan + al día, y sin plan + al día).
const DEMO_IDS = [
  "00000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000003",
  "00000000-0000-0000-0000-000000000005",
];

// Contacto de la clínica para el demo (los botones de llamar/WhatsApp/mapa).
const CONTACTO: PortalContacto = {
  telefono: "809-555-2020",
  whatsapp: "18095552020",
  direccion: "Av. Winston Churchill #90, Piantini, Santo Domingo",
  mapsUrl:
    "https://maps.google.com/?q=Av.+Winston+Churchill+90+Piantini+Santo+Domingo",
};

// Estados del odontograma traducidos a lenguaje de paciente.
const TOOTH_LABEL: Record<string, { etiqueta: string; color: string }> = {
  sano: { etiqueta: "Saludable", color: "#00C896" },
  tratado: { etiqueta: "Restaurado", color: "#0066CC" },
  caries: { etiqueta: "Necesita atención", color: "#F59E0B" },
  extraccion_necesaria: { etiqueta: "Requiere evaluación", color: "#EF4444" },
  corona: { etiqueta: "Corona / funda", color: "#6BB6F0" },
  implante: { etiqueta: "Implante", color: "#C9A84C" },
  endodoncia: { etiqueta: "Tratamiento de nervio", color: "#8B5CF6" },
  ausente: { etiqueta: "Diente faltante", color: "#94A3B8" },
};

// Recordatorios personalizados por tipo de tratamiento (no genéricos).
const CARE_TIPS: Record<string, PortalRecordatorio> = {
  ortodoncia: {
    key: "ortodoncia",
    titulo: "Higiene con brackets",
    cuerpo:
      "Cepilla después de cada comida y usa cepillo interdental. Evita chicle, hielo y alimentos muy duros que puedan despegar un bracket.",
  },
  endodoncia: {
    key: "endodoncia",
    titulo: "Después de tu endodoncia",
    cuerpo:
      "Evita masticar con ese lado hasta colocar la corona. Si sientes molestia al morder o inflamación, avísanos: la pieza aún está sensible.",
  },
  extraccion: {
    key: "extraccion",
    titulo: "Cuidados post-extracción",
    cuerpo:
      "No enjuagues con fuerza ni uses pajilla las primeras 24 h. Aplica frío las primeras horas y evita alimentos calientes. Es normal una molestia leve.",
  },
  limpieza: {
    key: "limpieza",
    titulo: "Tu próxima limpieza",
    cuerpo:
      "Una profilaxis cada 6 meses previene caries y enfermedad de las encías. Te avisaremos cuando toque tu próxima cita de higiene.",
  },
  blanqueamiento: {
    key: "blanqueamiento",
    titulo: "Cuida tu blanqueamiento",
    cuerpo:
      "Durante 48 horas evita café, vino tinto, remolacha y cigarrillo. Son las horas en que el esmalte absorbe más pigmento.",
  },
  corona: {
    key: "corona",
    titulo: "Cuidado de tu corona",
    cuerpo:
      "Tu corona no se pica, pero la encía alrededor sí. Mantén el hilo dental diario en esa zona para que dure muchos años.",
  },
  resina: {
    key: "resina",
    titulo: "Después de tu resina",
    cuerpo:
      "Puedes comer normal enseguida. Si notas que muerdes distinto o hay un borde alto, avísanos para pulirla.",
  },
  implante: {
    key: "implante",
    titulo: "Cuida tu implante",
    cuerpo:
      "El implante necesita la misma higiene que un diente natural. Cepillado, hilo y tus revisiones al día garantizan que se mantenga firme.",
  },
  general: {
    key: "general",
    titulo: "Mantén tu sonrisa sana",
    cuerpo:
      "Cepíllate dos veces al día, usa hilo dental a diario y no olvides tu revisión semestral. Prevenir siempre es más fácil que tratar.",
  },
};

type Rel<T> = T | T[] | null;
function one<T>(v: Rel<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function isoToLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${d} de ${meses[(m ?? 1) - 1]} de ${y}`;
}
function isoToCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${d} ${meses[(m ?? 1) - 1]} ${String(y).slice(2)}`;
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00Z").getTime();
  const b = new Date(toISO + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86_400_000);
}
function countdown(dias: number): string {
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Mañana";
  if (dias < 7) return `En ${dias} días`;
  if (dias < 14) return "En 1 semana";
  if (dias < 31) return `En ${Math.round(dias / 7)} semanas`;
  return `En ${Math.round(dias / 30)} meses`;
}

/** Lista de pacientes seleccionables en el presentador (los que tienen datos). */
export async function listPortalPatients(): Promise<PortalPatientLite[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("appointments")
    .select("patient_id, patients(id, nombre, es_vip)")
    .order("fecha", { ascending: false })
    .limit(500);

  const seen = new Map<string, PortalPatientLite>();
  for (const row of (data ?? []) as unknown as {
    patient_id: string;
    patients: Rel<{ id: string; nombre: string; es_vip: boolean }>;
  }[]) {
    const p = one(row.patients);
    if (!p || seen.has(p.id)) continue;
    seen.set(p.id, {
      id: p.id,
      nombre: p.nombre,
      esVip: !!p.es_vip,
      destacado: DEMO_IDS.includes(p.id),
    });
  }
  const list = [...seen.values()];
  list.sort((a, b) => {
    if (a.destacado !== b.destacado) return a.destacado ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, "es");
  });
  return list.slice(0, 24);
}

export async function getPortalData(patientId: string): Promise<PortalData | null> {
  const supabase = createClient();
  const today = todayISO();

  const { data: pat } = await supabase
    .from("patients")
    .select("id, nombre, es_vip, foto_path")
    .eq("id", patientId)
    .maybeSingle();
  if (!pat) return null;

  const [
    settingsRes,
    citaRes,
    histRes,
    planRes,
    invRes,
    toothRes,
  ] = await Promise.all([
    supabase.from("clinic_settings").select("nombre, eslogan, color_acento").eq("id", 1).maybeSingle(),
    supabase
      .from("appointments")
      .select("fecha, hora, duracion_min, dentista_nombre, tratamiento, estado")
      .eq("patient_id", patientId)
      .gte("fecha", today)
      .in("estado", ["pendiente", "confirmada", "sala_espera", "en_sillon"])
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select("fecha, tratamiento, dentista_nombre")
      .eq("patient_id", patientId)
      .eq("estado", "completada")
      .lte("fecha", today)
      .order("fecha", { ascending: false })
      .limit(8),
    supabase
      .from("treatment_plans")
      .select("titulo, tipo, costo_total, fecha_inicio, fecha_fin_estimada, treatment_plan_stages(orden, titulo, descripcion, estado, fecha)")
      .eq("patient_id", patientId)
      .eq("estado", "activo")
      .order("fecha_inicio", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("invoices")
      .select("id, total, estado")
      .eq("patient_id", patientId),
    supabase
      .from("tooth_states")
      .select("fdi, estado, nota")
      .eq("patient_id", patientId)
      .order("fdi", { ascending: true }),
  ]);

  // ── Clínica ──
  const settings = settingsRes.data as { nombre?: string; eslogan?: string | null; color_acento?: string } | null;
  const clinicaNombre = settings?.nombre ?? "Clínica Dental";
  const clinicaEslogan = settings?.eslogan ?? null;
  const colorAcento = settings?.color_acento ?? "#0066CC";

  // ── Foto (URL firmada corta; nunca pública) ──
  let fotoUrl: string | null = null;
  if (pat.foto_path) {
    try {
      const { data } = await supabase.storage.from("patient-photos").createSignedUrl(pat.foto_path, 300);
      fotoUrl = data?.signedUrl ?? null;
    } catch {
      fotoUrl = null;
    }
  }

  // ── Próxima cita ──
  let proximaCita: PortalCita | null = null;
  const c = citaRes.data as {
    fecha: string; hora: string; duracion_min: number; dentista_nombre: string | null; tratamiento: string | null;
  } | null;
  if (c) {
    const dias = daysBetween(today, c.fecha);
    proximaCita = {
      fechaISO: c.fecha,
      fechaLarga: isoToLarga(c.fecha),
      hora: fmtHora12(c.hora),
      horaISO: c.hora.slice(0, 5),
      dentista: c.dentista_nombre ?? "Odontólogo asignado",
      tratamiento: c.tratamiento ?? "Consulta",
      duracionMin: Number(c.duracion_min ?? 30),
      diasRestantes: dias,
      cuenta: countdown(dias),
    };
  }

  // ── Historial ──
  const historial: PortalHistItem[] = ((histRes.data ?? []) as {
    fecha: string; tratamiento: string | null; dentista_nombre: string | null;
  }[]).map((h) => ({
    fechaISO: h.fecha,
    fechaCorta: isoToCorta(h.fecha),
    tratamiento: h.tratamiento ?? "Consulta",
    dentista: h.dentista_nombre ?? "Odontólogo",
  }));

  // ── Plan en curso ──
  let plan: PortalPlan | null = null;
  const pl = planRes.data as {
    titulo: string; tipo: string; costo_total: number | null; fecha_inicio: string; fecha_fin_estimada: string | null;
    treatment_plan_stages: { orden: number; titulo: string; descripcion: string | null; estado: string; fecha: string | null }[];
  } | null;
  if (pl) {
    const etapas: PortalStage[] = (pl.treatment_plan_stages ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((s) => ({
        orden: s.orden,
        titulo: s.titulo,
        descripcion: s.descripcion,
        estado: (s.estado as PortalStage["estado"]) ?? "pendiente",
        fecha: s.fecha,
      }));
    const completadas = etapas.filter((e) => e.estado === "completada").length;
    const enProgreso = etapas.findIndex((e) => e.estado === "en_progreso");
    const total = etapas.length || 1;
    plan = {
      titulo: pl.titulo,
      tipo: pl.tipo,
      costoTotal: pl.costo_total,
      fechaInicio: pl.fecha_inicio,
      fechaFinEstimada: pl.fecha_fin_estimada,
      etapas,
      etapaActual: enProgreso >= 0 ? enProgreso + 1 : completadas + 1,
      progresoPct: Math.round(((completadas + (enProgreso >= 0 ? 0.5 : 0)) / total) * 100),
    };
  }

  // ── Estado de cuenta (facturas → pagos) ──
  const invoices = (invRes.data ?? []) as { id: string; total: number; estado: string }[];
  const invIds = invoices.map((i) => i.id);
  let pagos: PortalPago[] = [];
  let totalPagado = 0;
  const pagadoPorFactura = new Map<string, number>();
  if (invIds.length) {
    const { data: payRows } = await supabase
      .from("payments")
      .select("invoice_id, monto, metodo, fecha")
      .in("invoice_id", invIds)
      .order("fecha", { ascending: false });
    for (const p of (payRows ?? []) as { invoice_id: string; monto: number; metodo: string; fecha: string }[]) {
      totalPagado += Number(p.monto);
      pagadoPorFactura.set(p.invoice_id, (pagadoPorFactura.get(p.invoice_id) ?? 0) + Number(p.monto));
    }
    pagos = ((payRows ?? []) as { monto: number; metodo: string; fecha: string }[])
      .slice(0, 6)
      .map((p) => ({
        fechaISO: p.fecha,
        fechaCorta: isoToCorta(p.fecha),
        monto: Number(p.monto),
        metodo: p.metodo,
      }));
  }
  let balance = 0;
  for (const inv of invoices) {
    if (inv.estado === "pendiente" || inv.estado === "pagada_parcial") {
      balance += Number(inv.total) - (pagadoPorFactura.get(inv.id) ?? 0);
    }
  }
  balance = Math.max(0, Math.round(balance * 100) / 100);

  // ── Odontograma simplificado ──
  const teeth = (toothRes.data ?? []) as { fdi: number; estado: string; nota: string | null }[];
  const dientes: PortalDiente[] = teeth
    .filter((t) => t.estado !== "sano")
    .map((t) => {
      const meta = TOOTH_LABEL[t.estado] ?? { etiqueta: "En observación", color: "#94A3B8" };
      return { fdi: t.fdi, estado: t.estado, etiqueta: meta.etiqueta, color: meta.color, nota: t.nota };
    });
  const resumenMap = new Map<string, PortalResumenBoca>();
  for (const d of dientes) {
    const cur = resumenMap.get(d.estado);
    if (cur) cur.count += 1;
    else resumenMap.set(d.estado, { estado: d.estado, etiqueta: d.etiqueta, color: d.color, count: 1 });
  }
  const sanos = Math.max(0, 32 - teeth.filter((t) => t.estado === "ausente").length - dientes.length);

  // ── Recordatorios personalizados ──
  const keys = new Set<string>();
  if (plan) {
    if (plan.tipo.includes("ortodoncia")) keys.add("ortodoncia");
    if (plan.tipo.includes("endodoncia")) keys.add("endodoncia");
  }
  const histText = historial.map((h) => h.tratamiento.toLowerCase()).join(" ");
  const toothEstados = new Set(teeth.map((t) => t.estado));
  if (/extrac/.test(histText) || toothEstados.has("extraccion_necesaria")) keys.add("extraccion");
  if (/limpieza|profilaxis/.test(histText)) keys.add("limpieza");
  if (/blanqueam/.test(histText)) keys.add("blanqueamiento");
  if (/corona/.test(histText) || toothEstados.has("corona")) keys.add("corona");
  if (/resina|obturaci/.test(histText)) keys.add("resina");
  if (/endodoncia/.test(histText) || toothEstados.has("endodoncia")) keys.add("endodoncia");
  if (toothEstados.has("implante")) keys.add("implante");
  const recordatorios: PortalRecordatorio[] = [...keys]
    .map((k) => CARE_TIPS[k])
    .filter(Boolean)
    .slice(0, 4);
  if (recordatorios.length === 0) recordatorios.push(CARE_TIPS.general);

  const primerNombre = pat.nombre.trim().split(/\s+/)[0] ?? pat.nombre;

  return {
    patient: {
      id: pat.id,
      nombre: pat.nombre,
      primerNombre,
      esVip: !!pat.es_vip,
      fotoUrl,
    },
    clinicaNombre,
    clinicaEslogan,
    colorAcento,
    proximaCita,
    plan,
    historial,
    cuenta: { balance, totalPagado: Math.round(totalPagado * 100) / 100, pagos },
    recordatorios,
    boca: { dientes, resumen: [...resumenMap.values()], sanos },
    contacto: CONTACTO,
  };
}

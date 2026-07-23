import "server-only";

import { createClient } from "@/lib/supabase/server";
import { calcularNominaMensual, type PayrollCalc } from "@/lib/payroll";

// Precio de referencia por etiqueta de tratamiento de las citas sembradas.
const PRECIO_TRAT: Record<string, number> = {
  "Limpieza dental": 2500,
  "Resina compuesta": 3200,
  Endodoncia: 15000,
  "Extracción simple": 2500,
  "Corona de porcelana": 18000,
  Blanqueamiento: 8000,
  "Ortodoncia (ajuste)": 2000,
  "Profilaxis dental": 2500,
  "Implante (evaluación)": 1500,
  "Sellante dental": 1200,
};
const PRECIO_DEFAULT = 3000;
const SLOTS_DIA = 5; // capacidad de referencia por día laborable
const CLINIC_INICIO = 8;
const CLINIC_FIN = 18;
const DIAS = ["lun", "mar", "mie", "jue", "vie", "sab"] as const;
const DIAS_LARGOS: Record<string, string> = {
  lun: "Lunes", mar: "Martes", mie: "Miércoles", jue: "Jueves", vie: "Viernes", sab: "Sábado",
};

export type Horario = Record<string, [string, string]>;

export interface StaffMember {
  id: string;
  nombre: string;
  rol: "dentista" | "asistente" | "recepcionista";
  especialidad: string | null;
  exequatur: string | null;
  telefono: string | null;
  email: string | null;
  fechaIngreso: string;
  estado: "activo" | "vacaciones" | "licencia" | "inactivo";
  color: string;
  horario: Horario;
  salarioBase: number;
  comisionPct: number;
  horasExtra: number;
  otrasDeducciones: number;
  orden: number;
}
export interface TopTrat {
  nombre: string;
  count: number;
}
export interface DentistMetrics {
  staffId: string;
  nombre: string;
  color: string;
  especialidad: string | null;
  activo: boolean;
  citasMes: number;
  citasMesPrev: number;
  ingresosMes: number;
  ingresosMesPrev: number;
  produccionMes: number;
  ticketPromedio: number;
  noShowRate: number;
  ocupacionPct: number;
  topTratamientos: TopTrat[];
  trend: { mes: string; citas: number }[];
}
export interface PayrollRow {
  staffId: string;
  nombre: string;
  rol: string;
  especialidad: string | null;
  calc: PayrollCalc; // mensual
  estadoPago: "pendiente" | "pagada";
}
export interface AbsenceRow {
  staffId: string;
  nombre: string;
  color: string;
  tipo: "vacaciones" | "licencia" | "ausencia";
  inicio: string;
  fin: string;
  motivo: string | null;
}
export interface CoverageDay {
  dia: string;
  diaLargo: string;
  gaps: { inicio: string; fin: string }[];
}
export interface StaffModuleData {
  staff: StaffMember[];
  metrics: DentistMetrics[];
  payroll: PayrollRow[];
  absences: AbsenceRow[];
  coverage: CoverageDay[];
  periodoMes: string;
  totalesPrev: { bruto: number; deducciones: number; neto: number };
}

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const to12 = (hstr: string) => {
  const h = Number(hstr.slice(0, 2));
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${ampm}`;
};
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function precioDe(trat: string | null): number {
  if (!trat) return PRECIO_DEFAULT;
  return PRECIO_TRAT[trat] ?? PRECIO_DEFAULT;
}

/** Días laborables (lun-sáb según horario) de un mes. */
function diasLaborablesMes(horario: Horario, year: number, month: number): number {
  const last = new Date(year, month + 1, 0).getDate();
  let n = 0;
  for (let d = 1; d <= last; d++) {
    const dow = new Date(year, month, d).getDay(); // 0=dom..6=sáb
    const key = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"][dow];
    if (horario[key]) n++;
  }
  return n;
}

export async function getStaffModuleData(): Promise<StaffModuleData> {
  const supabase = createClient();
  const now = new Date();
  const curKey = monthKey(now);
  const prevKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const sixAgoISO = `${sixAgo.getFullYear()}-${String(sixAgo.getMonth() + 1).padStart(2, "0")}-01`;

  const [staffRes, absRes, statusRes, aptRes] = await Promise.all([
    supabase.from("staff").select("*").order("orden", { ascending: true }),
    supabase.from("staff_absences").select("staff_id, tipo, fecha_inicio, fecha_fin, motivo").order("fecha_inicio", { ascending: true }),
    supabase.from("payroll_status").select("staff_id, periodo, estado"),
    supabase
      .from("appointments")
      .select("fecha, estado, tratamiento, dentista_nombre")
      .gte("fecha", sixAgoISO),
  ]);

  const staff: StaffMember[] = ((staffRes.data ?? []) as Record<string, unknown>[]).map((s) => ({
    id: s.id as string,
    nombre: s.nombre as string,
    rol: s.rol as StaffMember["rol"],
    especialidad: (s.especialidad as string | null) ?? null,
    exequatur: (s.exequatur as string | null) ?? null,
    telefono: (s.telefono as string | null) ?? null,
    email: (s.email as string | null) ?? null,
    fechaIngreso: s.fecha_ingreso as string,
    estado: s.estado as StaffMember["estado"],
    color: (s.color as string) ?? "#0066CC",
    horario: (s.horario as Horario) ?? {},
    salarioBase: Number(s.salario_base ?? 0),
    comisionPct: Number(s.comision_pct ?? 0),
    horasExtra: Number(s.horas_extra ?? 0),
    otrasDeducciones: Number(s.otras_deducciones ?? 0),
    orden: Number(s.orden ?? 0),
  }));
  const byName = new Map(staff.map((s) => [s.nombre, s]));

  // ── Agregación de citas por dentista ──
  type Apt = { fecha: string; estado: string; tratamiento: string | null; dentista_nombre: string | null };
  const apts = (aptRes.data ?? []) as Apt[];

  const metrics: DentistMetrics[] = staff
    .filter((s) => s.rol === "dentista")
    .map((s) => {
      const mine = apts.filter((a) => a.dentista_nombre === s.nombre);
      const inMonth = (a: Apt, key: string) => a.fecha.slice(0, 7) === key;
      const activas = (a: Apt) => ["completada", "confirmada", "sala_espera", "en_sillon", "pendiente", "seguimiento"].includes(a.estado);

      const curCompletadas = mine.filter((a) => inMonth(a, curKey) && a.estado === "completada");
      const prevCompletadas = mine.filter((a) => inMonth(a, prevKey) && a.estado === "completada");
      const curActivas = mine.filter((a) => inMonth(a, curKey) && activas(a));
      const curTodas = mine.filter((a) => inMonth(a, curKey));
      const curNoShow = curTodas.filter((a) => a.estado === "no_show").length;

      const ingresosMes = curCompletadas.reduce((sum, a) => sum + precioDe(a.tratamiento), 0);
      const ingresosMesPrev = prevCompletadas.reduce((sum, a) => sum + precioDe(a.tratamiento), 0);
      const pacientes = curCompletadas.length || 1;
      const ticketPromedio = Math.round(ingresosMes / pacientes);
      const noShowRate = curTodas.length ? Math.round((curNoShow / curTodas.length) * 1000) / 10 : 0;

      const capacidad = diasLaborablesMes(s.horario, now.getFullYear(), now.getMonth()) * SLOTS_DIA;
      const ocupacionPct = capacidad ? Math.min(100, Math.round((curActivas.length / capacidad) * 100)) : 0;

      // Top tratamientos
      const tratMap = new Map<string, number>();
      for (const a of curCompletadas) {
        const t = a.tratamiento ?? "Otros";
        tratMap.set(t, (tratMap.get(t) ?? 0) + 1);
      }
      const topTratamientos = [...tratMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([nombre, count]) => ({ nombre, count }));

      // Tendencia 6 meses
      const trend: { mes: string; citas: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = monthKey(d);
        trend.push({
          mes: MESES_CORTOS[d.getMonth()],
          citas: mine.filter((a) => inMonth(a, key) && a.estado === "completada").length,
        });
      }

      return {
        staffId: s.id,
        nombre: s.nombre,
        color: s.color,
        especialidad: s.especialidad,
        activo: s.estado === "activo",
        citasMes: curCompletadas.length,
        citasMesPrev: prevCompletadas.length,
        ingresosMes,
        ingresosMesPrev,
        produccionMes: ingresosMes,
        ticketPromedio,
        noShowRate,
        ocupacionPct,
        topTratamientos,
        trend,
      };
    });
  metrics.sort((a, b) => b.ingresosMes - a.ingresosMes);

  // ── Nómina mensual ──
  const statusMap = new Map<string, string>();
  const curPeriodo = `mensual:${curKey}`;
  for (const r of (statusRes.data ?? []) as { staff_id: string; periodo: string; estado: string }[]) {
    if (r.periodo === curPeriodo) statusMap.set(r.staff_id, r.estado);
  }

  const payroll: PayrollRow[] = staff
    .filter((s) => s.estado !== "inactivo")
    .map((s) => {
      const prod = metrics.find((m) => m.staffId === s.id)?.produccionMes ?? 0;
      const comisiones = Math.round((prod * s.comisionPct) / 100);
      const calc = calcularNominaMensual({
        salarioBase: s.salarioBase,
        comisiones,
        horasExtra: s.horasExtra,
        otrasDeducciones: s.otrasDeducciones,
      });
      return {
        staffId: s.id,
        nombre: s.nombre,
        rol: s.rol,
        especialidad: s.especialidad,
        calc,
        estadoPago: (statusMap.get(s.id) as "pagada" | undefined) === "pagada" ? "pagada" : "pendiente",
      };
    });

  // ── Totales del mes anterior (para comparativa) ──
  const totalesPrev = staff
    .filter((s) => s.estado !== "inactivo")
    .reduce(
      (acc, s) => {
        const prodPrev = metrics.find((m) => m.staffId === s.id)?.ingresosMesPrev ?? 0;
        const comisiones = Math.round((prodPrev * s.comisionPct) / 100);
        const c = calcularNominaMensual({
          salarioBase: s.salarioBase,
          comisiones,
          horasExtra: s.horasExtra,
          otrasDeducciones: s.otrasDeducciones,
        });
        acc.bruto += c.bruto;
        acc.deducciones += c.totalDeducciones;
        acc.neto += c.neto;
        return acc;
      },
      { bruto: 0, deducciones: 0, neto: 0 },
    );

  // ── Ausencias ──
  const absences: AbsenceRow[] = ((absRes.data ?? []) as {
    staff_id: string; tipo: string; fecha_inicio: string; fecha_fin: string; motivo: string | null;
  }[]).map((a) => {
    const s = staff.find((x) => x.id === a.staff_id);
    return {
      staffId: a.staff_id,
      nombre: s?.nombre ?? "Personal",
      color: s?.color ?? "#94A3B8",
      tipo: a.tipo as AbsenceRow["tipo"],
      inicio: a.fecha_inicio,
      fin: a.fecha_fin,
      motivo: a.motivo,
    };
  });

  // ── Cobertura de odontólogos por día ──
  const dentistasCubren = staff.filter((s) => s.rol === "dentista" && (s.estado === "activo"));
  const coverage: CoverageDay[] = DIAS.map((dia) => {
    // Marca horas cubiertas 8..17 (bloques de 1h; 17 = 5-6pm).
    const cubierto = new Array(CLINIC_FIN - CLINIC_INICIO).fill(false);
    for (const s of dentistasCubren) {
      const rango = s.horario[dia];
      if (!rango) continue;
      const ini = Number(rango[0].slice(0, 2));
      const fin = Number(rango[1].slice(0, 2));
      for (let h = ini; h < fin; h++) {
        const idx = h - CLINIC_INICIO;
        if (idx >= 0 && idx < cubierto.length) cubierto[idx] = true;
      }
    }
    // Extrae rangos contiguos sin cobertura.
    const gaps: { inicio: string; fin: string }[] = [];
    let start: number | null = null;
    for (let i = 0; i <= cubierto.length; i++) {
      const uncovered = i < cubierto.length && !cubierto[i];
      if (uncovered && start === null) start = i;
      if (!uncovered && start !== null) {
        gaps.push({ inicio: to12(hh(CLINIC_INICIO + start)), fin: to12(hh(CLINIC_INICIO + i)) });
        start = null;
      }
    }
    return { dia, diaLargo: DIAS_LARGOS[dia], gaps };
  });

  return { staff, metrics, payroll, absences, coverage, periodoMes: curKey, totalesPrev };
}

/** Datos de un empleado para el volante de pago. */
export async function getPayrollSlip(staffId: string): Promise<{
  member: StaffMember;
  calc: PayrollCalc;
  comisiones: number;
  periodoMes: string;
} | null> {
  const data = await getStaffModuleData();
  const member = data.staff.find((s) => s.id === staffId);
  const row = data.payroll.find((p) => p.staffId === staffId);
  if (!member || !row) return null;
  return { member, calc: row.calc, comisiones: row.calc.comisiones, periodoMes: data.periodoMes };
}

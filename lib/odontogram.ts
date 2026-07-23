import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ToothStatus =
  | "sano"
  | "tratado"
  | "caries"
  | "extraccion_necesaria"
  | "corona"
  | "implante"
  | "endodoncia"
  | "ausente";

export interface ToothState {
  fdi: number;
  estado: ToothStatus;
  superficies: string[];
  nota: string | null;
}

export interface ToothEvent {
  id: string;
  fdi: number;
  estado: ToothStatus;
  superficies: string[];
  nota: string | null;
  fecha: string;
}

export interface Snapshot {
  id: string;
  fecha: string;
  etiqueta: string | null;
  snapshot: { fdi: number; estado: ToothStatus; superficies: string[] }[];
}

export type AffectationType =
  | "caries_superficial"
  | "caries_profunda"
  | "pulpitis"
  | "absceso"
  | "fractura"
  | "desgaste";

export interface AnatomyMark {
  id: string;
  fdi: number;
  zona: string;
  tipo: AffectationType;
  nota: string | null;
}

export interface AnatomyEvent {
  id: string;
  fdi: number;
  zona: string;
  tipo: AffectationType | null;
  accion: string;
  nota: string | null;
  fecha: string;
}

export interface OdontogramData {
  states: Record<number, ToothState>;
  events: ToothEvent[];
  snapshots: Snapshot[];
  anatomy: Record<number, AnatomyMark[]>;
  anatomyEvents: AnatomyEvent[];
}

export async function getOdontogram(patientId: string): Promise<OdontogramData> {
  const empty: OdontogramData = {
    states: {},
    events: [],
    snapshots: [],
    anatomy: {},
    anatomyEvents: [],
  };
  try {
    const supabase = createClient();
    const [statesRes, eventsRes, snapsRes, anatomyRes, anatomyEventsRes] =
      await Promise.all([
      supabase
        .from("tooth_states")
        .select("fdi, estado, superficies, nota")
        .eq("patient_id", patientId),
      supabase
        .from("tooth_events")
        .select("id, fdi, estado, superficies, nota, fecha")
        .eq("patient_id", patientId)
        .order("fecha", { ascending: false }),
      supabase
        .from("odontogram_snapshots")
        .select("id, fecha, etiqueta, snapshot")
        .eq("patient_id", patientId)
        .order("fecha", { ascending: false }),
      supabase
        .from("anatomy_marks")
        .select("id, fdi, zona, tipo, nota")
        .eq("patient_id", patientId),
      supabase
        .from("anatomy_events")
        .select("id, fdi, zona, tipo, accion, nota, fecha")
        .eq("patient_id", patientId)
        .order("fecha", { ascending: false }),
    ]);

    const states: Record<number, ToothState> = {};
    for (const r of statesRes.data ?? []) {
      states[r.fdi as number] = {
        fdi: r.fdi as number,
        estado: r.estado as ToothStatus,
        superficies: (r.superficies as string[]) ?? [],
        nota: (r.nota as string | null) ?? null,
      };
    }

    const events: ToothEvent[] = (eventsRes.data ?? []).map((r) => ({
      id: r.id as string,
      fdi: r.fdi as number,
      estado: r.estado as ToothStatus,
      superficies: (r.superficies as string[]) ?? [],
      nota: (r.nota as string | null) ?? null,
      fecha: r.fecha as string,
    }));

    const snapshots: Snapshot[] = (snapsRes.data ?? []).map((r) => ({
      id: r.id as string,
      fecha: r.fecha as string,
      etiqueta: (r.etiqueta as string | null) ?? null,
      snapshot: (r.snapshot as Snapshot["snapshot"]) ?? [],
    }));

    const anatomy: Record<number, AnatomyMark[]> = {};
    for (const r of anatomyRes.data ?? []) {
      const mark: AnatomyMark = {
        id: r.id as string,
        fdi: r.fdi as number,
        zona: r.zona as string,
        tipo: r.tipo as AffectationType,
        nota: (r.nota as string | null) ?? null,
      };
      (anatomy[mark.fdi] ??= []).push(mark);
    }

    const anatomyEvents: AnatomyEvent[] = (anatomyEventsRes.data ?? []).map((r) => ({
      id: r.id as string,
      fdi: r.fdi as number,
      zona: r.zona as string,
      tipo: (r.tipo as AffectationType | null) ?? null,
      accion: (r.accion as string) ?? "marco",
      nota: (r.nota as string | null) ?? null,
      fecha: r.fecha as string,
    }));

    return { states, events, snapshots, anatomy, anatomyEvents };
  } catch {
    return empty;
  }
}

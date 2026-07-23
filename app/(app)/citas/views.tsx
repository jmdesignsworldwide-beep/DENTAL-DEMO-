"use client";

import { motion } from "framer-motion";
import type { AppointmentRow } from "@/lib/appointments";
import {
  DIAS_CORTOS,
  addDays,
  isToday,
  monthMatrix,
  toISODate,
  weekDays,
  timeSlots,
  timeToMinutes,
  fmtHora,
  CLINIC_START_HOUR,
} from "@/lib/dates";
import { ESTADO_CITA } from "./estado-config";
import { cn } from "@/lib/utils";

const SLOT_PX = 44; // alto de un slot de 30 min
const START_MIN = CLINIC_START_HOUR * 60;

interface CommonProps {
  anchor: Date;
  citas: AppointmentRow[];
  onSelectEvent: (c: AppointmentRow) => void;
  onCreateAt: (fecha: string, hora?: string) => void;
  onSelectDay: (fecha: string) => void;
}

function byDay(citas: AppointmentRow[]): Map<string, AppointmentRow[]> {
  const m = new Map<string, AppointmentRow[]>();
  for (const c of citas) {
    const arr = m.get(c.fecha) ?? [];
    arr.push(c);
    m.set(c.fecha, arr);
  }
  return m;
}

/* ───────────────────────────── MES ───────────────────────────── */
export function MonthView({
  anchor,
  citas,
  onSelectEvent,
  onCreateAt,
  onSelectDay,
}: CommonProps) {
  const weeks = monthMatrix(anchor);
  const map = byDay(citas);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface dark:bg-surface/80">
      <div className="grid grid-cols-7 border-b border-border bg-surface-2/60 dark:bg-navy-lighter/40">
        {DIAS_CORTOS.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-muted"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((day) => {
          const iso = toISODate(day);
          const inMonth = day.getMonth() === anchor.getMonth();
          const dayCitas = (map.get(iso) ?? []).sort((a, b) =>
            a.hora.localeCompare(b.hora),
          );
          return (
            <div
              key={iso}
              className={cn(
                "group min-h-[92px] border-b border-r border-border/60 p-1.5 transition-colors last:border-r-0",
                !inMonth && "bg-surface-2/40 dark:bg-navy/40",
              )}
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => onSelectDay(iso)}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors",
                    isToday(day)
                      ? "bg-clinical text-white"
                      : inMonth
                        ? "text-fg hover:bg-surface-2"
                        : "text-muted/50",
                  )}
                >
                  {day.getDate()}
                </button>
                <button
                  onClick={() => onCreateAt(iso)}
                  className="hidden text-muted/60 hover:text-clinical group-hover:block"
                  aria-label="Nueva cita"
                >
                  <span className="text-lg leading-none">+</span>
                </button>
              </div>
              <div className="mt-1 space-y-0.5">
                {dayCitas.slice(0, 3).map((c) => {
                  const st = ESTADO_CITA[c.estado];
                  return (
                    <button
                      key={c.id}
                      onClick={() => onSelectEvent(c)}
                      className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] font-medium hover:bg-surface-2 dark:hover:bg-navy-lighter"
                    >
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", st.dot)} />
                      <span className="tabular text-muted">{fmtHora(c.hora)}</span>
                      <span className="truncate text-fg">{c.paciente}</span>
                    </button>
                  );
                })}
                {dayCitas.length > 3 && (
                  <button
                    onClick={() => onSelectDay(iso)}
                    className="px-1 text-[10px] font-semibold text-clinical hover:underline"
                  >
                    +{dayCitas.length - 3} más
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────── SEMANA / DÍA (time grid) ─────────────────────── */
function EventBlock({
  c,
  onSelect,
  compact,
}: {
  c: AppointmentRow;
  onSelect: (c: AppointmentRow) => void;
  compact?: boolean;
}) {
  const st = ESTADO_CITA[c.estado];
  const top = ((timeToMinutes(c.hora) - START_MIN) / 30) * SLOT_PX;
  const height = Math.max((c.duracion_min / 30) * SLOT_PX - 4, 22);
  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => onSelect(c)}
      style={{ top, height }}
      className={cn(
        "absolute inset-x-1 z-10 overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left shadow-sm transition-shadow hover:z-20 hover:shadow-card",
        st.chip,
      )}
    >
      <p className="truncate text-[11px] font-bold">
        <span className="tabular">{fmtHora(c.hora)}</span> · {c.paciente}
      </p>
      {!compact && (
        <p className="truncate text-[10px] opacity-80">{c.tratamiento}</p>
      )}
    </motion.button>
  );
}

function HourAxis() {
  return (
    <div className="w-12 shrink-0">
      {timeSlots(60).map((t) => (
        <div key={t} style={{ height: SLOT_PX * 2 }} className="relative">
          <span className="absolute -top-2 right-2 text-[10px] font-medium tabular text-muted">
            {fmtHora(t)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function WeekView({
  anchor,
  citas,
  onSelectEvent,
  onCreateAt,
}: CommonProps) {
  const days = weekDays(anchor);
  const map = byDay(citas);
  const slots = timeSlots(30);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface dark:bg-surface/80">
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          {/* Cabecera de días */}
          <div className="flex border-b border-border">
            <div className="w-12 shrink-0" />
            {days.map((d) => (
              <div
                key={toISODate(d)}
                className="flex-1 border-l border-border/60 px-2 py-2 text-center"
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  {DIAS_CORTOS[(d.getDay() + 6) % 7]}
                </p>
                <p
                  className={cn(
                    "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold",
                    isToday(d) ? "bg-clinical text-white" : "text-fg",
                  )}
                >
                  {d.getDate()}
                </p>
              </div>
            ))}
          </div>
          {/* Cuerpo */}
          <div className="flex">
            <HourAxis />
            {days.map((d) => {
              const iso = toISODate(d);
              const dayCitas = map.get(iso) ?? [];
              return (
                <div
                  key={iso}
                  className="relative flex-1 border-l border-border/60"
                  style={{ height: slots.length * SLOT_PX }}
                >
                  {slots.map((t, i) => (
                    <button
                      key={t}
                      onClick={() => onCreateAt(iso, t)}
                      style={{ height: SLOT_PX }}
                      className={cn(
                        "block w-full border-b border-border/40 transition-colors hover:bg-clinical-50/50 dark:hover:bg-clinical-900/20",
                        i % 2 === 1 && "border-b-border/20",
                      )}
                      aria-label={`Crear cita ${iso} ${t}`}
                    />
                  ))}
                  {dayCitas.map((c) => (
                    <EventBlock key={c.id} c={c} onSelect={onSelectEvent} compact />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DayView({
  anchor,
  citas,
  onSelectEvent,
  onCreateAt,
}: CommonProps) {
  const iso = toISODate(anchor);
  const dayCitas = citas.filter((c) => c.fecha === iso);
  const slots = timeSlots(30);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface dark:bg-surface/80">
      <div className="flex">
        <HourAxis />
        <div
          className="relative flex-1 border-l border-border/60"
          style={{ height: slots.length * SLOT_PX }}
        >
          {slots.map((t, i) => (
            <button
              key={t}
              onClick={() => onCreateAt(iso, t)}
              style={{ height: SLOT_PX }}
              className={cn(
                "flex w-full items-center border-b border-border/40 px-3 text-left text-[10px] text-muted/0 transition-colors hover:bg-clinical-50/50 hover:text-muted dark:hover:bg-clinical-900/20",
                i % 2 === 1 && "border-b-border/20",
              )}
            >
              + Nueva cita {fmtHora(t)}
            </button>
          ))}
          {dayCitas.map((c) => (
            <EventBlock key={c.id} c={c} onSelect={onSelectEvent} />
          ))}
        </div>
      </div>
    </div>
  );
}

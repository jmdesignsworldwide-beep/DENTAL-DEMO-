"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppointmentRow, PatientBasic } from "@/lib/appointments";
import {
  addDays,
  addMonths,
  parseISODate,
  toISODate,
  tituloRango,
} from "@/lib/dates";
import { ESTADO_CITA, ESTADOS_LEYENDA } from "./estado-config";
import { MonthView, WeekView, DayView } from "./views";
import { AppointmentFormModal } from "./appointment-form";
import { AppointmentDetail } from "./appointment-detail";
import { cn } from "@/lib/utils";

type View = "mes" | "semana" | "dia";
const VIEWS: { key: View; label: string }[] = [
  { key: "mes", label: "Mes" },
  { key: "semana", label: "Semana" },
  { key: "dia", label: "Día" },
];

export function CalendarClient({
  view,
  anchorISO,
  citas,
  dentists,
  patients,
  dentistaFilter,
  canWrite,
}: {
  view: View;
  anchorISO: string;
  citas: AppointmentRow[];
  dentists: string[];
  patients: PatientBasic[];
  dentistaFilter: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const anchor = parseISODate(anchorISO);

  const [createPrefill, setCreatePrefill] = React.useState<
    { fecha?: string; hora?: string } | null
  >(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editCita, setEditCita] = React.useState<AppointmentRow | null>(null);
  const [detailCita, setDetailCita] = React.useState<AppointmentRow | null>(null);

  const setParam = React.useCallback(
    (updates: Record<string, string | null>) => {
      const p = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") p.delete(k);
        else p.set(k, v);
      }
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  // Preferencia de vista recordada + día por defecto en móvil (solo si no hay ?view).
  React.useEffect(() => {
    if (params.get("view")) {
      localStorage.setItem("citas-view", params.get("view")!);
      return;
    }
    const saved = localStorage.getItem("citas-view") as View | null;
    const mobile = typeof window !== "undefined" && window.innerWidth < 640;
    const target = saved ?? (mobile ? "dia" : "semana");
    if (target !== "semana") setParam({ view: target });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navigate(dir: -1 | 1) {
    const d =
      view === "mes"
        ? addMonths(anchor, dir)
        : view === "semana"
          ? addDays(anchor, dir * 7)
          : addDays(anchor, dir);
    setParam({ date: toISODate(d) });
  }

  const commonProps = {
    anchor,
    citas,
    onSelectEvent: (c: AppointmentRow) => setDetailCita(c),
    onCreateAt: (fecha: string, hora?: string) => {
      setCreatePrefill({ fecha, hora });
      setCreateOpen(true);
    },
    onSelectDay: (fecha: string) => setParam({ view: "dia", date: fecha }),
  };

  function refresh() {
    setDetailCita(null);
    setCreateOpen(false);
    setEditCita(null);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Cabecera */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
              Citas
            </h1>
          </div>
          {canWrite && (
            <Button
              icon={Plus}
              onClick={() => {
                setCreatePrefill({ fecha: anchorISO });
                setCreateOpen(true);
              }}
            >
              Nueva cita
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-border bg-surface dark:bg-surface/60">
              <button
                onClick={() => navigate(-1)}
                className="flex h-9 w-9 items-center justify-center rounded-l-xl text-muted hover:bg-surface-2 hover:text-fg"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate(1)}
                className="flex h-9 w-9 items-center justify-center rounded-r-xl text-muted hover:bg-surface-2 hover:text-fg"
                aria-label="Siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={CalendarDays}
              onClick={() => setParam({ view: "dia", date: toISODate(new Date()) })}
            >
              Hoy
            </Button>
            <p className="ml-1 text-sm font-bold capitalize text-fg sm:text-base">
              {tituloRango(view, anchor)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filtro por odontólogo */}
            <div className="relative">
              <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <select
                value={dentistaFilter}
                onChange={(e) => setParam({ dentista: e.target.value || null })}
                className="h-9 rounded-xl border border-border bg-surface pl-8 pr-3 text-[13px] font-medium text-fg focus:outline-none focus:ring-2 focus:ring-ring/40 dark:bg-navy-light"
              >
                <option value="">Todos los odontólogos</option>
                {dentists.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de vista */}
            <div className="inline-flex rounded-xl border border-border bg-surface p-0.5 dark:bg-surface/60">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  onClick={() => setParam({ view: v.key })}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors",
                    view === v.key
                      ? "bg-clinical text-white shadow-sm"
                      : "text-muted hover:text-fg",
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Vista con transición */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${view}-${anchorISO}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {view === "mes" && <MonthView {...commonProps} />}
          {view === "semana" && <WeekView {...commonProps} />}
          {view === "dia" && <DayView {...commonProps} />}
        </motion.div>
      </AnimatePresence>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 dark:bg-surface/60">
        {ESTADOS_LEYENDA.map((e) => (
          <span key={e} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
            <span className={cn("h-2.5 w-2.5 rounded-full", ESTADO_CITA[e].dot)} />
            {ESTADO_CITA[e].label}
          </span>
        ))}
      </div>

      {/* Modales */}
      {canWrite && (
        <AppointmentFormModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSuccess={refresh}
          patients={patients}
          dentists={dentists}
          prefill={createPrefill}
        />
      )}
      {canWrite && editCita && (
        <AppointmentFormModal
          open={!!editCita}
          onClose={() => setEditCita(null)}
          onSuccess={refresh}
          patients={patients}
          dentists={dentists}
          cita={editCita}
        />
      )}
      <AppointmentDetail
        cita={detailCita}
        canWrite={canWrite}
        onClose={() => setDetailCita(null)}
        onEdit={(c) => {
          setDetailCita(null);
          setEditCita(c);
        }}
        onChanged={refresh}
      />
    </div>
  );
}

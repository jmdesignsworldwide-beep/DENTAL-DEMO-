"use client";

import * as React from "react";
import {
  Clock,
  User,
  Stethoscope,
  CalendarClock,
  Pencil,
  Ban,
  RefreshCw,
  StickyNote,
  ChevronRight,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { fmtHora12 } from "@/lib/dates";
import { formatDateLong } from "@/lib/utils";
import type { AppointmentRow } from "@/lib/appointments";
import { ESTADO_CITA, TRANSICIONES } from "./estado-config";
import { changeStatus, cancelAppointment, rescheduleAppointment } from "./actions";

export function AppointmentDetail({
  cita,
  canWrite,
  onClose,
  onEdit,
  onChanged,
}: {
  cita: AppointmentRow | null;
  canWrite: boolean;
  onClose: () => void;
  onEdit: (c: AppointmentRow) => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [pending, start] = React.useTransition();
  const [mode, setMode] = React.useState<"view" | "cancel" | "reschedule">("view");
  const [motivo, setMotivo] = React.useState("");
  const [fecha, setFecha] = React.useState("");
  const [hora, setHora] = React.useState("");

  React.useEffect(() => {
    if (cita) {
      setMode("view");
      setMotivo("");
      setFecha(cita.fecha);
      setHora(cita.hora);
    }
  }, [cita]);

  if (!cita) return null;
  const st = ESTADO_CITA[cita.estado];

  function setEstado(e: (typeof TRANSICIONES)[number]) {
    start(async () => {
      const r = await changeStatus(cita!.id, e);
      if (r.ok) {
        toast.success("Estado actualizado", ESTADO_CITA[e].label);
        onChanged();
      } else toast.error("Error", r.error);
    });
  }

  function doCancel() {
    start(async () => {
      const r = await cancelAppointment(cita!.id, motivo);
      if (r.ok) {
        toast.success("Cita cancelada");
        onChanged();
      } else toast.error("No se pudo cancelar", r.error);
    });
  }

  function doReschedule() {
    start(async () => {
      const r = await rescheduleAppointment(cita!.id, fecha, hora);
      if (r.ok) {
        toast.success("Cita reagendada", `${formatDateLong(fecha)} · ${hora}`);
        onChanged();
      } else toast.error("No se pudo reagendar", r.error);
    });
  }

  return (
    <Modal open={!!cita} onClose={onClose} className="max-w-md">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${st.badge}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
            {st.label}
          </span>
        </div>

        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-fg">
            <User className="h-5 w-5 text-clinical" />
            {cita.paciente}
          </h2>
        </div>

        <div className="space-y-2.5 rounded-xl border border-border bg-surface-2/50 p-3.5 dark:bg-navy-lighter/30">
          <Detail icon={Stethoscope} text={cita.tratamiento} />
          <Detail icon={CalendarClock} text={formatDateLong(cita.fecha)} />
          <Detail icon={Clock} text={`${fmtHora12(cita.hora)} · ${cita.duracion_min} min`} />
          {cita.dentista_nombre && <Detail icon={User} text={cita.dentista_nombre} />}
          {cita.notas && <Detail icon={StickyNote} text={cita.notas} />}
        </div>

        {cita.estado === "cancelada" && cita.motivo_cancelacion && (
          <div className="rounded-xl border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
            <span className="font-semibold">Motivo de cancelación:</span>{" "}
            {cita.motivo_cancelacion}
          </div>
        )}

        {!canWrite ? null : mode === "view" ? (
          <>
            {/* Cambiar estado */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                Cambiar estado
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TRANSICIONES.map((e) => {
                  const es = ESTADO_CITA[e];
                  const active = cita.estado === e;
                  return (
                    <button
                      key={e}
                      disabled={pending || active}
                      onClick={() => setEstado(e)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition-colors disabled:opacity-100 ${
                        active ? es.badge : "bg-surface text-muted ring-border hover:text-fg"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${es.dot}`} />
                      {es.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="secondary" icon={Pencil} onClick={() => onEdit(cita)}>
                Editar
              </Button>
              <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => setMode("reschedule")}>
                Reagendar
              </Button>
              {cita.estado !== "cancelada" && (
                <Button size="sm" variant="ghost" icon={Ban} onClick={() => setMode("cancel")} className="text-danger">
                  Cancelar cita
                </Button>
              )}
            </div>
          </>
        ) : mode === "cancel" ? (
          <div className="space-y-3">
            <Field label="Motivo de la cancelación" required>
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej. El paciente reprogramó por viaje"
                autoFocus
              />
            </Field>
            <p className="text-xs text-muted">
              El motivo queda registrado permanentemente en la auditoría.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMode("view")}>
                Volver
              </Button>
              <Button variant="danger" icon={Ban} loading={pending} disabled={motivo.trim().length < 3} onClick={doCancel}>
                Confirmar cancelación
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nueva fecha">
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="[color-scheme:light] dark:[color-scheme:dark]" />
              </Field>
              <Field label="Nueva hora">
                <Input type="time" step={900} value={hora} onChange={(e) => setHora(e.target.value)} className="[color-scheme:light] dark:[color-scheme:dark]" />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMode("view")}>
                Volver
              </Button>
              <Button icon={ChevronRight} loading={pending} onClick={doReschedule}>
                Reagendar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Detail({ icon: Icon, text }: { icon: typeof Clock; text: string }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <span className="font-medium text-fg">{text}</span>
    </div>
  );
}

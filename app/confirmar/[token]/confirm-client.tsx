"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, CalendarClock, Stethoscope, CalendarCog, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmAppointment, requestChange } from "@/app/(app)/comunicaciones/actions";

type Estado = "pendiente" | "confirmada" | "cambio_solicitado";

export function ConfirmClient({
  token,
  estadoInicial,
  paciente,
  fecha,
  hora,
  dentista,
  tratamiento,
}: {
  token: string;
  estadoInicial: Estado;
  paciente: string;
  fecha: string;
  hora: string;
  dentista: string | null;
  tratamiento: string;
}) {
  const [estado, setEstado] = React.useState<Estado>(estadoInicial);
  const [busy, setBusy] = React.useState(false);
  const [changing, setChanging] = React.useState(false);
  const [mensaje, setMensaje] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  const confirmar = async () => {
    setBusy(true);
    setErr(null);
    const res = await confirmAppointment(token);
    setBusy(false);
    if (res.ok) setEstado("confirmada");
    else setErr(res.error ?? "No se pudo confirmar.");
  };

  const pedirCambio = async () => {
    setBusy(true);
    setErr(null);
    const res = await requestChange(token, mensaje);
    setBusy(false);
    if (res.ok) setEstado("cambio_solicitado");
    else setErr(res.error ?? "No se pudo registrar.");
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card-hover">
      {/* Detalle de la cita */}
      <div className="border-b border-border bg-clinical/5 p-6">
        <p className="text-sm text-muted">
          Hola <span className="font-bold text-fg">{paciente.split(" ")[0]}</span>, esta es su próxima cita:
        </p>
        <div className="mt-4 space-y-2.5">
          <Detail icon={CalendarClock} label={fecha} value={`a las ${hora}`} />
          <Detail icon={Stethoscope} label={tratamiento} value={dentista ?? undefined} />
        </div>
      </div>

      {/* Acción según estado */}
      <div className="p-6">
        {estado === "confirmada" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center py-4 text-center"
          >
            <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-mint/15 text-mint">
              <PartyPopper className="h-8 w-8" />
            </span>
            <h2 className="text-lg font-extrabold text-fg">¡Cita confirmada!</h2>
            <p className="mt-1 text-sm text-muted">
              Gracias por confirmar. Le esperamos. Si necesita algo, escríbanos.
            </p>
          </motion.div>
        ) : estado === "cambio_solicitado" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center py-4 text-center"
          >
            <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-amber/15 text-amber">
              <CalendarCog className="h-8 w-8" />
            </span>
            <h2 className="text-lg font-extrabold text-fg">Solicitud recibida</h2>
            <p className="mt-1 text-sm text-muted">
              La clínica le contactará para coordinar una nueva fecha. ¡Gracias!
            </p>
          </motion.div>
        ) : changing ? (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-fg">¿Qué fecha le conviene mejor?</label>
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={3}
              placeholder="Ej. Prefiero por la tarde, o la próxima semana…"
              className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-fg outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/20"
            />
            {err && <p className="text-sm font-semibold text-danger">{err}</p>}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setChanging(false)} disabled={busy} className="flex-1">
                Volver
              </Button>
              <Button icon={CalendarCog} onClick={pedirCambio} loading={busy} className="flex-1">
                Enviar solicitud
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {err && <p className="text-center text-sm font-semibold text-danger">{err}</p>}
            <Button icon={Check} onClick={confirmar} loading={busy} size="lg" className="w-full">
              Confirmar asistencia
            </Button>
            <button
              onClick={() => setChanging(true)}
              disabled={busy}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-muted transition-colors hover:text-fg disabled:opacity-50"
            >
              Necesito reprogramar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Check;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-clinical shadow-sm">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div>
        <p className="text-sm font-bold text-fg">{label}</p>
        {value && <p className="text-xs text-muted">{value}</p>}
      </div>
    </div>
  );
}

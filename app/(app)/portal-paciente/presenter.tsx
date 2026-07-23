"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Smartphone, Maximize2, Crown, Star, Loader2, ChevronDown } from "lucide-react";
import { PatientPortal } from "@/components/portal/patient-portal";
import type { PortalData, PortalPatientLite } from "@/lib/patient-portal";

type Theme = "light" | "dark";

export function Presenter({
  patients,
  selectedId,
  data,
}: {
  patients: PortalPatientLite[];
  selectedId: string;
  data: PortalData | null;
}) {
  const router = useRouter();
  const [theme, setTheme] = React.useState<Theme>("light");
  const [pending, start] = React.useTransition();

  const selected = patients.find((p) => p.id === selectedId);

  const onSelect = (id: string) => {
    if (id === selectedId) return;
    start(() => router.push(`/portal-paciente?p=${id}`));
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-center">
        {/* Panel de control del presentador */}
        <div className="w-full max-w-sm shrink-0 space-y-5 lg:pt-6">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-bold uppercase tracking-wider text-clinical">
              <Smartphone className="h-3.5 w-3.5" /> Portal del Paciente
            </span>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-fg">
              Tu clínica, en el teléfono de cada paciente
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              El sistema no termina en la recepción: tus pacientes ven su próxima cita, el
              progreso de su tratamiento, su estado de cuenta y recordatorios hechos a su medida.
            </p>
          </div>

          {/* Selector de paciente */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Ver el portal de</label>
            <div className="relative">
              <select
                value={selectedId}
                onChange={(e) => onSelect(e.target.value)}
                className="w-full appearance-none rounded-xl border border-border bg-surface px-3.5 py-3 pr-10 text-sm font-semibold text-fg outline-none ring-clinical/30 focus:ring-2"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.destacado ? "★ " : ""}{p.nombre}{p.esVip ? "  · VIP" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              <Star className="h-3 w-3 text-amber" /> Los destacados muestran los tres casos: plan en curso, balance pendiente y al día.
            </p>
          </div>

          {/* Toggle de tema del mockup */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Tema del portal</label>
            <div className="inline-flex rounded-xl border border-border bg-surface p-1">
              {(["light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-bold capitalize transition-colors ${
                    theme === t ? "bg-clinical text-white" : "text-muted hover:text-fg"
                  }`}
                >
                  {t === "light" ? "Claro" : "Oscuro"}
                </button>
              ))}
            </div>
          </div>

          {/* Ver a pantalla completa */}
          {selectedId && (
            <a
              href={`/portal/${selectedId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-clinical py-3 text-sm font-bold text-white shadow-card transition-transform active:scale-[0.98] hover:bg-clinical-600"
            >
              <Maximize2 className="h-4 w-4" /> Ver a pantalla completa
            </a>
          )}
          <p className="text-[11px] leading-relaxed text-muted">
            Ábrelo a pantalla completa y entrega el teléfono: el cliente vive el portal en sus propias manos.
          </p>

          {selected && (
            <div className="rounded-xl border border-border bg-surface-2/50 p-3 text-[12px] text-muted">
              Mostrando el portal de{" "}
              <span className="font-bold text-fg">{selected.nombre}</span>
              {selected.esVip && (
                <span className="ml-1 inline-flex items-center gap-0.5 align-middle text-gold">
                  <Crown className="h-3 w-3" /> VIP
                </span>
              )}
              .
            </div>
          )}
        </div>

        {/* Marco de teléfono */}
        <div className="relative flex justify-center">
          <PhoneFrame loading={pending}>
            {data ? (
              <PatientPortal data={data} theme={theme} onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))} />
            ) : (
              <div className="flex h-full items-center justify-center bg-bg text-sm text-muted">
                Selecciona un paciente para ver su portal.
              </div>
            )}
          </PhoneFrame>
        </div>
      </div>
    </div>
  );
}

function PhoneFrame({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="relative"
    >
      {/* Cuerpo del dispositivo */}
      <div className="relative h-[700px] w-[340px] rounded-[2.75rem] bg-navy p-3 shadow-[0_30px_80px_-20px_rgba(10,22,40,0.55),0_10px_30px_-10px_rgba(10,22,40,0.4)] ring-1 ring-black/10 dark:ring-white/10">
        {/* Botones laterales */}
        <span className="absolute -left-[3px] top-28 h-12 w-[3px] rounded-l bg-navy-lighter" />
        <span className="absolute -left-[3px] top-44 h-16 w-[3px] rounded-l bg-navy-lighter" />
        <span className="absolute -right-[3px] top-36 h-20 w-[3px] rounded-r bg-navy-lighter" />

        {/* Pantalla */}
        <div className="relative h-full w-full overflow-hidden rounded-[2.1rem] bg-bg">
          {/* Dynamic island */}
          <div className="pointer-events-none absolute left-1/2 top-2 z-30 h-7 w-24 -translate-x-1/2 rounded-full bg-black" />
          {/* Reflejo sutil */}
          <div className="pointer-events-none absolute inset-0 z-20 rounded-[2.1rem]" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.12), transparent 30%)" }} />

          {loading && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-bg/60 backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-clinical" />
            </div>
          )}

          <div className="h-full w-full">{children}</div>
        </div>
      </div>
    </motion.div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Camera, History, Baby, User } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { formatDateLong } from "@/lib/utils";
import type { Denticion } from "@/lib/teeth";
import type { OdontogramData, ToothState } from "@/lib/odontogram";
import { OdontogramChart } from "./odontogram-chart";
import { ToothPanel } from "./tooth-panel";
import { Legend } from "./legend";
import { saveSnapshot } from "./actions";
import { cn } from "@/lib/utils";

export function OdontogramClient({
  patientId,
  patientNombre,
  patientVip,
  fotoUrl,
  data,
  canWrite,
}: {
  patientId: string;
  patientNombre: string;
  patientVip: boolean;
  fotoUrl: string | null;
  data: OdontogramData;
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [denticion, setDenticion] = React.useState<Denticion>("adulto");
  const [selectedFdi, setSelectedFdi] = React.useState<number | null>(null);
  const [snapId, setSnapId] = React.useState<string>("actual");
  const [snapModal, setSnapModal] = React.useState(false);
  const [etiqueta, setEtiqueta] = React.useState("");
  const [saving, startSave] = React.useTransition();

  const viewingSnapshot = snapId !== "actual";
  const activeSnap = data.snapshots.find((s) => s.id === snapId);

  // Estados mostrados: actuales o los del snapshot seleccionado.
  const states: Record<number, ToothState> = React.useMemo(() => {
    if (!viewingSnapshot || !activeSnap) return data.states;
    const m: Record<number, ToothState> = {};
    for (const t of activeSnap.snapshot) {
      m[t.fdi] = { fdi: t.fdi, estado: t.estado, superficies: t.superficies ?? [], nota: null };
    }
    return m;
  }, [viewingSnapshot, activeSnap, data.states]);

  const selectedState = selectedFdi != null ? states[selectedFdi] : undefined;

  function doSnapshot() {
    startSave(async () => {
      const res = await saveSnapshot(patientId, etiqueta);
      if (res.ok) {
        toast.success("Snapshot guardado", "Estado del odontograma capturado");
        setSnapModal(false);
        setEtiqueta("");
        router.refresh();
      } else toast.error("Error", res.error);
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link
        href={`/pacientes/${patientId}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Perfil del paciente
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar nombre={patientNombre} url={fotoUrl} size="lg" vip={patientVip} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Odontograma
            </p>
            <h1 className="text-xl font-extrabold tracking-tight text-fg sm:text-2xl">
              {patientNombre}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle dentición */}
          <div className="inline-flex rounded-xl border border-border bg-surface p-0.5 dark:bg-surface/60">
            {(["adulto", "pediatrico"] as Denticion[]).map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDenticion(d);
                  setSelectedFdi(null);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors",
                  denticion === d ? "bg-clinical text-white shadow-sm" : "text-muted hover:text-fg",
                )}
              >
                {d === "adulto" ? <User className="h-3.5 w-3.5" /> : <Baby className="h-3.5 w-3.5" />}
                {d === "adulto" ? "Adulto" : "Pediátrico"}
              </button>
            ))}
          </div>

          {/* Selector de snapshot */}
          {data.snapshots.length > 0 && (
            <div className="relative">
              <History className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <select
                value={snapId}
                onChange={(e) => {
                  setSnapId(e.target.value);
                  setSelectedFdi(null);
                }}
                className="h-9 rounded-xl border border-border bg-surface pl-8 pr-3 text-[13px] font-medium text-fg focus:outline-none focus:ring-2 focus:ring-ring/40 dark:bg-navy-light"
              >
                <option value="actual">Estado actual</option>
                {data.snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.etiqueta ? `${s.etiqueta} · ` : ""}
                    {formatDateLong(s.fecha)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {canWrite && !viewingSnapshot && (
            <Button size="sm" variant="secondary" icon={Camera} onClick={() => setSnapModal(true)}>
              Snapshot
            </Button>
          )}
        </div>
      </div>

      {/* Banner de snapshot */}
      <AnimatePresence>
        {viewingSnapshot && activeSnap && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-600 dark:text-violet-300"
          >
            <History className="h-4 w-4" />
            Viendo snapshot: {activeSnap.etiqueta ?? "Sin etiqueta"} ·{" "}
            {formatDateLong(activeSnap.fecha)} (solo lectura)
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chart */}
      <AnimatePresence mode="wait">
        <motion.div
          key={denticion}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25 }}
        >
          <OdontogramChart
            denticion={denticion}
            states={states}
            selectedFdi={selectedFdi}
            onSelect={setSelectedFdi}
            readOnly={viewingSnapshot}
          />
        </motion.div>
      </AnimatePresence>

      <Legend />

      {/* Panel lateral (drawer) */}
      <AnimatePresence>
        {selectedFdi != null && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              className="absolute inset-0 bg-navy/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFdi(null)}
            />
            <motion.div
              className="relative z-10 h-full w-full max-w-md border-l border-border bg-surface shadow-card-hover"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              <ToothPanel
                patientId={patientId}
                fdi={selectedFdi}
                state={selectedState}
                events={data.events}
                anatomyMarks={data.anatomy[selectedFdi] ?? []}
                anatomyEvents={data.anatomyEvents}
                canWrite={canWrite && !viewingSnapshot}
                onClose={() => setSelectedFdi(null)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de snapshot */}
      <Modal
        open={snapModal}
        onClose={() => setSnapModal(false)}
        title="Guardar snapshot del odontograma"
        description="Captura el estado actual para comparar la evolución del paciente."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSnapModal(false)}>
              Cancelar
            </Button>
            <Button icon={Camera} loading={saving} onClick={doSnapshot}>
              Guardar snapshot
            </Button>
          </>
        }
      >
        <Input
          value={etiqueta}
          onChange={(e) => setEtiqueta(e.target.value)}
          placeholder="Etiqueta (ej. Control post-tratamiento)"
        />
      </Modal>
    </div>
  );
}

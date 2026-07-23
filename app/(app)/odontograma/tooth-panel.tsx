"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X, Save, History, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatDateLong } from "@/lib/utils";
import { toothName, type Superficie } from "@/lib/teeth";
import type { ToothState, ToothEvent, ToothStatus } from "@/lib/odontogram";
import { ESTADO_DIENTE, ESTADOS_ORDEN } from "./tooth-config";
import { SurfaceDiagram } from "./surface-diagram";
import { setToothState } from "./actions";

export function ToothPanel({
  patientId,
  fdi,
  state,
  events,
  canWrite,
  onClose,
}: {
  patientId: string;
  fdi: number;
  state: ToothState | undefined;
  events: ToothEvent[];
  canWrite: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = React.useTransition();

  const [estado, setEstado] = React.useState<ToothStatus>(state?.estado ?? "sano");
  const [superficies, setSuperficies] = React.useState<string[]>(state?.superficies ?? []);
  const [nota, setNota] = React.useState(state?.nota ?? "");

  React.useEffect(() => {
    setEstado(state?.estado ?? "sano");
    setSuperficies(state?.superficies ?? []);
    setNota(state?.nota ?? "");
  }, [fdi, state]);

  const historial = events.filter((e) => e.fdi === fdi);

  function persist(next: {
    estado?: ToothStatus;
    superficies?: string[];
    nota?: string;
  }) {
    const e = next.estado ?? estado;
    const s = next.superficies ?? superficies;
    const n = next.nota ?? nota;
    start(async () => {
      const res = await setToothState(patientId, fdi, e, s, n);
      if (res.ok) router.refresh();
      else toast.error("Error", res.error);
    });
  }

  function pickEstado(e: ToothStatus) {
    setEstado(e);
    persist({ estado: e });
    toast.success("Diente actualizado", ESTADO_DIENTE[e].label);
  }

  function toggleSurface(code: Superficie) {
    const next = superficies.includes(code)
      ? superficies.filter((x) => x !== code)
      : [...superficies, code];
    setSuperficies(next);
    persist({ superficies: next });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Diente <span className="tabular">{fdi}</span>
          </p>
          <h3 className="text-lg font-extrabold tracking-tight text-fg">
            {toothName(fdi)}
          </h3>
          <span
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
            style={{ background: ESTADO_DIENTE[estado].fill }}
          >
            {ESTADO_DIENTE[estado].label}
          </span>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        {/* Superficies */}
        <div>
          <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-muted">
            Superficies del diente
          </p>
          <SurfaceDiagram
            estado={estado}
            superficies={superficies}
            onToggle={toggleSurface}
            readOnly={!canWrite}
          />
        </div>

        {/* Estado picker */}
        {canWrite && (
          <div>
            <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-muted">
              Marcar estado
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ESTADOS_ORDEN.map((e) => {
                const cfg = ESTADO_DIENTE[e];
                const active = estado === e;
                return (
                  <button
                    key={e}
                    disabled={pending}
                    onClick={() => pickEstado(e)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] font-semibold transition-all ${
                      active
                        ? "border-clinical ring-2 ring-clinical/30"
                        : "border-border hover:bg-surface-2"
                    }`}
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                      style={{ background: cfg.fill }}
                    />
                    <span className="truncate text-fg">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Notas */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-muted">
            <StickyNote className="h-3.5 w-3.5" /> Notas del odontólogo
          </p>
          {canWrite ? (
            <>
              <Textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Observaciones sobre este diente…"
              />
              <Button
                size="sm"
                icon={Save}
                loading={pending}
                className="mt-2"
                onClick={() => {
                  persist({ nota });
                  toast.success("Nota guardada");
                }}
              >
                Guardar nota
              </Button>
            </>
          ) : (
            <p className="text-sm text-fg/90">{nota || "Sin notas."}</p>
          )}
        </div>

        {/* Historial del diente */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-muted">
            <History className="h-3.5 w-3.5" /> Historial de este diente
          </p>
          {historial.length === 0 ? (
            <p className="text-sm text-muted">Sin cambios registrados.</p>
          ) : (
            <ul className="space-y-2">
              {historial.map((ev) => (
                <li key={ev.id} className="flex items-center gap-2.5 text-sm">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                    style={{ background: ESTADO_DIENTE[ev.estado].fill }}
                  />
                  <span className="font-semibold text-fg">{ESTADO_DIENTE[ev.estado].label}</span>
                  <span className="ml-auto text-xs text-muted">{formatDateLong(ev.fecha)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

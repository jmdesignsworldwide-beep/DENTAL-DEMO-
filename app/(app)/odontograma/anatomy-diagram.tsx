"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Trash2, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatDateLong } from "@/lib/utils";
import type { ToothType } from "@/lib/teeth";
import type { AnatomyMark, AnatomyEvent, AffectationType } from "@/lib/odontogram";
import {
  AFFECTATION,
  AFFECTATION_ORDEN,
  CAPAS,
  ZONA_LABEL,
  type ZonaCode,
} from "./anatomy-config";
import { setAnatomyMark, removeAnatomyMark } from "./actions";

interface Geom {
  esmalte: string;
  dentina: string;
  pulpa: string;
  canales: string[];
  cemento: string;
  hotspots: Record<ZonaCode, { x: number; y: number }>;
}

const GEOM: Record<ToothType, Geom> = {
  incisivo: {
    esmalte: "M74,128 C70,70 78,18 100,18 C122,18 130,70 126,128 Z",
    dentina:
      "M82,124 C80,74 86,34 100,34 C114,34 120,74 118,124 C116,200 110,286 100,288 C90,286 84,200 82,124 Z",
    pulpa: "M92,70 C92,58 108,58 108,70 C108,84 100,94 100,94 C100,94 92,84 92,70 Z",
    canales: ["M98,94 C98,180 99,275 100,284 C101,275 102,180 102,94 Z"],
    cemento: "M74,128 C76,200 88,300 100,300 C112,300 124,200 126,128 Z",
    hotspots: {
      esmalte: { x: 100, y: 44 },
      dentina: { x: 80, y: 104 },
      camara_pulpar: { x: 100, y: 76 },
      conducto: { x: 100, y: 200 },
      raiz: { x: 120, y: 238 },
      apice: { x: 100, y: 296 },
    },
  },
  canino: {
    esmalte: "M76,128 C74,72 92,20 100,16 C108,20 126,72 124,128 Z",
    dentina:
      "M84,124 C82,78 96,34 100,32 C104,34 118,78 116,124 C114,214 108,308 100,310 C92,308 86,214 84,124 Z",
    pulpa: "M93,74 C93,62 107,62 107,74 C107,88 100,98 100,98 C100,98 93,88 93,74 Z",
    canales: ["M98,98 C98,196 99,300 100,308 C101,300 102,196 102,98 Z"],
    cemento: "M76,128 C78,216 88,322 100,322 C112,322 122,216 124,128 Z",
    hotspots: {
      esmalte: { x: 100, y: 42 },
      dentina: { x: 82, y: 106 },
      camara_pulpar: { x: 100, y: 78 },
      conducto: { x: 100, y: 214 },
      raiz: { x: 120, y: 250 },
      apice: { x: 100, y: 314 },
    },
  },
  premolar: {
    esmalte:
      "M66,128 C64,80 66,42 78,42 C86,42 88,56 94,56 C97,56 98,46 100,46 C102,46 103,56 106,56 C112,56 114,42 122,42 C134,42 136,80 134,128 Z",
    dentina:
      "M78,124 C76,80 82,58 100,58 C118,58 124,80 122,124 C120,196 112,286 100,288 C88,286 80,196 78,124 Z",
    pulpa: "M88,76 C88,62 112,62 112,76 C112,90 100,100 100,100 C100,100 88,90 88,76 Z",
    canales: [
      "M95,100 C95,180 96,272 97,282 C98,272 98,180 98,100 Z",
      "M102,100 C102,180 102,272 103,282 C104,272 105,180 105,100 Z",
    ],
    cemento: "M70,128 C74,200 88,296 100,296 C112,296 126,200 130,128 Z",
    hotspots: {
      esmalte: { x: 100, y: 48 },
      dentina: { x: 82, y: 104 },
      camara_pulpar: { x: 100, y: 80 },
      conducto: { x: 98, y: 198 },
      raiz: { x: 122, y: 236 },
      apice: { x: 100, y: 292 },
    },
  },
  molar: {
    esmalte:
      "M50,132 C48,82 50,46 62,46 C70,46 74,60 82,60 C88,60 90,50 100,50 C110,50 112,60 118,60 C126,60 130,46 138,46 C150,46 152,82 150,132 Z",
    dentina:
      "M62,128 C60,86 74,60 100,60 C126,60 140,86 138,128 C134,182 122,290 108,290 C102,290 102,202 100,172 C98,202 98,290 92,290 C78,290 66,182 62,128 Z",
    pulpa: "M82,80 C82,66 118,66 118,80 C118,94 100,104 100,104 C100,104 82,94 82,80 Z",
    canales: [
      "M86,104 C84,190 82,284 84,288 C88,284 90,190 92,104 Z",
      "M108,104 C110,190 116,284 118,288 C114,284 112,190 114,104 Z",
    ],
    cemento:
      "M54,132 C56,210 66,300 80,300 C92,300 94,210 96,150 L104,150 C106,210 108,300 120,300 C134,300 144,210 146,132 Z",
    hotspots: {
      esmalte: { x: 100, y: 52 },
      dentina: { x: 124, y: 110 },
      camara_pulpar: { x: 100, y: 84 },
      conducto: { x: 88, y: 200 },
      raiz: { x: 130, y: 244 },
      apice: { x: 118, y: 292 },
    },
  },
};

const LAYER_FILL: Record<string, string> = {
  hueso: "#E7D3B1",
  encia: "#E19A9A",
  cemento: "#F2E9D8",
  esmalte: "#EAF2FB",
  dentina: "#EBD9A8",
  camara_pulpar: "#E4746E",
};

export function AnatomyDiagram({
  patientId,
  fdi,
  type,
  marks,
  events,
  canWrite,
}: {
  patientId: string;
  fdi: number;
  type: ToothType;
  marks: AnatomyMark[];
  events: AnatomyEvent[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const reduce = useReducedMotion();
  const g = GEOM[type];
  const [hoverLayer, setHoverLayer] = React.useState<string | null>(null);
  const [zonaModal, setZonaModal] = React.useState<ZonaCode | null>(null);
  const [tipo, setTipo] = React.useState<AffectationType>("caries_superficial");
  const [nota, setNota] = React.useState("");
  const [pending, start] = React.useTransition();

  const markMap = React.useMemo(() => {
    const m: Record<string, AnatomyMark> = {};
    marks.forEach((k) => (m[k.zona] = k));
    return m;
  }, [marks]);

  const historial = events.filter((e) => e.fdi === fdi);

  function openZona(z: ZonaCode) {
    if (!canWrite) return;
    const existing = markMap[z];
    setTipo(existing?.tipo ?? "caries_superficial");
    setNota(existing?.nota ?? "");
    setZonaModal(z);
  }

  function guardar() {
    if (!zonaModal) return;
    start(async () => {
      const res = await setAnatomyMark(patientId, fdi, zonaModal, tipo, nota);
      if (res.ok) {
        toast.success("Zona marcada", `${ZONA_LABEL[zonaModal]} · ${AFFECTATION[tipo].label}`);
        setZonaModal(null);
        router.refresh();
      } else toast.error("Error", res.error);
    });
  }

  function quitar() {
    if (!zonaModal) return;
    start(async () => {
      const res = await removeAnatomyMark(patientId, fdi, zonaModal);
      if (res.ok) {
        toast.success("Marca eliminada");
        setZonaModal(null);
        router.refresh();
      } else toast.error("Error", res.error);
    });
  }

  const lay = (code: string) => ({
    fill: LAYER_FILL[code],
    opacity: hoverLayer && hoverLayer !== code ? 0.5 : 1,
    stroke: hoverLayer === code ? "#0066CC" : undefined,
    strokeWidth: hoverLayer === code ? 2 : undefined,
    style: { transition: "opacity .2s" },
  });

  const hotspots = Object.entries(g.hotspots) as [ZonaCode, { x: number; y: number }][];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,200px)_1fr]">
        {/* SVG */}
        <div className="mx-auto w-full max-w-[220px] rounded-2xl border border-border bg-gradient-to-b from-surface to-surface-2/40 p-2 dark:from-surface/60 dark:to-navy/40">
          <svg
            viewBox="0 0 200 340"
            className="h-auto w-full dark:[filter:drop-shadow(0_0_5px_rgba(0,102,204,0.28))]"
          >
            {/* Hueso alveolar */}
            <g {...lay("hueso")}>
              <rect x={18} y={132} width={48} height={190} rx={10} />
              <rect x={134} y={132} width={48} height={190} rx={10} />
            </g>
            {/* Ligamento periodontal (contorno) */}
            <path
              d={g.cemento}
              fill="none"
              stroke={hoverLayer === "ligamento" ? "#0066CC" : "#E8B4AE"}
              strokeWidth={hoverLayer === "ligamento" ? 4 : 3}
              opacity={hoverLayer && hoverLayer !== "ligamento" ? 0.4 : 0.9}
            />
            {/* Cemento / raíz */}
            <path d={g.cemento} {...lay("cemento")} stroke="#D9CBB0" strokeWidth={1} />
            {/* Encía */}
            <g {...lay("encia")}>
              <path d="M18,120 C48,116 60,124 72,130 L72,146 C60,156 44,156 22,152 Z" />
              <path d="M182,120 C152,116 140,124 128,130 L128,146 C140,156 156,156 178,152 Z" />
            </g>
            {/* Dentina */}
            <path d={g.dentina} {...lay("dentina")} stroke="#D8C48A" strokeWidth={1} />
            {/* Esmalte */}
            <path d={g.esmalte} {...lay("esmalte")} stroke="#C7D9EE" strokeWidth={1.5} />
            {/* Pulpa */}
            <g {...lay("camara_pulpar")}>
              <path d={g.pulpa} />
              {g.canales.map((c, i) => (
                <path key={i} d={c} stroke="#E4746E" strokeWidth={1} />
              ))}
            </g>

            {/* Hotspots de marcado */}
            {hotspots.map(([zona, pos]) => {
              const mark = markMap[zona];
              const color = mark ? AFFECTATION[mark.tipo].color : null;
              return (
                <g
                  key={zona}
                  transform={`translate(${pos.x},${pos.y})`}
                  onClick={() => openZona(zona)}
                  onMouseEnter={() => setHoverLayer(zona)}
                  onMouseLeave={() => setHoverLayer(null)}
                  className={canWrite ? "cursor-pointer" : "cursor-default"}
                >
                  {mark && !reduce && (
                    <motion.circle
                      r={9}
                      fill={color!}
                      opacity={0.35}
                      animate={{ r: [9, 13, 9], opacity: [0.35, 0.1, 0.35] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                  <circle
                    r={6}
                    fill={color ?? "#fff"}
                    stroke={color ?? "#94A3B8"}
                    strokeWidth={2}
                    strokeDasharray={mark ? undefined : "2 2"}
                    className="drop-shadow"
                  />
                  {mark && <path d="M-2,0 L-0.5,2 L2.5,-2" fill="none" stroke="#fff" strokeWidth={1.4} />}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Capas etiquetadas (hover resalta) */}
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
              Capas anatómicas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CAPAS.map((c) => (
                <button
                  key={c.code}
                  onMouseEnter={() => setHoverLayer(c.code)}
                  onMouseLeave={() => setHoverLayer(null)}
                  className="rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-fg transition-colors hover:border-clinical-300 hover:bg-clinical-50/50 dark:hover:bg-clinical-900/20"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
              Afectaciones
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {AFFECTATION_ORDEN.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-[11px] text-muted">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: AFFECTATION[t].color }} />
                  {AFFECTATION[t].label}
                </span>
              ))}
            </div>
          </div>

          {canWrite && (
            <p className="text-[11px] text-muted">
              Toca un punto sobre el diagrama para marcar la zona afectada.
            </p>
          )}
        </div>
      </div>

      {/* Registro anatómico */}
      {historial.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
            Registro anatómico
          </p>
          <ul className="space-y-1.5">
            {historial.slice(0, 6).map((ev) => (
              <li key={ev.id} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: ev.tipo ? AFFECTATION[ev.tipo].color : "#94A3B8" }}
                />
                <span className="font-semibold text-fg">
                  {ZONA_LABEL[ev.zona as ZonaCode] ?? ev.zona}
                </span>
                <span className="text-muted">
                  {ev.accion === "desmarco" ? "desmarcada" : ev.tipo ? AFFECTATION[ev.tipo].label : ""}
                </span>
                <span className="ml-auto text-muted">{formatDateLong(ev.fecha)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal de marcado */}
      <Modal
        open={!!zonaModal}
        onClose={() => setZonaModal(null)}
        title={zonaModal ? `Marcar: ${ZONA_LABEL[zonaModal]}` : ""}
        description="Selecciona el tipo de afectación de esta zona."
      >
        <AnimatePresence>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {AFFECTATION_ORDEN.map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] font-semibold transition-all ${
                    tipo === t ? "border-clinical ring-2 ring-clinical/30" : "border-border hover:bg-surface-2"
                  }`}
                >
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: AFFECTATION[t].color }} />
                  <span className="truncate text-fg">{AFFECTATION[t].label}</span>
                </button>
              ))}
            </div>
            <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota de la zona (opcional)" />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              {zonaModal && markMap[zonaModal] ? (
                <Button variant="ghost" icon={Trash2} loading={pending} className="text-danger" onClick={quitar}>
                  Quitar marca
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2 sm:justify-end">
                <Button variant="ghost" onClick={() => setZonaModal(null)}>
                  Cancelar
                </Button>
                <Button icon={Check} loading={pending} onClick={guardar}>
                  Guardar marca
                </Button>
              </div>
            </div>
          </div>
        </AnimatePresence>
      </Modal>
    </div>
  );
}

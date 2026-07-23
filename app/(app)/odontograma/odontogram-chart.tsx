"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { dientesDe, toothType, toothName, type Denticion, type ToothType } from "@/lib/teeth";
import type { ToothState, ToothStatus } from "@/lib/odontogram";
import { ESTADO_DIENTE } from "./tooth-config";

const CROWN: Record<ToothType, string> = {
  incisivo:
    "M13,22 L27,22 Q29,22 29,25 L28,52 Q28,58 20,58 Q12,58 12,52 L11,25 Q11,22 13,22 Z",
  canino:
    "M13,22 L27,22 Q29,22 29,25 L28,48 Q28,52 20,60 Q12,52 12,48 L11,25 Q11,22 13,22 Z",
  premolar:
    "M11,22 L29,22 Q31,22 31,25 L30,51 Q30,55 26,54 Q23,51 20,54 Q17,51 14,54 Q10,55 10,51 L9,25 Q9,22 11,22 Z",
  molar:
    "M8,22 L32,22 Q34,22 34,25 L34,52 Q34,58 27,58 L13,58 Q6,58 6,52 L6,25 Q6,22 8,22 Z",
};
const ROOTS: Record<ToothType, string> = {
  incisivo: "M17,23 L20,4 L23,23 Z",
  canino: "M17,23 L20,2 L23,23 Z",
  premolar: "M17,23 L20,4 L23,23 Z",
  molar: "M12,23 L14,4 L16,23 Z M24,23 L26,4 L28,23 Z",
};

const CELL_W = 42;
const GAP = 6;
const CENTER_GAP = 22;
const ROW_H = 66;

function positions(count: number): number[] {
  const half = count / 2;
  const out: number[] = [];
  let x = 0;
  for (let i = 0; i < count; i++) {
    if (i === half) x += CENTER_GAP;
    out.push(x);
    x += CELL_W + GAP;
  }
  return out;
}

function Tooth({
  fdi,
  x,
  y,
  lower,
  state,
  selected,
  onHover,
  onSelect,
  reduce,
}: {
  fdi: number;
  x: number;
  y: number;
  lower: boolean;
  state: ToothState | undefined;
  selected: boolean;
  onHover: (fdi: number | null) => void;
  onSelect: (fdi: number) => void;
  reduce: boolean;
}) {
  const type = toothType(fdi);
  const estado: ToothStatus = state?.estado ?? "sano";
  const cfg = ESTADO_DIENTE[estado];
  const ausente = estado === "ausente";

  // Voltea verticalmente los dientes inferiores (corona hacia el centro).
  const flip = lower ? "scale(1,-1) translate(0,-62)" : "";

  return (
    <g
      transform={`translate(${x},${y})`}
      onMouseEnter={() => onHover(fdi)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(fdi)}
      className="cursor-pointer"
    >
      <motion.g whileHover={reduce ? undefined : { y: -4 }} initial={false}>
      <g transform={flip}>
        {/* raíces */}
        <path
          d={ROOTS[type]}
          fill={ausente ? "none" : "#F1F5F9"}
          stroke={cfg.stroke}
          strokeWidth={1}
          opacity={ausente ? 0.3 : 0.9}
          className="dark:opacity-70"
        />
        {/* corona */}
        <motion.path
          d={CROWN[type]}
          animate={{ fill: cfg.fill }}
          transition={{ duration: reduce ? 0 : 0.35 }}
          stroke={cfg.stroke}
          strokeWidth={selected ? 2.4 : 1.4}
          strokeDasharray={ausente ? "3 2" : undefined}
          fillOpacity={ausente ? 0.35 : 1}
        />
        {/* aro de selección */}
        {selected && (
          <path
            d={CROWN[type]}
            fill="none"
            stroke="#0066CC"
            strokeWidth={2.5}
            className="drop-shadow"
          />
        )}
        {/* marca de superficies afectadas */}
        {state && state.superficies.length > 0 && !ausente && (
          <circle cx={20} cy={42} r={2.6} fill="#fff" opacity={0.9} />
        )}
      </g>
      {/* número FDI */}
      <text
        x={20}
        y={lower ? 74 : -6}
        textAnchor="middle"
        className="fill-muted text-[9px] font-bold"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {fdi}
      </text>
      </motion.g>
    </g>
  );
}

export function OdontogramChart({
  denticion,
  states,
  selectedFdi,
  onSelect,
  readOnly,
}: {
  denticion: Denticion;
  states: Record<number, ToothState>;
  selectedFdi: number | null;
  onSelect: (fdi: number) => void;
  readOnly?: boolean;
}) {
  const reduce = !!useReducedMotion();
  const { superior, inferior } = dientesDe(denticion);
  const [hover, setHover] = React.useState<number | null>(null);
  const [mouse, setMouse] = React.useState({ x: 0, y: 0 });
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const xsSup = positions(superior.length);
  const xsInf = positions(inferior.length);
  const totalW = Math.max(...xsSup, ...xsInf) + CELL_W;
  const svgH = ROW_H * 2 + 40;
  const upperY = 14;
  const lowerY = ROW_H + 30;
  const midY = ROW_H + 22;
  const centerX =
    (xsSup[superior.length / 2 - 1] + CELL_W + xsSup[superior.length / 2]) / 2;

  const hoverState = hover != null ? states[hover] : undefined;

  return (
    <div
      ref={wrapRef}
      className="relative overflow-x-auto rounded-2xl border border-border bg-surface p-4 dark:bg-surface/80"
      onMouseMove={(e) => {
        const r = wrapRef.current?.getBoundingClientRect();
        if (r) setMouse({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
    >
      <svg
        viewBox={`-10 0 ${totalW + 20} ${svgH}`}
        className="mx-auto block"
        style={{ minWidth: denticion === "adulto" ? 640 : 460, width: "100%" }}
      >
        {/* Ejes de cuadrante */}
        <line x1={centerX} y1={6} x2={centerX} y2={svgH - 6} stroke="currentColor" className="text-border" strokeWidth={1} />
        <line x1={-10} y1={midY} x2={totalW + 10} y2={midY} stroke="currentColor" className="text-border" strokeWidth={1} />

        {/* Etiquetas de cuadrante */}
        <text x={centerX / 2} y={svgH - 2} textAnchor="middle" className="fill-muted/60 text-[8px] font-bold uppercase tracking-wider">
          {denticion === "adulto" ? "Superior derecho" : "Sup. der."}
        </text>
        <text x={centerX + (totalW - centerX) / 2} y={svgH - 2} textAnchor="middle" className="fill-muted/60 text-[8px] font-bold uppercase tracking-wider">
          {denticion === "adulto" ? "Superior izquierdo" : "Sup. izq."}
        </text>

        {superior.map((fdi, i) => (
          <Tooth
            key={fdi}
            fdi={fdi}
            x={xsSup[i]}
            y={upperY}
            lower={false}
            state={states[fdi]}
            selected={selectedFdi === fdi}
            onHover={readOnly ? () => {} : setHover}
            onSelect={readOnly ? () => {} : onSelect}
            reduce={reduce}
          />
        ))}
        {inferior.map((fdi, i) => (
          <Tooth
            key={fdi}
            fdi={fdi}
            x={xsInf[i]}
            y={lowerY}
            lower
            state={states[fdi]}
            selected={selectedFdi === fdi}
            onHover={readOnly ? () => {} : setHover}
            onSelect={readOnly ? () => {} : onSelect}
            reduce={reduce}
          />
        ))}
      </svg>

      {/* Tooltip flotante */}
      {hover != null && (
        <div
          className="pointer-events-none absolute z-20 w-56 rounded-xl border border-border bg-surface p-3 shadow-card-hover"
          style={{
            left: Math.min(mouse.x + 14, (wrapRef.current?.clientWidth ?? 300) - 230),
            top: mouse.y + 14,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-fg tabular">Diente {hover}</span>
            <span
              className="h-3 w-3 rounded-full ring-1 ring-inset ring-black/10"
              style={{ background: ESTADO_DIENTE[hoverState?.estado ?? "sano"].fill }}
            />
          </div>
          <p className="mt-0.5 text-xs text-muted">{toothName(hover)}</p>
          <p className="mt-1 text-xs font-semibold text-clinical">
            {ESTADO_DIENTE[hoverState?.estado ?? "sano"].label}
          </p>
        </div>
      )}
    </div>
  );
}

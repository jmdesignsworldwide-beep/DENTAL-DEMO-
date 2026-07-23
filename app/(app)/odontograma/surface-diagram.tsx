"use client";

import type { ToothStatus } from "@/lib/odontogram";
import type { Superficie } from "@/lib/teeth";
import { ESTADO_DIENTE } from "./tooth-config";

const ZONES: { code: Superficie; label: string; points: string; cx: number; cy: number }[] = [
  { code: "V", label: "Vestibular", points: "0,0 120,0 80,40 40,40", cx: 60, cy: 22 },
  { code: "L", label: "Lingual", points: "0,120 120,120 80,80 40,80", cx: 60, cy: 100 },
  { code: "M", label: "Mesial", points: "0,0 40,40 40,80 0,120", cx: 20, cy: 60 },
  { code: "D", label: "Distal", points: "120,0 80,40 80,80 120,120", cx: 100, cy: 60 },
  { code: "O", label: "Oclusal", points: "40,40 80,40 80,80 40,80", cx: 60, cy: 60 },
];

export function SurfaceDiagram({
  estado,
  superficies,
  onToggle,
  readOnly,
}: {
  estado: ToothStatus;
  superficies: string[];
  onToggle: (code: Superficie) => void;
  readOnly?: boolean;
}) {
  const activeFill = ESTADO_DIENTE[estado === "sano" ? "caries" : estado].fill;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="-2 -2 124 124" className="w-40">
        {ZONES.map((z) => {
          const active = superficies.includes(z.code);
          return (
            <g key={z.code}>
              <polygon
                points={z.points}
                fill={active ? activeFill : "transparent"}
                className={`stroke-border transition-colors ${
                  readOnly ? "" : "cursor-pointer hover:fill-clinical-50 dark:hover:fill-clinical-900/30"
                }`}
                strokeWidth={1.5}
                onClick={() => !readOnly && onToggle(z.code)}
              />
              <text
                x={z.cx}
                y={z.cy + 3}
                textAnchor="middle"
                className={`pointer-events-none text-[13px] font-bold ${
                  active ? "fill-white" : "fill-muted"
                }`}
              >
                {z.code}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-[11px] text-muted">
        {readOnly ? "Superficies afectadas" : "Toca una superficie para marcarla"}
      </p>
    </div>
  );
}

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Building2, CalendarRange, CalendarCog, Stethoscope, Users, Hash, Tv, ShieldCheck,
} from "lucide-react";
import type { SettingsData } from "@/lib/settings";
import { IdentidadSection } from "./sections/identidad";
import { HorariosSection } from "./sections/horarios";
import { CitasSection } from "./sections/citas";
import { TratamientosSection } from "./sections/tratamientos";
import { UsuariosSection } from "./sections/usuarios";
import { NcfSection } from "./sections/ncf";
import { SalaSection } from "./sections/sala";
import { AuditoriaSection } from "./sections/auditoria";

type Key = "identidad" | "horarios" | "citas" | "tratamientos" | "usuarios" | "ncf" | "sala" | "auditoria";

const SECTIONS: { key: Key; label: string; desc: string; icon: React.ElementType }[] = [
  { key: "identidad", label: "Identidad", desc: "Marca y datos", icon: Building2 },
  { key: "horarios", label: "Horarios", desc: "Atención y feriados", icon: CalendarRange },
  { key: "citas", label: "Citas", desc: "Reglas y recordatorios", icon: CalendarCog },
  { key: "tratamientos", label: "Tratamientos", desc: "Precios del catálogo", icon: Stethoscope },
  { key: "usuarios", label: "Usuarios y permisos", desc: "Accesos y roles", icon: Users },
  { key: "ncf", label: "Secuencias NCF", desc: "Comprobantes fiscales", icon: Hash },
  { key: "sala", label: "Sala de espera", desc: "Pantalla TV", icon: Tv },
  { key: "auditoria", label: "Respaldo y auditoría", desc: "Bitácora del sistema", icon: ShieldCheck },
];

export function ConfiguracionClient({ data }: { data: SettingsData }) {
  const [active, setActive] = React.useState<Key>("identidad");

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-fg">Configuración</h1>
        <p className="mt-1 text-sm text-muted">Controla todo tu sistema desde un solo lugar.</p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Nav lateral (desktop) / tabs (móvil) */}
        <nav className="lg:w-60 lg:shrink-0">
          <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1.5 no-scrollbar lg:flex-col lg:gap-0.5">
            {SECTIONS.map((s) => {
              const on = active === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setActive(s.key)}
                  className={`relative flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left transition-colors lg:w-full ${on ? "text-white" : "text-fg hover:bg-surface-2"}`}
                >
                  {on && <motion.span layoutId="cfg-nav" className="absolute inset-0 rounded-xl bg-clinical" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                  <span className="relative flex items-center gap-3">
                    <s.icon className="h-[18px] w-[18px] shrink-0" />
                    <span>
                      <span className="block text-[13px] font-bold leading-tight">{s.label}</span>
                      <span className={`hidden text-[11px] leading-tight lg:block ${on ? "text-white/70" : "text-muted"}`}>{s.desc}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Sección activa */}
        <div className="min-w-0 flex-1">
          <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {active === "identidad" && <IdentidadSection clinic={data.clinic} />}
            {active === "horarios" && <HorariosSection clinic={data.clinic} holidays={data.holidays} />}
            {active === "citas" && <CitasSection clinic={data.clinic} />}
            {active === "tratamientos" && <TratamientosSection treatments={data.treatments} />}
            {active === "usuarios" && <UsuariosSection users={data.users} />}
            {active === "ncf" && <NcfSection ncf={data.ncf} umbral={data.clinic.ncfAlertaUmbral} />}
            {active === "sala" && <SalaSection clinic={data.clinic} tokens={data.tokens} waiting={data.waiting} />}
            {active === "auditoria" && <AuditoriaSection audit={data.audit} lastBackupAt={data.clinic.lastBackupAt} />}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

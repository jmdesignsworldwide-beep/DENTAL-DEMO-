"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Phone, Mail, CalendarDays, BadgeCheck, Clock, X, Stethoscope, Briefcase, ConciergeBell,
} from "lucide-react";
import { initials, formatDateLong } from "@/lib/utils";
import type { StaffMember } from "@/lib/staff";

const ROL_META: Record<string, { label: string; icon: React.ElementType }> = {
  dentista: { label: "Odontólogo", icon: Stethoscope },
  asistente: { label: "Asistente", icon: Briefcase },
  recepcionista: { label: "Recepción", icon: ConciergeBell },
};
const ESTADO_META: Record<string, { label: string; color: string }> = {
  activo: { label: "Activo", color: "#00C896" },
  vacaciones: { label: "Vacaciones", color: "#F59E0B" },
  licencia: { label: "Licencia", color: "#8B5CF6" },
  inactivo: { label: "Inactivo", color: "#94A3B8" },
};
const DIA_LABEL: Record<string, string> = {
  lun: "Lun", mar: "Mar", mie: "Mié", jue: "Jue", vie: "Vie", sab: "Sáb",
};

export function TeamPanel({ staff }: { staff: StaffMember[] }) {
  const [detail, setDetail] = React.useState<StaffMember | null>(null);

  if (staff.length === 0) {
    return <p className="py-16 text-center text-muted">No hay personal registrado.</p>;
  }

  return (
    <>
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {staff.map((s) => {
          const rol = ROL_META[s.rol] ?? ROL_META.asistente;
          const estado = ESTADO_META[s.estado] ?? ESTADO_META.activo;
          return (
            <motion.button
              key={s.id}
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 30 } } }}
              onClick={() => setDetail(s)}
              className="group flex flex-col rounded-2xl border border-border bg-surface p-4 text-left shadow-card transition-all duration-300 ease-spring hover:-translate-y-1 hover:shadow-card-hover"
            >
              <div className="flex items-center gap-3">
                <span
                  className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white"
                  style={{ background: s.color }}
                >
                  {initials(s.nombre)}
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-surface"
                    style={{ background: estado.color }}
                    title={estado.label}
                  />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-extrabold text-fg">{s.nombre}</p>
                  <p className="truncate text-[13px] font-semibold" style={{ color: s.color }}>
                    {s.especialidad ?? rol.label}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-muted">
                  <rol.icon className="h-3 w-3" /> {rol.label}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: `${estado.color}1a`, color: estado.color }}>
                  {estado.label}
                </span>
              </div>

              <div className="mt-3 space-y-1 border-t border-border pt-3 text-[12px] text-muted">
                {s.exequatur && (
                  <p className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5" /> Exequátur {s.exequatur}</p>
                )}
                <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {s.telefono ?? "—"}</p>
                <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Desde {new Date(s.fechaIngreso).getFullYear()}</p>
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      <AnimatePresence>
        {detail && <StaffDetail member={detail} onClose={() => setDetail(null)} />}
      </AnimatePresence>
    </>
  );
}

function StaffDetail({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const rol = ROL_META[member.rol] ?? ROL_META.asistente;
  const estado = ESTADO_META[member.estado] ?? ESTADO_META.activo;
  const dias = ["lun", "mar", "mie", "jue", "vie", "sab"].filter((d) => member.horario[d]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-surface shadow-card-hover"
      >
        <div className="relative p-5" style={{ background: `linear-gradient(135deg, ${member.color}, ${member.color}cc)` }}>
          <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1 text-white/80 hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-xl font-black text-white backdrop-blur">
              {initials(member.nombre)}
            </span>
            <div>
              <p className="text-lg font-extrabold text-white">{member.nombre}</p>
              <p className="text-sm font-semibold text-white/90">{member.especialidad ?? rol.label}</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: estado.color }} /> {estado.label}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <Field icon={rol.icon} label="Rol" value={rol.label} />
          {member.exequatur && <Field icon={BadgeCheck} label="Exequátur" value={member.exequatur} />}
          <Field icon={Phone} label="Teléfono" value={member.telefono ?? "—"} />
          <Field icon={Mail} label="Correo" value={member.email ?? "—"} />
          <Field icon={CalendarDays} label="Fecha de ingreso" value={formatDateLong(member.fechaIngreso)} />
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-muted">
              <Clock className="h-3.5 w-3.5" /> Horario semanal
            </p>
            {dias.length === 0 ? (
              <p className="text-[13px] text-muted">Sin horario asignado.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {dias.map((d) => (
                  <span key={d} className="rounded-lg bg-surface-2 px-2 py-1 text-[11px] font-semibold text-fg">
                    <span className="font-bold">{DIA_LABEL[d]}</span>{" "}
                    <span className="tabular text-muted">{member.horario[d][0]}–{member.horario[d][1]}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
        <p className="truncate text-[13px] font-semibold text-fg">{value}</p>
      </div>
    </div>
  );
}

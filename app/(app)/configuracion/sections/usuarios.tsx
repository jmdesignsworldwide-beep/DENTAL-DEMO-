"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { UserPlus, LogOut, Check, Minus, ShieldCheck, X } from "lucide-react";
import { initials, relativeTime } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { NAV_ITEMS } from "@/components/layout/nav-config";
import type { Role } from "@/lib/auth";
import type { AppUser } from "@/lib/settings";
import { inputCls } from "./ui";
import { changeUserRole, toggleUserActive, forceLogout } from "../actions";

const ROLES: { key: Role; label: string }[] = [
  { key: "owner", label: "Owner" },
  { key: "dentista", label: "Odontólogo" },
  { key: "recepcionista", label: "Recepción" },
  { key: "asistente", label: "Asistente" },
];

export function UsuariosSection({ users }: { users: AppUser[] }) {
  const { success, error } = useToast();
  const [list, setList] = React.useState(users);
  const [invite, setInvite] = React.useState(false);
  const [inv, setInv] = React.useState({ nombre: "", email: "", rol: "asistente" as Role });

  const onRole = async (id: string, rol: string) => {
    setList((p) => p.map((u) => (u.id === id ? { ...u, rol } : u)));
    const res = await changeUserRole(id, rol);
    if (!res.ok) error("No se pudo cambiar el rol", res.error);
  };
  const onEstado = async (id: string, estado: "activo" | "inactivo") => {
    setList((p) => p.map((u) => (u.id === id ? { ...u, estado } : u)));
    const res = await toggleUserActive(id, estado);
    if (res.ok) success(estado === "activo" ? "Usuario activado" : "Usuario desactivado");
    else error("No se pudo actualizar", res.error);
  };
  const onLogout = async (id: string, nombre: string) => {
    setList((p) => p.map((u) => (u.id === id ? { ...u, ultimoAcceso: null } : u)));
    await forceLogout(id);
    success("Sesión cerrada", `Se cerró la sesión de ${nombre} en todos sus dispositivos.`);
  };
  const sendInvite = () => {
    if (inv.email.length < 5) { error("Correo inválido"); return; }
    success("Invitación enviada", `${inv.email} recibirá un enlace para crear su cuenta como ${inv.rol}.`);
    setInvite(false);
    setInv({ nombre: "", email: "", rol: "asistente" });
  };

  return (
    <div className="space-y-5">
      {/* Usuarios */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-fg">Usuarios y permisos</h2>
            <p className="mt-0.5 text-[13px] text-muted">Gestiona accesos, roles y estado del equipo.</p>
          </div>
          <button onClick={() => setInvite((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl bg-clinical px-3 py-2 text-sm font-bold text-white hover:bg-clinical-600">
            <UserPlus className="h-4 w-4" /> Invitar
          </button>
        </div>

        {invite && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface-2/40 p-3">
            <input className={`${inputCls} flex-1`} placeholder="Nombre" value={inv.nombre} onChange={(e) => setInv((p) => ({ ...p, nombre: e.target.value }))} />
            <input className={`${inputCls} flex-1`} placeholder="Correo" value={inv.email} onChange={(e) => setInv((p) => ({ ...p, email: e.target.value }))} />
            <select className={`${inputCls} w-36`} value={inv.rol} onChange={(e) => setInv((p) => ({ ...p, rol: e.target.value as Role }))}>
              {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <button onClick={sendInvite} className="rounded-xl bg-clinical px-4 py-2 text-sm font-bold text-white">Enviar</button>
            <button onClick={() => setInvite(false)} className="rounded-xl border border-border p-2 text-muted"><X className="h-4 w-4" /></button>
          </motion.div>
        )}

        <div className="mt-4 space-y-2">
          {list.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2/30 px-3 py-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clinical/10 text-[13px] font-black text-clinical">{initials(u.nombre)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-fg">{u.nombre}</p>
                <p className="truncate text-[11px] text-muted">{u.email}</p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-[11px] font-semibold text-fg">{u.ultimoAcceso ? relativeTime(u.ultimoAcceso) : "Sin sesión"}</p>
                <p className="text-[10px] text-muted">{u.dispositivo ?? "—"}</p>
              </div>
              <select value={u.rol} onChange={(e) => onRole(u.id, e.target.value)} className="h-8 rounded-lg border border-border bg-surface px-2 text-[12px] font-bold text-fg outline-none">
                {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
              <button
                onClick={() => onEstado(u.id, u.estado === "activo" ? "inactivo" : "activo")}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${u.estado === "activo" ? "bg-mint/10 text-mint" : "bg-surface-2 text-muted"}`}
              >
                {u.estado === "activo" ? "Activo" : "Inactivo"}
              </button>
              <button onClick={() => onLogout(u.id, u.nombre)} title="Forzar cierre de sesión" className="rounded-lg border border-border p-1.5 text-muted hover:text-danger">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Matriz de permisos */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-fg"><ShieldCheck className="h-4 w-4 text-clinical" /> Matriz de permisos por rol</h3>
        <p className="mt-0.5 text-[13px] text-muted">Qué puede ver cada rol en cada módulo. Refleja los permisos reales del sistema.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-muted">Módulo</th>
                {ROLES.map((r) => <th key={r.key} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-muted">{r.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {NAV_ITEMS.map((item) => (
                <tr key={item.href} className="border-b border-border last:border-0">
                  <td className="px-2 py-1.5 font-semibold text-fg">{item.label}</td>
                  {ROLES.map((r) => {
                    const allowed = !item.roles || item.roles.includes(r.key);
                    return (
                      <td key={r.key} className="px-2 py-1.5 text-center">
                        {allowed ? <Check className="mx-auto h-4 w-4 text-mint" /> : <Minus className="mx-auto h-3.5 w-3.5 text-border" />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

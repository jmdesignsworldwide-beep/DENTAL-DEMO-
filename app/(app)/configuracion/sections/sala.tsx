"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Tv, Plus, Copy, Trash2, Check, Loader2, Siren, ShieldQuestion } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type { ClinicSettings, ScreenToken, WaitingContent } from "@/lib/settings";
import { inputCls } from "./ui";
import { genScreenToken, revokeScreenToken, saveWelcome, savePrivacy, toggleWaitingContent } from "../actions";
import { setEmergency } from "@/app/sala-espera/actions";

const PRIVACIDAD: { key: ClinicSettings["nivelPrivacidad"]; label: string; ej: string }[] = [
  { key: "completo", label: "Nombre completo", ej: "María Altagracia Peña" },
  { key: "inicial", label: "Nombre + inicial", ej: "María P." },
  { key: "solo_nombre", label: "Solo nombre", ej: "María" },
];

export function SalaSection({ clinic, tokens, waiting }: { clinic: ClinicSettings; tokens: ScreenToken[]; waiting: WaitingContent[] }) {
  const { success, error } = useToast();
  const [toks, setToks] = React.useState(tokens);
  const [content, setContent] = React.useState(waiting);
  const [welcome, setWelcome] = React.useState(clinic.mensajeBienvenida ?? "");
  const [priv, setPriv] = React.useState(clinic.nivelPrivacidad);
  const [genPending, startGen] = React.useTransition();
  const [copied, setCopied] = React.useState<string | null>(null);

  // Emergencia
  const [emActive, setEmActive] = React.useState(clinic.emergencyActive);
  const [emMsg, setEmMsg] = React.useState(clinic.emergencyMessage ?? "Retraso de 30 minutos por emergencia en curso.");
  const [emSev, setEmSev] = React.useState<"warning" | "danger">(clinic.emergencySeverity);
  const [emPending, startEm] = React.useTransition();

  const gen = () => startGen(async () => {
    const r = await genScreenToken("Pantalla de recepción");
    if (r.ok && r.token) { setToks((p) => [{ id: crypto.randomUUID(), token: r.token!, nombre: "Pantalla de recepción", activo: true, createdAt: new Date().toISOString() }, ...p]); success("Token generado", r.token); }
    else error("No se pudo generar", r.error);
  });
  const revoke = async (id: string) => { setToks((p) => p.map((t) => (t.id === id ? { ...t, activo: false } : t))); await revokeScreenToken(id); success("Token revocado"); };
  const copy = (tok: string) => { void navigator.clipboard?.writeText(`${window.location.origin}/sala-espera?token=${tok}`); setCopied(tok); window.setTimeout(() => setCopied(null), 1500); };

  const onWelcome = async () => { const r = await saveWelcome(welcome); r.ok ? success("Mensaje guardado") : error("No se pudo guardar", r.error); };
  const onPriv = async (n: ClinicSettings["nivelPrivacidad"]) => { setPriv(n); const r = await savePrivacy(n); if (!r.ok) error("No se pudo guardar", r.error); };
  const onToggleContent = async (id: string, activo: boolean) => { setContent((p) => p.map((c) => (c.id === id ? { ...c, activo } : c))); await toggleWaitingContent(id, activo); };

  const applyEm = (on: boolean) => startEm(async () => {
    const r = await setEmergency(on, emMsg, emSev);
    if (r.ok) { setEmActive(on); success(on ? "Modo emergencia activado" : "Modo emergencia desactivado"); }
    else error("No se pudo aplicar", r.error);
  });

  return (
    <div className="space-y-5">
      {/* Token de pantalla */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-fg"><Tv className="h-5 w-5 text-clinical" /> Pantalla de sala de espera</h2>
            <p className="mt-0.5 text-[13px] text-muted">Genera un token para mostrar la pantalla en un TV, sin credenciales de usuario.</p>
          </div>
          <button onClick={gen} disabled={genPending} className="inline-flex items-center gap-1.5 rounded-xl bg-clinical px-3 py-2 text-sm font-bold text-white hover:bg-clinical-600 disabled:opacity-50">
            {genPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Generar token
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {toks.length === 0 ? (
            <p className="text-[13px] text-muted">No hay tokens generados.</p>
          ) : toks.map((t) => (
            <div key={t.id} className={`flex items-center gap-3 rounded-xl border border-border px-3 py-2 ${t.activo ? "bg-surface-2/40" : "bg-surface-2/20 opacity-60"}`}>
              <span className="font-mono text-[13px] font-bold tabular text-fg">{t.token}</span>
              <span className="text-[11px] text-muted">{t.nombre}</span>
              {t.activo ? (
                <div className="ml-auto flex items-center gap-1.5">
                  <button onClick={() => copy(t.token)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-fg hover:bg-surface-2">
                    {copied === t.token ? <Check className="h-3.5 w-3.5 text-mint" /> : <Copy className="h-3.5 w-3.5" />} {copied === t.token ? "Copiado" : "Copiar enlace"}
                  </button>
                  <button onClick={() => revoke(t.id)} className="rounded-lg border border-border p-1.5 text-muted hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ) : <span className="ml-auto text-[11px] font-bold text-muted">Revocado</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Bienvenida + privacidad */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h3 className="text-[15px] font-extrabold text-fg">Mensaje de bienvenida</h3>
          <textarea rows={3} value={welcome} onChange={(e) => setWelcome(e.target.value)} className={`${inputCls} mt-2 h-auto py-2`} placeholder="Bienvenido. En breve será atendido." />
          <button onClick={onWelcome} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-clinical px-4 py-2 text-sm font-bold text-white hover:bg-clinical-600"><Check className="h-4 w-4" /> Guardar</button>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-fg"><ShieldQuestion className="h-4 w-4 text-clinical" /> Privacidad en pantalla</h3>
          <p className="mt-0.5 text-[13px] text-muted">Cómo se muestran los nombres en el TV público.</p>
          <div className="mt-2 space-y-1.5">
            {PRIVACIDAD.map((p) => (
              <button key={p.key} onClick={() => onPriv(p.key)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${priv === p.key ? "border-clinical bg-clinical/5" : "border-border hover:bg-surface-2"}`}>
                <span className="text-[13px] font-bold text-fg">{p.label}</span>
                <span className="flex items-center gap-2 text-[12px] text-muted">{p.ej}{priv === p.key && <Check className="h-4 w-4 text-clinical" />}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contenido del carrusel */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-[15px] font-extrabold text-fg">Consejos y anuncios del carrusel</h3>
        <p className="mt-0.5 text-[13px] text-muted">Activa o desactiva lo que rota en la pantalla.</p>
        <div className="mt-3 space-y-2">
          {content.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/30 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-fg">{c.titulo}</p>
                <p className="truncate text-[11px] text-muted">{c.cuerpo}</p>
              </div>
              <button onClick={() => onToggleContent(c.id, !c.activo)} role="switch" aria-checked={c.activo} className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${c.activo ? "bg-clinical" : "bg-surface-2 border border-border"}`}>
                <span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform" style={{ transform: c.activo ? "translateX(18px)" : "translateX(3px)" }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Modo emergencia */}
      <div className={`rounded-2xl border p-5 shadow-card ${emActive ? "border-danger/40 bg-danger/5" : "border-border bg-surface"}`}>
        <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-fg"><Siren className={`h-4 w-4 ${emActive ? "text-danger" : "text-amber"}`} /> Modo de emergencia</h3>
        <p className="mt-0.5 text-[13px] text-muted">Muestra un mensaje prioritario a pantalla completa en la sala.</p>
        <textarea rows={2} value={emMsg} onChange={(e) => setEmMsg(e.target.value)} className={`${inputCls} mt-2 h-auto py-2`} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {(["warning", "danger"] as const).map((s) => (
            <button key={s} onClick={() => setEmSev(s)} className={`rounded-lg border px-3 py-1.5 text-[12px] font-bold ${emSev === s ? "border-clinical ring-1 ring-clinical/40" : "border-border"}`} style={{ color: s === "danger" ? "#EF4444" : "#F59E0B" }}>
              {s === "danger" ? "Emergencia (rojo)" : "Aviso (ámbar)"}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            {emActive && <button onClick={() => applyEm(false)} disabled={emPending} className="rounded-xl px-4 py-2 text-sm font-bold text-mint hover:bg-mint/10 disabled:opacity-50">Desactivar</button>}
            <button onClick={() => applyEm(true)} disabled={emPending} className="inline-flex items-center gap-1.5 rounded-xl bg-danger px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
              {emPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Siren className="h-4 w-4" />} {emActive ? "Actualizar" : "Activar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

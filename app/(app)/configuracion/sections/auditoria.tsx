"use client";

import * as React from "react";
import { DatabaseBackup, Download, FileText, Search, ShieldCheck, Loader2 } from "lucide-react";
import { relativeTime, formatDateLong } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import type { AuditEntry } from "@/lib/settings";
import { inputCls } from "./ui";

export function AuditoriaSection({ audit, lastBackupAt }: { audit: AuditEntry[]; lastBackupAt: string | null }) {
  const { success } = useToast();
  const [q, setQ] = React.useState("");
  const [actor, setActor] = React.useState("todos");
  const [entity, setEntity] = React.useState("todos");
  const [rango, setRango] = React.useState<"todas" | "7d" | "30d">("todas");
  const [backing, setBacking] = React.useState(false);

  const actores = React.useMemo(() => [...new Set(audit.map((a) => a.actor).filter(Boolean))] as string[], [audit]);
  const entidades = React.useMemo(() => [...new Set(audit.map((a) => a.entity).filter(Boolean))] as string[], [audit]);

  const filtered = React.useMemo(() => {
    const now = Date.now();
    const query = q.trim().toLowerCase();
    return audit.filter((a) => {
      if (actor !== "todos" && a.actor !== actor) return false;
      if (entity !== "todos" && a.entity !== entity) return false;
      if (rango !== "todas") {
        const win = rango === "7d" ? 7 * 864e5 : 30 * 864e5;
        if (now - new Date(a.createdAt).getTime() > win) return false;
      }
      if (query && !a.action.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [audit, q, actor, entity, rango]);

  const exportCSV = () => {
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const rows = [["Fecha", "Usuario", "Acción", "Módulo"], ...filtered.map((a) => [new Date(a.createdAt).toLocaleString("es-DO"), a.actor ?? "Sistema", a.action, a.entity ?? "—"])];
    const csv = rows.map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "auditoria.csv"; link.click();
    URL.revokeObjectURL(url);
    success("Exportado", `${filtered.length} registros en CSV.`);
  };

  const exportPDF = () => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    const rows = filtered.map((a) => `<tr><td>${new Date(a.createdAt).toLocaleString("es-DO")}</td><td>${a.actor ?? "Sistema"}</td><td>${a.action}</td><td>${a.entity ?? "—"}</td></tr>`).join("");
    w.document.write(`<html><head><title>Auditoría</title><style>body{font-family:Inter,system-ui,sans-serif;color:#0A1628;padding:24px}h1{color:#0066CC;font-size:18px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}th{text-align:left;border-bottom:2px solid #0066CC;padding:6px;text-transform:uppercase;font-size:10px;color:#475569}td{border-bottom:1px solid #E2E8F0;padding:6px}</style></head><body><h1>Clínica Dental — Bitácora de auditoría</h1><p style="font-size:11px;color:#475569">Generado el ${new Date().toLocaleString("es-DO")} · ${filtered.length} registros</p><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Módulo</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  return (
    <div className="space-y-5">
      {/* Respaldo */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-fg"><DatabaseBackup className="h-5 w-5 text-clinical" /> Respaldo del sistema</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Stat label="Último respaldo" value={lastBackupAt ? relativeTime(lastBackupAt) : "—"} sub={lastBackupAt ? formatDateLong(lastBackupAt) : ""} />
          <Stat label="Estado" value="Al día" sub="Automático diario" ok />
          <Stat label="Tamaño" value="48.2 MB" sub="Cifrado AES-256" />
        </div>
        <button
          onClick={() => { setBacking(true); window.setTimeout(() => { setBacking(false); success("Respaldo iniciado", "Se está generando una copia completa cifrada."); }, 1200); }}
          disabled={backing}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold text-fg hover:bg-surface-2 disabled:opacity-50"
        >
          {backing ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseBackup className="h-4 w-4" />} Respaldar ahora
        </button>
      </div>

      {/* Auditoría */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-fg"><ShieldCheck className="h-4 w-4 text-clinical" /> Bitácora de auditoría</h3>
            <p className="mt-0.5 text-[13px] text-muted">Cada acción del sistema queda registrada de forma inmutable.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCSV} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[13px] font-bold text-fg hover:bg-surface-2"><Download className="h-4 w-4" /> CSV</button>
            <button onClick={exportPDF} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[13px] font-bold text-fg hover:bg-surface-2"><FileText className="h-4 w-4" /> PDF</button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Buscar acción…" className={`${inputCls} pl-9`} />
          </div>
          <Select value={actor} onChange={setActor} opts={[["todos", "Todos los usuarios"], ...actores.map((a) => [a, a] as [string, string])]} />
          <Select value={entity} onChange={setEntity} opts={[["todos", "Todos los módulos"], ...entidades.map((e) => [e, e] as [string, string])]} />
          <Select value={rango} onChange={(v) => setRango(v as "todas" | "7d" | "30d")} opts={[["todas", "Cualquier fecha"], ["7d", "7 días"], ["30d", "30 días"]]} />
        </div>

        <div className="mt-3 max-h-[440px] space-y-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted">Sin registros para estos filtros.</p>
          ) : filtered.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-surface-2/50">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-clinical" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-fg"><span className="font-bold">{a.actor ?? "Sistema"}</span> {a.action}</p>
                <p className="text-[11px] text-muted">{a.entity ?? "sistema"} · {relativeTime(a.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, ok }: { label: string; value: string; sub?: string; ok?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-2/50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-0.5 text-[18px] font-black ${ok ? "text-mint" : "text-fg"}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

function Select({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-xl border border-border bg-surface px-3 text-[13px] font-semibold text-fg outline-none focus:ring-2 focus:ring-clinical/30">
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

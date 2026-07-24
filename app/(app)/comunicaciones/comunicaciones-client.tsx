"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Send,
  CalendarClock,
  History,
  FileText,
  SlidersHorizontal,
  BarChart3,
  Ban,
  Loader2,
  Search,
  ArrowRight,
  UserX,
  UserCheck,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { KPICard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatRD, relativeTime, initials, cn } from "@/lib/utils";
import { dispatchMessage } from "@/lib/comm-sender";
import type {
  QueueItem,
  HistoryItem,
  MessageTemplate,
  CommStats,
  ImpactMetrics,
} from "@/lib/communications";
import {
  ESTADO_MENSAJE,
  CANAL,
  TIPO_MENSAJE,
  VARIABLES_DISPONIBLES,
  type Canal,
  type MensajeEstado,
} from "./estado-config";
import { ImpactPanel } from "./impact-panel";
import {
  markMessageSent,
  markManySent,
  cancelMessage,
  saveTemplate,
  setOptOut,
  clearOptOut,
} from "./actions";

type Tab = "hoy" | "programados" | "historial" | "plantillas" | "preferencias" | "impacto";
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "hoy", label: "Cola de hoy", icon: Send },
  { id: "programados", label: "Programados", icon: CalendarClock },
  { id: "historial", label: "Historial", icon: History },
  { id: "plantillas", label: "Plantillas", icon: FileText },
  { id: "preferencias", label: "Preferencias", icon: SlidersHorizontal },
  { id: "impacto", label: "Impacto", icon: BarChart3 },
];

interface PatientBasic {
  id: string;
  nombre: string;
  telefono: string | null;
}

export function ComunicacionesClient({
  queue,
  upcoming,
  history,
  templates,
  stats,
  impact,
  patients,
  isOwner,
}: {
  queue: QueueItem[];
  upcoming: QueueItem[];
  history: HistoryItem[];
  templates: MessageTemplate[];
  stats: CommStats;
  impact: ImpactMetrics;
  patients: PatientBasic[];
  isOwner: boolean;
}) {
  const [tab, setTab] = React.useState<Tab>("hoy");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-fg">Comunicaciones</h1>
        <p className="mt-0.5 text-sm text-muted">
          Recordatorios automáticos que reducen el no-show y llenan el sillón.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KPICard label="Por enviar hoy" value={stats.pendientesHoy} icon={Send} accent="clinical" />
        <KPICard label="Programados" value={stats.programados} icon={CalendarClock} accent="mint" />
        <KPICard label="Enviados este mes" value={stats.enviadosMes} icon={MessageSquare} accent="amber" />
        <KPICard label="Tasa de respuesta" value={stats.tasaRespuesta} suffix="%" icon={BarChart3} accent="gold" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1 dark:bg-surface/60">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors",
                active ? "text-white" : "text-muted hover:text-fg",
              )}
            >
              {active && (
                <motion.span
                  layoutId="comm-tab"
                  className="absolute inset-0 rounded-lg bg-clinical"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                <t.icon className="h-4 w-4" />
                {t.label}
                {t.id === "hoy" && queue.length > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] font-bold",
                      active ? "bg-white/25" : "bg-clinical/10 text-clinical",
                    )}
                  >
                    {queue.length}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "hoy" && <QueueTab items={queue} today />}
          {tab === "programados" && <QueueTab items={upcoming} />}
          {tab === "historial" && <HistoryTab rows={history} />}
          {tab === "plantillas" && <TemplatesTab templates={templates} canEdit={isOwner} />}
          {tab === "preferencias" && (
            <PrefsTab templates={templates} patients={patients} canEditTemplates={isOwner} />
          )}
          {tab === "impacto" && <ImpactPanel m={impact} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ─── Cola de hoy / programados ─── */
function QueueTab({ items, today }: { items: QueueItem[]; today?: boolean }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [bulk, setBulk] = React.useState(false);

  const send = async (it: QueueItem) => {
    setBusy(it.id);
    const res = dispatchMessage({ canal: it.canal, destinatario: it.destinatario, cuerpo: it.cuerpo });
    if (res.ok && res.url) window.open(res.url, "_blank", "noopener");
    const marked = await markMessageSent(it.id);
    setBusy(null);
    if (marked.ok) {
      success("Mensaje despachado", "Se registró en la bitácora.");
      router.refresh();
    } else error("No se pudo registrar", marked.error);
  };

  const sendAll = async () => {
    if (items.length === 0) return;
    setBulk(true);
    // Abre cada conversación en secuencia (el navegador puede limitar los pop-ups).
    for (const it of items) {
      const res = dispatchMessage({ canal: it.canal, destinatario: it.destinatario, cuerpo: it.cuerpo });
      if (res.ok && res.url) window.open(res.url, "_blank", "noopener");
    }
    const r = await markManySent(items.map((i) => i.id));
    setBulk(false);
    if (r.ok) {
      success(`${r.enviados} mensajes despachados`, "La recepción despachó la cola completa.");
      router.refresh();
    } else error("No se pudo completar", r.error);
  };

  const cancel = async (id: string) => {
    setBusy(id);
    const r = await cancelMessage(id);
    setBusy(null);
    if (r.ok) {
      success("Mensaje cancelado");
      router.refresh();
    } else error("No se pudo cancelar", r.error);
  };

  if (items.length === 0)
    return (
      <div className="rounded-2xl border border-border bg-surface">
        <EmptyState
          icon={today ? Send : CalendarClock}
          title={today ? "Nada por enviar hoy" : "Sin mensajes programados"}
          description={
            today
              ? "Cuando se agende una cita, sus recordatorios aparecerán aquí automáticamente."
              : "Los recordatorios de los próximos días aparecerán aquí."
          }
        />
      </div>
    );

  return (
    <div className="space-y-3">
      {today && (
        <div className="flex items-center justify-between rounded-xl border border-clinical/20 bg-clinical/5 px-4 py-3">
          <p className="text-sm text-fg">
            <span className="font-bold">{items.length}</span> mensaje
            {items.length === 1 ? "" : "s"} listo{items.length === 1 ? "" : "s"} para despachar.
          </p>
          <Button size="sm" icon={Send} onClick={sendAll} loading={bulk}>
            Enviar todos
          </Button>
        </div>
      )}
      <ul className="space-y-2.5">
        {items.map((it) => (
          <QueueRow
            key={it.id}
            it={it}
            busy={busy === it.id}
            onSend={() => send(it)}
            onCancel={() => cancel(it.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function QueueRow({
  it,
  busy,
  onSend,
  onCancel,
}: {
  it: QueueItem;
  busy: boolean;
  onSend: () => void;
  onCancel: () => void;
}) {
  const canal = CANAL[it.canal];
  const CanalIcon = canal.icon;
  return (
    <li className="rounded-2xl border border-border bg-surface p-4 shadow-card dark:bg-surface/80">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clinical/10 text-xs font-bold text-clinical">
          {initials(it.paciente)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-bold text-fg">{it.paciente}</span>
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", canal.chip)}>
              <CanalIcon className="h-3 w-3" />
              {canal.label}
            </span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">
              {TIPO_MENSAJE[it.tipo] ?? it.tipo}
            </span>
          </div>
          <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm text-muted">{it.cuerpo}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3">
        <button
          onClick={onCancel}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"
        >
          <Ban className="h-3.5 w-3.5" />
          Cancelar
        </button>
        <Button size="sm" icon={busy ? undefined : Send} onClick={onSend} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
        </Button>
      </div>
    </li>
  );
}

/* ─── Historial ─── */
function HistoryTab({ rows }: { rows: HistoryItem[] }) {
  const [q, setQ] = React.useState("");
  const [canal, setCanal] = React.useState<Canal | "todos">("todos");
  const [page, setPage] = React.useState(1);
  const PER = 15;

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (canal === "todos" || r.canal === canal) &&
        (!term || r.paciente.toLowerCase().includes(term) || r.cuerpo.toLowerCase().includes(term)),
    );
  }, [rows, q, canal]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER));
  const pageRows = filtered.slice((page - 1) * PER, page * PER);
  React.useEffect(() => setPage(1), [q, canal]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por paciente o texto…"
            className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm text-fg outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/20"
          />
        </div>
        <select
          value={canal}
          onChange={(e) => setCanal(e.target.value as Canal | "todos")}
          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-fg outline-none focus:border-clinical"
        >
          <option value="todos">Todos los canales</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS</option>
          <option value="email">Correo</option>
        </select>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted">
        <ShieldCheck className="h-3.5 w-3.5 text-mint" />
        Registro permanente e inmutable — el respaldo legal de la clínica.
      </div>

      {pageRows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface">
          <EmptyState icon={History} title="Sin resultados" description="Ajusta la búsqueda o el filtro." />
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface dark:bg-surface/80">
          {pageRows.map((r) => {
            const canalCfg = CANAL[r.canal as Canal];
            const entrante = r.direccion === "entrante";
            return (
              <li key={r.id} className="flex items-start gap-3 p-3.5">
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    entrante ? "bg-mint/10 text-mint" : "bg-surface-2 text-muted",
                  )}
                >
                  {entrante ? <ArrowRight className="h-3.5 w-3.5 rotate-180" /> : initials(r.paciente)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-semibold text-fg">{r.paciente}</span>
                    {canalCfg && (
                      <span className="text-[11px] font-semibold text-muted">· {canalCfg.label}</span>
                    )}
                    {entrante && (
                      <span className="rounded-full bg-mint/10 px-1.5 text-[10px] font-bold text-mint">
                        respuesta
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-sm text-muted">{r.cuerpo}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted">{relativeTime(r.created_at)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted tabular">
            {page} / {pageCount}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─── Plantillas ─── */
const SAMPLE: Record<string, string> = {
  paciente: "María Altagracia Peña",
  primer_nombre: "María",
  fecha: "24 de julio de 2026",
  hora: "10:30 AM",
  "odontólogo": "Dra. Carolina Espaillat",
  tratamiento: "Limpieza dental",
  "clínica": "Clínica Dental",
  "teléfono_clínica": "809-555-0100",
  "dirección": "Av. Winston Churchill #90, Santo Domingo",
  monto: "RD$ 4,500.00",
  consultorio: "Consultorio 2",
};

function renderPreview(body: string): string {
  let out = body;
  for (const [k, v] of Object.entries(SAMPLE)) out = out.split(`{${k}}`).join(v);
  return out;
}

function TemplatesTab({ templates, canEdit }: { templates: MessageTemplate[]; canEdit: boolean }) {
  const [editing, setEditing] = React.useState<MessageTemplate | null>(null);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {templates.map((t) => {
        const canalCfg = CANAL[t.canal];
        const CanalIcon = canalCfg.icon;
        return (
          <button
            key={t.id}
            onClick={() => setEditing(t)}
            className="flex flex-col rounded-2xl border border-border bg-surface p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover dark:bg-surface/80"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-fg">{t.nombre}</span>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", canalCfg.chip)}>
                <CanalIcon className="h-3 w-3" />
                {canalCfg.label}
              </span>
            </div>
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-muted">{t.cuerpo}</p>
            {!t.activa && (
              <span className="mt-2 w-fit rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">
                Desactivada
              </span>
            )}
          </button>
        );
      })}
      {editing && (
        <TemplateEditor template={editing} canEdit={canEdit} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function TemplateEditor({
  template,
  canEdit,
  onClose,
}: {
  template: MessageTemplate;
  canEdit: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [cuerpo, setCuerpo] = React.useState(template.cuerpo);
  const [saving, setSaving] = React.useState(false);
  const max = CANAL[template.canal].max;

  const unknown = React.useMemo(() => {
    const known = new Set<string>(VARIABLES_DISPONIBLES);
    const found = cuerpo.match(/\{([^{}]+)\}/g) ?? [];
    return found.map((f) => f.slice(1, -1).trim()).filter((v) => !known.has(v));
  }, [cuerpo]);

  const save = async () => {
    if (unknown.length > 0) return error("Variables inválidas", unknown.map((u) => `{${u}}`).join(", "));
    setSaving(true);
    const res = await saveTemplate(template.id, { cuerpo });
    setSaving(false);
    if (res.ok) {
      success("Plantilla guardada");
      onClose();
      router.refresh();
    } else error("No se pudo guardar", res.error);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={template.nombre}
      description={canEdit ? "Edita el mensaje. La vista previa usa datos reales de ejemplo." : "Solo el administrador puede editar plantillas."}
      className="max-w-xl"
      footer={
        canEdit ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cerrar
            </Button>
            <Button onClick={save} loading={saving} disabled={unknown.length > 0}>
              Guardar
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold text-muted">Mensaje</label>
            <span className={cn("text-[11px] tabular", cuerpo.length > max ? "text-danger" : "text-muted")}>
              {cuerpo.length}/{max}
            </span>
          </div>
          <textarea
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            readOnly={!canEdit}
            rows={5}
            className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-fg outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/20 read-only:opacity-70"
          />
          {unknown.length > 0 && (
            <p className="mt-1 text-xs font-semibold text-danger">
              Variables no válidas: {unknown.map((u) => `{${u}}`).join(", ")}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {template.variables_disponibles.map((v) => (
            <span key={v} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-muted">
              {`{${v}}`}
            </span>
          ))}
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-muted">Vista previa</p>
          <div className="rounded-xl border border-[#25D366]/30 bg-[#25D366]/5 p-3">
            <p className="whitespace-pre-wrap text-sm text-fg">{renderPreview(cuerpo)}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Preferencias: automatizaciones + opt-out ─── */
function PrefsTab({
  templates,
  patients,
  canEditTemplates,
}: {
  templates: MessageTemplate[];
  patients: PatientBasic[];
  canEditTemplates: boolean;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);

  const toggle = async (t: MessageTemplate) => {
    if (!canEditTemplates) return error("Sin permiso", "Solo el administrador cambia automatizaciones.");
    setBusy(t.id);
    const res = await saveTemplate(t.id, { activa: !t.activa });
    setBusy(null);
    if (res.ok) {
      success(t.activa ? "Automatización desactivada" : "Automatización activada");
      router.refresh();
    } else error("No se pudo cambiar", res.error);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-sm font-bold text-fg">Automatizaciones</h3>
        <p className="mb-3 text-xs text-muted">
          Qué mensajes se programan solos. Desactiva los que no quieras enviar.
        </p>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface dark:bg-surface/80">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg">{t.nombre}</p>
                <p className="truncate text-xs text-muted">{CANAL[t.canal].label}</p>
              </div>
              <button
                onClick={() => toggle(t)}
                disabled={busy === t.id || !canEditTemplates}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
                  t.activa ? "bg-mint" : "bg-surface-2",
                )}
                aria-label={t.activa ? "Desactivar" : "Activar"}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                    t.activa ? "translate-x-[22px]" : "translate-x-0.5",
                  )}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <OptOutManager patients={patients} />
    </div>
  );
}

function OptOutManager({ patients }: { patients: PatientBasic[] }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState<PatientBasic | null>(null);
  const [motivo, setMotivo] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return patients.filter((p) => p.nombre.toLowerCase().includes(term)).slice(0, 6);
  }, [patients, q]);

  const doOptOut = async () => {
    if (!sel) return;
    setBusy(true);
    const res = await setOptOut(sel.id, motivo);
    setBusy(false);
    if (res.ok) {
      success("Opt-out registrado", `${sel.nombre} no recibirá mensajes.`);
      setSel(null);
      setMotivo("");
      setQ("");
      router.refresh();
    } else error("No se pudo registrar", res.error);
  };

  const doClear = async () => {
    if (!sel) return;
    setBusy(true);
    const res = await clearOptOut(sel.id);
    setBusy(false);
    if (res.ok) {
      success("Comunicaciones reactivadas", `${sel.nombre} vuelve a recibir mensajes.`);
      setSel(null);
      setQ("");
      router.refresh();
    } else error("No se pudo reactivar", res.error);
  };

  return (
    <div>
      <h3 className="mb-1 text-sm font-bold text-fg">Consentimiento del paciente (opt-out)</h3>
      <p className="mb-3 text-xs text-muted">
        El opt-out se respeta a nivel de base de datos: el sistema no puede programarle un mensaje.
      </p>
      <div className="rounded-2xl border border-border bg-surface p-4 dark:bg-surface/80">
        {!sel ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar paciente…"
              className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm text-fg outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/20"
            />
            {filtered.length > 0 && (
              <div className="mt-2 space-y-1">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSel(p)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-fg transition-colors hover:bg-surface-2"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold text-muted">
                      {initials(p.nombre)}
                    </span>
                    {p.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-clinical/10 text-xs font-bold text-clinical">
                {initials(sel.nombre)}
              </span>
              <span className="text-sm font-semibold text-fg">{sel.nombre}</span>
              <button onClick={() => setSel(null)} className="ml-auto text-xs font-semibold text-muted hover:text-fg">
                Cambiar
              </button>
            </div>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo del opt-out (opcional)"
              className="h-10 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-fg outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/20"
            />
            <div className="flex gap-2">
              <Button variant="danger" icon={UserX} onClick={doOptOut} loading={busy} className="flex-1">
                Registrar opt-out
              </Button>
              <Button variant="secondary" icon={UserCheck} onClick={doClear} loading={busy}>
                Reactivar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

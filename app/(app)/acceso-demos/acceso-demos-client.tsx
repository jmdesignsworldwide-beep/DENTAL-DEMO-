"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  KeyRound,
  Plus,
  RefreshCw,
  Trash2,
  CalendarPlus,
  Copy,
  Check,
  Users,
  CircleCheck,
  CircleSlash,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { KPICard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatDateLong, relativeTime, cn } from "@/lib/utils";
import type { DemoAccount, DemoEstado } from "@/lib/demos";
import {
  createDemoAccount,
  revokeDemoAccount,
  extendDemoAccount,
  reseedDemoData,
} from "./actions";

const ESTADO: Record<DemoEstado, { label: string; chip: string }> = {
  activa: { label: "Activa", chip: "bg-mint/10 text-mint ring-mint/30" },
  expirada: { label: "Expirada", chip: "bg-amber/10 text-amber ring-amber/30" },
  revocada: { label: "Revocada", chip: "bg-surface-2 text-muted ring-border" },
};

function genPassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 3; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `demo-${out}${Math.floor(10 + Math.random() * 89)}`;
}

export function AccesoDemosClient({ cuentas }: { cuentas: DemoAccount[] }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [openNew, setOpenNew] = React.useState(false);
  const [openReseed, setOpenReseed] = React.useState(false);
  const [reseeding, setReseeding] = React.useState(false);
  const [creds, setCreds] = React.useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const activas = cuentas.filter((c) => c.estado === "activa").length;
  const expiradas = cuentas.filter((c) => c.estado !== "activa").length;

  const doRevoke = async (id: string) => {
    setBusy(id);
    const r = await revokeDemoAccount(id);
    setBusy(null);
    if (r.ok) { success("Cuenta revocada", "El acceso quedó bloqueado al instante."); router.refresh(); }
    else error("No se pudo revocar", r.error);
  };
  const doExtend = async (id: string, dias: number) => {
    setBusy(id);
    const r = await extendDemoAccount(id, dias);
    setBusy(null);
    if (r.ok) { success(`Vigencia extendida +${dias} días`); router.refresh(); }
    else error("No se pudo extender", r.error);
  };
  const doReseed = async () => {
    setReseeding(true);
    const r = await reseedDemoData();
    setReseeding(false);
    setOpenReseed(false);
    if (r.ok) { success("Datos resembrados", "El próximo prospecto verá el demo limpio."); router.refresh(); }
    else error("No se pudo resembrar", r.error);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-fg">
            <KeyRound className="h-6 w-6 text-clinical" />
            Acceso Demos
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            Cuentas temporales para prospectos. Ven todo el sistema; no tocan configuración ni este panel.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={RefreshCw} onClick={() => setOpenReseed(true)}>
            Resembrar datos
          </Button>
          <Button icon={Plus} onClick={() => setOpenNew(true)}>
            Nueva cuenta
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <KPICard label="Cuentas demo" value={cuentas.length} icon={Users} accent="clinical" />
        <KPICard label="Activas" value={activas} icon={CircleCheck} accent="mint" />
        <KPICard label="Expiradas / revocadas" value={expiradas} icon={CircleSlash} accent="amber" />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted">
        <ShieldCheck className="h-3.5 w-3.5 text-mint" />
        La expiración se valida en la base de datos: una cuenta vencida no puede consultar nada, ni por API.
      </div>

      {cuentas.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface">
          <EmptyState
            icon={KeyRound}
            title="Aún no hay cuentas demo"
            description="Crea una cuenta con vigencia para entregarle el demo a un prospecto."
            action={<Button icon={Plus} onClick={() => setOpenNew(true)}>Nueva cuenta</Button>}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface dark:bg-surface/80">
          <ul className="divide-y divide-border">
            {cuentas.map((c, i) => (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.2) }}
                className="flex flex-wrap items-center gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-fg">{c.usuario}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset", ESTADO[c.estado].chip)}>
                      {ESTADO[c.estado].label}
                    </span>
                    {c.estado === "activa" && c.dias_restantes !== null && (
                      <span className={cn("text-xs font-semibold tabular", c.dias_restantes <= 2 ? "text-danger" : "text-muted")}>
                        {c.dias_restantes} día{c.dias_restantes === 1 ? "" : "s"} restante{c.dias_restantes === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                    <span>Creada {c.created_at ? formatDateLong(c.created_at) : "—"}</span>
                    <span>Vence {c.expira_at ? formatDateLong(c.expira_at) : "—"}</span>
                    <span>Último acceso: {c.ultimo_acceso ? relativeTime(c.ultimo_acceso) : "nunca"}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {c.estado !== "revocada" && (
                    <>
                      <button
                        onClick={() => doExtend(c.id, 7)}
                        disabled={busy === c.id}
                        title="Extender 7 días"
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-clinical transition-colors hover:bg-clinical/10 disabled:opacity-40"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        +7d
                      </button>
                      <button
                        onClick={() => doExtend(c.id, 30)}
                        disabled={busy === c.id}
                        title="Extender 30 días"
                        className="inline-flex items-center rounded-lg px-2 py-1.5 text-xs font-semibold text-clinical transition-colors hover:bg-clinical/10 disabled:opacity-40"
                      >
                        +30d
                      </button>
                    </>
                  )}
                  {c.activo && (
                    <button
                      onClick={() => doRevoke(c.id)}
                      disabled={busy === c.id}
                      title="Revocar acceso"
                      className="inline-flex items-center rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      )}

      <NewDemoModal
        open={openNew}
        onClose={() => setOpenNew(false)}
        onCreated={(email, password) => {
          setOpenNew(false);
          setCreds({ email, password });
          router.refresh();
        }}
        onError={(m) => error("No se pudo crear", m)}
      />

      {/* Credenciales recién creadas */}
      <Modal
        open={!!creds}
        onClose={() => setCreds(null)}
        title="Cuenta demo creada"
        description="Entrégale estas credenciales al prospecto. La contraseña no se vuelve a mostrar."
        footer={<Button onClick={() => setCreds(null)} className="w-full">Entendido</Button>}
      >
        {creds && (
          <div className="space-y-3">
            <CopyRow label="Usuario" value={creds.email} />
            <CopyRow label="Contraseña" value={creds.password} />
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Sparkles className="h-3.5 w-3.5 text-clinical" />
              El prospecto entra en la página de login con estas credenciales.
            </p>
          </div>
        )}
      </Modal>

      {/* Confirmar reseed */}
      <Modal
        open={openReseed}
        onClose={() => setOpenReseed(false)}
        title="Resembrar datos del demo"
        description="Restaura pacientes, citas, facturas, presupuestos y mensajes a su estado original limpio. Lo que haya modificado un prospecto se pierde. La configuración y las cuentas no se tocan."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpenReseed(false)} disabled={reseeding}>Cancelar</Button>
            <Button variant="danger" icon={RefreshCw} onClick={doReseed} loading={reseeding}>Resembrar ahora</Button>
          </div>
        }
      >
        <p className="text-sm text-muted">Ideal antes de entregarle el demo a un nuevo prospecto.</p>
      </Modal>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted">{label}</label>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-fg">{value}</span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-clinical hover:bg-clinical/10"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

function NewDemoModal({
  open,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (email: string, password: string) => void;
  onError: (m: string) => void;
}) {
  const [usuario, setUsuario] = React.useState("");
  const [password, setPassword] = React.useState(genPassword());
  const [modo, setModo] = React.useState<"dias" | "fecha">("dias");
  const [dias, setDias] = React.useState(15);
  const [fecha, setFecha] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const reset = () => {
    setUsuario("");
    setPassword(genPassword());
    setModo("dias");
    setDias(15);
    setFecha("");
  };

  const submit = async () => {
    if (usuario.trim().length < 3) return onError("El usuario debe tener al menos 3 caracteres.");
    setSaving(true);
    const res = await createDemoAccount({
      usuario,
      password,
      ...(modo === "dias" ? { dias } : { fecha }),
    });
    setSaving(false);
    if (res.ok && res.email) {
      const pw = password;
      reset();
      onCreated(res.email, pw);
    } else onError(res.error ?? "Error");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva cuenta demo"
      description="Define usuario, contraseña y vigencia. El acceso muere solo al vencer."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} loading={saving}>Crear cuenta</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-fg">Usuario</label>
          <div className="flex items-center rounded-xl border border-border bg-surface focus-within:border-clinical focus-within:ring-2 focus-within:ring-clinical/20">
            <input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="prospecto1"
              className="h-11 min-w-0 flex-1 rounded-l-xl bg-transparent px-3.5 text-sm text-fg outline-none"
            />
            <span className="px-3 text-sm text-muted">@demo.local</span>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-fg">Contraseña</label>
          <div className="flex gap-2">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 font-mono text-sm text-fg outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/20"
            />
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => setPassword(genPassword())}>
              Generar
            </Button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-fg">Vigencia</label>
          <div className="flex flex-wrap gap-2">
            {[7, 15, 30].map((d) => (
              <button
                key={d}
                onClick={() => { setModo("dias"); setDias(d); }}
                className={cn(
                  "rounded-xl px-3.5 py-2 text-sm font-semibold ring-1 ring-inset transition-colors",
                  modo === "dias" && dias === d ? "bg-clinical text-white ring-clinical" : "bg-surface text-muted ring-border hover:text-fg",
                )}
              >
                {d} días
              </button>
            ))}
            <input
              type="date"
              value={fecha}
              onChange={(e) => { setFecha(e.target.value); setModo("fecha"); }}
              className={cn(
                "h-10 rounded-xl border bg-surface px-3 text-sm text-fg outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/20",
                modo === "fecha" ? "border-clinical" : "border-border",
              )}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

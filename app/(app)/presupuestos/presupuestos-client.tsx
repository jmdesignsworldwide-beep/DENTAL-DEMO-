"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  FileSpreadsheet,
  Search,
  Plus,
  Wallet,
  Percent,
  Send,
  CheckCircle2,
  User,
  Stethoscope,
  ChevronRight,
  AlertCircle,
  Clock,
} from "lucide-react";
import { KPICard } from "@/components/ui/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatRD, formatDateLong, initials, cn } from "@/lib/utils";
import type { BudgetListItem, BudgetKPIs } from "@/lib/budgets";
import {
  ESTADO_PRESUPUESTO,
  ESTADOS_ORDEN,
  type BudgetEstado,
} from "./estado-config";
import { createBudget } from "./actions";

interface PatientBasic {
  id: string;
  nombre: string;
  telefono: string | null;
}

interface Props {
  rows: BudgetListItem[];
  total: number;
  page: number;
  pageCount: number;
  kpis: BudgetKPIs;
  q: string;
  estado: BudgetEstado | "todos";
  patients: PatientBasic[];
  canCreate: boolean;
}

export function PresupuestosClient({
  rows,
  total,
  page,
  pageCount,
  kpis,
  q,
  estado,
  patients,
  canCreate,
}: Props) {
  const router = useRouter();
  const { success, error } = useToast();
  const [search, setSearch] = React.useState(q);
  const [openNew, setOpenNew] = React.useState(false);

  const pushQuery = React.useCallback(
    (next: { q?: string; estado?: string; page?: number }) => {
      const params = new URLSearchParams();
      const nq = next.q ?? search;
      const ne = next.estado ?? estado;
      if (nq) params.set("q", nq);
      if (ne && ne !== "todos") params.set("estado", ne);
      if (next.page && next.page > 1) params.set("page", String(next.page));
      router.push(`/presupuestos${params.toString() ? `?${params}` : ""}`);
    },
    [router, search, estado],
  );

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    pushQuery({ q: search, page: 1 });
  };

  const pendientes = rows.filter((r) => r.estado === "presentado");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-fg">Presupuestos</h1>
          <p className="mt-0.5 text-sm text-muted">
            Planes de tratamiento que cierran ventas · {total} en total
          </p>
        </div>
        {canCreate && (
          <Button icon={Plus} onClick={() => setOpenNew(true)}>
            Nuevo presupuesto
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KPICard
          label="En presupuestos pendientes"
          value={kpis.montoPendiente}
          icon={Wallet}
          prefix="RD$ "
          accent="gold"
        />
        <KPICard
          label="Tasa de aceptación"
          value={kpis.tasaAceptacion}
          icon={Percent}
          suffix="%"
          accent="mint"
        />
        <KPICard
          label="Esperando respuesta"
          value={kpis.pendientesCount}
          icon={Send}
          accent="clinical"
        />
        <KPICard
          label="Aceptados"
          value={kpis.aceptadosCount}
          icon={CheckCircle2}
          accent="amber"
        />
      </div>

      {/* Panel de seguimiento (innovación: countdown de vencimiento) */}
      {pendientes.length > 0 && (
        <div className="rounded-2xl border border-clinical/20 bg-clinical/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-clinical/10 text-clinical">
              <Clock className="h-[18px] w-[18px]" />
            </span>
            <h2 className="text-sm font-bold text-fg">Seguimiento — esperando decisión</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {pendientes.map((r) => {
              const dias = r.expira_en;
              const urgente = dias !== null && dias <= 3;
              return (
                <Link
                  key={r.id}
                  href={`/presupuestos/${r.id}`}
                  className="group flex min-w-[220px] flex-1 items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3 transition-all hover:-translate-y-0.5 hover:shadow-card"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-fg">{r.paciente}</p>
                    <p className="truncate text-xs text-muted">{r.titulo}</p>
                    <p className="mt-1 text-sm font-bold tabular text-clinical">
                      {formatRD(r.total_estimado)}
                    </p>
                  </div>
                  {dias !== null && (
                    <span
                      className={cn(
                        "shrink-0 rounded-lg px-2 py-1 text-center text-[11px] font-bold ring-1 ring-inset",
                        urgente
                          ? "bg-danger/10 text-danger ring-danger/30"
                          : "bg-surface-2 text-muted ring-border",
                      )}
                    >
                      {dias < 0 ? "Venció" : dias === 0 ? "Vence hoy" : `${dias}d`}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="space-y-3">
        <form onSubmit={onSearchSubmit} className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título del plan…"
            className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-fg outline-none transition-colors placeholder:text-muted focus:border-clinical focus:ring-2 focus:ring-clinical/20"
          />
        </form>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="Todos"
            active={estado === "todos"}
            onClick={() => pushQuery({ estado: "todos", page: 1 })}
          />
          {ESTADOS_ORDEN.map((e) => {
            const cfg = ESTADO_PRESUPUESTO[e];
            return (
              <FilterChip
                key={e}
                label={cfg.label}
                active={estado === e}
                onClick={() => pushQuery({ estado: e, page: 1 })}
              />
            );
          })}
        </div>
      </div>

      {/* Lista */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface">
          <EmptyState
            icon={FileSpreadsheet}
            title="No hay presupuestos"
            description={
              q || estado !== "todos"
                ? "Ajusta los filtros para ver más resultados."
                : "Crea el primer plan de tratamiento para empezar a cerrar ventas."
            }
            action={
              canCreate && !q && estado === "todos" ? (
                <Button icon={Plus} onClick={() => setOpenNew(true)}>
                  Nuevo presupuesto
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r, i) => (
            <BudgetCard key={r.id} row={r} index={i} />
          ))}
        </div>
      )}

      {/* Paginación */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => pushQuery({ page: page - 1 })}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted tabular">
            {page} / {pageCount}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => pushQuery({ page: page + 1 })}
          >
            Siguiente
          </Button>
        </div>
      )}

      {canCreate && (
        <NewBudgetModal
          open={openNew}
          onClose={() => setOpenNew(false)}
          patients={patients}
          onCreated={(id) => {
            success("Presupuesto creado", "Agrégale los servicios del plan.");
            router.push(`/presupuestos/${id}`);
          }}
          onError={(m) => error("No se pudo crear", m)}
        />
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-[13px] font-semibold ring-1 ring-inset transition-colors",
        active
          ? "bg-clinical text-white ring-clinical"
          : "bg-surface text-muted ring-border hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}

function BudgetCard({ row, index }: { row: BudgetListItem; index: number }) {
  const cfg = ESTADO_PRESUPUESTO[row.estado];
  const Icon = cfg.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={`/presupuestos/${row.id}`}
        className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-card transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:shadow-card-hover dark:bg-surface/80"
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
              cfg.chip,
            )}
          >
            <Icon className="h-3 w-3" />
            {cfg.label}
          </span>
          {row.version > 1 && (
            <Badge variant="neutral" className="shrink-0">
              v{row.version}
            </Badge>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clinical/10 text-xs font-bold text-clinical">
            {initials(row.paciente)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-fg">{row.paciente}</p>
            <p className="truncate text-xs text-muted">{row.titulo}</p>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Total estimado
            </p>
            <p className="text-xl font-extrabold tabular text-fg">
              {formatRD(row.total_estimado)}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-clinical" />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Stethoscope className="h-3.5 w-3.5" />
            {row.items_count} servicio{row.items_count === 1 ? "" : "s"}
          </span>
          {row.odontologo && (
            <span className="inline-flex items-center gap-1 truncate">
              <User className="h-3.5 w-3.5" />
              {row.odontologo}
            </span>
          )}
          {row.estado === "presentado" && row.expira_en !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                row.expira_en <= 3 ? "font-bold text-danger" : "",
              )}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              {row.expira_en < 0
                ? "Vencido"
                : row.expira_en === 0
                  ? "Vence hoy"
                  : `Vence en ${row.expira_en}d`}
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

function NewBudgetModal({
  open,
  onClose,
  patients,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  patients: PatientBasic[];
  onCreated: (id: string) => void;
  onError: (m: string) => void;
}) {
  const [pacienteId, setPacienteId] = React.useState("");
  const [pacienteQuery, setPacienteQuery] = React.useState("");
  const [titulo, setTitulo] = React.useState("");
  const [diagnostico, setDiagnostico] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const filtered = React.useMemo(() => {
    const term = pacienteQuery.trim().toLowerCase();
    if (!term) return patients.slice(0, 8);
    return patients.filter((p) => p.nombre.toLowerCase().includes(term)).slice(0, 8);
  }, [patients, pacienteQuery]);

  const selected = patients.find((p) => p.id === pacienteId);

  const reset = () => {
    setPacienteId("");
    setPacienteQuery("");
    setTitulo("");
    setDiagnostico("");
  };

  const submit = async () => {
    if (!pacienteId) return onError("Selecciona un paciente.");
    setSaving(true);
    const res = await createBudget({
      patientId: pacienteId,
      titulo: titulo.trim() || "Plan de tratamiento",
      diagnostico: diagnostico.trim() || undefined,
    });
    setSaving(false);
    if (res.ok && res.id) {
      reset();
      onCreated(res.id);
    } else {
      onError(res.error ?? "Error desconocido.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo presupuesto"
      description="Selecciona el paciente y describe el plan. Luego agregas los servicios."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={saving} disabled={!pacienteId}>
            Crear y continuar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-fg">Paciente</label>
          {selected ? (
            <div className="flex items-center justify-between rounded-xl border border-clinical/30 bg-clinical/5 px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-clinical/10 text-[11px] font-bold text-clinical">
                  {initials(selected.nombre)}
                </span>
                {selected.nombre}
              </span>
              <button
                onClick={() => setPacienteId("")}
                className="text-xs font-semibold text-muted hover:text-danger"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <input
                value={pacienteQuery}
                onChange={(e) => setPacienteQuery(e.target.value)}
                placeholder="Buscar paciente por nombre…"
                className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-fg outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/20"
              />
              {filtered.length > 0 && (
                <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                  {filtered.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setPacienteId(p.id);
                        setPacienteQuery("");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-fg transition-colors hover:bg-surface-2"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold text-muted">
                        {initials(p.nombre)}
                      </span>
                      <span className="font-medium">{p.nombre}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-fg">Título del plan</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. Rehabilitación oral integral"
            className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-fg outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-fg">
            Diagnóstico general <span className="font-normal text-muted">(opcional)</span>
          </label>
          <textarea
            value={diagnostico}
            onChange={(e) => setDiagnostico(e.target.value)}
            rows={3}
            placeholder="Resumen clínico del caso…"
            className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-fg outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/20"
          />
        </div>
      </div>
    </Modal>
  );
}

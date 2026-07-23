"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Pencil,
  LayoutGrid,
  List,
  Clock,
  Power,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { useToast } from "@/components/ui/toast";
import { formatRD } from "@/lib/utils";
import type { Treatment } from "@/lib/treatments";
import { CATEGORIA, CATEGORIAS_ORDEN, type Categoria } from "./categoria-config";
import { TreatmentForm } from "./treatment-form";
import { setTreatmentActivo } from "./actions";
import { cn } from "@/lib/utils";

export function CatalogClient({
  treatments,
  canManage,
}: {
  treatments: Treatment[];
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [vista, setVista] = React.useState<"categoria" | "tabla">("categoria");
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState<Categoria | "todas">("todas");
  const [min, setMin] = React.useState("");
  const [max, setMax] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Treatment | null>(null);
  const [, start] = React.useTransition();

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    const mn = min ? parseFloat(min) : -Infinity;
    const mx = max ? parseFloat(max) : Infinity;
    return treatments.filter((t) => {
      if (s && !t.nombre.toLowerCase().includes(s)) return false;
      if (cat !== "todas" && t.categoria !== cat) return false;
      if (t.precio < mn || t.precio > mx) return false;
      return true;
    });
  }, [treatments, q, cat, min, max]);

  function toggleActivo(t: Treatment) {
    start(async () => {
      const res = await setTreatmentActivo(t.id, !t.activo);
      if (res.ok) {
        toast.success(t.activo ? "Desactivado" : "Activado", t.nombre);
        router.refresh();
      } else toast.error("Error", res.error);
    });
  }

  const abrirEdit = (t: Treatment) => {
    setEditing(t);
    setFormOpen(true);
  };
  const abrirNuevo = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const grupos = CATEGORIAS_ORDEN.map((c) => ({
    cat: c,
    items: filtered.filter((t) => t.categoria === c),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">Tratamientos</h1>
          <p className="text-sm text-muted">{treatments.length} servicios en el catálogo</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-border bg-surface p-0.5 dark:bg-surface/60">
            <button onClick={() => setVista("categoria")} className={cn("flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-semibold", vista === "categoria" ? "bg-clinical text-white" : "text-muted hover:text-fg")}>
              <LayoutGrid className="h-3.5 w-3.5" /> Categorías
            </button>
            <button onClick={() => setVista("tabla")} className={cn("flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-semibold", vista === "tabla" ? "bg-clinical text-white" : "text-muted hover:text-fg")}>
              <List className="h-3.5 w-3.5" /> Tabla
            </button>
          </div>
          {canManage && (
            <Button icon={Plus} onClick={abrirNuevo}>
              Nuevo
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tratamiento…" className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-fg dark:bg-navy-light" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value as Categoria | "todas")} className="h-10 rounded-xl border border-border bg-surface px-3 text-[13px] font-medium text-fg dark:bg-navy-light">
          <option value="todas">Todas las categorías</option>
          {CATEGORIAS_ORDEN.map((c) => (
            <option key={c} value={c}>{CATEGORIA[c].label}</option>
          ))}
        </select>
        <input type="number" value={min} onChange={(e) => setMin(e.target.value)} placeholder="Min RD$" className="h-10 w-24 rounded-xl border border-border bg-surface px-2.5 text-sm text-fg tabular dark:bg-navy-light" />
        <input type="number" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Max RD$" className="h-10 w-24 rounded-xl border border-border bg-surface px-2.5 text-sm text-fg tabular dark:bg-navy-light" />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface dark:bg-surface/80">
          <EmptyState icon={Stethoscope} title="Sin tratamientos" description="Ajusta los filtros o crea un nuevo tratamiento." action={canManage ? <Button icon={Plus} onClick={abrirNuevo}>Nuevo tratamiento</Button> : undefined} />
        </div>
      ) : vista === "categoria" ? (
        <div className="space-y-8">
          {grupos.map((g) => {
            const cfg = CATEGORIA[g.cat];
            const Icon = cfg.icon;
            return (
              <div key={g.cat}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${cfg.hex}1a`, color: cfg.hex }}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-fg">{cfg.label}</h2>
                  <span className="text-xs text-muted">({g.items.length})</span>
                </div>
                <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {g.items.map((t) => (
                    <StaggerItem key={t.id}>
                      <Card t={t} canManage={canManage} onEdit={abrirEdit} onToggle={toggleActivo} />
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface dark:bg-surface/80">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-muted dark:bg-navy-lighter/40">
                  <th className="px-4 py-3 text-left font-bold">Tratamiento</th>
                  <th className="hidden px-4 py-3 text-left font-bold sm:table-cell">Categoría</th>
                  <th className="hidden px-4 py-3 text-right font-bold md:table-cell">Duración</th>
                  <th className="px-4 py-3 text-right font-bold">Precio</th>
                  {canManage && <th className="px-4 py-3 text-right font-bold">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const cfg = CATEGORIA[t.categoria];
                  return (
                    <tr key={t.id} className={cn("border-b border-border/60 last:border-0", !t.activo && "opacity-50")}>
                      <td className="px-4 py-3 font-semibold text-fg">{t.nombre}</td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.chip}`}>{cfg.label}</span>
                      </td>
                      <td className="hidden px-4 py-3 text-right text-muted tabular md:table-cell">{t.duracion_min} min</td>
                      <td className="px-4 py-3 text-right font-bold text-fg tabular">{formatRD(t.precio)}</td>
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => abrirEdit(t)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => toggleActivo(t)} className={cn("rounded-lg p-1.5 hover:bg-surface-2", t.activo ? "text-mint" : "text-muted")}><Power className="h-4 w-4" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canManage && <TreatmentForm open={formOpen} onClose={() => setFormOpen(false)} treatment={editing} />}
    </div>
  );
}

function Card({
  t,
  canManage,
  onEdit,
  onToggle,
}: {
  t: Treatment;
  canManage: boolean;
  onEdit: (t: Treatment) => void;
  onToggle: (t: Treatment) => void;
}) {
  const cfg = CATEGORIA[t.categoria];
  const Icon = cfg.icon;
  return (
    <div className={cn("group flex h-full flex-col rounded-2xl border border-border bg-surface p-4 shadow-card transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:shadow-card-hover dark:bg-surface/80", !t.activo && "opacity-60")}>
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${cfg.hex}1a`, color: cfg.hex }}>
          <Icon className="h-5 w-5" />
        </span>
        {!t.activo && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">Inactivo</span>}
      </div>
      <h3 className="mt-3 text-sm font-bold text-fg">{t.nombre}</h3>
      {t.descripcion && <p className="mt-1 line-clamp-2 text-xs text-muted">{t.descripcion}</p>}
      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
        <span className="flex items-center gap-1 text-xs text-muted">
          <Clock className="h-3.5 w-3.5" /> {t.duracion_min} min
        </span>
        <span className="text-base font-extrabold text-clinical tabular">{formatRD(t.precio)}</span>
      </div>
      {canManage && (
        <div className="mt-3 flex gap-1.5">
          <Button size="sm" variant="secondary" icon={Pencil} className="flex-1" onClick={() => onEdit(t)}>
            Editar
          </Button>
          <Button size="sm" variant="ghost" icon={Power} className={t.activo ? "text-mint" : "text-muted"} onClick={() => onToggle(t)} aria-label="Activar/Desactivar" />
        </div>
      )}
    </div>
  );
}

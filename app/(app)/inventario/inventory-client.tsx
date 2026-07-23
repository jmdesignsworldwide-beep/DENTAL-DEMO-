"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Package,
  AlertTriangle,
  DollarSign,
  LayoutGrid,
  List,
  ArrowDownToLine,
  ArrowUpFromLine,
  Pencil,
  Truck,
  Stethoscope,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Field } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { useToast } from "@/components/ui/toast";
import { formatRD, formatDateLong } from "@/lib/utils";
import type { InventoryData, Material } from "@/lib/inventory";
import {
  MAT_CATEGORIA,
  MAT_CATEGORIAS_ORDEN,
  stockNivel,
  type MaterialCategoria,
} from "./categoria-config";
import { registerMovement, updateMaterial } from "./actions";
import { cn } from "@/lib/utils";

const NIVEL_STYLE = {
  critico: { bar: "bg-danger", text: "text-danger", row: "bg-danger/5" },
  bajo: { bar: "bg-amber", text: "text-amber", row: "bg-amber/5" },
  ok: { bar: "bg-mint", text: "text-mint", row: "" },
};

function StockBar({ actual, minimo }: { actual: number; minimo: number }) {
  const nivel = stockNivel(actual, minimo);
  const pct = Math.max(4, Math.min(100, (actual / Math.max(minimo * 2, 1)) * 100));
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold text-fg tabular">{actual}</span>
        <span className="text-muted tabular">mín {minimo}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2 dark:bg-navy-lighter">
        <div className={cn("h-full rounded-full transition-all", NIVEL_STYLE[nivel].bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function InventoryClient({
  data,
  canMove,
  canEdit,
}: {
  data: InventoryData;
  canMove: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = React.useTransition();
  const [vista, setVista] = React.useState<"tabla" | "cards">("tabla");
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState<MaterialCategoria | "todas">("todas");
  const [prov, setProv] = React.useState("todos");
  const [estado, setEstado] = React.useState<"todos" | "bajo">("todos");
  const [move, setMove] = React.useState<{ m: Material; tipo: "entrada" | "salida" } | null>(null);
  const [edit, setEdit] = React.useState<Material | null>(null);
  const [cantidad, setCantidad] = React.useState(1);
  const [motivo, setMotivo] = React.useState("");
  const [min, setMin] = React.useState(0);
  const [costo, setCosto] = React.useState(0);

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.materials
      .filter((m) => {
        if (s && !m.nombre.toLowerCase().includes(s)) return false;
        if (cat !== "todas" && m.categoria !== cat) return false;
        if (prov !== "todos" && m.proveedor_id !== prov) return false;
        if (estado === "bajo" && m.stock_actual > m.stock_minimo) return false;
        return true;
      })
      .sort((a, b) => {
        const rank = (m: Material) => ({ critico: 0, bajo: 1, ok: 2 }[stockNivel(m.stock_actual, m.stock_minimo)]);
        return rank(a) - rank(b) || a.nombre.localeCompare(b.nombre, "es");
      });
  }, [data.materials, q, cat, prov, estado]);

  function abrirMove(m: Material, tipo: "entrada" | "salida") {
    setMove({ m, tipo });
    setCantidad(1);
    setMotivo("");
  }
  function abrirEdit(m: Material) {
    setEdit(m);
    setMin(m.stock_minimo);
    setCosto(m.costo_unitario);
  }
  function doMove() {
    if (!move) return;
    start(async () => {
      const res = await registerMovement(move.m.id, move.tipo, cantidad, motivo);
      if (res.ok) {
        toast.success(move.tipo === "entrada" ? "Entrada registrada" : "Salida registrada", move.m.nombre);
        setMove(null);
        router.refresh();
      } else toast.error("Error", res.error);
    });
  }
  function doEdit() {
    if (!edit) return;
    start(async () => {
      const res = await updateMaterial(edit.id, min, costo);
      if (res.ok) {
        toast.success("Material actualizado", edit.nombre);
        setEdit(null);
        router.refresh();
      } else toast.error("Error", res.error);
    });
  }

  const maxConsumo = Math.max(1, ...data.consumoMes.map((c) => c.cantidad));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">Inventario</h1>
        <p className="text-sm text-muted">{data.materials.length} materiales en existencia</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi icon={Package} label="Materiales" value={String(data.materials.length)} accent="clinical" />
        <Kpi icon={AlertTriangle} label="Bajo mínimo" value={String(data.bajoMinimo)} accent="danger" />
        <Kpi icon={DollarSign} label="Valor de inventario" value={formatRD(data.valorTotal)} accent="gold" />
      </div>

      {/* Alerta de stock */}
      {data.bajoMinimo > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-amber/40 bg-amber/5 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber" />
          <p className="text-sm font-semibold text-fg">
            {data.bajoMinimo} material{data.bajoMinimo === 1 ? "" : "es"} bajo el stock mínimo.
          </p>
          <button onClick={() => setEstado("bajo")} className="ml-auto text-sm font-bold text-amber hover:underline">
            Ver
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar material…" className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-fg dark:bg-navy-light" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value as MaterialCategoria | "todas")} className="h-10 rounded-xl border border-border bg-surface px-3 text-[13px] font-medium text-fg dark:bg-navy-light">
          <option value="todas">Todas las categorías</option>
          {MAT_CATEGORIAS_ORDEN.map((c) => (<option key={c} value={c}>{MAT_CATEGORIA[c].label}</option>))}
        </select>
        <select value={prov} onChange={(e) => setProv(e.target.value)} className="h-10 rounded-xl border border-border bg-surface px-3 text-[13px] font-medium text-fg dark:bg-navy-light">
          <option value="todos">Todos los proveedores</option>
          {data.suppliers.map((s) => (<option key={s.id} value={s.id}>{s.nombre}</option>))}
        </select>
        <select value={estado} onChange={(e) => setEstado(e.target.value as "todos" | "bajo")} className="h-10 rounded-xl border border-border bg-surface px-3 text-[13px] font-medium text-fg dark:bg-navy-light">
          <option value="todos">Todo el stock</option>
          <option value="bajo">Solo bajo mínimo</option>
        </select>
        <div className="inline-flex rounded-xl border border-border bg-surface p-0.5 dark:bg-surface/60">
          <button onClick={() => setVista("tabla")} className={cn("rounded-lg px-2.5 py-1.5", vista === "tabla" ? "bg-clinical text-white" : "text-muted")}><List className="h-4 w-4" /></button>
          <button onClick={() => setVista("cards")} className={cn("rounded-lg px-2.5 py-1.5", vista === "cards" ? "bg-clinical text-white" : "text-muted")}><LayoutGrid className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface dark:bg-surface/80">
          <EmptyState icon={Package} title="Sin materiales" description="Ajusta los filtros." />
        </div>
      ) : vista === "tabla" ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface dark:bg-surface/80">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-muted dark:bg-navy-lighter/40">
                  <th className="px-4 py-3 text-left font-bold">Material</th>
                  <th className="hidden px-4 py-3 text-left font-bold lg:table-cell">Categoría</th>
                  <th className="px-4 py-3 text-left font-bold">Stock</th>
                  <th className="hidden px-4 py-3 text-right font-bold md:table-cell">Costo</th>
                  <th className="hidden px-4 py-3 text-left font-bold lg:table-cell">Proveedor</th>
                  {canMove && <th className="px-4 py-3 text-right font-bold">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const nivel = stockNivel(m.stock_actual, m.stock_minimo);
                  const cfg = MAT_CATEGORIA[m.categoria];
                  return (
                    <tr key={m.id} className={cn("border-b border-border/60 last:border-0", NIVEL_STYLE[nivel].row)}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-fg">{m.nombre}</p>
                        <p className="text-xs text-muted">{m.unidad}</p>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: cfg.hex }}>
                          <cfg.icon className="h-3.5 w-3.5" /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ minWidth: 140 }}><StockBar actual={m.stock_actual} minimo={m.stock_minimo} /></td>
                      <td className="hidden px-4 py-3 text-right text-muted tabular md:table-cell">{formatRD(m.costo_unitario)}</td>
                      <td className="hidden px-4 py-3 text-muted lg:table-cell">{m.proveedor ?? "—"}</td>
                      {canMove && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => abrirMove(m, "entrada")} title="Entrada" className="rounded-lg p-1.5 text-mint hover:bg-surface-2"><ArrowDownToLine className="h-4 w-4" /></button>
                            <button onClick={() => abrirMove(m, "salida")} title="Salida" className="rounded-lg p-1.5 text-amber hover:bg-surface-2"><ArrowUpFromLine className="h-4 w-4" /></button>
                            {canEdit && <button onClick={() => abrirEdit(m)} title="Editar" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg"><Pencil className="h-4 w-4" /></button>}
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
      ) : (
        <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => {
            const cfg = MAT_CATEGORIA[m.categoria];
            return (
              <StaggerItem key={m.id}>
                <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-4 shadow-card dark:bg-surface/80">
                  <div className="flex items-start justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${cfg.hex}1a`, color: cfg.hex }}><cfg.icon className="h-4 w-4" /></span>
                    <span className="text-xs text-muted">{m.unidad}</span>
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-fg">{m.nombre}</h3>
                  <p className="text-xs text-muted">{m.proveedor ?? ""}</p>
                  <div className="mt-3"><StockBar actual={m.stock_actual} minimo={m.stock_minimo} /></div>
                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                    <span className="text-sm font-bold text-clinical tabular">{formatRD(m.costo_unitario)}</span>
                    {canMove && (
                      <div className="flex gap-1">
                        <button onClick={() => abrirMove(m, "entrada")} className="rounded-lg p-1.5 text-mint hover:bg-surface-2"><ArrowDownToLine className="h-4 w-4" /></button>
                        <button onClick={() => abrirMove(m, "salida")} className="rounded-lg p-1.5 text-amber hover:bg-surface-2"><ArrowUpFromLine className="h-4 w-4" /></button>
                        {canEdit && <button onClick={() => abrirEdit(m)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2"><Pencil className="h-4 w-4" /></button>}
                      </div>
                    )}
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      {/* Paneles inferiores */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Consumo del mes */}
        <Card>
          <CardHeader><CardTitle>Consumo del mes</CardTitle></CardHeader>
          <CardContent>
            {data.consumoMes.length === 0 ? (
              <p className="text-sm text-muted">Sin salidas registradas este mes.</p>
            ) : (
              <ul className="space-y-2.5">
                {data.consumoMes.slice(0, 6).map((c) => (
                  <li key={c.material_id}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate font-medium text-fg">{c.nombre}</span>
                      <span className="text-muted tabular">{c.cantidad}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2 dark:bg-navy-lighter">
                      <div className="h-full rounded-full bg-clinical" style={{ width: `${(c.cantidad / maxConsumo) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Proveedores */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-[18px] w-[18px] text-clinical" /> Proveedores</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60">
              {data.suppliers.map((s) => (
                <li key={s.id} className="py-2">
                  <p className="text-sm font-semibold text-fg">{s.nombre}</p>
                  <p className="flex items-center gap-2 text-xs text-muted">
                    {s.contacto ?? ""}
                    {s.telefono && <span className="inline-flex items-center gap-1 tabular"><Phone className="h-3 w-3" />{s.telefono}</span>}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Recetas por tratamiento */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="h-[18px] w-[18px] text-clinical" /> Consumo por tratamiento</CardTitle></CardHeader>
          <CardContent>
            {data.recetas.length === 0 ? (
              <p className="text-sm text-muted">Sin recetas configuradas.</p>
            ) : (
              <ul className="space-y-3">
                {data.recetas.map((r) => (
                  <li key={r.treatment}>
                    <p className="text-sm font-bold text-fg">{r.treatment}</p>
                    <p className="text-xs text-muted">
                      {r.materiales.map((m) => `${m.nombre} ×${m.cantidad}`).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal movimiento */}
      <Modal
        open={!!move}
        onClose={() => setMove(null)}
        title={move ? `${move.tipo === "entrada" ? "Entrada" : "Salida"} · ${move.m.nombre}` : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMove(null)}>Cancelar</Button>
            <Button icon={move?.tipo === "entrada" ? ArrowDownToLine : ArrowUpFromLine} loading={pending} onClick={doMove}>Registrar</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Cantidad (${move?.m.unidad ?? ""})`}>
            <Input type="number" min={0} value={cantidad} onChange={(e) => setCantidad(Math.max(0, parseFloat(e.target.value) || 0))} autoFocus />
          </Field>
          <Field label="Stock actual">
            <Input value={move ? `${move.m.stock_actual}` : ""} disabled />
          </Field>
          <Field label="Motivo" className="sm:col-span-2">
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={move?.tipo === "entrada" ? "Reposición / compra" : "Consumo en tratamiento"} />
          </Field>
        </div>
      </Modal>

      {/* Modal editar */}
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit ? `Editar · ${edit.nombre}` : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button icon={Pencil} loading={pending} onClick={doEdit}>Guardar</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Stock mínimo">
            <Input type="number" min={0} value={min} onChange={(e) => setMin(Math.max(0, parseFloat(e.target.value) || 0))} />
          </Field>
          <Field label="Costo unitario (RD$)">
            <Input type="number" min={0} value={costo} onChange={(e) => setCosto(Math.max(0, parseFloat(e.target.value) || 0))} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  accent: "clinical" | "danger" | "gold";
}) {
  const cls = {
    clinical: "text-clinical bg-clinical-50 dark:bg-clinical-900/40",
    danger: "text-danger bg-danger/10",
    gold: "text-gold-dark bg-gold/10 dark:text-gold-light",
  }[accent];
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 dark:bg-surface/80">
      <div className="flex items-center gap-3">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", cls)}><Icon className="h-5 w-5" /></span>
        <div>
          <p className="text-xs font-medium text-muted">{label}</p>
          <p className="text-lg font-extrabold text-fg tabular">{value}</p>
        </div>
      </div>
    </div>
  );
}

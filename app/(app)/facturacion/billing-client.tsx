"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Receipt,
  DollarSign,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRD } from "@/lib/utils";
import type { InvoiceRow } from "@/lib/billing";
import type { PatientBasic } from "@/lib/appointments";
import {
  ESTADO_FACTURA,
  METODO_PAGO,
  METODOS,
  type InvoiceEstado,
  type MetodoPago,
} from "./estado-config";
import { InvoiceFormModal } from "./invoice-form";

function fecha(iso: string) {
  return new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(iso + "T00:00:00"),
  );
}

interface Props {
  rows: InvoiceRow[];
  total: number;
  page: number;
  pageCount: number;
  periodo: { count: number; total: number; cobrado: number };
  q: string;
  estado: string;
  metodo: string;
  desde: string;
  hasta: string;
  patients: PatientBasic[];
  canWrite: boolean;
}

export function BillingClient(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = React.useState(props.q);
  const [modal, setModal] = React.useState(false);
  const first = React.useRef(true);

  const setParam = React.useCallback(
    (u: Record<string, string | null>) => {
      const p = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(u)) {
        if (!v) p.delete(k);
        else p.set(k, v);
      }
      if (!("page" in u)) p.delete("page");
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => setParam({ q: q || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">Facturación</h1>
          <p className="text-sm text-muted">{props.total} facturas</p>
        </div>
        {props.canWrite && (
          <Button icon={Plus} onClick={() => setModal(true)}>
            Nueva factura
          </Button>
        )}
      </div>

      {/* Totales del período */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi icon={FileText} label="Facturas" value={String(props.periodo.count)} accent="clinical" />
        <Kpi icon={DollarSign} label="Facturado" value={formatRD(props.periodo.total)} accent="gold" />
        <Kpi icon={CheckCircle2} label="Cobrado" value={formatRD(props.periodo.cobrado)} accent="mint" />
      </div>

      {/* Filtros */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por NCF o paciente…"
            className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-fg dark:bg-navy-light"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={props.estado} onChange={(e) => setParam({ estado: e.target.value === "todos" ? null : e.target.value })} className="h-9 rounded-xl border border-border bg-surface px-3 text-[13px] font-medium text-fg dark:bg-navy-light">
            <option value="todos">Todos los estados</option>
            {(Object.keys(ESTADO_FACTURA) as InvoiceEstado[]).map((e) => (
              <option key={e} value={e}>
                {ESTADO_FACTURA[e].label}
              </option>
            ))}
          </select>
          <select value={props.metodo} onChange={(e) => setParam({ metodo: e.target.value === "todos" ? null : e.target.value })} className="h-9 rounded-xl border border-border bg-surface px-3 text-[13px] font-medium text-fg dark:bg-navy-light">
            <option value="todos">Todos los métodos</option>
            {METODOS.map((m) => (
              <option key={m} value={m}>
                {METODO_PAGO[m as MetodoPago]}
              </option>
            ))}
          </select>
          <input type="date" value={props.desde} onChange={(e) => setParam({ desde: e.target.value || null })} className="h-9 rounded-xl border border-border bg-surface px-2 text-[13px] text-fg dark:bg-navy-light [color-scheme:light] dark:[color-scheme:dark]" />
          <input type="date" value={props.hasta} onChange={(e) => setParam({ hasta: e.target.value || null })} className="h-9 rounded-xl border border-border bg-surface px-2 text-[13px] text-fg dark:bg-navy-light [color-scheme:light] dark:[color-scheme:dark]" />
        </div>
      </div>

      {/* Tabla */}
      {props.rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface dark:bg-surface/80">
          <EmptyState
            icon={Receipt}
            title="Sin facturas"
            description="Ajusta los filtros o emite una nueva factura."
            action={props.canWrite ? <Button icon={Plus} onClick={() => setModal(true)}>Nueva factura</Button> : undefined}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface dark:bg-surface/80">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-muted dark:bg-navy-lighter/40">
                  <th className="px-4 py-3 text-left font-bold">NCF</th>
                  <th className="hidden px-4 py-3 text-left font-bold sm:table-cell">Fecha</th>
                  <th className="px-4 py-3 text-left font-bold">Paciente</th>
                  <th className="hidden px-4 py-3 text-left font-bold md:table-cell">Método</th>
                  <th className="px-4 py-3 text-right font-bold">Total</th>
                  <th className="px-4 py-3 text-left font-bold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {props.rows.map((r) => {
                  const est = ESTADO_FACTURA[r.estado];
                  return (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/facturacion/${r.id}`)}
                      className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-clinical-50/60 dark:hover:bg-clinical-900/20"
                    >
                      <td className="px-4 py-3 font-semibold text-fg tabular">{r.ncf ?? "—"}</td>
                      <td className="hidden px-4 py-3 text-muted tabular sm:table-cell">{fecha(r.fecha)}</td>
                      <td className="px-4 py-3 text-fg">{r.paciente}</td>
                      <td className="hidden px-4 py-3 text-muted md:table-cell">{r.metodo_pago ? METODO_PAGO[r.metodo_pago] : "—"}</td>
                      <td className="px-4 py-3 text-right font-bold text-fg tabular">{formatRD(r.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${est.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${est.dot}`} />
                          {est.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {props.pageCount > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">Página {props.page} de {props.pageCount}</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={props.page <= 1} onClick={() => setParam({ page: String(props.page - 1) })}>
              Anterior
            </Button>
            <Button variant="secondary" size="sm" iconRight={ChevronRight} disabled={props.page >= props.pageCount} onClick={() => setParam({ page: String(props.page + 1) })}>
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {props.canWrite && <InvoiceFormModal open={modal} onClose={() => setModal(false)} patients={props.patients} />}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
  accent: "clinical" | "gold" | "mint";
}) {
  const cls = {
    clinical: "text-clinical bg-clinical-50 dark:bg-clinical-900/40",
    gold: "text-gold-dark bg-gold/10 dark:text-gold-light",
    mint: "text-mint bg-mint/10",
  }[accent];
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 dark:bg-surface/80">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${cls}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-medium text-muted">{label}</p>
          <p className="text-lg font-extrabold text-fg tabular">{value}</p>
        </div>
      </div>
    </div>
  );
}

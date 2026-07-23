"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Search,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  Users,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PatientFormModal } from "./patient-form";
import { calcularEdad } from "@/lib/validation";
import type { EstadoFiltro, EdadFiltro, SortKey } from "@/lib/patients";

export interface PatientRow {
  id: string;
  nombre: string;
  cedula: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  es_vip: boolean;
  activo: boolean;
  alergias: string | null;
  medicamentos: string | null;
  condiciones: string | null;
  ultima_visita: string | null;
  fotoUrl: string | null;
}

interface Props {
  rows: PatientRow[];
  total: number;
  page: number;
  pageCount: number;
  q: string;
  estado: EstadoFiltro;
  edad: EdadFiltro;
  alertas: boolean;
  sort: SortKey;
  dir: "asc" | "desc";
  canCreate: boolean;
  openNuevo: boolean;
}

const ESTADOS: { key: EstadoFiltro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "activo", label: "Activos" },
  { key: "vip", label: "VIP" },
  { key: "inactivo", label: "Inactivos" },
];

const EDADES: { key: EdadFiltro; label: string }[] = [
  { key: "todas", label: "Todas las edades" },
  { key: "menor", label: "Menores de 18" },
  { key: "18-39", label: "18 – 39 años" },
  { key: "40-59", label: "40 – 59 años" },
  { key: "60+", label: "60+ años" },
];

function fecha(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso + "T00:00:00"));
}

export function PatientsClient(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = React.useState(props.q);
  const [modal, setModal] = React.useState(props.openNuevo);
  const firstRender = React.useRef(true);

  const setParam = React.useCallback(
    (updates: Record<string, string | null>) => {
      const p = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") p.delete(k);
        else p.set(k, v);
      }
      // cualquier cambio de filtro vuelve a la página 1
      if (!("page" in updates)) p.delete("page");
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  // Búsqueda debounced.
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => setParam({ q: q || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function toggleSort(key: SortKey) {
    const dir =
      props.sort === key && props.dir === "asc" ? "desc" : "asc";
    setParam({ sort: key, dir });
  }

  function closeModal() {
    setModal(false);
    if (params.get("nuevo")) setParam({ nuevo: null });
  }

  const SortIcon = ({ col }: { col: SortKey }) =>
    props.sort === col ? (
      props.dir === "asc" ? (
        <ChevronUp className="h-3.5 w-3.5 text-clinical" />
      ) : (
        <ChevronDown className="h-3.5 w-3.5 text-clinical" />
      )
    ) : (
      <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
    );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
            Pacientes
          </h1>
          <p className="text-sm text-muted">
            {props.total} paciente{props.total === 1 ? "" : "s"} en el sistema
          </p>
        </div>
        {props.canCreate && (
          <Button icon={UserPlus} onClick={() => setModal(true)}>
            Nuevo paciente
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, cédula o teléfono…"
            className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-fg placeholder:text-muted/70 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 dark:bg-navy-light"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Estado (segmentado) */}
          <div className="inline-flex rounded-xl border border-border bg-surface p-0.5 dark:bg-surface/60">
            {ESTADOS.map((s) => (
              <button
                key={s.key}
                onClick={() => setParam({ estado: s.key === "todos" ? null : s.key })}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  props.estado === s.key
                    ? "bg-clinical text-white shadow-sm"
                    : "text-muted hover:text-fg"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Edad */}
          <select
            value={props.edad}
            onChange={(e) => setParam({ edad: e.target.value === "todas" ? null : e.target.value })}
            className="h-9 rounded-xl border border-border bg-surface px-3 text-[13px] font-medium text-fg focus:outline-none focus:ring-2 focus:ring-ring/40 dark:bg-navy-light"
          >
            {EDADES.map((ed) => (
              <option key={ed.key} value={ed.key}>
                {ed.label}
              </option>
            ))}
          </select>

          {/* Alertas médicas */}
          <button
            onClick={() => setParam({ alertas: props.alertas ? null : "1" })}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              props.alertas
                ? "border-danger/40 bg-danger/10 text-danger"
                : "border-border bg-surface text-muted hover:text-fg dark:bg-navy-light"
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Con alertas médicas
          </button>
        </div>
      </div>

      {/* Tabla */}
      {props.rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface dark:bg-surface/80">
          <EmptyState
            icon={Users}
            title="No se encontraron pacientes"
            description="Ajusta la búsqueda o los filtros, o registra un nuevo paciente para empezar."
            action={
              props.canCreate ? (
                <Button icon={UserPlus} onClick={() => setModal(true)}>
                  Nuevo paciente
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface dark:bg-surface/80">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-muted dark:bg-navy-lighter/40">
                  <th className="px-4 py-3 text-left font-bold">
                    <button onClick={() => toggleSort("nombre")} className="inline-flex items-center gap-1 hover:text-fg">
                      Paciente <SortIcon col="nombre" />
                    </button>
                  </th>
                  <th className="hidden px-4 py-3 text-left font-bold sm:table-cell">
                    <button onClick={() => toggleSort("cedula")} className="inline-flex items-center gap-1 hover:text-fg">
                      Cédula <SortIcon col="cedula" />
                    </button>
                  </th>
                  <th className="hidden px-4 py-3 text-left font-bold md:table-cell">Teléfono</th>
                  <th className="px-4 py-3 text-left font-bold">Estado</th>
                  <th className="hidden px-4 py-3 text-left font-bold lg:table-cell">
                    <button onClick={() => toggleSort("ultima_visita")} className="inline-flex items-center gap-1 hover:text-fg">
                      Última visita <SortIcon col="ultima_visita" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {props.rows.map((r) => {
                  const edad = calcularEdad(r.fecha_nacimiento);
                  const conAlerta = !!(r.alergias || r.medicamentos || r.condiciones);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/pacientes/${r.id}`)}
                      className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-clinical-50/60 dark:hover:bg-clinical-900/20"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar nombre={r.nombre} url={r.fotoUrl} size="sm" vip={r.es_vip} />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate font-semibold text-fg">
                              {r.nombre}
                              {conAlerta && (
                                <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-danger" />
                              )}
                            </p>
                            <p className="text-xs text-muted">
                              {edad !== null ? `${edad} años` : "Edad no registrada"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-muted tabular sm:table-cell">
                        {r.cedula ?? "—"}
                      </td>
                      <td className="hidden px-4 py-3 text-muted tabular md:table-cell">
                        {r.telefono ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {!r.activo ? (
                          <Badge variant="neutral" dot>
                            Inactivo
                          </Badge>
                        ) : r.es_vip ? (
                          <Badge variant="vip">VIP</Badge>
                        ) : (
                          <Badge variant="success" dot>
                            Activo
                          </Badge>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-muted tabular lg:table-cell">
                        {fecha(r.ultima_visita)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Paginación */}
      {props.pageCount > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            Página {props.page} de {props.pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={ChevronLeft}
              disabled={props.page <= 1}
              onClick={() => setParam({ page: String(props.page - 1) })}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              iconRight={ChevronRight}
              disabled={props.page >= props.pageCount}
              onClick={() => setParam({ page: String(props.page + 1) })}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {props.canCreate && (
        <PatientFormModal open={modal} onClose={closeModal} />
      )}
    </div>
  );
}

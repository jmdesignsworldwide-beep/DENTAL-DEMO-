"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  Search,
  Save,
  Calendar,
  Inbox,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input, Textarea, Select, DatePicker, Field } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { KPICard } from "@/components/ui/kpi-card";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Skeleton,
  SkeletonRow,
  SkeletonKPI,
} from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { formatRD } from "@/lib/utils";

interface Paciente {
  nombre: string;
  telefono: string;
  ultima: string;
  balance: number;
}

const pacientes: Paciente[] = [
  { nombre: "María Altagracia Peña", telefono: "809-555-0142", ultima: "2026-07-14", balance: 3500 },
  { nombre: "José Ramón Fernández", telefono: "829-555-0198", ultima: "2026-07-09", balance: 0 },
  { nombre: "Carmen Yolanda Reyes", telefono: "849-555-0177", ultima: "2026-06-28", balance: 12800 },
  { nombre: "Luis Manuel Jiménez", telefono: "809-555-0210", ultima: "2026-07-18", balance: 1500 },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold tracking-tight text-fg">{title}</h2>
      {children}
    </section>
  );
}

export function Showcase() {
  const [modal, setModal] = React.useState(false);
  const [err, setErr] = React.useState(false);
  const toast = useToast();

  const columns: Column<Paciente>[] = [
    { key: "nombre", header: "Paciente", sortable: true },
    { key: "telefono", header: "Teléfono" },
    { key: "ultima", header: "Última visita", sortable: true },
    {
      key: "balance",
      header: "Balance",
      sortable: true,
      align: "right",
      render: (r) => (
        <span
          className={
            r.balance > 0 ? "font-semibold text-danger" : "text-muted"
          }
          data-tabular
        >
          {formatRD(r.balance)}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-clinical" />
            <h1 className="text-2xl font-extrabold tracking-tight text-fg">
              Design System
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted">
            Librería de componentes · solo desarrollo
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Paleta">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {[
            ["Clinical", "#0066CC"],
            ["Ice", "#E8F4FD"],
            ["Navy", "#0A1628"],
            ["Mint", "#00C896"],
            ["Amber", "#F59E0B"],
            ["Danger", "#EF4444"],
            ["Gold", "#C9A84C"],
            ["White", "#FFFFFF"],
          ].map(([name, hex]) => (
            <div key={name} className="space-y-1.5">
              <div
                className="h-16 rounded-xl border border-border shadow-card"
                style={{ background: hex }}
              />
              <p className="text-xs font-semibold text-fg">{name}</p>
              <p className="text-[11px] text-muted">{hex}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Botones">
        <Card>
          <CardContent className="flex flex-wrap gap-3 pt-5">
            <Button icon={Plus}>Primary</Button>
            <Button variant="secondary" icon={Save}>
              Secondary
            </Button>
            <Button variant="ghost" icon={Search}>
              Ghost
            </Button>
            <Button variant="danger" icon={Trash2}>
              Danger
            </Button>
            <Button variant="gold" icon={Sparkles}>
              VIP
            </Button>
            <Button loading>Cargando</Button>
            <Button size="icon" icon={Plus} aria-label="Agregar" />
          </CardContent>
        </Card>
      </Section>

      <Section title="Formularios">
        <Card>
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="ds-n" required>
              <Input id="ds-n" placeholder="María Altagracia" icon={Search} />
            </Field>
            <Field label="Fecha de cita" htmlFor="ds-d">
              <DatePicker id="ds-d" />
            </Field>
            <Field label="Tratamiento" htmlFor="ds-s">
              <Select id="ds-s" defaultValue="">
                <option value="" disabled>
                  Seleccionar…
                </option>
                <option>Limpieza dental</option>
                <option>Endodoncia</option>
                <option>Blanqueamiento</option>
              </Select>
            </Field>
            <Field
              label="Con error"
              htmlFor="ds-e"
              error={err ? "Este campo es obligatorio." : undefined}
            >
              <Input
                id="ds-e"
                error={err}
                placeholder="Toca «Validar»"
                onChange={() => setErr(false)}
              />
            </Field>
            <Field label="Notas" htmlFor="ds-t" className="sm:col-span-2">
              <Textarea id="ds-t" placeholder="Observaciones clínicas…" />
            </Field>
            <div className="sm:col-span-2">
              <Button variant="secondary" onClick={() => setErr(true)}>
                Validar (mostrar error)
              </Button>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Badges">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-5">
            <Badge>Neutral</Badge>
            <Badge variant="clinical">Clinical</Badge>
            <Badge variant="success" dot>
              Confirmada
            </Badge>
            <Badge variant="warning" dot>
              Pendiente
            </Badge>
            <Badge variant="danger" dot>
              Cancelada
            </Badge>
            <Badge variant="vip">Paciente VIP</Badge>
          </CardContent>
        </Card>
      </Section>

      <Section title="KPI Cards (count-up)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KPICard label="Citas hoy" value={14} icon={Calendar} trend={8.3} />
          <KPICard
            label="Ingresos"
            value={842500}
            prefix="RD$ "
            icon={Save}
            trend={12.6}
            accent="gold"
          />
          <KPICard
            label="Pacientes"
            value={1287}
            icon={Search}
            trend={-2.1}
            accent="mint"
          />
        </div>
      </Section>

      <Section title="Data Table (ordenable)">
        <DataTable
          columns={columns}
          data={pacientes}
          rowKey={(r) => r.nombre}
          onRowClick={(r) => toast.success("Paciente", r.nombre)}
        />
      </Section>

      <Section title="Modal · Toasts">
        <Card>
          <CardContent className="flex flex-wrap gap-3 pt-5">
            <Button onClick={() => setModal(true)}>Abrir modal</Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast.success("Guardado", "Los cambios se guardaron.")
              }
            >
              Toast éxito
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                toast.error("Error", "No se pudo completar la acción.")
              }
            >
              Toast error
            </Button>
          </CardContent>
        </Card>
      </Section>

      <Section title="Skeletons">
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonKPI />
          <Card>
            <CardContent className="space-y-2 pt-5">
              <SkeletonRow />
              <SkeletonRow />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Empty State">
        <Card>
          <CardHeader>
            <CardTitle>Sin resultados</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Inbox}
              title="No hay citas para esta fecha"
              description="Cuando agendes una cita aparecerá aquí con todos sus detalles."
              action={<Button icon={Plus}>Nueva cita</Button>}
            />
          </CardContent>
        </Card>
      </Section>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Confirmar acción"
        description="Este es el componente Modal con AnimatePresence."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button
              icon={Save}
              onClick={() => {
                setModal(false);
                toast.success("Listo", "Acción confirmada.");
              }}
            >
              Confirmar
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Se anima al abrir y cerrar, cierra con Escape o clic afuera, y bloquea
          el scroll del fondo. Impecable en móvil (hoja inferior) y desktop.
        </p>
      </Modal>
    </div>
  );
}

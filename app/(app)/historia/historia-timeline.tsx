"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  FileDown,
  ChevronDown,
  Stethoscope,
  HeartPulse,
  Activity,
  Pill,
  CalendarClock,
  ShieldCheck,
  FileText,
  Filter as FilterIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { Lightbox } from "@/components/ui/lightbox";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { formatDateLong } from "@/lib/utils";
import type { ClinicalRecord } from "@/lib/clinical";
import { ATTACH } from "./attachment-config";
import { RecordForm } from "./record-form";

export function HistoriaTimeline({
  patientId,
  patientNombre,
  patientVip,
  fotoUrl,
  records,
  canWrite,
  odontologos,
  defaultOdontologo,
}: {
  patientId: string;
  patientNombre: string;
  patientVip: boolean;
  fotoUrl: string | null;
  records: ClinicalRecord[];
  canWrite: boolean;
  odontologos: string[];
  defaultOdontologo: string;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [lightbox, setLightbox] = React.useState<string | null>(null);
  const [pdf, setPdf] = React.useState<string | null>(null);
  const [showFilters, setShowFilters] = React.useState(false);
  const [desde, setDesde] = React.useState("");
  const [hasta, setHasta] = React.useState("");
  const [trat, setTrat] = React.useState("");
  const [odo, setOdo] = React.useState("");

  const filtered = React.useMemo(() => {
    return records.filter((r) => {
      if (desde && r.fecha < desde) return false;
      if (hasta && r.fecha > hasta) return false;
      if (odo && r.odontologo_nombre !== odo) return false;
      if (trat && !(r.tratamiento_realizado ?? "").toLowerCase().includes(trat.toLowerCase()))
        return false;
      return true;
    });
  }, [records, desde, hasta, trat, odo]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href={`/pacientes/${patientId}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Perfil del paciente
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar nombre={patientNombre} url={fotoUrl} size="lg" vip={patientVip} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Historia clínica
            </p>
            <h1 className="text-xl font-extrabold tracking-tight text-fg sm:text-2xl">
              {patientNombre}
            </h1>
            <p className="text-sm text-muted">
              {records.length} entrada{records.length === 1 ? "" : "s"} registrada
              {records.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={FilterIcon} onClick={() => setShowFilters((v) => !v)}>
            Filtros
          </Button>
          <Link href={`/imprimir/historia/${patientId}`} target="_blank">
            <Button variant="secondary" size="sm" icon={FileDown}>
              Exportar PDF
            </Button>
          </Link>
          {canWrite && (
            <Button size="sm" icon={Plus} onClick={() => setFormOpen(true)}>
              Nueva entrada
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-4 dark:bg-surface/60">
              <label className="text-xs font-semibold text-muted">
                Desde
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm text-fg dark:bg-navy-light [color-scheme:light] dark:[color-scheme:dark]" />
              </label>
              <label className="text-xs font-semibold text-muted">
                Hasta
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm text-fg dark:bg-navy-light [color-scheme:light] dark:[color-scheme:dark]" />
              </label>
              <label className="text-xs font-semibold text-muted">
                Tratamiento
                <input value={trat} onChange={(e) => setTrat(e.target.value)} placeholder="Buscar…" className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm text-fg dark:bg-navy-light" />
              </label>
              <label className="text-xs font-semibold text-muted">
                Odontólogo
                <select value={odo} onChange={(e) => setOdo(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm text-fg dark:bg-navy-light">
                  <option value="">Todos</option>
                  {odontologos.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Stethoscope}
            title={records.length === 0 ? "Sin historia clínica" : "Sin resultados"}
            description={
              records.length === 0
                ? "Registra la primera entrada de visita para comenzar el expediente clínico."
                : "Ajusta los filtros para ver más entradas."
            }
            action={
              canWrite && records.length === 0 ? (
                <Button icon={Plus} onClick={() => setFormOpen(true)}>
                  Nueva entrada
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Stagger className="space-y-4">
          {filtered.map((r) => (
            <StaggerItem key={r.id}>
              <RecordCard
                record={r}
                onImage={setLightbox}
                onPdf={setPdf}
              />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {canWrite && (
        <RecordForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSuccess={() => {
            setFormOpen(false);
            router.refresh();
          }}
          patientId={patientId}
          odontologos={odontologos}
          defaultOdontologo={defaultOdontologo}
        />
      )}

      <Lightbox url={lightbox} onClose={() => setLightbox(null)} />

      <Modal open={!!pdf} onClose={() => setPdf(null)} title="Consentimiento" className="max-w-3xl">
        {pdf && (
          <iframe src={pdf} title="Consentimiento" className="h-[70vh] w-full rounded-lg border border-border" />
        )}
      </Modal>
    </div>
  );
}

function VitalPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HeartPulse;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface-2/70 px-3 py-1.5 dark:bg-navy-lighter/40">
      <Icon className="h-4 w-4 text-clinical" />
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm font-bold text-fg tabular">{value}</span>
    </div>
  );
}

function RecordCard({
  record: r,
  onImage,
  onPdf,
}: {
  record: ClinicalRecord;
  onImage: (url: string) => void;
  onPdf: (url: string) => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card dark:bg-surface/80">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-surface-2/40"
      >
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clinical-50 text-clinical dark:bg-clinical-900/40 dark:text-clinical-200">
          <Stethoscope className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-fg">{formatDateLong(r.fecha)}</p>
            {r.firmada && (
              <Badge variant="success">
                <ShieldCheck className="h-3 w-3" /> Firmada
              </Badge>
            )}
            {r.es_enmienda && <Badge variant="warning">Enmienda</Badge>}
            {r.attachments.length > 0 && (
              <Badge variant="clinical">
                <FileText className="h-3 w-3" /> {r.attachments.length}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted">
            {r.diagnostico || r.motivo_consulta || "Consulta"}
            {r.odontologo_nombre ? ` · ${r.odontologo_nombre}` : ""}
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-border px-4 py-4">
              {/* Signos vitales */}
              {(r.presion_arterial || r.frecuencia_cardiaca) && (
                <div className="flex flex-wrap gap-2">
                  {r.presion_arterial && (
                    <VitalPill icon={Activity} label="P/A" value={`${r.presion_arterial} mmHg`} />
                  )}
                  {r.frecuencia_cardiaca && (
                    <VitalPill icon={HeartPulse} label="FC" value={`${r.frecuencia_cardiaca} lpm`} />
                  )}
                </div>
              )}

              <Detalles r={r} />

              {/* Medicamentos destacados */}
              {r.medicamentos_recetados && (
                <div className="flex items-start gap-2.5 rounded-xl border border-clinical-200 bg-clinical-50 px-3.5 py-2.5 dark:border-clinical-700/50 dark:bg-clinical-900/30">
                  <Pill className="mt-0.5 h-4 w-4 shrink-0 text-clinical" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-clinical-700 dark:text-clinical-200">
                      Medicamentos recetados
                    </p>
                    <p className="text-sm font-semibold text-fg">{r.medicamentos_recetados}</p>
                  </div>
                </div>
              )}

              {r.proxima_cita_recomendada && (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <CalendarClock className="h-4 w-4" />
                  Próxima cita recomendada:{" "}
                  <span className="font-semibold text-fg">
                    {formatDateLong(r.proxima_cita_recomendada)}
                  </span>
                </p>
              )}

              {/* Adjuntos */}
              {r.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {r.attachments.map((a) => {
                    const cfg = ATTACH[a.tipo];
                    const clickable = a.url;
                    return (
                      <button
                        key={a.id}
                        disabled={!clickable}
                        onClick={() =>
                          a.url && (cfg.isImage ? onImage(a.url) : onPdf(a.url))
                        }
                        title={cfg.label}
                        className="group relative h-20 w-20 overflow-hidden rounded-xl border border-border bg-surface-2 disabled:opacity-60 dark:bg-navy-lighter"
                      >
                        {cfg.isImage && a.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.url} alt={cfg.label} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                        ) : (
                          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted">
                            <cfg.icon className={`h-5 w-5 ${cfg.color}`} />
                            <span className="px-1 text-center text-[9px] font-medium leading-tight">
                              {cfg.label}
                            </span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Detalles({ r }: { r: ClinicalRecord }) {
  const items = [
    ["Motivo de consulta", r.motivo_consulta],
    ["Diagnóstico", r.diagnostico],
    ["Tratamiento realizado", r.tratamiento_realizado],
    ["Materiales usados", r.materiales_usados],
    ["Notas clínicas", r.notas_clinicas],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className={label === "Notas clínicas" ? "sm:col-span-2" : ""}>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-fg">{value}</p>
        </div>
      ))}
    </div>
  );
}

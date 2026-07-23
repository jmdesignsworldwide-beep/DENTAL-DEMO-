"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Phone,
  Mail,
  MapPin,
  Droplet,
  ShieldPlus,
  UserRound,
  AlertTriangle,
  Pill,
  HeartPulse,
  Wallet,
  CalendarClock,
  Stethoscope,
  FileText,
  Grid3x3,
  Receipt,
  Lock,
  Power,
  StickyNote,
  ChevronRight,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { formatRD, formatDateLong } from "@/lib/utils";
import { calcularEdad } from "@/lib/validation";
import type { PatientOverview, TreatmentRow } from "@/lib/patients";
import { PatientFormModal } from "../patient-form";
import { setPatientActivo } from "../actions";

const ESTADO_LABEL: Record<string, { label: string; cls: string }> = {
  confirmada: { label: "Confirmada", cls: "text-clinical" },
  sala_espera: { label: "Sala de espera", cls: "text-amber" },
  en_sillon: { label: "En el sillón", cls: "text-mint" },
  completada: { label: "Completada", cls: "text-muted" },
  cancelada: { label: "Cancelada", cls: "text-danger" },
  no_show: { label: "No asistió", cls: "text-danger" },
};

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted dark:bg-navy-lighter">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="truncate text-sm font-semibold text-fg">
          {value || "No registrado"}
        </p>
      </div>
    </div>
  );
}

export function ProfileView({
  patient,
  historial,
  fotoUrl,
  canEdit,
  canSeeIncome,
  canSeeClinical,
  canSeeOdonto,
}: {
  patient: PatientOverview;
  historial: TreatmentRow[];
  fotoUrl: string | null;
  canEdit: boolean;
  canSeeIncome: boolean;
  canSeeClinical?: boolean;
  canSeeOdonto?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = React.useState(false);
  const [confirmingOff, setConfirmingOff] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const edad = calcularEdad(patient.fecha_nacimiento);
  const alertas = [
    patient.alergias && { icon: AlertTriangle, label: "Alergias", value: patient.alergias },
    patient.medicamentos && { icon: Pill, label: "Medicamentos", value: patient.medicamentos },
    patient.condiciones && { icon: HeartPulse, label: "Condiciones", value: patient.condiciones },
  ].filter(Boolean) as { icon: typeof Pill; label: string; value: string }[];

  function toggleActivo() {
    startTransition(async () => {
      await setPatientActivo(patient.id, !patient.activo);
      setConfirmingOff(false);
      toast.success(
        patient.activo ? "Paciente desactivado" : "Paciente reactivado",
        patient.nombre,
      );
      router.refresh();
    });
  }

  const modulos = [
    { label: "Historia clínica", icon: FileText, tanda: 5 },
    { label: "Odontograma", icon: Grid3x3, tanda: 6 },
    { label: "Facturas", icon: Receipt, tanda: 8 },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/pacientes"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Pacientes
      </Link>

      <Stagger className="space-y-6">
        {/* Header */}
        <StaggerItem>
          <Card className="overflow-hidden">
            <div className="h-20 bg-gradient-to-r from-clinical-500 to-clinical-700 dark:from-clinical-700 dark:to-navy" />
            <CardContent className="pt-0">
              <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-end gap-4">
                  <Avatar
                    nombre={patient.nombre}
                    url={fotoUrl}
                    size="xl"
                    vip={patient.es_vip}
                    className="ring-4 ring-surface"
                  />
                  <div className="pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl font-extrabold tracking-tight text-fg sm:text-2xl">
                        {patient.nombre}
                      </h1>
                      {patient.es_vip && <Badge variant="vip">VIP</Badge>}
                      {!patient.activo && (
                        <Badge variant="neutral" dot>
                          Inactivo
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted">
                      {edad !== null ? `${edad} años` : "Edad no registrada"}
                      {patient.cedula ? ` · Cédula ${patient.cedula}` : ""}
                    </p>
                  </div>
                </div>

                {canEdit && (
                  <div className="flex gap-2">
                    <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
                      Editar
                    </Button>
                    <Button
                      variant={patient.activo ? "ghost" : "primary"}
                      icon={Power}
                      onClick={() => setConfirmingOff(true)}
                    >
                      {patient.activo ? "Desactivar" : "Reactivar"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Alertas médicas — imposible de ignorar */}
        {alertas.length > 0 && (
          <StaggerItem>
            <div className="overflow-hidden rounded-2xl border-2 border-danger/40 bg-danger/5">
              <div className="flex items-center gap-2 border-b border-danger/20 bg-danger/10 px-4 py-2.5">
                <AlertTriangle className="h-4 w-4 text-danger" />
                <span className="text-sm font-bold uppercase tracking-wide text-danger">
                  Alertas médicas
                </span>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-3">
                {alertas.map((a) => (
                  <div key={a.label} className="flex items-start gap-2.5">
                    <a.icon className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-danger/80">
                        {a.label}
                      </p>
                      <p className="text-sm font-semibold text-fg">{a.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </StaggerItem>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Columna principal */}
          <div className="space-y-6 lg:col-span-2">
            <StaggerItem>
              <Card>
                <CardHeader>
                  <CardTitle>Datos de contacto</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-x-6 sm:grid-cols-2">
                  <InfoRow icon={Phone} label="Teléfono" value={patient.telefono} />
                  <InfoRow icon={Mail} label="Correo" value={patient.email} />
                  <InfoRow icon={MapPin} label="Dirección" value={patient.direccion} />
                  <InfoRow icon={Droplet} label="Tipo de sangre" value={patient.tipo_sangre} />
                  <InfoRow icon={ShieldPlus} label="Seguro médico" value={patient.seguro} />
                  <InfoRow icon={FileText} label="Póliza" value={patient.poliza} />
                  <InfoRow
                    icon={UserRound}
                    label="Contacto de emergencia"
                    value={patient.contacto_emergencia_nombre}
                  />
                  <InfoRow
                    icon={Phone}
                    label="Tel. de emergencia"
                    value={patient.contacto_emergencia_telefono}
                  />
                </CardContent>
              </Card>
            </StaggerItem>

            <StaggerItem>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Stethoscope className="h-[18px] w-[18px] text-clinical" />
                    Historial de tratamientos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {historial.length === 0 ? (
                    <EmptyState
                      icon={Stethoscope}
                      title="Sin tratamientos registrados"
                      description="Los tratamientos y citas del paciente aparecerán aquí en orden cronológico."
                    />
                  ) : (
                    <ul className="relative space-y-4 before:absolute before:left-[7px] before:top-2 before:h-full before:w-px before:bg-border">
                      {historial.map((t) => {
                        const st = ESTADO_LABEL[t.estado] ?? {
                          label: t.estado,
                          cls: "text-muted",
                        };
                        return (
                          <li key={t.id} className="relative flex gap-3 pl-6">
                            <span className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-surface bg-clinical" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-bold text-fg">
                                  {t.tratamiento}
                                </p>
                                <span className={`text-xs font-semibold ${st.cls}`}>
                                  {st.label}
                                </span>
                              </div>
                              <p className="text-xs text-muted">
                                {formatDateLong(t.fecha)}
                                {t.dentista ? ` · ${t.dentista}` : ""}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>

            {patient.notas && (
              <StaggerItem>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <StickyNote className="h-[18px] w-[18px] text-clinical" />
                      Notas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg/90">
                      {patient.notas}
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <StaggerItem>
              <Card>
                <CardContent className="space-y-4 pt-5">
                  {canSeeIncome && (
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold-dark dark:text-gold-light">
                        <Wallet className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-xs font-medium text-muted">Total gastado</p>
                        <p className="text-lg font-extrabold text-fg tabular">
                          {formatRD(Number(patient.total_gastado))}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-clinical-50 text-clinical dark:bg-clinical-900/40 dark:text-clinical-200">
                      <Stethoscope className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-muted">Tratamientos</p>
                      <p className="text-lg font-extrabold text-fg tabular">
                        {patient.num_tratamientos}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint/10 text-mint">
                      <CalendarClock className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-muted">Próxima cita</p>
                      <p className="text-sm font-bold text-fg">
                        {patient.proxima_cita
                          ? formatDateLong(patient.proxima_cita)
                          : "Sin agendar"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>

            <StaggerItem>
              <Card>
                <CardHeader>
                  <CardTitle>Módulos vinculados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {modulos.map((m) => {
                    const href =
                      m.label === "Historia clínica" && canSeeClinical
                        ? `/historia/${patient.id}`
                        : m.label === "Odontograma" && canSeeOdonto
                          ? `/odontograma/${patient.id}`
                          : m.label === "Facturas" && canSeeIncome
                            ? `/facturacion?q=${encodeURIComponent(patient.nombre)}`
                            : null;
                    if (href) {
                      return (
                        <Link
                          key={m.label}
                          href={href}
                          className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-clinical-300 hover:bg-clinical-50/50 dark:hover:bg-clinical-900/20"
                        >
                          <m.icon className="h-4 w-4 shrink-0 text-clinical" />
                          <span className="flex-1">{m.label}</span>
                          <ChevronRight className="h-4 w-4 text-muted" />
                        </Link>
                      );
                    }
                    return (
                      <div
                        key={m.label}
                        title={`Disponible en la Tanda ${m.tanda}`}
                        className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm font-medium text-muted/70"
                      >
                        <m.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{m.label}</span>
                        <Lock className="h-3.5 w-3.5" />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </StaggerItem>
          </div>
        </div>
      </Stagger>

      {/* Modales */}
      {canEdit && (
        <PatientFormModal
          open={editing}
          onClose={() => setEditing(false)}
          patient={patient}
        />
      )}

      <Modal
        open={confirmingOff}
        onClose={() => setConfirmingOff(false)}
        title={patient.activo ? "Desactivar paciente" : "Reactivar paciente"}
        description={
          patient.activo
            ? "El paciente quedará inactivo pero su expediente e historial se conservan. Nunca se borra."
            : "El paciente volverá a estar activo en el sistema."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmingOff(false)}>
              Cancelar
            </Button>
            <Button
              variant={patient.activo ? "danger" : "primary"}
              icon={Power}
              loading={pending}
              onClick={toggleActivo}
            >
              {patient.activo ? "Desactivar" : "Reactivar"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Paciente:{" "}
          <span className="font-semibold text-fg">{patient.nombre}</span>
        </p>
      </Modal>
    </div>
  );
}

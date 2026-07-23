"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Camera, Save, Star, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { formatCedula } from "@/lib/validation";
import { createPatient, updatePatient, type PatientFormState } from "./actions";
import type { PatientOverview } from "@/lib/patients";

const TIPOS_SANGRE = ["", "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const SEGUROS = [
  "ARS Humano",
  "ARS SeNaSa",
  "ARS Universal",
  "Mapfre Salud",
  "ARS Palic",
  "ARS Monumental",
  "Sin seguro",
];

function SubmitButton({ edit }: { edit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" icon={Save} loading={pending}>
      {pending ? "Guardando…" : edit ? "Guardar cambios" : "Crear paciente"}
    </Button>
  );
}

export function PatientFormModal({
  open,
  onClose,
  patient,
}: {
  open: boolean;
  onClose: () => void;
  patient?: PatientOverview | null;
}) {
  const edit = !!patient;
  const action = edit ? updatePatient : createPatient;
  const [state, formAction] = useFormState<PatientFormState, FormData>(
    action,
    {},
  );

  const [cedula, setCedula] = React.useState(patient?.cedula ?? "");
  const [vip, setVip] = React.useState(patient?.es_vip ?? false);
  const [nombre, setNombre] = React.useState(patient?.nombre ?? "");
  const [preview, setPreview] = React.useState<string | null>(null);
  const err = state.errors ?? {};

  function onFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edit ? "Editar paciente" : "Nuevo paciente"}
      description={
        edit
          ? "Actualiza el expediente del paciente."
          : "Registra un nuevo paciente en el CRM."
      }
      className="max-w-2xl"
    >
      <form action={formAction} className="space-y-5">
        {edit && <input type="hidden" name="id" value={patient!.id} />}
        <input type="hidden" name="es_vip" value={vip ? "true" : "false"} />

        {state.formError && (
          <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm font-medium text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {state.formError}
          </div>
        )}

        {/* Foto + VIP */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar nombre={nombre || "N N"} url={preview} size="lg" vip={vip} />
            <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-clinical text-white shadow-card transition-transform hover:scale-110">
              <Camera className="h-3.5 w-3.5" />
              <input
                type="file"
                name="foto"
                accept="image/*"
                className="sr-only"
                onChange={onFoto}
              />
            </label>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-fg">Foto del paciente</p>
            <p className="text-xs text-muted">JPG o PNG, hasta 5 MB.</p>
            <button
              type="button"
              onClick={() => setVip((v) => !v)}
              className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset transition-colors ${
                vip
                  ? "bg-gradient-to-r from-gold-light/20 to-gold/20 text-gold-dark ring-gold/50 dark:text-gold-light"
                  : "bg-surface-2 text-muted ring-border"
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${vip ? "fill-current" : ""}`} />
              {vip ? "Paciente VIP" : "Marcar como VIP"}
            </button>
          </div>
        </div>

        {/* Datos personales */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo" htmlFor="p-nombre" required error={err.nombre} className="sm:col-span-2">
            <Input
              id="p-nombre"
              name="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              error={!!err.nombre}
              placeholder="María Altagracia Peña"
              required
            />
          </Field>
          <Field label="Cédula" htmlFor="p-cedula" error={err.cedula}>
            <Input
              id="p-cedula"
              name="cedula"
              value={cedula}
              onChange={(e) => setCedula(formatCedula(e.target.value))}
              error={!!err.cedula}
              placeholder="001-0000000-0"
              inputMode="numeric"
            />
          </Field>
          <Field label="Fecha de nacimiento" htmlFor="p-fn" error={err.fecha_nacimiento}>
            <Input
              id="p-fn"
              name="fecha_nacimiento"
              type="date"
              defaultValue={patient?.fecha_nacimiento ?? ""}
              error={!!err.fecha_nacimiento}
              className="[color-scheme:light] dark:[color-scheme:dark]"
            />
          </Field>
          <Field label="Teléfono" htmlFor="p-tel" error={err.telefono}>
            <Input
              id="p-tel"
              name="telefono"
              defaultValue={patient?.telefono ?? ""}
              error={!!err.telefono}
              placeholder="809-555-0100"
            />
          </Field>
          <Field label="Correo" htmlFor="p-email" error={err.email}>
            <Input
              id="p-email"
              name="email"
              type="email"
              defaultValue={patient?.email ?? ""}
              error={!!err.email}
              placeholder="paciente@correo.com"
            />
          </Field>
          <Field label="Dirección" htmlFor="p-dir" className="sm:col-span-2">
            <Input
              id="p-dir"
              name="direccion"
              defaultValue={patient?.direccion ?? ""}
              placeholder="C/ Duarte #45, Gazcue, Santo Domingo"
            />
          </Field>
        </div>

        {/* Alertas médicas */}
        <div>
          <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-danger">
            Información médica
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de sangre" htmlFor="p-sangre">
              <Select id="p-sangre" name="tipo_sangre" defaultValue={patient?.tipo_sangre ?? ""}>
                {TIPOS_SANGRE.map((t) => (
                  <option key={t} value={t}>
                    {t || "No especificado"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Alergias" htmlFor="p-alergias">
              <Input
                id="p-alergias"
                name="alergias"
                defaultValue={patient?.alergias ?? ""}
                placeholder="Penicilina, látex…"
              />
            </Field>
            <Field label="Medicamentos" htmlFor="p-meds">
              <Input
                id="p-meds"
                name="medicamentos"
                defaultValue={patient?.medicamentos ?? ""}
                placeholder="Warfarina, losartán…"
              />
            </Field>
            <Field label="Condiciones" htmlFor="p-cond">
              <Input
                id="p-cond"
                name="condiciones"
                defaultValue={patient?.condiciones ?? ""}
                placeholder="Diabetes, hipertensión…"
              />
            </Field>
          </div>
        </div>

        {/* Seguro + emergencia */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Seguro médico" htmlFor="p-seguro">
            <Select id="p-seguro" name="seguro" defaultValue={patient?.seguro ?? ""}>
              <option value="">No especificado</option>
              {SEGUROS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Número de póliza" htmlFor="p-poliza">
            <Input id="p-poliza" name="poliza" defaultValue={patient?.poliza ?? ""} placeholder="POL-000000" />
          </Field>
          <Field label="Contacto de emergencia" htmlFor="p-ce-n">
            <Input
              id="p-ce-n"
              name="contacto_emergencia_nombre"
              defaultValue={patient?.contacto_emergencia_nombre ?? ""}
              placeholder="Nombre del contacto"
            />
          </Field>
          <Field label="Tel. de emergencia" htmlFor="p-ce-t" error={err.contacto_emergencia_telefono}>
            <Input
              id="p-ce-t"
              name="contacto_emergencia_telefono"
              defaultValue={patient?.contacto_emergencia_telefono ?? ""}
              error={!!err.contacto_emergencia_telefono}
              placeholder="809-555-0100"
            />
          </Field>
        </div>

        <Field label="Notas" htmlFor="p-notas">
          <Textarea
            id="p-notas"
            name="notas"
            defaultValue={patient?.notas ?? ""}
            placeholder="Observaciones generales del paciente…"
          />
        </Field>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <SubmitButton edit={edit} />
        </div>
      </form>
    </Modal>
  );
}

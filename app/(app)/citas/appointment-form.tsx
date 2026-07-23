"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Search, UserPlus, Check, Save, AlertCircle, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { AppointmentRow, PatientBasic } from "@/lib/appointments";
import type { CatalogItem } from "@/lib/treatments";
import { createAppointment, updateAppointment, quickCreatePatient, type CitaFormState } from "./actions";
import { ESTADO_CITA, TRANSICIONES } from "./estado-config";

const DURACIONES = [30, 45, 60, 90, 120];

function Submit({ edit }: { edit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" icon={Save} loading={pending}>
      {pending ? "Guardando…" : edit ? "Guardar cambios" : "Agendar cita"}
    </Button>
  );
}

function PatientPicker({
  patients,
  value,
  onChange,
}: {
  patients: PatientBasic[];
  value: { id: string; nombre: string } | null;
  onChange: (p: { id: string; nombre: string } | null) => void;
}) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [nuevoNombre, setNuevoNombre] = React.useState("");
  const [nuevoTel, setNuevoTel] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const toast = useToast();

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return patients.slice(0, 8);
    return patients
      .filter((p) => p.nombre.toLowerCase().includes(s) || (p.telefono ?? "").includes(s))
      .slice(0, 8);
  }, [q, patients]);

  async function crear() {
    if (nuevoNombre.trim().length < 3) return;
    setBusy(true);
    const res = await quickCreatePatient(nuevoNombre, nuevoTel);
    setBusy(false);
    if (res.id && res.nombre) {
      onChange({ id: res.id, nombre: res.nombre });
      setCreating(false);
      setNuevoNombre("");
      setNuevoTel("");
      toast.success("Paciente creado", res.nombre);
    } else {
      toast.error("Error", res.error ?? "No se pudo crear.");
    }
  }

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-clinical-200 bg-clinical-50 px-3.5 py-2.5 dark:border-clinical-700/50 dark:bg-clinical-900/30">
        <span className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Check className="h-4 w-4 text-clinical" />
          {value.nombre}
        </span>
        <button type="button" onClick={() => onChange(null)} className="text-muted hover:text-danger">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!creating ? (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Buscar paciente por nombre o teléfono…"
              className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-fg placeholder:text-muted/70 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 dark:bg-navy-light"
            />
          </div>
          {open && (
            <div className="max-h-52 overflow-y-auto rounded-xl border border-border bg-surface shadow-card">
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted">Sin resultados.</p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onChange({ id: p.id, nombre: p.nombre });
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-2 dark:hover:bg-navy-lighter"
                  >
                    <span className="font-medium text-fg">{p.nombre}</span>
                    <span className="text-xs text-muted tabular">{p.telefono ?? ""}</span>
                  </button>
                ))
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-clinical hover:underline"
          >
            <UserPlus className="h-4 w-4" />
            ¿Paciente nuevo? Crear al instante
          </button>
        </>
      ) : (
        <div className="space-y-2 rounded-xl border border-border bg-surface-2/50 p-3 dark:bg-navy-lighter/30">
          <Input
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="Nombre completo"
          />
          <Input
            value={nuevoTel}
            onChange={(e) => setNuevoTel(e.target.value)}
            placeholder="Teléfono (opcional)"
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" icon={UserPlus} loading={busy} onClick={crear}>
              Crear y seleccionar
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppointmentFormModal({
  open,
  onClose,
  onSuccess,
  patients,
  dentists,
  catalog,
  prefill,
  cita,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patients: PatientBasic[];
  dentists: string[];
  catalog: CatalogItem[];
  prefill?: { fecha?: string; hora?: string } | null;
  cita?: AppointmentRow | null;
}) {
  const edit = !!cita;
  const action = edit ? updateAppointment : createAppointment;
  const [state, formAction] = useFormState<CitaFormState, FormData>(action, {});
  const [patient, setPatient] = React.useState<{ id: string; nombre: string } | null>(
    cita ? { id: cita.patient_id, nombre: cita.paciente } : null,
  );
  const [tratamiento, setTratamiento] = React.useState(cita?.tratamiento ?? "");
  const [tratamientoId, setTratamientoId] = React.useState("");
  const [duracion, setDuracion] = React.useState(String(cita?.duracion_min ?? 30));

  React.useEffect(() => {
    if (state.ok) onSuccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  const fe = state.fieldErrors ?? {};
  const dentOptions = Array.from(new Set([...(dentists ?? []), cita?.dentista_nombre ?? ""])).filter(Boolean);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edit ? "Editar cita" : "Nueva cita"}
      description={edit ? "Modifica los datos de la cita." : "Agenda una cita en el calendario."}
      className="max-w-xl"
    >
      <form action={formAction} className="space-y-4">
        {edit && <input type="hidden" name="id" value={cita!.id} />}
        <input type="hidden" name="patient_id" value={patient?.id ?? ""} />
        <input type="hidden" name="tratamiento" value={tratamiento} />
        <input type="hidden" name="tratamiento_id" value={tratamientoId} />

        {state.error && (
          <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm font-medium text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {state.error}
          </div>
        )}

        <Field label="Paciente" required error={fe.patient_id}>
          <PatientPicker patients={patients} value={patient} onChange={setPatient} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tratamiento" htmlFor="c-trat" required error={fe.tratamiento}>
            <Select
              id="c-trat"
              value={tratamiento}
              error={!!fe.tratamiento}
              onChange={(e) => {
                const val = e.target.value;
                setTratamiento(val);
                const item = catalog.find((c) => c.nombre === val);
                setTratamientoId(item?.id ?? "");
                if (item) setDuracion(String(item.duracion_min));
              }}
            >
              <option value="" disabled>
                Seleccionar…
              </option>
              {catalog.map((c) => (
                <option key={c.id} value={c.nombre}>
                  {c.nombre}
                </option>
              ))}
              {cita && !catalog.some((c) => c.nombre === cita.tratamiento) && (
                <option value={cita.tratamiento}>{cita.tratamiento}</option>
              )}
            </Select>
          </Field>
          <Field label="Odontólogo" htmlFor="c-dent">
            <Select id="c-dent" name="dentista_nombre" defaultValue={cita?.dentista_nombre ?? ""}>
              <option value="">Sin asignar</option>
              {dentOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha" htmlFor="c-fecha" required error={fe.fecha}>
            <Input
              id="c-fecha"
              name="fecha"
              type="date"
              defaultValue={cita?.fecha ?? prefill?.fecha ?? ""}
              error={!!fe.fecha}
              className="[color-scheme:light] dark:[color-scheme:dark]"
            />
          </Field>
          <Field label="Hora" htmlFor="c-hora" required error={fe.hora}>
            <Input
              id="c-hora"
              name="hora"
              type="time"
              step={900}
              defaultValue={cita?.hora ?? prefill?.hora ?? "09:00"}
              error={!!fe.hora}
              className="[color-scheme:light] dark:[color-scheme:dark]"
            />
          </Field>
          <Field label="Duración" htmlFor="c-dur">
            <Select id="c-dur" name="duracion_min" value={duracion} onChange={(e) => setDuracion(e.target.value)}>
              {Array.from(new Set([...DURACIONES, parseInt(duracion) || 30]))
                .sort((a, b) => a - b)
                .map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Estado" htmlFor="c-estado">
            <Select id="c-estado" name="estado" defaultValue={cita?.estado ?? "pendiente"}>
              {TRANSICIONES.map((e) => (
                <option key={e} value={e}>
                  {ESTADO_CITA[e].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Notas" htmlFor="c-notas">
          <Textarea id="c-notas" name="notas" defaultValue={cita?.notas ?? ""} placeholder="Notas de la cita…" />
        </Field>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Submit edit={edit} />
        </div>
      </form>
    </Modal>
  );
}

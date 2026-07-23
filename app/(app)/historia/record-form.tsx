"use client";

import * as React from "react";
import {
  UploadCloud,
  X,
  Save,
  ShieldCheck,
  AlertCircle,
  Activity,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createRecord, type RecordState } from "./actions";
import { ATTACH, ATTACH_TIPOS } from "./attachment-config";
import type { AttachmentTipo } from "@/lib/clinical";

interface PendingFile {
  file: File;
  tipo: AttachmentTipo;
  desc: string;
  preview: string | null;
}

export function RecordForm({
  open,
  onClose,
  onSuccess,
  patientId,
  odontologos,
  defaultOdontologo,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patientId: string;
  odontologos: string[];
  defaultOdontologo: string;
}) {
  const toast = useToast();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [pending, start] = React.useTransition();
  const [state, setState] = React.useState<RecordState>({});
  const [files, setFiles] = React.useState<PendingFile[]>([]);
  const [firmar, setFirmar] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: PendingFile[] = [];
    for (const file of Array.from(list)) {
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") continue;
      next.push({
        file,
        tipo: file.type === "application/pdf" ? "consentimiento" : "foto_antes",
        desc: "",
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      });
    }
    setFiles((f) => [...f, ...next].slice(0, 12));
  }

  function submit() {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    fd.set("patient_id", patientId);
    fd.set("firmar", firmar ? "true" : "false");
    fd.set("fileCount", String(files.length));
    files.forEach((pf, i) => {
      fd.set(`file_${i}`, pf.file);
      fd.set(`tipo_${i}`, pf.tipo);
      fd.set(`desc_${i}`, pf.desc);
    });
    start(async () => {
      const res = await createRecord(fd);
      setState(res);
      if (res.ok) {
        toast.success("Entrada registrada", firmar ? "Firmada y bloqueada" : undefined);
        setFiles([]);
        setFirmar(false);
        onSuccess();
      } else if (res.error) {
        toast.error("Error", res.error);
      }
    });
  }

  const fe = state.fieldErrors ?? {};

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva entrada de visita"
      description="Registra la consulta clínica del paciente."
      className="max-w-2xl"
    >
      <form ref={formRef} className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        {state.error && (
          <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm font-medium text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {state.error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha" htmlFor="r-fecha" required error={fe.fecha}>
            <Input
              id="r-fecha"
              name="fecha"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="[color-scheme:light] dark:[color-scheme:dark]"
            />
          </Field>
          <Field label="Odontólogo" htmlFor="r-odo">
            <Select id="r-odo" name="odontologo_nombre" defaultValue={defaultOdontologo}>
              {Array.from(new Set([defaultOdontologo, ...odontologos]))
                .filter(Boolean)
                .map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
            </Select>
          </Field>
        </div>

        <Field label="Motivo de consulta" htmlFor="r-motivo" error={fe.motivo_consulta}>
          <Input id="r-motivo" name="motivo_consulta" placeholder="Ej. Dolor en molar inferior derecho" />
        </Field>

        {/* Signos vitales */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-muted">
            <Activity className="h-3.5 w-3.5" /> Signos vitales
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Presión arterial" htmlFor="r-pa">
              <Input id="r-pa" name="presion_arterial" placeholder="120/80" inputMode="numeric" />
            </Field>
            <Field label="Frecuencia cardiaca (lpm)" htmlFor="r-fc">
              <Input id="r-fc" name="frecuencia_cardiaca" type="number" min={20} max={250} placeholder="72" />
            </Field>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Diagnóstico" htmlFor="r-diag">
            <Input id="r-diag" name="diagnostico" placeholder="Ej. Caries oclusal pieza 36" />
          </Field>
          <Field label="Tratamiento realizado" htmlFor="r-trat">
            <Input id="r-trat" name="tratamiento_realizado" placeholder="Ej. Obturación con resina" />
          </Field>
          <Field label="Materiales usados" htmlFor="r-mat">
            <Input id="r-mat" name="materiales_usados" placeholder="Resina A2, adhesivo…" />
          </Field>
          <Field label="Próxima cita recomendada" htmlFor="r-prox">
            <Input id="r-prox" name="proxima_cita_recomendada" type="date" className="[color-scheme:light] dark:[color-scheme:dark]" />
          </Field>
        </div>

        <Field label="Medicamentos recetados" htmlFor="r-meds">
          <Input id="r-meds" name="medicamentos_recetados" placeholder="Amoxicilina 500mg c/8h por 7 días" />
        </Field>

        <Field label="Notas clínicas" htmlFor="r-notas">
          <Textarea id="r-notas" name="notas_clinicas" className="min-h-[120px]" placeholder="Observaciones detalladas de la consulta…" />
        </Field>

        {/* Adjuntos drag & drop */}
        <div>
          <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-muted">
            Adjuntos (fotos, radiografías, consentimientos)
          </p>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragOver
                ? "border-clinical bg-clinical-50 dark:bg-clinical-900/30"
                : "border-border hover:border-clinical-300"
            }`}
          >
            <UploadCloud className="h-6 w-6 text-muted" />
            <span className="text-sm font-semibold text-fg">
              Arrastra archivos aquí o haz clic
            </span>
            <span className="text-xs text-muted">Imágenes o PDF, hasta 10 MB c/u</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="sr-only"
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>

          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((pf, i) => {
                const Icon = ATTACH[pf.tipo].icon;
                return (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-2">
                    {pf.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pf.preview} alt="" className="h-11 w-11 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-2 text-muted">
                        <Icon className="h-5 w-5" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-fg">{pf.file.name}</p>
                      <select
                        value={pf.tipo}
                        onChange={(e) =>
                          setFiles((arr) =>
                            arr.map((x, j) =>
                              j === i ? { ...x, tipo: e.target.value as AttachmentTipo } : x,
                            ),
                          )
                        }
                        className="mt-1 h-7 rounded-lg border border-border bg-surface px-2 text-xs text-fg dark:bg-navy-light"
                      >
                        {ATTACH_TIPOS.map((t) => (
                          <option key={t} value={t}>
                            {ATTACH[t].label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiles((arr) => arr.filter((_, j) => j !== i))}
                      className="text-muted hover:text-danger"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Firmar */}
        <label className="flex items-start gap-3 rounded-xl border border-border bg-surface-2/50 p-3 dark:bg-navy-lighter/30">
          <input
            type="checkbox"
            checked={firmar}
            onChange={(e) => setFirmar(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border text-clinical focus:ring-ring"
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-fg">
              <ShieldCheck className="h-4 w-4 text-mint" />
              Firmar y bloquear la entrada
            </span>
            <span className="text-xs text-muted">
              Una entrada firmada es inmutable: las correcciones se hacen con una enmienda.
            </span>
          </span>
        </label>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" icon={firmar ? ShieldCheck : Save} loading={pending} onClick={submit}>
            {pending ? "Guardando…" : firmar ? "Firmar y guardar" : "Guardar entrada"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

"use client";

import * as React from "react";
import { MessageCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type { ClinicSettings } from "@/lib/settings";
import { SectionShell, Field, inputCls, SaveButton, useUnsavedWarning } from "./ui";
import { saveCitasConfig } from "../actions";

const VARS = ["{paciente}", "{fecha}", "{hora}", "{odontologo}"];
const SAMPLE: Record<string, string> = {
  "{paciente}": "María Altagracia Peña",
  "{fecha}": "lunes 27 de julio",
  "{hora}": "10:00 AM",
  "{odontologo}": "Dra. Carolina Espaillat",
};

export function CitasSection({ clinic }: { clinic: ClinicSettings }) {
  const { success, error } = useToast();
  const [pending, start] = React.useTransition();
  const [c, setC] = React.useState(clinic.citasConfig);
  const [plantilla, setPlantilla] = React.useState(clinic.recordatorioPlantilla);
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  const initial = React.useRef(JSON.stringify({ c: clinic.citasConfig, p: clinic.recordatorioPlantilla }));
  const dirty = JSON.stringify({ c, p: plantilla }) !== initial.current;
  useUnsavedWarning(dirty);

  const num = (k: keyof typeof c, v: string) => setC((p) => ({ ...p, [k]: Math.max(0, Number(v) || 0) }));

  const preview = VARS.reduce((s, v) => s.split(v).join(SAMPLE[v]), plantilla);

  const insertVar = (v: string) => {
    const ta = taRef.current;
    if (!ta) { setPlantilla((p) => p + v); return; }
    const start0 = ta.selectionStart ?? plantilla.length;
    setPlantilla((p) => p.slice(0, start0) + v + p.slice(ta.selectionEnd ?? start0));
  };

  const onSave = () =>
    start(async () => {
      const res = await saveCitasConfig(c, plantilla);
      if (res.ok) { initial.current = JSON.stringify({ c, p: plantilla }); success("Configuración de citas guardada"); }
      else error("No se pudo guardar", res.error);
    });

  return (
    <SectionShell title="Configuración de citas" description="Reglas de agenda y recordatorios automáticos.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Duración por defecto (min)"><input type="number" className={inputCls} value={c.duracion_default} onChange={(e) => num("duracion_default", e.target.value)} /></Field>
        <Field label="Intervalo de slots">
          <select className={inputCls} value={c.intervalo_slot} onChange={(e) => setC((p) => ({ ...p, intervalo_slot: Number(e.target.value) }))}>
            {[15, 30, 60].map((v) => <option key={v} value={v}>{v} minutos</option>)}
          </select>
        </Field>
        <Field label="Días máximos de anticipación"><input type="number" className={inputCls} value={c.dias_anticipacion} onChange={(e) => num("dias_anticipacion", e.target.value)} /></Field>
        <Field label="Buffer entre citas (min)"><input type="number" className={inputCls} value={c.buffer_min} onChange={(e) => num("buffer_min", e.target.value)} /></Field>
        <Field label="Cancelación: aviso mínimo (horas)"><input type="number" className={inputCls} value={c.cancelacion_horas} onChange={(e) => num("cancelacion_horas", e.target.value)} /></Field>
        <Field label="Recordatorio: enviar antes (horas)"><input type="number" className={inputCls} value={c.recordatorio_horas} onChange={(e) => num("recordatorio_horas", e.target.value)} /></Field>
        <Field label="Canal del recordatorio">
          <select className={inputCls} value={c.recordatorio_canal} onChange={(e) => setC((p) => ({ ...p, recordatorio_canal: e.target.value }))}>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Correo</option>
            <option value="sms">SMS</option>
          </select>
        </Field>
      </div>

      <Field label="Plantilla del mensaje de recordatorio" hint="Usa las variables para personalizar cada mensaje.">
        <textarea ref={taRef} rows={3} className={`${inputCls} h-auto py-2`} value={plantilla} onChange={(e) => setPlantilla(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {VARS.map((v) => (
          <button key={v} onClick={() => insertVar(v)} className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-[11px] font-bold text-clinical hover:bg-clinical/10">{v}</button>
        ))}
      </div>

      {/* Preview del mensaje */}
      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Vista previa del recordatorio</p>
        <div className="flex items-start gap-2 rounded-2xl bg-surface-2/60 p-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint/15 text-mint"><MessageCircle className="h-4 w-4" /></span>
          <div className="max-w-sm rounded-2xl rounded-tl-sm bg-mint/10 px-3 py-2 text-[13px] leading-snug text-fg">{preview}</div>
        </div>
      </div>

      <SaveButton dirty={dirty} pending={pending} onClick={onSave} />
    </SectionShell>
  );
}

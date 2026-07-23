"use client";

import * as React from "react";
import { Instagram, Facebook, Globe, Phone, MapPin } from "lucide-react";
import { formatRD } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo";
import { useToast } from "@/components/ui/toast";
import type { ClinicSettings } from "@/lib/settings";
import { SectionShell, Field, inputCls, SaveButton, useUnsavedWarning } from "./ui";
import { saveIdentity } from "../actions";

export function IdentidadSection({ clinic }: { clinic: ClinicSettings }) {
  const { success, error } = useToast();
  const [pending, start] = React.useTransition();
  const [f, setF] = React.useState({
    nombre: clinic.nombre, eslogan: clinic.eslogan ?? "", direccion: clinic.direccion ?? "",
    telefono: clinic.telefono ?? "", email: clinic.email ?? "", rnc: clinic.rnc ?? "",
    sitioWeb: clinic.sitioWeb ?? "", colorAcento: clinic.colorAcento,
    instagram: clinic.redes.instagram ?? "", facebook: clinic.redes.facebook ?? "",
  });
  const initial = React.useRef(f);
  const dirty = JSON.stringify(f) !== JSON.stringify(initial.current);
  useUnsavedWarning(dirty);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const onSave = () =>
    start(async () => {
      const res = await saveIdentity({
        nombre: f.nombre, eslogan: f.eslogan, direccion: f.direccion, telefono: f.telefono,
        email: f.email, rnc: f.rnc, sitioWeb: f.sitioWeb, colorAcento: f.colorAcento,
        redes: { instagram: f.instagram, facebook: f.facebook },
      });
      if (res.ok) { initial.current = f; success("Identidad guardada", "Tu marca se aplicó en todo el sistema."); }
      else error("No se pudo guardar", res.error);
    });

  const accent = /^#[0-9a-fA-F]{6}$/.test(f.colorAcento) ? f.colorAcento : "#0066CC";

  return (
    <SectionShell
      title="Identidad de la clínica"
      description="Estos datos aparecen en facturas, la sala de espera y el portal del paciente."
      aside={<LivePreview f={f} accent={accent} />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre de la clínica"><input className={inputCls} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></Field>
        <Field label="Eslogan"><input className={inputCls} value={f.eslogan} onChange={(e) => set("eslogan", e.target.value)} placeholder="Tu sonrisa, nuestra pasión" /></Field>
        <Field label="RNC"><input className={inputCls} value={f.rnc} onChange={(e) => set("rnc", e.target.value)} /></Field>
        <Field label="Teléfono"><input className={inputCls} value={f.telefono} onChange={(e) => set("telefono", e.target.value)} /></Field>
        <Field label="Correo"><input className={inputCls} value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Sitio web"><input className={inputCls} value={f.sitioWeb} onChange={(e) => set("sitioWeb", e.target.value)} /></Field>
        <Field label="Dirección" className="sm:col-span-2"><input className={inputCls} value={f.direccion} onChange={(e) => set("direccion", e.target.value)} /></Field>
        <Field label="Instagram"><input className={inputCls} value={f.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@clinica" /></Field>
        <Field label="Facebook"><input className={inputCls} value={f.facebook} onChange={(e) => set("facebook", e.target.value)} /></Field>
      </div>

      <Field label="Color de acento" hint="Se aplica sobre la base del design system.">
        <div className="flex items-center gap-3">
          <input type="color" value={accent} onChange={(e) => set("colorAcento", e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-surface" />
          <input className={`${inputCls} max-w-[140px] tabular`} value={f.colorAcento} onChange={(e) => set("colorAcento", e.target.value)} />
          <div className="flex gap-1.5">
            {["#0066CC", "#00C896", "#8B5CF6", "#C9A84C", "#EF4444"].map((c) => (
              <button key={c} onClick={() => set("colorAcento", c)} className="h-7 w-7 rounded-lg ring-1 ring-border" style={{ background: c }} aria-label={c} />
            ))}
          </div>
        </div>
      </Field>

      <SaveButton dirty={dirty} pending={pending} onClick={onSave} />
    </SectionShell>
  );
}

function LivePreview({ f, accent }: { f: { nombre: string; eslogan: string; rnc: string; direccion: string; telefono: string; sitioWeb: string; instagram: string; facebook: string }; accent: string }) {
  return (
    <div className="space-y-3">
      <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted">Vista previa en vivo</p>

      {/* Factura */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white text-[#0A1628] shadow-card">
        <div className="flex items-start justify-between border-b-2 p-3" style={{ borderColor: accent }}>
          <div className="flex items-center gap-2">
            <LogoMark className="h-8 w-8" />
            <div>
              <p className="text-[13px] font-extrabold leading-tight">{f.nombre || "Clínica Dental"}</p>
              <p className="text-[9px] text-[#475569]">RNC: {f.rnc || "—"} · {f.direccion || "—"}</p>
            </div>
          </div>
          <p className="text-[11px] font-bold" style={{ color: accent }}>FACTURA</p>
        </div>
        <div className="space-y-1 p-3 text-[11px]">
          <div className="flex justify-between"><span className="text-[#475569]">Limpieza dental</span><span className="tabular">{formatRD(2500)}</span></div>
          <div className="flex justify-between"><span className="text-[#475569]">Resina compuesta</span><span className="tabular">{formatRD(3200)}</span></div>
          <div className="mt-1 flex justify-between border-t pt-1 font-extrabold" style={{ color: accent }}><span>Total</span><span className="tabular">{formatRD(5700)}</span></div>
        </div>
      </div>

      {/* Sala de espera */}
      <div className="overflow-hidden rounded-2xl border border-border shadow-card" style={{ background: `linear-gradient(160deg, ${accent}, #0A1628)` }}>
        <div className="flex items-center gap-2 p-3 text-white">
          <LogoMark className="h-8 w-8" glow />
          <div>
            <p className="text-[13px] font-black leading-tight">{f.nombre || "Clínica Dental"}</p>
            <p className="text-[10px] text-white/80">{f.eslogan || "Tu sonrisa, nuestra pasión"}</p>
          </div>
        </div>
        <div className="px-3 pb-3">
          <div className="rounded-lg bg-white/10 p-2 text-center text-white backdrop-blur">
            <p className="text-[9px] uppercase tracking-widest text-white/70">En turno</p>
            <p className="text-sm font-black">María A.</p>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-white/80">
            {f.instagram && <span className="inline-flex items-center gap-0.5"><Instagram className="h-3 w-3" />{f.instagram}</span>}
            {f.facebook && <span className="inline-flex items-center gap-0.5"><Facebook className="h-3 w-3" />{f.facebook}</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10px] text-muted">
        {f.telefono && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{f.telefono}</span>}
        {f.sitioWeb && <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" />{f.sitioWeb}</span>}
        {f.direccion && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{f.direccion}</span>}
      </div>
    </div>
  );
}

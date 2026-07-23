"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Maximize,
  Minimize,
  Clock as ClockIcon,
  AlertTriangle,
  Siren,
  X,
  LogOut,
  Armchair,
} from "lucide-react";
import { Aurora } from "@/components/brand/aurora";
import { LogoMark } from "@/components/brand/logo";
import { initials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { WaitingScreen } from "@/lib/waiting-room";
import { setEmergency } from "./actions";

const ESTADO_COLA: Record<string, { label: string; color: string }> = {
  sala_espera: { label: "En sala", color: "#F59E0B" },
  confirmada: { label: "Confirmada", color: "#0066CC" },
  pendiente: { label: "Por confirmar", color: "#94A3B8" },
};

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function Kiosk({
  initial,
  pollUrl,
  canControl,
  liveCapable,
}: {
  initial: WaitingScreen;
  pollUrl: string;
  canControl: boolean;
  liveCapable: boolean;
}) {
  const reduce = useReducedMotion();
  const [data, setData] = React.useState(initial);
  const [now, setNow] = React.useState<Date | null>(null);
  const [vertical, setVertical] = React.useState(false);
  const [fs, setFs] = React.useState(false);
  const [live, setLive] = React.useState(true);
  const [cursorHidden, setCursorHidden] = React.useState(false);
  const [content, setContent] = React.useState(0);
  const [emOpen, setEmOpen] = React.useState(false);
  const accent = data.clinic.colorAcento || "#0066CC";

  const refetch = React.useCallback(async () => {
    try {
      const res = await fetch(pollUrl, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as WaitingScreen;
      if (json?.clinic) setData(json);
      setLive(true);
    } catch {
      setLive(false);
    }
  }, [pollUrl]);

  // Reloj.
  React.useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Layout por orientación.
  React.useEffect(() => {
    const check = () => setVertical(window.innerHeight > window.innerWidth * 1.1);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Polling (fallback y kiosco por token).
  React.useEffect(() => {
    const t = setInterval(refetch, 15000);
    return () => clearInterval(t);
  }, [refetch]);

  // Realtime cuando hay sesión (respeta RLS).
  React.useEffect(() => {
    if (!liveCapable) return;
    let removed = false;
    try {
      const supabase = createClient();
      const ch = supabase
        .channel("sala-espera")
        .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => refetch())
        .subscribe();
      return () => {
        removed = true;
        supabase.removeChannel(ch);
      };
    } catch {
      /* fallback: polling */
    }
    return () => {
      void removed;
    };
  }, [liveCapable, refetch]);

  // Wake lock.
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const req = async () => {
      try {
        lock = await (navigator as Navigator & {
          wakeLock: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
        }).wakeLock.request("screen");
      } catch {
        /* silencioso */
      }
    };
    req();
    const onVis = () => document.visibilityState === "visible" && req();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release?.().catch(() => {});
    };
  }, []);

  // Ocultar cursor tras 5s.
  React.useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const move = () => {
      setCursorHidden(false);
      clearTimeout(t);
      t = setTimeout(() => setCursorHidden(true), 5000);
    };
    move();
    window.addEventListener("mousemove", move);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousemove", move);
    };
  }, []);

  // Carrusel.
  React.useEffect(() => {
    if (data.content.length <= 1) return;
    const t = setInterval(() => setContent((c) => (c + 1) % data.content.length), 7000);
    return () => clearInterval(t);
  }, [data.content.length]);

  // Fullscreen.
  React.useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  const fechaTxt = now
    ? `${DIAS[now.getDay()]}, ${now.getDate()} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`
    : "";
  const horaTxt = now
    ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`
    : "--:--:--";

  const container = `fixed inset-0 overflow-hidden select-none bg-bg text-fg ${cursorHidden ? "cursor-none" : ""}`;

  // ── Modo emergencia ──
  if (data.emergency) {
    const danger = data.emergency.severity === "danger";
    return (
      <div className={container}>
        <div className={`flex h-full flex-col items-center justify-center px-8 text-center ${danger ? "bg-danger" : "bg-amber"}`}>
          <motion.div
            animate={reduce ? {} : { scale: [1, 1.06, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex h-28 w-28 items-center justify-center rounded-full bg-white/20"
          >
            <Siren className="h-16 w-16 text-white" />
          </motion.div>
          <p className="mt-8 text-[clamp(1rem,3vw,2rem)] font-bold uppercase tracking-[0.3em] text-white/80">
            {danger ? "Emergencia" : "Aviso importante"}
          </p>
          <h1 className="mt-4 max-w-5xl text-[clamp(2.5rem,8vw,7rem)] font-black leading-tight text-white">
            {data.emergency.message}
          </h1>
        </div>
        {canControl && (
          <ControlBar
            hidden={cursorHidden}
            fs={fs}
            toggleFs={toggleFs}
            onEmergency={() => setEmOpen(true)}
          />
        )}
        {canControl && emOpen && <EmergencyPanel data={data} onClose={() => setEmOpen(false)} onDone={refetch} />}
      </div>
    );
  }

  // ── Fuera de horario ──
  if (!data.abierto) {
    return (
      <div className={container}>
        <Aurora className="opacity-60" />
        <div className="relative flex h-full flex-col items-center justify-center px-8 text-center">
          <LogoMark className="h-24 w-24" glow />
          <h1 className="mt-8 text-[clamp(2rem,6vw,5rem)] font-black tracking-tight text-fg">
            {data.clinic.nombre}
          </h1>
          <p className="mt-3 text-[clamp(1rem,2.5vw,1.75rem)] text-muted">{data.proximaApertura}</p>
          <div className="mt-10 font-black tabular text-fg" style={{ fontSize: "clamp(3rem,10vw,8rem)" }}>
            {horaTxt.slice(0, 5)}
          </div>
          <p className="text-lg capitalize text-muted">{fechaTxt}</p>
        </div>
        {canControl && <ControlBar hidden={cursorHidden} fs={fs} toggleFs={toggleFs} onEmergency={() => setEmOpen(true)} />}
        {canControl && emOpen && <EmergencyPanel data={data} onClose={() => setEmOpen(false)} onDone={refetch} />}
      </div>
    );
  }

  // ── Modo normal ──
  return (
    <div className={container}>
      <Aurora className="opacity-70" />
      <div className={`relative flex h-full flex-col gap-4 p-[clamp(1rem,3vw,2.5rem)]`}>
        {/* Top bar */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark className="h-[clamp(2.5rem,4vw,3.5rem)] w-[clamp(2.5rem,4vw,3.5rem)]" glow />
            <div>
              <p className="text-[clamp(1.1rem,2.4vw,1.9rem)] font-black leading-none tracking-tight text-fg">
                {data.clinic.nombre}
              </p>
              {data.clinic.eslogan && <p className="text-[clamp(0.7rem,1.2vw,1rem)] text-muted">{data.clinic.eslogan}</p>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-semibold text-muted backdrop-blur">
              <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-mint" : "bg-danger"}`} />
              {live ? "En vivo" : "Reconectando"}
            </span>
            <div className="text-right">
              <p className="font-black leading-none tabular text-fg" style={{ fontSize: "clamp(1.6rem,3.5vw,3rem)" }}>
                {horaTxt}
              </p>
              <p className="text-[clamp(0.65rem,1.1vw,0.95rem)] capitalize text-muted">{fechaTxt}</p>
            </div>
          </div>
        </header>

        {/* Cuerpo */}
        <div className={`grid min-h-0 flex-1 gap-4 ${vertical ? "grid-rows-[auto_1fr_auto]" : "grid-cols-[1.6fr_1fr]"}`}>
          {/* Columna principal */}
          <div className="flex min-h-0 flex-col gap-4">
            <EnTurnoHero data={data} accent={accent} reduce={!!reduce} />
            <ColaList data={data} vertical={vertical} />
          </div>

          {/* Carrusel */}
          <Carrusel data={data} index={content} reduce={!!reduce} accent={accent} />
        </div>
      </div>

      {canControl && <ControlBar hidden={cursorHidden} fs={fs} toggleFs={toggleFs} onEmergency={() => setEmOpen(true)} />}
      {canControl && emOpen && <EmergencyPanel data={data} onClose={() => setEmOpen(false)} onDone={refetch} />}
    </div>
  );
}

function EnTurnoHero({ data, accent, reduce }: { data: WaitingScreen; accent: string; reduce: boolean }) {
  const t = data.enTurno;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl border border-border bg-surface/60 p-[clamp(1rem,3vw,2rem)] text-center backdrop-blur-xl">
      <p className="text-[clamp(0.9rem,2vw,1.5rem)] font-bold uppercase tracking-[0.35em]" style={{ color: accent }}>
        En turno
      </p>
      <AnimatePresence mode="wait">
        {t ? (
          <motion.div
            key={t.display + t.hora}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 30, filter: "blur(14px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -20, filter: "blur(10px)" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center"
          >
            <div className="relative mt-3">
              {!reduce && (
                <motion.span
                  className="absolute inset-0 -z-10 rounded-full"
                  style={{ background: accent }}
                  animate={{ opacity: [0.15, 0.35, 0.15], scale: [1, 1.15, 1] }}
                  transition={{ duration: 2.4, repeat: Infinity }}
                />
              )}
              {data.clinic.mostrarFoto && t.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.fotoUrl} alt="" className="h-[clamp(5rem,12vh,9rem)] w-[clamp(5rem,12vh,9rem)] rounded-full object-cover ring-4 ring-white/40" />
              ) : (
                <span
                  className="flex h-[clamp(5rem,12vh,9rem)] w-[clamp(5rem,12vh,9rem)] items-center justify-center rounded-full text-[clamp(1.5rem,4vh,3rem)] font-black text-white"
                  style={{ background: accent }}
                >
                  {initials(t.display)}
                </span>
              )}
            </div>
            <h1 className="mt-5 font-black leading-none tracking-tight text-fg" style={{ fontSize: "clamp(2.5rem,8vw,7rem)" }}>
              {t.display}
            </h1>
            <div className="mt-4 flex items-center gap-4 text-[clamp(0.9rem,2vw,1.5rem)] font-bold text-muted">
              <span className="tabular">{t.hora}</span>
              {t.consultorio && (
                <span className="inline-flex items-center gap-2 rounded-full px-4 py-1 text-white" style={{ background: accent }}>
                  <Armchair className="h-5 w-5" /> Consultorio {t.consultorio}
                </span>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
            <p className="text-[clamp(1.5rem,5vw,3.5rem)] font-black text-fg">{data.clinic.mensajeBienvenida}</p>
            <p className="mt-2 text-[clamp(0.9rem,2vw,1.3rem)] text-muted">Enseguida llamamos al siguiente paciente.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ColaList({ data, vertical }: { data: WaitingScreen; vertical: boolean }) {
  const cola = data.cola.slice(0, vertical ? 6 : 5);
  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-[clamp(0.75rem,2vw,1.25rem)] backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[clamp(0.8rem,1.6vw,1.1rem)] font-bold uppercase tracking-wider text-muted">Siguientes</p>
        {data.siguiente && (
          <p className="text-[clamp(0.8rem,1.6vw,1.1rem)] font-bold text-fg">
            Siguiente: <span className="text-clinical">{data.siguiente.display}</span>
          </p>
        )}
      </div>
      {cola.length === 0 ? (
        <p className="py-4 text-center text-[clamp(0.9rem,2vw,1.2rem)] text-muted">No hay pacientes en espera.</p>
      ) : (
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {cola.map((c, i) => {
              const st = ESTADO_COLA[c.estado] ?? { label: c.estado, color: "#94A3B8" };
              return (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-3 rounded-xl bg-surface/70 px-3 py-2"
                >
                  <span className="w-7 text-center text-[clamp(0.9rem,1.6vw,1.2rem)] font-black tabular text-muted">{i + 1}</span>
                  <span className="flex-1 truncate text-[clamp(1rem,2vw,1.5rem)] font-bold text-fg">{c.display}</span>
                  <span className="hidden items-center gap-1.5 sm:flex">
                    <span className="h-2 w-2 rounded-full" style={{ background: st.color }} />
                    <span className="text-[clamp(0.7rem,1.3vw,1rem)] font-semibold text-muted">{st.label}</span>
                  </span>
                  <span className="tabular text-[clamp(0.85rem,1.5vw,1.15rem)] font-semibold text-muted">{c.hora}</span>
                  <span className="rounded-lg bg-clinical-50 px-2 py-0.5 text-[clamp(0.7rem,1.3vw,1rem)] font-bold text-clinical tabular dark:bg-clinical-900/40 dark:text-clinical-200">
                    {c.esperaMin <= 0 ? "Pronto" : `~${c.esperaMin} min`}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function Carrusel({ data, index, reduce, accent }: { data: WaitingScreen; index: number; reduce: boolean; accent: string }) {
  const item = data.content[index];
  const tipoLabel: Record<string, string> = { consejo: "Consejo de salud", anuncio: "Novedades", recordatorio: "Recordatorio" };
  return (
    <div className="relative flex min-h-0 flex-col overflow-hidden rounded-3xl border border-border p-[clamp(1rem,3vw,2rem)] text-white" style={{ background: `linear-gradient(160deg, ${accent}, #0A1628)` }}>
      <p className="text-[clamp(0.75rem,1.5vw,1.1rem)] font-bold uppercase tracking-[0.25em] text-white/70">
        {item ? tipoLabel[item.tipo] ?? "Información" : "Información"}
      </p>
      <div className="flex flex-1 items-center">
        <AnimatePresence mode="wait">
          {item && (
            <motion.div
              key={index}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -24 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="text-[clamp(1.5rem,3.5vw,3rem)] font-black leading-tight">{item.titulo}</h2>
              <p className="mt-3 text-[clamp(0.95rem,1.9vw,1.5rem)] leading-relaxed text-white/85">{item.cuerpo}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {data.content.length > 1 && (
        <div className="flex gap-1.5">
          {data.content.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/40"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function ControlBar({ hidden, fs, toggleFs, onEmergency }: { hidden: boolean; fs: boolean; toggleFs: () => void; onEmergency: () => void }) {
  return (
    <div className={`fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-border bg-surface/90 p-1.5 shadow-card-hover backdrop-blur transition-opacity ${hidden ? "pointer-events-none opacity-0" : "opacity-100"}`}>
      <button onClick={toggleFs} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-fg hover:bg-surface-2">
        {fs ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        {fs ? "Salir" : "Pantalla completa"}
      </button>
      <button onClick={onEmergency} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-amber hover:bg-amber/10">
        <AlertTriangle className="h-4 w-4" /> Emergencia
      </button>
      <Link href="/dashboard" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-2">
        <LogOut className="h-4 w-4" /> Salir
      </Link>
    </div>
  );
}

function EmergencyPanel({ data, onClose, onDone }: { data: WaitingScreen; onClose: () => void; onDone: () => void }) {
  const [msg, setMsg] = React.useState(data.emergency?.message ?? "Retraso de 30 minutos por emergencia en curso.");
  const [sev, setSev] = React.useState<"warning" | "danger">(data.emergency?.severity ?? "warning");
  const [pending, start] = React.useTransition();
  const active = !!data.emergency;

  const apply = (on: boolean) =>
    start(async () => {
      await setEmergency(on, msg, sev);
      onDone();
      onClose();
    });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-fg">
            <Siren className="h-5 w-5 text-amber" /> Modo emergencia
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-2"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-1 text-sm text-muted">Muestra un mensaje prioritario a pantalla completa en la sala.</p>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={3}
          className="mt-4 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-fg dark:bg-navy-light"
          placeholder="Mensaje para la sala…"
        />
        <div className="mt-3 flex gap-2">
          {(["warning", "danger"] as const).map((s) => (
            <button key={s} onClick={() => setSev(s)} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold capitalize transition-all ${sev === s ? "ring-2 ring-clinical/40 border-clinical" : "border-border"}`} style={{ color: s === "danger" ? "#EF4444" : "#F59E0B" }}>
              {s === "danger" ? "Emergencia (rojo)" : "Aviso (ámbar)"}
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          {active && (
            <button disabled={pending} onClick={() => apply(false)} className="rounded-xl px-4 py-2 text-sm font-bold text-mint hover:bg-mint/10">
              Desactivar
            </button>
          )}
          <button disabled={pending} onClick={() => apply(true)} className="rounded-xl bg-clinical px-5 py-2 text-sm font-bold text-white hover:bg-clinical-600">
            {active ? "Actualizar" : "Activar"}
          </button>
        </div>
      </div>
    </div>
  );
}

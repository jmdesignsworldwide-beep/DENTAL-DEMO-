"use client";

import * as React from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import {
  Sun,
  Moon,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Check,
  Clock,
  Stethoscope,
  MapPin,
  Phone,
  MessageCircle,
  CreditCard,
  Sparkles,
  ShieldCheck,
  Crown,
  Activity,
  Bell,
  History,
  RefreshCw,
  X,
  Send,
  Smile,
} from "lucide-react";
import { formatRD, initials } from "@/lib/utils";
import type { PortalData, PortalRecordatorio } from "@/lib/patient-portal";

type Theme = "light" | "dark";

const REC_ICON: Record<string, React.ElementType> = {
  ortodoncia: Smile,
  endodoncia: Activity,
  extraccion: ShieldCheck,
  limpieza: Sparkles,
  blanqueamiento: Sparkles,
  corona: Crown,
  resina: Check,
  implante: ShieldCheck,
  general: Bell,
};

const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  seguro: "Seguro",
  mixto: "Mixto",
};

function greetingNow(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

const listV: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const itemV: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 30 } },
};

export function PatientPortal({
  data,
  theme,
  onToggleTheme,
}: {
  data: PortalData;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const reduce = useReducedMotion();
  const accent = data.colorAcento || "#0066CC";
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const [confirmed, setConfirmed] = React.useState(false);
  const [changeOpen, setChangeOpen] = React.useState(false);
  const [citaOpen, setCitaOpen] = React.useState(false);
  const [payOpen, setPayOpen] = React.useState(false);
  const [icsDone, setIcsDone] = React.useState(false);

  // Pull-to-refresh (visual, gesto móvil real).
  const [pull, setPull] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const startY = React.useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if ((scrollRef.current?.scrollTop ?? 0) <= 0) startY.current = e.touches[0].clientY;
    else startY.current = null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setPull(Math.min(80, dy * 0.5));
  };
  const onTouchEnd = () => {
    if (pull > 55 && !refreshing) {
      setRefreshing(true);
      window.setTimeout(() => {
        setRefreshing(false);
        setPull(0);
      }, 800);
    } else {
      setPull(0);
    }
    startY.current = null;
  };

  const downloadIcs = () => {
    const c = data.proximaCita;
    if (!c) return;
    const dt = `${c.fechaISO.replace(/-/g, "")}T${c.horaISO.replace(":", "")}00`;
    const [hh, mm] = c.horaISO.split(":").map(Number);
    const endMin = hh * 60 + mm + c.duracionMin;
    const eh = String(Math.floor(endMin / 60)).padStart(2, "0");
    const em = String(endMin % 60).padStart(2, "0");
    const dtEnd = `${c.fechaISO.replace(/-/g, "")}T${eh}${em}00`;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Clinica Dental//Portal//ES",
      "BEGIN:VEVENT",
      `UID:cita-${c.fechaISO}-${c.horaISO}@clinica`,
      `DTSTART:${dt}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${c.tratamiento} — ${data.clinicaNombre}`,
      `DESCRIPTION:Cita con ${c.dentista}`,
      `LOCATION:${data.contacto.direccion}`,
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      "DESCRIPTION:Recordatorio de cita",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cita-dental.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setIcsDone(true);
    window.setTimeout(() => setIcsDone(false), 2200);
  };

  const primary = { background: accent } as React.CSSProperties;

  return (
    <div
      className="portal-scope no-scrollbar relative flex h-full w-full flex-col overflow-hidden font-sans"
      data-portal-theme={theme}
    >
      {/* Fondo suave con halo del acento */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-[0.14]"
        style={{ background: `radial-gradient(120% 80% at 50% 0%, ${accent}, transparent 70%)` }}
      />

      {/* Pull-to-refresh */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center"
        style={{ height: pull, opacity: pull > 8 || refreshing ? 1 : 0 }}
      >
        <div className="mt-2 flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted shadow-card">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} style={{ color: accent }} />
          {refreshing ? "Actualizando…" : pull > 55 ? "Suelta para actualizar" : "Desliza para actualizar"}
        </div>
      </div>

      <div
        ref={scrollRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="no-scrollbar relative z-10 flex-1 overflow-y-auto overflow-x-hidden"
        style={{ transform: pull ? `translateY(${pull}px)` : undefined, transition: pull ? "none" : "transform 0.3s" }}
      >
        {/* Header (deja espacio para el notch / dynamic island) */}
        <header className="flex items-center justify-between px-5 pb-2 pt-9">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-card" style={primary}>
              <ToothGlyph className="h-5 w-5" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13px] font-extrabold tracking-tight text-fg">{data.clinicaNombre}</p>
              <p className="truncate text-[10px] font-medium text-muted">{data.clinicaEslogan ?? "Tu portal de paciente"}</p>
            </div>
          </div>
          <button
            onClick={onToggleTheme}
            aria-label="Cambiar tema"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-fg"
          >
            {theme === "dark" ? <Moon className="h-4 w-4 text-gold-light" /> : <Sun className="h-4 w-4 text-amber" />}
          </button>
        </header>

        {/* Saludo */}
        <div className="flex items-center gap-3 px-5 pb-3 pt-2">
          {data.patient.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.patient.fotoUrl} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-white/50" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full text-base font-black text-white" style={primary}>
              {initials(data.patient.nombre)}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted">{greetingNow()},</p>
            <div className="flex items-center gap-1.5">
              <p className="truncate text-lg font-extrabold tracking-tight text-fg">{data.patient.primerNombre}</p>
              {data.patient.esVip && (
                <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white" style={{ background: "#C9A84C" }}>
                  <Crown className="h-2.5 w-2.5" /> VIP
                </span>
              )}
            </div>
          </div>
        </div>

        <motion.div
          variants={reduce ? undefined : listV}
          initial={reduce ? undefined : "hidden"}
          animate={reduce ? undefined : "show"}
          className="space-y-3.5 px-4 pb-24 pt-1"
        >
          {/* ── Próxima cita ── */}
          <motion.section variants={itemV}>
            {data.proximaCita ? (
              <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-4 shadow-card">
                <div className="absolute right-0 top-0 h-24 w-24 opacity-20" style={{ background: `radial-gradient(circle at 70% 20%, ${accent}, transparent 60%)` }} />
                <div className="relative flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                    <CalendarClock className="h-3.5 w-3.5" /> Próxima cita
                  </span>
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-black text-white" style={primary}>
                    {data.proximaCita.cuenta}
                  </span>
                </div>
                <p className="relative mt-2 text-[22px] font-extrabold capitalize leading-tight text-fg">
                  {data.proximaCita.fechaLarga}
                </p>
                <div className="relative mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-semibold text-muted">
                  <span className="inline-flex items-center gap-1.5 tabular"><Clock className="h-3.5 w-3.5" />{data.proximaCita.hora}</span>
                  <span className="inline-flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5" />{data.proximaCita.dentista}</span>
                </div>
                <div className="relative mt-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px] font-semibold text-fg">
                  {data.proximaCita.tratamiento}
                  <span className="ml-1 text-muted">· {data.proximaCita.duracionMin} min</span>
                </div>

                <div className="relative mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setConfirmed(true)}
                    disabled={confirmed}
                    className="col-span-2 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-transform active:scale-[0.98]"
                    style={confirmed ? { background: "#00C896" } : primary}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {confirmed ? (
                        <motion.span key="ok" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" /> ¡Cita confirmada!
                        </motion.span>
                      ) : (
                        <motion.span key="cf" exit={{ opacity: 0 }} className="flex items-center gap-2">
                          <Check className="h-4 w-4" /> Confirmar cita
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                  <button
                    onClick={() => setChangeOpen((v) => !v)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface py-2.5 text-[13px] font-bold text-fg transition-transform active:scale-[0.98]"
                  >
                    <CalendarClock className="h-4 w-4" /> Cambiar
                  </button>
                  <button
                    onClick={downloadIcs}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface py-2.5 text-[13px] font-bold text-fg transition-transform active:scale-[0.98]"
                  >
                    {icsDone ? <Check className="h-4 w-4 text-mint" /> : <CalendarPlus className="h-4 w-4" />}
                    {icsDone ? "Añadida" : "Calendario"}
                  </button>
                </div>

                <AnimatePresence>
                  {changeOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="relative overflow-hidden"
                    >
                      <ChangeForm accent={accent} onDone={() => setChangeOpen(false)} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <EmptyCita accent={accent} onSolicitar={() => setCitaOpen(true)} />
            )}
          </motion.section>

          {/* ── Tratamiento en curso ── */}
          {data.plan && (
            <motion.section variants={itemV}>
              <PlanCard plan={data.plan} accent={accent} reduce={!!reduce} />
            </motion.section>
          )}

          {/* ── Recordatorios personalizados ── */}
          {data.recordatorios.length > 0 && (
            <motion.section variants={itemV} className="space-y-2">
              <SectionTitle icon={Bell} accent={accent}>Recomendaciones para ti</SectionTitle>
              <div className="space-y-2">
                {data.recordatorios.map((r) => (
                  <RecCard key={r.key} rec={r} accent={accent} />
                ))}
              </div>
            </motion.section>
          )}

          {/* ── Mi boca (odontograma simplificado) ── */}
          <motion.section variants={itemV}>
            <MouthCard boca={data.boca} accent={accent} />
          </motion.section>

          {/* ── Estado de cuenta ── */}
          <motion.section variants={itemV}>
            <AccountCard cuenta={data.cuenta} accent={accent} onPay={() => setPayOpen(true)} />
          </motion.section>

          {/* ── Historial ── */}
          {data.historial.length > 0 && (
            <motion.section variants={itemV} className="space-y-2">
              <SectionTitle icon={History} accent={accent}>Historial de tratamientos</SectionTitle>
              <div className="rounded-2xl border border-border bg-surface p-1.5 shadow-card">
                {data.historial.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-2.5 py-2">
                    <span className="relative flex flex-col items-center self-stretch">
                      <span className="h-2 w-2 rounded-full" style={primary} />
                      {i < data.historial.length - 1 && <span className="mt-0.5 w-px flex-1 bg-border" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-fg">{h.tratamiento}</p>
                      <p className="truncate text-[11px] text-muted">{h.dentista}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold tabular text-muted">{h.fechaCorta}</span>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* ── Contacto ── */}
          <motion.section variants={itemV} className="space-y-2">
            <SectionTitle icon={MapPin} accent={accent}>Contáctanos</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              <ContactBtn href={`tel:${data.contacto.telefono}`} icon={Phone} label="Llamar" accent={accent} />
              <ContactBtn href={`https://wa.me/${data.contacto.whatsapp}`} icon={MessageCircle} label="WhatsApp" accent={accent} />
              <ContactBtn href={data.contacto.mapsUrl} icon={MapPin} label="Cómo llegar" accent={accent} />
            </div>
            <p className="px-1 pt-0.5 text-center text-[11px] text-muted">{data.contacto.direccion}</p>
          </motion.section>

          {/* ── Solicitar cita ── */}
          <motion.section variants={itemV}>
            <button
              onClick={() => setCitaOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-card transition-transform active:scale-[0.98]"
              style={primary}
            >
              <CalendarPlus className="h-4 w-4" /> Solicitar una cita
            </button>
          </motion.section>
        </motion.div>
      </div>

      {/* Sheets / modales */}
      <AnimatePresence>
        {citaOpen && <RequestSheet key="req" title="Solicitar una cita" accent={accent} onClose={() => setCitaOpen(false)} />}
        {payOpen && <PaySheet key="pay" balance={data.cuenta.balance} accent={accent} onClose={() => setPayOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────── Subcomponentes ───────────────────────────

function SectionTitle({ icon: Icon, accent, children }: { icon: React.ElementType; accent: string; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-1.5 px-1 text-[12px] font-extrabold uppercase tracking-wider text-muted">
      <Icon className="h-3.5 w-3.5" style={{ color: accent }} /> {children}
    </h2>
  );
}

function PlanCard({ plan, accent, reduce }: { plan: NonNullable<PortalData["plan"]>; accent: string; reduce: boolean }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
            <Activity className="h-3.5 w-3.5" /> Tratamiento en curso
          </span>
          <p className="mt-1 text-[15px] font-extrabold leading-tight text-fg">{plan.titulo}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-black tabular leading-none" style={{ color: accent }}>{plan.progresoPct}%</p>
          <p className="text-[10px] font-semibold text-muted">completado</p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-full"
          style={{ background: accent }}
          initial={reduce ? undefined : { width: 0 }}
          whileInView={{ width: `${plan.progresoPct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* Etapas */}
      <ol className="mt-3.5 space-y-0">
        {plan.etapas.map((e, i) => {
          const done = e.estado === "completada";
          const active = e.estado === "en_progreso";
          return (
            <li key={e.orden} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black"
                  style={
                    done
                      ? { background: "#00C896", color: "#fff" }
                      : active
                        ? { background: accent, color: "#fff", boxShadow: `0 0 0 4px ${accent}22` }
                        : { background: "transparent", color: "inherit", border: "2px solid hsl(var(--border))" }
                  }
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : e.orden}
                </span>
                {i < plan.etapas.length - 1 && (
                  <span className="my-0.5 w-0.5 flex-1" style={{ background: done ? "#00C896" : "hsl(var(--border))", minHeight: 18 }} />
                )}
              </div>
              <div className={`pb-3 ${active ? "" : "opacity-90"}`}>
                <div className="flex items-center gap-2">
                  <p className={`text-[13px] font-bold ${active ? "text-fg" : done ? "text-fg" : "text-muted"}`}>{e.titulo}</p>
                  {active && (
                    <span className="rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase text-white" style={{ background: accent }}>Ahora</span>
                  )}
                </div>
                {e.descripcion && <p className="mt-0.5 text-[11px] leading-snug text-muted">{e.descripcion}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      {plan.costoTotal != null && (
        <div className="mt-1 flex items-center justify-between border-t border-border pt-2.5 text-[12px]">
          <span className="font-semibold text-muted">Inversión del plan</span>
          <span className="font-black tabular text-fg">{formatRD(plan.costoTotal)}</span>
        </div>
      )}
    </div>
  );
}

function RecCard({ rec, accent }: { rec: PortalRecordatorio; accent: string }) {
  const Icon = REC_ICON[rec.key] ?? Bell;
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${accent}1a`, color: accent }}>
        <Icon style={{ width: 18, height: 18 }} />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-fg">{rec.titulo}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted">{rec.cuerpo}</p>
      </div>
    </div>
  );
}

function MouthCard({ boca, accent }: { boca: PortalData["boca"]; accent: string }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
          <Smile className="h-3.5 w-3.5" /> Mi boca
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-fg">
          <span className="h-2 w-2 rounded-full" style={{ background: "#00C896" }} /> {boca.sanos} sanos
        </span>
      </div>

      {boca.dientes.length === 0 ? (
        <div className="mt-3 flex flex-col items-center py-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "#00C89620" }}>
            <Smile className="h-6 w-6" style={{ color: "#00C896" }} />
          </span>
          <p className="mt-2 text-[13px] font-bold text-fg">¡Todo en orden!</p>
          <p className="text-[11px] text-muted">No hay hallazgos pendientes en tu última revisión.</p>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {boca.dientes.map((d) => (
              <span
                key={d.fdi}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2 py-1 text-[11px] font-bold text-fg"
                title={d.nota ?? d.etiqueta}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded text-[8px] font-black text-white" style={{ background: d.color }}>
                  {d.fdi}
                </span>
                {d.etiqueta}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2.5">
            {boca.resumen.map((r) => (
              <span key={r.estado} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: r.color }} /> {r.etiqueta} ({r.count})
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AccountCard({ cuenta, accent, onPay }: { cuenta: PortalData["cuenta"]; accent: string; onPay: () => void }) {
  const alDia = cuenta.balance <= 0;
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
            <CreditCard className="h-3.5 w-3.5" /> Estado de cuenta
          </span>
          {alDia && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase text-white" style={{ background: "#00C896" }}>
              <CheckCircle2 className="h-3 w-3" /> Al día
            </span>
          )}
        </div>

        {alDia ? (
          <p className="mt-2 text-[13px] font-semibold text-fg">
            No tienes balance pendiente. <span className="text-muted">¡Gracias por mantenerte al día!</span>
          </p>
        ) : (
          <div className="mt-2 flex items-end justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted">Balance pendiente</p>
              <p className="text-[26px] font-black tabular leading-none text-fg">{formatRD(cuenta.balance)}</p>
            </div>
            <button
              onClick={onPay}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-transform active:scale-[0.98]"
              style={{ background: accent }}
            >
              <CreditCard className="h-4 w-4" /> Pagar
            </button>
          </div>
        )}
      </div>

      {cuenta.pagos.length > 0 && (
        <div className="border-t border-border bg-surface-2/40 px-4 py-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">Pagos recientes</p>
          <div className="space-y-1">
            {cuenta.pagos.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-2 font-semibold text-fg">
                  <Check className="h-3.5 w-3.5 text-mint" />
                  {METODO_LABEL[p.metodo] ?? p.metodo}
                  <span className="text-muted">· {p.fechaCorta}</span>
                </span>
                <span className="font-bold tabular text-fg">{formatRD(p.monto)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyCita({ accent, onSolicitar }: { accent: string; onSolicitar: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface p-6 text-center shadow-card">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${accent}1a`, color: accent }}>
        <CalendarClock className="h-6 w-6" />
      </span>
      <p className="mt-2 text-[14px] font-extrabold text-fg">No tienes citas próximas</p>
      <p className="mt-0.5 text-[12px] text-muted">Agenda tu próxima visita en segundos.</p>
      <button onClick={onSolicitar} className="mx-auto mt-3 flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ background: accent }}>
        <CalendarPlus className="h-4 w-4" /> Solicitar cita
      </button>
    </div>
  );
}

function ContactBtn({ href, icon: Icon, label, accent }: { href: string; icon: React.ElementType; label: string; accent: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface py-3 text-[11px] font-bold text-fg shadow-card transition-transform active:scale-[0.97]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${accent}1a`, color: accent }}>
        <Icon style={{ width: 18, height: 18 }} />
      </span>
      {label}
    </a>
  );
}

function ChangeForm({ accent, onDone }: { accent: string; onDone: () => void }) {
  const [sent, setSent] = React.useState(false);
  const [pref, setPref] = React.useState<string | null>(null);
  const opciones = ["Mañana", "Tarde", "Fin de semana", "Otra fecha"];
  return (
    <div className="mt-3 rounded-2xl border border-border bg-surface-2 p-3">
      {sent ? (
        <p className="flex items-center justify-center gap-2 py-2 text-[13px] font-bold text-fg">
          <CheckCircle2 className="h-4 w-4 text-mint" /> Solicitud enviada. Te contactaremos.
        </p>
      ) : (
        <>
          <p className="text-[12px] font-bold text-fg">¿Qué horario te conviene más?</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {opciones.map((o) => (
              <button
                key={o}
                onClick={() => setPref(o)}
                className="rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors"
                style={pref === o ? { background: accent, color: "#fff", borderColor: accent } : { borderColor: "hsl(var(--border))", color: "hsl(var(--fg))" }}
              >
                {o}
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex gap-2">
            <button onClick={onDone} className="flex-1 rounded-lg border border-border py-2 text-[12px] font-bold text-muted">Cancelar</button>
            <button
              onClick={() => { setSent(true); window.setTimeout(onDone, 1400); }}
              disabled={!pref}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-bold text-white disabled:opacity-50"
              style={{ background: accent }}
            >
              <Send className="h-3.5 w-3.5" /> Enviar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="absolute inset-0 z-40 flex items-end bg-black/40 backdrop-blur-[2px]"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-3xl border-t border-border bg-surface p-5 pb-7"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function RequestSheet({ title, accent, onClose }: { title: string; accent: string; onClose: () => void }) {
  const [sent, setSent] = React.useState(false);
  const [motivo, setMotivo] = React.useState<string | null>(null);
  const motivos = ["Limpieza", "Dolor / urgencia", "Evaluación", "Ortodoncia", "Estética", "Otro"];
  return (
    <Sheet onClose={onClose}>
      <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />
      {sent ? (
        <div className="flex flex-col items-center py-4 text-center">
          <motion.span initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "#00C896" }}>
            <Check className="h-7 w-7 text-white" />
          </motion.span>
          <p className="mt-3 text-base font-extrabold text-fg">¡Solicitud enviada!</p>
          <p className="mt-1 text-[13px] text-muted">Recepción te confirmará tu cita muy pronto.</p>
          <button onClick={onClose} className="mt-4 rounded-xl px-6 py-2.5 text-sm font-bold text-white" style={{ background: accent }}>Listo</button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-fg">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1 text-muted"><X className="h-5 w-5" /></button>
          </div>
          <p className="mt-1 text-[12px] text-muted">Cuéntanos el motivo y te contactamos.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {motivos.map((m) => (
              <button
                key={m}
                onClick={() => setMotivo(m)}
                className="rounded-xl border px-3 py-2.5 text-[13px] font-bold transition-colors"
                style={motivo === m ? { background: accent, color: "#fff", borderColor: accent } : { borderColor: "hsl(var(--border))", color: "hsl(var(--fg))" }}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSent(true)}
            disabled={!motivo}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: accent }}
          >
            <Send className="h-4 w-4" /> Enviar solicitud
          </button>
        </>
      )}
    </Sheet>
  );
}

function PaySheet({ balance, accent, onClose }: { balance: number; accent: string; onClose: () => void }) {
  const [done, setDone] = React.useState(false);
  const [metodo, setMetodo] = React.useState<string>("tarjeta");
  const metodos = [
    { k: "tarjeta", label: "Tarjeta" },
    { k: "transferencia", label: "Transferencia" },
    { k: "efectivo", label: "En clínica" },
  ];
  return (
    <Sheet onClose={onClose}>
      <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />
      {done ? (
        <div className="flex flex-col items-center py-4 text-center">
          <motion.span initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "#00C896" }}>
            <Check className="h-7 w-7 text-white" />
          </motion.span>
          <p className="mt-3 text-base font-extrabold text-fg">Pago registrado</p>
          <p className="mt-1 text-[13px] text-muted">Recibirás tu comprobante con NCF por correo.</p>
          <button onClick={onClose} className="mt-4 rounded-xl px-6 py-2.5 text-sm font-bold text-white" style={{ background: accent }}>Listo</button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-fg">Pagar balance</h3>
            <button onClick={onClose} className="rounded-lg p-1 text-muted"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-3 rounded-2xl bg-surface-2 p-3 text-center">
            <p className="text-[11px] font-semibold text-muted">Monto a pagar</p>
            <p className="text-[28px] font-black tabular leading-none text-fg">{formatRD(balance)}</p>
          </div>
          <p className="mt-3 text-[12px] font-bold text-fg">Método de pago</p>
          <div className="mt-2 space-y-1.5">
            {metodos.map((m) => (
              <button
                key={m.k}
                onClick={() => setMetodo(m.k)}
                className="flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-[13px] font-bold transition-colors"
                style={metodo === m.k ? { borderColor: accent, background: `${accent}12`, color: "hsl(var(--fg))" } : { borderColor: "hsl(var(--border))", color: "hsl(var(--fg))" }}
              >
                {m.label}
                <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ border: `2px solid ${metodo === m.k ? accent : "hsl(var(--border))"}` }}>
                  {metodo === m.k && <span className="h-2 w-2 rounded-full" style={{ background: accent }} />}
                </span>
              </button>
            ))}
          </div>
          <button onClick={() => setDone(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white" style={{ background: accent }}>
            <CreditCard className="h-4 w-4" /> Confirmar pago
          </button>
          <p className="mt-2 text-center text-[10px] text-muted">Demostración — no se procesa ningún cobro real.</p>
        </>
      )}
    </Sheet>
  );
}

/** Isotipo dental compacto para el header del portal. */
function ToothGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 4c-1.7-1.3-4.1-1.2-5.3.3-1.3 1.6-.9 4-.3 6.2.35 1.25.65 3.1 1 4.45.2.8.5 1.65 1.1 1.65.7 0 .8-1 .95-1.85.15-.85.3-2.1.8-2.1s.65 1.25.8 2.1c.15.85.25 1.85.95 1.85.6 0 .9-.85 1.1-1.65.35-1.35.65-3.2 1-4.45.6-2.2 1-4.6-.3-6.2C16.1 2.8 13.7 2.7 12 4Z"
        fill="currentColor"
      />
    </svg>
  );
}

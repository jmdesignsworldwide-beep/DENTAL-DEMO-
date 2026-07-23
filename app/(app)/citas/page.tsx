import type { Metadata } from "next";
import { Suspense } from "react";
import { requireActiveUser } from "@/lib/auth";
import {
  getAppointmentsRange,
  listDentists,
  listPatientsBasic,
} from "@/lib/appointments";
import {
  monthMatrix,
  weekDays,
  parseISODate,
  toISODate,
} from "@/lib/dates";
import { CalendarClient } from "./calendar-client";
import { CitasSkeleton } from "./citas-skeleton";

export const metadata: Metadata = { title: "Citas" };
export const dynamic = "force-dynamic";

type View = "mes" | "semana" | "dia";
type SearchParams = { [k: string]: string | string[] | undefined };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function rango(view: View, anchor: Date): { from: string; to: string } {
  if (view === "mes") {
    const weeks = monthMatrix(anchor);
    return {
      from: toISODate(weeks[0][0]),
      to: toISODate(weeks[weeks.length - 1][6]),
    };
  }
  if (view === "semana") {
    const d = weekDays(anchor);
    return { from: toISODate(d[0]), to: toISODate(d[6]) };
  }
  const iso = toISODate(anchor);
  return { from: iso, to: iso };
}

async function CalendarData({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireActiveUser();
  const canWrite =
    user.rol === "owner" ||
    user.rol === "recepcionista" ||
    user.rol === "dentista";

  const viewParam = one(searchParams.view);
  const view: View =
    viewParam === "mes" || viewParam === "dia" ? viewParam : "semana";
  const dateParam = one(searchParams.date);
  const anchor =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? parseISODate(dateParam)
      : new Date();
  const dentista = one(searchParams.dentista) ?? "";

  const { from, to } = rango(view, anchor);

  const [citas, dentists, patients] = await Promise.all([
    getAppointmentsRange(from, to, dentista || undefined),
    listDentists(),
    listPatientsBasic(),
  ]);

  return (
    <CalendarClient
      view={view}
      anchorISO={toISODate(anchor)}
      citas={citas}
      dentists={dentists}
      patients={patients}
      dentistaFilter={dentista}
      canWrite={canWrite}
    />
  );
}

export default function CitasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<CitasSkeleton />}>
      <CalendarData searchParams={searchParams} />
    </Suspense>
  );
}

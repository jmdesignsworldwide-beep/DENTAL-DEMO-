import type { Metadata } from "next";
import { Suspense } from "react";
import { requireActiveUser } from "@/lib/auth";
import {
  listPatients,
  type EstadoFiltro,
  type EdadFiltro,
  type SortKey,
} from "@/lib/patients";
import { getSignedPhotoUrl } from "@/lib/storage";
import { PatientsClient, type PatientRow } from "./patients-client";
import { PatientsSkeleton } from "./patients-skeleton";

export const metadata: Metadata = { title: "Pacientes" };
export const dynamic = "force-dynamic";

type SearchParams = { [k: string]: string | string[] | undefined };

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

async function PatientsData({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireActiveUser();
  const canCreate =
    user.rol === "owner" ||
    user.rol === "recepcionista" ||
    user.rol === "dentista";

  const q = one(searchParams.q) ?? "";
  const estado = (one(searchParams.estado) as EstadoFiltro) ?? "todos";
  const edad = (one(searchParams.edad) as EdadFiltro) ?? "todas";
  const alertas = one(searchParams.alertas) === "1";
  const sort = (one(searchParams.sort) as SortKey) ?? "nombre";
  const dir = one(searchParams.dir) === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(one(searchParams.page) ?? "1", 10) || 1);

  const { rows, total, page: current, pageCount } = await listPatients({
    q,
    estado,
    edad,
    alertas,
    sort,
    dir,
    page,
  });

  const withPhotos: PatientRow[] = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      nombre: r.nombre,
      cedula: r.cedula,
      telefono: r.telefono,
      fecha_nacimiento: r.fecha_nacimiento,
      es_vip: r.es_vip,
      activo: r.activo,
      alergias: r.alergias,
      medicamentos: r.medicamentos,
      condiciones: r.condiciones,
      ultima_visita: r.ultima_visita,
      fotoUrl: await getSignedPhotoUrl(r.foto_path),
    })),
  );

  return (
    <PatientsClient
      rows={withPhotos}
      total={total}
      page={current}
      pageCount={pageCount}
      q={q}
      estado={estado}
      edad={edad}
      alertas={alertas}
      sort={sort}
      dir={dir}
      canCreate={canCreate}
      openNuevo={one(searchParams.nuevo) === "1"}
    />
  );
}

export default function PacientesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<PatientsSkeleton />}>
      <PatientsData searchParams={searchParams} />
    </Suspense>
  );
}

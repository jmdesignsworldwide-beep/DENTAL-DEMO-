import type { Metadata } from "next";
import { Suspense } from "react";
import { requireActiveUser } from "@/lib/auth";
import { listPortalPatients, getPortalData } from "@/lib/patient-portal";
import { Presenter } from "./presenter";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Portal del Paciente" };
export const dynamic = "force-dynamic";

type SearchParams = { [k: string]: string | string[] | undefined };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Data({ searchParams }: { searchParams: SearchParams }) {
  await requireActiveUser();
  const list = await listPortalPatients();
  const selectedId = one(searchParams.p) ?? list[0]?.id ?? "";
  const data = selectedId ? await getPortalData(selectedId) : null;

  return <Presenter patients={list} selectedId={selectedId} data={data} />;
}

export default function PortalPacientePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-[700px] w-[340px] rounded-[2.75rem]" />
        </div>
      }
    >
      <Data searchParams={searchParams} />
    </Suspense>
  );
}

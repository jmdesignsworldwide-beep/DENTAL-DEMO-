import type { Metadata } from "next";
import { getConfirmView } from "@/lib/confirm";
import { LogoMark } from "@/components/brand/logo";
import { formatDateLong } from "@/lib/utils";
import { ConfirmClient } from "./confirm-client";
import { CalendarX2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Confirmar cita",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function ConfirmarPage({ params }: { params: { token: string } }) {
  const view = await getConfirmView(params.token);

  const invalido = !view || !view.cita || view.expirado;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-ice to-white px-4 py-10 dark:from-navy dark:to-navy-light">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark className="h-12 w-12" />
          <p className="mt-2 text-lg font-extrabold tracking-tight text-fg">Clínica Dental</p>
        </div>

        {invalido ? (
          <div className="rounded-3xl border border-border bg-surface p-8 text-center shadow-card">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/10 text-amber">
              <CalendarX2 className="h-7 w-7" />
            </span>
            <h1 className="text-lg font-bold text-fg">Enlace no disponible</h1>
            <p className="mt-1.5 text-sm text-muted">
              Este enlace de confirmación expiró o no es válido. Comuníquese con la clínica al{" "}
              <a href="tel:8095550100" className="font-semibold text-clinical">
                809-555-0100
              </a>{" "}
              para confirmar su cita.
            </p>
          </div>
        ) : (
          <ConfirmClient
            token={view!.token}
            estadoInicial={view!.estado}
            paciente={view!.paciente}
            fecha={formatDateLong(view!.cita!.fecha)}
            hora={view!.cita!.hora}
            dentista={view!.cita!.dentista}
            tratamiento={view!.cita!.tratamiento}
          />
        )}

        <p className="mt-6 text-center text-xs text-muted">
          Recibió este enlace por su recordatorio de cita. Sus datos están protegidos.
        </p>
      </div>
    </div>
  );
}

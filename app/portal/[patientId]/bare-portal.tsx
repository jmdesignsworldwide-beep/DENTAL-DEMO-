"use client";

import * as React from "react";
import { PatientPortal } from "@/components/portal/patient-portal";
import type { PortalData } from "@/lib/patient-portal";

type Theme = "light" | "dark";

export function BarePortal({ data }: { data: PortalData }) {
  const [theme, setTheme] = React.useState<Theme>("light");
  return (
    <div className="fixed inset-0 flex justify-center bg-navy">
      <div className="relative h-full w-full max-w-[440px] overflow-hidden bg-bg shadow-2xl">
        <PatientPortal
          data={data}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
        />
      </div>
    </div>
  );
}

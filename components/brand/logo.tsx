import { cn } from "@/lib/utils";

/** Isotipo dental — diente estilizado en gradiente clinical. */
export function LogoMark({
  className,
  glow,
}: {
  className?: string;
  glow?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
    >
      {glow && (
        <span className="absolute inset-0 -z-10 rounded-2xl bg-clinical/40 blur-xl" />
      )}
      <svg
        viewBox="0 0 48 48"
        fill="none"
        className="h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="logoGrad" x1="8" y1="4" x2="40" y2="44">
            <stop offset="0" stopColor="#3391E6" />
            <stop offset="0.55" stopColor="#0066CC" />
            <stop offset="1" stopColor="#003D7A" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="13" fill="url(#logoGrad)" />
        <path
          d="M24 12.5c-3.4-2.6-8.2-2.4-10.6.6-2.6 3.3-1.8 8.1-.6 12.4.7 2.5 1.3 6.2 2 8.9.4 1.6 1 3.3 2.2 3.3 1.4 0 1.6-2 1.9-3.7.3-1.7.6-4.2 1.6-4.2s1.3 2.5 1.6 4.2c.3 1.7.5 3.7 1.9 3.7 1.2 0 1.8-1.7 2.2-3.3.7-2.7 1.3-6.4 2-8.9 1.2-4.3 2-9.1-.6-12.4-2.4-3-7.2-3.2-10.6-.6"
          fill="#fff"
          fillOpacity="0.96"
        />
      </svg>
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-9 w-9" />
      <div className="leading-tight">
        <div className="text-[15px] font-extrabold tracking-tight text-fg">
          Clínica<span className="text-gradient-clinical"> Dental</span>
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          Sistema de Gestión
        </div>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

/**
 * Fondo aurora clinical blue sutil animado. Puramente decorativo.
 * Respeta prefers-reduced-motion vía la regla global de globals.css.
 */
export function Aurora({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      <div className="absolute -left-[10%] top-[-15%] h-[55vh] w-[55vh] animate-aurora rounded-full bg-clinical/30 blur-[100px] dark:bg-clinical/25" />
      <div
        className="absolute right-[-8%] top-[10%] h-[48vh] w-[48vh] animate-aurora rounded-full bg-clinical-300/40 blur-[110px] dark:bg-clinical-700/30"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="absolute bottom-[-20%] left-[25%] h-[50vh] w-[50vh] animate-aurora rounded-full bg-mint/20 blur-[120px] dark:bg-gold/10"
        style={{ animationDelay: "-11s" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,hsl(var(--bg))_92%)]" />
    </div>
  );
}

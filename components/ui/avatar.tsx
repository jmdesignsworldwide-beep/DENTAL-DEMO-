import { initials as toInitials, cn } from "@/lib/utils";

interface AvatarProps {
  nombre: string;
  url?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  vip?: boolean;
  className?: string;
}

const sizes = {
  sm: "h-9 w-9 text-[11px]",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
};

/**
 * Avatar del paciente. Usa la foto (URL firmada) si existe; si no, cae a
 * iniciales sobre gradiente clínico. VIP añade anillo dorado.
 */
export function Avatar({
  nombre,
  url,
  size = "md",
  vip,
  className,
}: AvatarProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white",
        !url && "bg-gradient-to-br from-clinical-400 to-clinical-700",
        vip && "ring-2 ring-gold ring-offset-2 ring-offset-surface",
        sizes[size],
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={nombre}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        toInitials(nombre)
      )}
    </span>
  );
}

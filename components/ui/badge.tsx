import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset transition-colors",
  {
    variants: {
      variant: {
        neutral:
          "bg-surface-2 text-muted ring-border dark:bg-navy-lighter",
        clinical:
          "bg-clinical-50 text-clinical-700 ring-clinical-200 dark:bg-clinical-900/40 dark:text-clinical-200 dark:ring-clinical-700/50",
        success:
          "bg-mint/10 text-mint ring-mint/30",
        warning:
          "bg-amber/10 text-amber ring-amber/30",
        danger:
          "bg-danger/10 text-danger ring-danger/30",
        vip: "bg-gradient-to-r from-gold-light/20 to-gold/20 text-gold-dark ring-gold/40 dark:text-gold-light dark:ring-gold/50 shadow-[0_0_12px_rgba(201,168,76,0.25)]",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({
  className,
  variant,
  dot,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {variant === "vip" && <Crown className="h-3 w-3" />}
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      )}
      {children}
    </span>
  );
}

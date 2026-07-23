"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-clinical text-white shadow-[0_4px_14px_rgba(0,102,204,0.35)] hover:bg-clinical-600 hover:shadow-[0_6px_20px_rgba(0,102,204,0.45)] dark:shadow-glow",
        secondary:
          "bg-surface-2 text-clinical-700 dark:text-clinical-200 hover:bg-clinical-100 dark:hover:bg-navy-lighter border border-border",
        ghost:
          "bg-transparent text-fg hover:bg-surface-2 dark:hover:bg-navy-lighter",
        danger:
          "bg-danger text-white shadow-[0_4px_14px_rgba(239,68,68,0.35)] hover:brightness-110",
        gold: "bg-gold text-navy shadow-glow-gold hover:bg-gold-light font-bold",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px]",
        md: "h-11 px-5",
        lg: "h-12 px-7 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      icon: Icon,
      iconRight: IconRight,
      loading,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          Icon && <Icon className="h-4 w-4" />
        )}
        {children}
        {IconRight && !loading && <IconRight className="h-4 w-4" />}
      </button>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };

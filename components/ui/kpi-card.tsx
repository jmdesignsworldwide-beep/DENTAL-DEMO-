"use client";

import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { CountUp } from "@/components/motion/count-up";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  trend?: number; // porcentaje, ej. 12.4 ó -3.1
  accent?: "clinical" | "mint" | "amber" | "gold";
  className?: string;
}

const accentMap = {
  clinical:
    "text-clinical bg-clinical-50 dark:bg-clinical-900/40 dark:text-clinical-200",
  mint: "text-mint bg-mint/10",
  amber: "text-amber bg-amber/10",
  gold: "text-gold-dark bg-gold/10 dark:text-gold-light",
};

export function KPICard({
  label,
  value,
  icon: Icon,
  prefix,
  suffix,
  decimals = 0,
  trend,
  accent = "clinical",
  className,
}: KPICardProps) {
  const positive = (trend ?? 0) >= 0;
  return (
    <div
      className={cn(
        "group rounded-2xl border border-border bg-surface p-5 shadow-card transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:shadow-card-hover dark:bg-surface/80",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-muted">{label}</span>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
            accentMap[accent],
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </span>
      </div>
      <div className="mt-3 text-[28px] font-extrabold leading-none tracking-tight text-fg">
        <CountUp
          value={value}
          prefix={prefix}
          suffix={suffix}
          decimals={decimals}
        />
      </div>
      {trend !== undefined && (
        <div className="mt-2 flex items-center gap-1 text-xs font-semibold">
          <span
            className={cn(
              "inline-flex items-center gap-0.5",
              positive ? "text-mint" : "text-danger",
            )}
          >
            {positive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {Math.abs(trend)}%
          </span>
          <span className="text-muted">vs. mes anterior</span>
        </div>
      )}
    </div>
  );
}

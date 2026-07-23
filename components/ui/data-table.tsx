"use client";

import * as React from "react";
import { ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  onRowClick,
  rowKey,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<{
    key: keyof T & string;
    dir: "asc" | "desc";
  } | null>(null);

  const sorted = React.useMemo(() => {
    if (!sort) return data;
    const { key, dir } = sort;
    return [...data].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), "es");
      return dir === "asc" ? cmp : -cmp;
    });
  }, [data, sort]);

  const toggleSort = (key: keyof T & string) => {
    setSort((prev) =>
      prev?.key === key
        ? prev.dir === "asc"
          ? { key, dir: "desc" }
          : null
        : { key, dir: "asc" },
    );
  };

  const alignClass = (a?: string) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-surface dark:bg-surface/80",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/60 dark:bg-navy-lighter/40">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-[12px] font-bold uppercase tracking-wide text-muted",
                    alignClass(col.align),
                  )}
                >
                  {col.sortable ? (
                    <button
                      onClick={() => toggleSort(col.key)}
                      className={cn(
                        "inline-flex items-center gap-1 transition-colors hover:text-fg",
                        col.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {col.header}
                      {sort?.key === col.key ? (
                        sort.dir === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5 text-clinical" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-clinical" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "border-b border-border/60 transition-colors last:border-0",
                  onRowClick &&
                    "cursor-pointer hover:bg-clinical-50/60 dark:hover:bg-clinical-900/20",
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-4 py-3 text-fg",
                      alignClass(col.align),
                      col.className,
                    )}
                  >
                    {col.render ? col.render(row) : String(row[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

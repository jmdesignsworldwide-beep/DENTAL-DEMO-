"use client";

import * as React from "react";
import { AlertCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldWrapProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({
  label,
  error,
  hint,
  required,
  htmlFor,
  children,
  className,
}: FieldWrapProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-[13px] font-semibold text-fg"
        >
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="flex items-center gap-1 text-xs font-medium text-danger">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </span>
      ) : (
        hint && <span className="text-xs text-muted">{hint}</span>
      )}
    </div>
  );
}

const fieldBase =
  "w-full rounded-xl border bg-surface px-3.5 text-sm text-fg placeholder:text-muted/70 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring disabled:opacity-60 disabled:cursor-not-allowed dark:bg-navy-light";

function stateClasses(error?: boolean) {
  return error
    ? "border-danger focus:ring-danger/40 focus:border-danger"
    : "border-border hover:border-clinical-300 dark:hover:border-clinical-700";
}

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  icon?: LucideIcon;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, icon: Icon, ...props }, ref) => {
    if (Icon) {
      return (
        <div className="relative">
          <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            ref={ref}
            className={cn(fieldBase, stateClasses(error), "h-11 pl-10", className)}
            {...props}
          />
        </div>
      );
    }
    return (
      <input
        ref={ref}
        className={cn(fieldBase, stateClasses(error), "h-11", className)}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(fieldBase, stateClasses(error), "min-h-[92px] py-2.5", className)}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          fieldBase,
          stateClasses(error),
          "h-11 appearance-none pr-10",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  ),
);
Select.displayName = "Select";

/** DatePicker nativo estilizado — con estado de error. */
export const DatePicker = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      type="date"
      className={cn(
        fieldBase,
        stateClasses(error),
        "h-11 [color-scheme:light] dark:[color-scheme:dark]",
        className,
      )}
      {...props}
    />
  ),
);
DatePicker.displayName = "DatePicker";

"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { login, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      className="w-full"
      loading={pending}
      iconRight={pending ? undefined : ArrowRight}
    >
      {pending ? "Ingresando…" : "Ingresar al sistema"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="font-medium">{state.error}</span>
        </motion.div>
      )}

      <Field label="Correo electrónico" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tu@clinica.do"
          icon={Mail}
          required
          maxLength={254}
        />
      </Field>

      <Field label="Contraseña" htmlFor="password">
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            minLength={6}
            maxLength={200}
            className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 pl-10 pr-11 text-sm text-fg placeholder:text-muted/70 transition-all focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 dark:bg-navy-light"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted transition-colors hover:text-fg"
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            tabIndex={-1}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            name="remember"
            className="h-4 w-4 rounded border-border text-clinical focus:ring-ring"
          />
          Recordarme
        </label>
        <button
          type="button"
          className="text-sm font-semibold text-clinical hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>

      <div className="pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}

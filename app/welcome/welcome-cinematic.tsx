"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Aurora } from "@/components/brand/aurora";
import { LogoMark } from "@/components/brand/logo";
import { greeting } from "@/lib/utils";

export function WelcomeCinematic({ nombre }: { nombre: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const donePush = React.useRef(false);

  const go = React.useCallback(() => {
    if (donePush.current) return;
    donePush.current = true;
    router.replace("/dashboard");
  }, [router]);

  React.useEffect(() => {
    // Fail-safe global: pase lo que pase, al dashboard.
    const failSafe = setTimeout(go, reduce ? 300 : 4200);
    return () => clearTimeout(failSafe);
  }, [go, reduce]);

  // Nombre corto: "Dra. María González" → mantiene título + primer nombre.
  const display = nombre.trim() || "Doctor(a)";

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg"
      onClick={go}
    >
      <Aurora />

      <motion.div
        className="relative flex flex-col items-center px-6 text-center"
        initial={reduce ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          initial={reduce ? { scale: 1 } : { scale: 0.6, filter: "blur(14px)" }}
          animate={{ scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <LogoMark className="h-20 w-20 sm:h-24 sm:w-24" glow />
        </motion.div>

        <motion.p
          className="mt-8 text-sm font-semibold uppercase tracking-[0.28em] text-muted"
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          {greeting()}
        </motion.p>

        {/* Reveal blur-to-sharp tipo cortina */}
        <div className="relative mt-2 overflow-hidden">
          <motion.h1
            className="text-gradient-clinical text-4xl font-extrabold tracking-tight sm:text-6xl"
            initial={
              reduce
                ? { opacity: 1 }
                : { opacity: 0, y: 24, filter: "blur(16px)" }
            }
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.65, duration: 1, ease: [0.22, 1, 0.36, 1] }}
          >
            {display}
          </motion.h1>
          {!reduce && (
            <motion.span
              className="absolute inset-0 bg-bg"
              initial={{ x: "0%" }}
              animate={{ x: "110%" }}
              transition={{ delay: 0.7, duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
            />
          )}
        </div>

        <motion.p
          className="mt-5 max-w-sm text-[15px] text-muted"
          initial={reduce ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.7 }}
        >
          Preparando tu clínica…
        </motion.p>

        {!reduce && (
          <motion.div
            className="mt-6 h-0.5 w-40 overflow-hidden rounded-full bg-border"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
          >
            <motion.div
              className="h-full rounded-full bg-clinical"
              initial={{ x: "-100%" }}
              animate={{ x: "0%" }}
              transition={{ delay: 1.4, duration: 2.4, ease: "easeInOut" }}
            />
          </motion.div>
        )}

        <button
          onClick={go}
          className="mt-8 text-xs font-medium text-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
        >
          Saltar intro
        </button>
      </motion.div>
    </div>
  );
}

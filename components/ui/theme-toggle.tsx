"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const current = mounted ? resolvedTheme ?? theme : undefined;
  const isDark = current === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Cambiar tema"
      className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-fg transition-colors hover:bg-surface-2 dark:hover:bg-navy-lighter"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "moon" : "sun"}
          initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ duration: 0.2 }}
        >
          {isDark ? (
            <Moon className="h-[18px] w-[18px] text-gold-light" />
          ) : (
            <Sun className="h-[18px] w-[18px] text-amber" />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

"use client";

import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {/* reducedMotion="user": TODA animación de Framer respeta
          prefers-reduced-motion del sistema, sin excepción. */}
      <MotionConfig reducedMotion="user">
        <ToastProvider>{children}</ToastProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}

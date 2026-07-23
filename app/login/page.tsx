import type { Metadata } from "next";
import { ShieldCheck, Sparkles, Activity } from "lucide-react";
import { Aurora } from "@/components/brand/aurora";
import { LogoMark } from "@/components/brand/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingreso" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg">
      <Aurora />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row">
        {/* Panel de marca — se oculta en móvil para dar foco al formulario */}
        <aside className="hidden flex-1 flex-col justify-between p-12 lg:flex">
          <div className="flex items-center gap-3">
            <LogoMark className="h-11 w-11" glow />
            <div>
              <p className="text-lg font-extrabold tracking-tight text-fg">
                Clínica<span className="text-gradient-clinical"> Dental</span>
              </p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Sistema de Gestión
              </p>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-fg">
              La clínica del futuro,{" "}
              <span className="text-gradient-clinical">hoy.</span>
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Pacientes, citas, odontograma interactivo, facturación y reportes.
              Todo en un solo lugar, con seguridad de nivel hospitalario.
            </p>

            <ul className="mt-8 space-y-3">
              {[
                { icon: Activity, text: "Historia clínica y odontograma en tiempo real" },
                { icon: ShieldCheck, text: "Seguridad Fort Knox · datos cifrados y protegidos" },
                { icon: Sparkles, text: "Diseñado para clínicas dominicanas premium" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-fg/85">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-clinical-50 text-clinical dark:bg-clinical-900/40 dark:text-clinical-200">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted">
            © {new Date().getFullYear()} Clínica Dental · República Dominicana
          </p>
        </aside>

        {/* Formulario */}
        <main className="flex flex-1 items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-[400px]">
            {/* Logo móvil */}
            <div className="mb-8 flex flex-col items-center lg:hidden">
              <LogoMark className="h-14 w-14" glow />
              <p className="mt-3 text-lg font-extrabold tracking-tight text-fg">
                Clínica<span className="text-gradient-clinical"> Dental</span>
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-surface/80 p-6 shadow-card-hover backdrop-blur-xl sm:p-8 dark:glass">
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold tracking-tight text-fg">
                  Bienvenido de nuevo
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Ingresa tus credenciales para acceder al sistema.
                </p>
              </div>

              <LoginForm />

              <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted">
                <ShieldCheck className="h-3.5 w-3.5 text-mint" />
                Conexión segura y cifrada
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-muted lg:hidden">
              © {new Date().getFullYear()} Clínica Dental · RD
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

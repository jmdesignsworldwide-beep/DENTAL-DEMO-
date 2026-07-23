import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileText,
  Grid3x3,
  Microscope,
  Receipt,
  Stethoscope,
  Package,
  BarChart3,
  Tv,
  Smartphone,
  UserCog,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/auth";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Roles con acceso. Si se omite, todos los roles activos. */
  roles?: Role[];
  /** Módulo aún no construido → deshabilitado con señal visual. */
  ready?: boolean;
  tanda: number;
}

/** Los 15 módulos del sistema, en orden de las tandas. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, ready: true, tanda: 2 },
  { label: "Pacientes", href: "/pacientes", icon: Users, ready: true, tanda: 3, roles: ["owner", "dentista", "recepcionista", "asistente"] },
  { label: "Citas", href: "/citas", icon: CalendarDays, ready: true, tanda: 4, roles: ["owner", "dentista", "recepcionista", "asistente"] },
  { label: "Historia Clínica", href: "/historia", icon: FileText, ready: true, tanda: 5, roles: ["owner", "dentista"] },
  { label: "Odontograma", href: "/odontograma", icon: Grid3x3, ready: true, tanda: 6, roles: ["owner", "dentista", "asistente"] },
  { label: "Diagrama Dental", href: "/diente", icon: Microscope, ready: false, tanda: 7, roles: ["owner", "dentista"] },
  { label: "Facturación", href: "/facturacion", icon: Receipt, ready: true, tanda: 8, roles: ["owner", "recepcionista"] },
  { label: "Tratamientos", href: "/tratamientos", icon: Stethoscope, ready: true, tanda: 9 },
  { label: "Inventario", href: "/inventario", icon: Package, ready: true, tanda: 10, roles: ["owner", "recepcionista", "asistente"] },
  { label: "Reportes", href: "/reportes", icon: BarChart3, ready: false, tanda: 11, roles: ["owner"] },
  { label: "Sala de Espera", href: "/sala", icon: Tv, ready: false, tanda: 12 },
  { label: "Portal Paciente", href: "/portal", icon: Smartphone, ready: false, tanda: 13 },
  { label: "Personal y Nómina", href: "/personal", icon: UserCog, ready: false, tanda: 14, roles: ["owner"] },
  { label: "Notificaciones", href: "/notificaciones", icon: Bell, ready: false, tanda: 15 },
  { label: "Configuración", href: "/configuracion", icon: Settings, ready: false, tanda: 16, roles: ["owner"] },
];

export function visibleFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(role));
}

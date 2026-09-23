import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Calculator,
  CalendarDays,
  Footprints,
  History,
  Home,
  Settings2,
  Trophy,
} from "lucide-react"

/**
 * Fuente única de verdad para la navegación principal.
 *
 * - `primaryNav`: items del main bar (mobile pill + desktop top nav).
 * - `moreMenu`: items secundarios agrupados en secciones (menú "Más").
 * - `isNavItemActive`: deriva el estado activo de la ruta real (soporta
 *   rutas anidadas, refresh y deep links).
 */
export interface NavItem {
  id: string
  label: string
  /** Label corto para la top nav desktop (cuando el espacio es limitado). */
  shortLabel?: string
  icon: LucideIcon
  to: string
}

export interface MenuSection {
  id: string
  label: string
  items: NavItem[]
}

/**
 * Slots del main bar (mobile). El orden de este array define el orden visual:
 * HOY → PLAN → RUN → PROGRESO → MÁS.
 */
export type NavSlot =
  | { kind: "route"; id: string; label: string; icon: LucideIcon; to: string }
  | { kind: "run" }
  | { kind: "more" }

export const navSlots: NavSlot[] = [
  { kind: "route", id: "today", label: "Hoy", icon: Home, to: "/" },
  {
    kind: "route",
    id: "plan",
    label: "Plan",
    icon: CalendarDays,
    to: "/routines",
  },
  { kind: "run" },
  {
    kind: "route",
    id: "progress",
    label: "Progreso",
    icon: BarChart3,
    to: "/analytics",
  },
  { kind: "more" },
]

/** Items de ruta del main bar (usados por la top nav desktop). */
export const primaryNav: NavItem[] = navSlots.filter(
  (slot): slot is Extract<NavSlot, { kind: "route" }> => slot.kind === "route",
)

export const moreMenu: MenuSection[] = [
  {
    id: "navigation",
    label: "Navegación",
    items: [
      {
        id: "races",
        label: "Carreras & objetivos",
        shortLabel: "Carreras",
        icon: Trophy,
        to: "/races",
      },
      {
        id: "activities",
        label: "Historial de Actividades",
        shortLabel: "Historial",
        icon: History,
        to: "/activities",
      },
    ],
  },
  {
    id: "tools",
    label: "Herramientas",
    items: [
      {
        id: "shoes",
        label: "Gestión de calzado",
        shortLabel: "Calzado",
        icon: Footprints,
        to: "/shoes",
      },
      {
        id: "calculators",
        label: "Calculadoras",
        icon: Calculator,
        to: "/tools",
      },
    ],
  },
  {
    id: "system",
    label: "Sistema",
    items: [
      {
        id: "settings",
        label: "Configuración",
        icon: Settings2,
        to: "/settings",
      },
    ],
  },
]

/** Items planos para la top nav desktop (primarios + secundarios). */
export const desktopNavItems: NavItem[] = [
  ...primaryNav,
  ...moreMenu.flatMap((section) => section.items),
]

export function isNavItemActive(
  item: Pick<NavItem, "to">,
  pathname: string,
): boolean {
  if (item.to === "/") return pathname === "/"
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

export function isAnyMoreItemActive(pathname: string): boolean {
  return moreMenu.some((section) =>
    section.items.some((item) => isNavItemActive(item, pathname)),
  )
}

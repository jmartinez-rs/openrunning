import { Link as RouterLink, useRouterState } from "@tanstack/react-router"
import { Menu, Play } from "lucide-react"
import { useState } from "react"

import { MoreMenuSheet } from "@/components/Navbar/MoreMenuSheet"
import { RunActionSheet } from "@/components/Navbar/RunActionSheet"
import {
  isAnyMoreItemActive,
  isNavItemActive,
  navSlots,
} from "@/lib/navigation"
import { cn } from "@/lib/utils"

export function MobileTabBar() {
  const router = useRouterState()
  const currentPath = router.location.pathname
  const [menuOpen, setMenuOpen] = useState(false)
  const [runOpen, setRunOpen] = useState(false)

  const isMoreActive = isAnyMoreItemActive(currentPath)

  return (
    <>
      <div className="md:hidden fixed inset-x-0 z-50 flex justify-center px-4 bottom-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <nav
          aria-label="Navegación principal"
          className="flex w-full max-w-[400px] items-end justify-between gap-1 bg-surface-container/90 backdrop-blur-xl border border-white/10 rounded-full px-3 pt-1.5 pb-1 shadow-card"
        >
          {navSlots.map((slot) => {
            // RUN: acción principal (3er slot)
            if (slot.kind === "run") {
              return (
                <button
                  key="run"
                  type="button"
                  onClick={() => setRunOpen(true)}
                  aria-label="Iniciar actividad"
                  className="group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-full px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <div className="-mt-9 flex size-[56px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_20px_rgba(234,252,95,0.25)] transition-transform active:scale-95 group-hover:scale-105">
                    <Play className="size-7 fill-current stroke-none ml-0.5" />
                  </div>
                  <span className="text-[10px] font-bold leading-none text-primary">
                    RUN
                  </span>
                </button>
              )
            }

            // MÁS: menú secundario (5to slot)
            if (slot.kind === "more") {
              return (
                <button
                  key="more"
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  aria-label="Abrir menú"
                  aria-expanded={menuOpen}
                  aria-current={isMoreActive ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-full px-1 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                    isMoreActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-surface-container-high/40 hover:text-foreground",
                  )}
                >
                  <Menu
                    className="size-6 shrink-0"
                    strokeWidth={isMoreActive ? 2.5 : 1.8}
                  />
                  <span
                    className={cn(
                      "text-[10px] leading-none",
                      isMoreActive ? "font-bold" : "font-medium",
                    )}
                  >
                    MÁS
                  </span>
                </button>
              )
            }

            // Ruta regular (Hoy / Plan / Progreso)
            const isActive = isNavItemActive(slot, currentPath)
            const Icon = slot.icon
            return (
              <RouterLink
                key={slot.id}
                to={slot.to}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-full px-1 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-surface-container-high/40 hover:text-foreground",
                )}
              >
                <Icon
                  className="size-6 shrink-0"
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                <span
                  className={cn(
                    "text-[10px] leading-none",
                    isActive ? "font-bold" : "font-medium",
                  )}
                >
                  {slot.label}
                </span>
              </RouterLink>
            )
          })}
        </nav>
      </div>

      <RunActionSheet open={runOpen} onOpenChange={setRunOpen} />
      <MoreMenuSheet open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  )
}

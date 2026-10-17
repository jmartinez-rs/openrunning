import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  CheckCircle2,
  ClipboardList,
  Download,
  FileDown,
  FileText,
  LayoutGrid,
  Pencil,
  Play,
  Trash2,
  Watch,
} from "lucide-react"

import type { RunningPlanPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { PlanEvolutionTab } from "./PlanEvolutionTab"
import { PlanTimeline } from "./PlanTimeline"
import { type WeekOverview } from "./running-utils"

interface RunnaPlanQuickActionsProps {
  plan: RunningPlanPublic
  weeks: WeekOverview[]
  currentWeekNumber?: number
  onSelectWeek: (weekNumber: number) => void
  onExportMarkdown: () => void
  onDeletePlan: () => void
  onStatusChange?: (newStatus: "planned" | "active" | "completed") => void
  className?: string
}

/**
 * Tarjeta de 3 acciones rápidas (Runna Quick Actions - PAgina_tuplan_completa.jpg):
 * 1. "Visión general del plan" (documento) -> abre modal con Timeline y Evolución
 * 2. "Apps conectadas" (grid) -> abre modal de Strava y sincronización con relojes
 * 3. "Gestionar plan" (portapapeles con lápiz) -> abre modal para editar, exportar o eliminar el plan
 */
export function RunnaPlanQuickActions({
  plan,
  weeks,
  currentWeekNumber,
  onSelectWeek,
  onExportMarkdown,
  onDeletePlan,
  onStatusChange,
  className,
}: RunnaPlanQuickActionsProps) {
  const navigate = useNavigate()
  const { showSuccessToast } = useCustomToast()

  const [showOverviewModal, setShowOverviewModal] = useState(false)
  const [showAppsModal, setShowAppsModal] = useState(false)
  const [showManageModal, setShowManageModal] = useState(false)

  return (
    <>
      <section
        aria-label="Acciones rápidas del plan"
        className={cn(
          "rounded-3xl border border-border/80 bg-card/90 p-5 shadow-md",
          className,
        )}
      >
        <div className="grid grid-cols-3 gap-2 text-center">
          {/* 1. Visión general del plan */}
          <button
            type="button"
            onClick={() => setShowOverviewModal(true)}
            className="flex flex-col items-center gap-2 p-2 rounded-2xl hover:bg-white/5 active:scale-95 transition-all cursor-pointer group"
          >
            <div className="size-12 rounded-full bg-surface-container-high/60 border border-white/10 flex items-center justify-center text-zinc-300 group-hover:bg-primary/20 group-hover:border-primary/40 group-hover:text-primary transition-all shadow-sm">
              <FileText className="size-5" />
            </div>
            <span className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors leading-tight">
              Visión general
              <br />
              del plan
            </span>
          </button>

          {/* 2. Apps conectadas */}
          <button
            type="button"
            onClick={() => setShowAppsModal(true)}
            className="flex flex-col items-center gap-2 p-2 rounded-2xl hover:bg-white/5 active:scale-95 transition-all cursor-pointer group"
          >
            <div className="size-12 rounded-full bg-surface-container-high/60 border border-white/10 flex items-center justify-center text-zinc-300 group-hover:bg-primary/20 group-hover:border-primary/40 group-hover:text-primary transition-all shadow-sm">
              <LayoutGrid className="size-5" />
            </div>
            <span className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors leading-tight">
              Apps
              <br />
              conectadas
            </span>
          </button>

          {/* 3. Gestionar plan */}
          <button
            type="button"
            onClick={() => setShowManageModal(true)}
            className="flex flex-col items-center gap-2 p-2 rounded-2xl hover:bg-white/5 active:scale-95 transition-all cursor-pointer group"
          >
            <div className="size-12 rounded-full bg-surface-container-high/60 border border-white/10 flex items-center justify-center text-zinc-300 group-hover:bg-primary/20 group-hover:border-primary/40 group-hover:text-primary transition-all shadow-sm">
              <ClipboardList className="size-5" />
            </div>
            <span className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors leading-tight">
              Gestionar
              <br />
              plan
            </span>
          </button>
        </div>
      </section>

      {/* ── Modal 1: Visión General del Plan ── */}
      <Dialog open={showOverviewModal} onOpenChange={setShowOverviewModal}>
        <DialogContent className="max-w-2xl rounded-3xl bg-[#12151a] border-white/10 text-white p-6 max-h-[85vh] overflow-y-auto no-scrollbar">
          <DialogHeader>
            <DialogTitle className="text-xl font-black font-display text-white">
              Visión General del Plan
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Distribución de fases, progresión de semanas y evolución del entrenamiento.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-6">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Línea de tiempo de fases
              </h4>
              <PlanTimeline
                weeks={weeks}
                currentWeekNumber={currentWeekNumber}
                onSelectWeek={(w) => {
                  onSelectWeek(w)
                  setShowOverviewModal(false)
                }}
              />
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Progreso y Cumplimiento
              </h4>
              <PlanEvolutionTab plan={plan} />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              className="rounded-full bg-white text-zinc-950 font-bold text-xs"
              onClick={() => setShowOverviewModal(false)}
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal 2: Apps Conectadas ── */}
      <Dialog open={showAppsModal} onOpenChange={setShowAppsModal}>
        <DialogContent className="max-w-md rounded-3xl bg-[#12151a] border-white/10 text-white p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black font-display text-white">
              Apps Conectadas & Dispositivos
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Sincronizá tus carreras automáticamente con tus plataformas favoritas.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-black text-sm">
                  S
                </div>
                <div>
                  <span className="font-bold text-sm text-white block">
                    Strava
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Sincronización bidireccional activa
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full text-xs border-white/10"
                onClick={() => navigate({ to: "/settings" })}
              >
                Ajustes
              </Button>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-sm">
                  <Watch className="size-5" />
                </div>
                <div>
                  <span className="font-bold text-sm text-white block">
                    Relojes (Garmin / Apple)
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Descarga de archivos estructurados .FIT
                  </span>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                className="rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-bold"
                onClick={() => {
                  showSuccessToast("Generando exportación estructurada .FIT...")
                }}
              >
                <Download className="size-3.5 mr-1" /> .FIT
              </Button>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              className="rounded-full bg-white text-zinc-950 font-bold text-xs"
              onClick={() => setShowAppsModal(false)}
            >
              Listo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal 3: Gestionar Plan ── */}
      <Dialog open={showManageModal} onOpenChange={setShowManageModal}>
        <DialogContent className="max-w-md rounded-3xl bg-[#12151a] border-white/10 text-white p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black font-display text-white">
              Gestionar Plan
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Modificá la configuración de tu plan, exportalo o eliminalo.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-2.5">
            {onStatusChange &&
              (plan.status === "active" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start rounded-2xl border-amber-500/20 bg-amber-500/10 py-5 text-xs font-bold hover:bg-amber-500/20 text-amber-400 cursor-pointer"
                  onClick={() => {
                    setShowManageModal(false)
                    onStatusChange("completed")
                  }}
                >
                  <CheckCircle2 className="mr-3 size-4 text-amber-400" />
                  Finalizar plan antes de tiempo
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start rounded-2xl border-primary/20 bg-primary/10 py-5 text-xs font-bold hover:bg-primary/20 text-primary cursor-pointer"
                  onClick={() => {
                    setShowManageModal(false)
                    onStatusChange("active")
                  }}
                >
                  <Play className="mr-3 size-4 text-primary fill-current" />
                  Activar como mi plan actual
                </Button>
              ))}

            <Button
              type="button"
              variant="outline"
              className="w-full justify-start rounded-2xl border-white/10 py-5 text-xs font-bold hover:bg-white/10 text-white cursor-pointer"
              onClick={() => {
                setShowManageModal(false)
                navigate({
                  to: "/routines/run/new",
                  search: { edit: plan.id },
                })
              }}
            >
              <Pencil className="mr-3 size-4 text-primary" />
              Editar semanas y objetivos con el Asistente
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-start rounded-2xl border-white/10 py-5 text-xs font-bold hover:bg-white/10 text-white"
              onClick={() => {
                setShowManageModal(false)
                onExportMarkdown()
              }}
            >
              <FileDown className="mr-3 size-4 text-primary" />
              Descargar plan completo en Markdown (.md)
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-start rounded-2xl border-red-500/20 bg-red-500/10 py-5 text-xs font-bold hover:bg-red-500/20 text-red-400"
              onClick={() => {
                setShowManageModal(false)
                onDeletePlan()
              }}
            >
              <Trash2 className="mr-3 size-4 text-red-400" />
              Eliminar plan
            </Button>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              className="text-xs"
              onClick={() => setShowManageModal(false)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

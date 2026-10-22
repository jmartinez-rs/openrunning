import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Flame,
  Gauge,
  Sparkles,
  Zap,
} from "lucide-react"

import {
  RunningPlansService,
  type RunningPlanPublic,
  type RecalibrationPreviewPublic,
} from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPace } from "@/lib/running-math"
import { cn } from "@/lib/utils"
import { PlanRecalibrationModal } from "./PlanRecalibrationModal"

interface PlanFitnessCardProps {
  plan: RunningPlanPublic
  className?: string
}

export function PlanFitnessCard({ plan, className }: PlanFitnessCardProps) {
  const [modalOpen, setModalOpen] = useState(false)

  // Automatic preview checking recent activities in Strava / Cardio
  const autoPreviewQuery = useQuery<RecalibrationPreviewPublic>({
    queryKey: ["recalibration-auto-preview", plan.id],
    queryFn: () => RunningPlansService.previewRecalibration({ planId: plan.id }),
    staleTime: 1000 * 60 * 5, // 5 min
  })

  const preview = autoPreviewQuery.data

  // Current VDOT: priority to preview current_vdot, then plan.baseline.vdot.value, then 35
  const baselineVdot =
    typeof plan.baseline?.vdot === "object" && plan.baseline.vdot !== null
      ? (plan.baseline.vdot as { value?: number }).value
      : null

  const currentVdot = preview?.current_vdot ?? baselineVdot ?? 35.0
  const suggestedVdot = preview?.vdot ?? null
  const hasImprovement =
    suggestedVdot != null && suggestedVdot > currentVdot + 0.2

  const sourceLabel =
    preview?.current_vdot_source === "activity"
      ? "Actividad de carrera"
      : preview?.current_vdot_source === "test"
        ? "Test de forma"
        : preview?.current_vdot_source === "manual"
          ? "Ajuste manual"
          : "Marca inicial"

  return (
    <>
      <section
        aria-label="Estado de forma y VDOT"
        className={cn(
          "overflow-hidden rounded-3xl border border-border/80 bg-card/90 p-5 sm:p-6 shadow-md transition-all",
          className,
        )}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Gauge className="size-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground/90">
                  Estado de forma
                </span>
                <Badge
                  variant="outline"
                  className="gap-1 border-primary/30 bg-primary/10 text-[10px] font-bold text-primary uppercase"
                >
                  <Flame className="size-3" />
                  VDOT {currentVdot.toFixed(1)}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground mt-0.5">
                Fuente: <span className="font-semibold text-foreground/80">{sourceLabel}</span>
                {preview?.current_vdot_date && (
                  <span> · {preview.current_vdot_date}</span>
                )}
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => setModalOpen(true)}
            variant="outline"
            size="sm"
            className="rounded-full text-xs font-bold gap-1.5 border-border hover:bg-white/5 active:scale-95 cursor-pointer shrink-0"
          >
            <Zap className="size-3.5 text-primary" />
            <span>Recalibrar ritmos</span>
          </Button>
        </div>

        {/* Banner de mejora detectada */}
        {hasImprovement && (
          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-300">
            <div className="flex items-start gap-2.5">
              <Sparkles className="size-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-emerald-300">
                  ¡Mejora de rendimiento detectada!
                </p>
                <p className="text-emerald-200/80 mt-0.5">
                  Tus carreras recientes sugieren un VDOT de{" "}
                  <strong className="text-emerald-100 font-mono font-bold">
                    {suggestedVdot.toFixed(1)}
                  </strong>{" "}
                  (+{(suggestedVdot - currentVdot).toFixed(1)} puntos).
                </p>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => setModalOpen(true)}
              className="rounded-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs gap-1 shrink-0 h-8 px-3"
            >
              <span>Ajustar plan</span>
              <ArrowUpRight className="size-3.5" />
            </Button>
          </div>
        )}

        {/* Recomendación de test de forma si no hay datos concluyentes */}
        {!hasImprovement && preview?.recommend_fitness_test && (
          <div className="mt-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3 flex items-start gap-2.5 text-xs text-blue-200/90">
            <AlertCircle className="size-4 text-blue-400 shrink-0 mt-0.5" />
            <p>
              Tu VDOT actual es estimado. Realizá el <strong>test de control planificado</strong> para calibrar tus ritmos exactos.
            </p>
          </div>
        )}
      </section>

      {/* Modal de Recalibración */}
      <PlanRecalibrationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        planId={plan.id}
        currentVdot={currentVdot}
        suggestedVdot={suggestedVdot}
      />
    </>
  )
}

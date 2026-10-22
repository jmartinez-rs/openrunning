import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  ShieldAlert,
  Sliders,
  Sparkles,
} from "lucide-react"

import {
  RunningPlansService,
  type PlanAdaptationPreviewPublic,
} from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PlanAdaptationModal } from "./PlanAdaptationModal"

interface PlanAdaptationBannerProps {
  planId: string
  className?: string
}

export function PlanAdaptationBanner({
  planId,
  className,
}: PlanAdaptationBannerProps) {
  const [modalOpen, setModalOpen] = useState(false)

  const { data: previewData } = useQuery<PlanAdaptationPreviewPublic>({
    queryKey: ["adaptation-preview", planId],
    queryFn: () => RunningPlansService.previewPlanAdaptations({ planId }),
    staleTime: 1000 * 60 * 5, // 5 min
  })

  const suggestions = previewData?.suggestions ?? []
  if (suggestions.length === 0) {
    return null
  }

  const hasCritical = suggestions.some((s) => s.severity === "critical")
  const hasWarning = suggestions.some((s) => s.severity === "warning")

  return (
    <>
      <div
        className={cn(
          "rounded-3xl border p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all shadow-md animate-in fade-in duration-300",
          hasCritical
            ? "border-red-500/40 bg-red-500/10"
            : hasWarning
              ? "border-amber-500/40 bg-amber-500/10"
              : "border-primary/40 bg-primary/10",
          className,
        )}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={cn(
              "size-10 rounded-2xl flex items-center justify-center shrink-0 border",
              hasCritical
                ? "bg-red-500/20 border-red-500/30 text-red-400"
                : hasWarning
                  ? "bg-amber-500/20 border-amber-500/30 text-amber-400"
                  : "bg-primary/20 border-primary/30 text-primary",
            )}
          >
            {hasCritical ? (
              <ShieldAlert className="size-5" />
            ) : hasWarning ? (
              <Sliders className="size-5" />
            ) : (
              <Sparkles className="size-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black text-foreground">
                Tu plan puede adaptarse
              </h4>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5",
                  hasCritical
                    ? "border-red-500/40 bg-red-500/20 text-red-300"
                    : hasWarning
                      ? "border-amber-500/40 bg-amber-500/20 text-amber-300"
                      : "border-primary/40 bg-primary/20 text-primary",
                )}
              >
                {suggestions.length}{" "}
                {suggestions.length === 1 ? "ajuste" : "ajustes"}
              </Badge>
            </div>

            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Detectamos sugerencias basadas en tu adherencia y esfuerzo reciente para mantener tu entrenamiento equilibrado.
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => setModalOpen(true)}
          className={cn(
            "rounded-full text-xs font-bold gap-1.5 shrink-0 w-full sm:w-auto h-9 px-4 cursor-pointer",
            hasCritical
              ? "bg-red-500 hover:bg-red-600 text-white"
              : hasWarning
                ? "bg-amber-500 hover:bg-amber-600 text-black"
                : "bg-primary hover:bg-primary/90 text-primary-foreground",
          )}
        >
          <span>Revisar ajustes</span>
          <ArrowRight className="size-3.5" />
        </Button>
      </div>

      <PlanAdaptationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        planId={planId}
        previewData={previewData}
      />
    </>
  )
}

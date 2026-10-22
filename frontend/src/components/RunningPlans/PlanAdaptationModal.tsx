import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Info,
  ShieldAlert,
  Sliders,
  Sparkles,
} from "lucide-react"

import {
  RunningPlansService,
  type AdaptationSuggestionPublic,
  type PlanAdaptationPreviewPublic,
} from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"

interface PlanAdaptationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  previewData?: PlanAdaptationPreviewPublic | null
  onApplied?: () => void
}

export function PlanAdaptationModal({
  open,
  onOpenChange,
  planId,
  previewData,
  onApplied,
}: PlanAdaptationModalProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const suggestions = previewData?.suggestions ?? []
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set())

  // Select all by default when suggestions load
  useEffect(() => {
    if (open && suggestions.length > 0) {
      setSelectedCodes(new Set(suggestions.map((s) => s.rule_code)))
    }
  }, [open, suggestions])

  const toggleRule = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const applyMutation = useMutation({
    mutationFn: () =>
      RunningPlansService.applyAdaptationsToPlan({
        planId,
        requestBody: {
          selected_rule_codes: Array.from(selectedCodes),
          confirm: true,
        },
      }),
    onSuccess: (data) => {
      const count = data.applied_rules?.length ?? selectedCodes.size
      showSuccessToast(
        `Se ${count === 1 ? "aplicó 1 ajuste" : `aplicaron ${count} ajustes`} a tu plan`,
      )
      queryClient.invalidateQueries({ queryKey: ["running-plan", planId] })
      queryClient.invalidateQueries({ queryKey: ["running-plans"] })
      queryClient.invalidateQueries({ queryKey: ["adaptation-preview", planId] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      onApplied?.()
      onOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-card border-border p-6 text-foreground">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Sliders className="size-4" />
            <span>Adaptación Inteligente</span>
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black font-display tracking-tight text-foreground">
            Ajustar plan a tu realidad
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Basado en tu entrenamiento y sensaciones recientes, estos ajustes optimizan la progresión de carga y previenen el sobreentrenamiento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {suggestions.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No hay sugerencias de adaptación pendientes para este plan.
            </div>
          ) : (
            suggestions.map((item: AdaptationSuggestionPublic) => {
              const isSelected = selectedCodes.has(item.rule_code)

              const severityBadge =
                item.severity === "critical" ? (
                  <Badge className="border-red-500/30 bg-red-500/10 text-red-400 gap-1 text-[10px] font-bold">
                    <ShieldAlert className="size-3" />
                    Prioridad Alta
                  </Badge>
                ) : item.severity === "warning" ? (
                  <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-400 gap-1 text-[10px] font-bold">
                    <AlertTriangle className="size-3" />
                    Atención
                  </Badge>
                ) : (
                  <Badge className="border-blue-500/30 bg-blue-500/10 text-blue-400 gap-1 text-[10px] font-bold">
                    <Info className="size-3" />
                    Optimización
                  </Badge>
                )

              return (
                <div
                  key={item.rule_code}
                  onClick={() => toggleRule(item.rule_code)}
                  className={cn(
                    "cursor-pointer rounded-2xl border p-4 transition-all duration-200 select-none",
                    isSelected
                      ? "border-primary/40 bg-surface-container-high/60 shadow-sm"
                      : "border-border/60 bg-surface-container-high/20 opacity-70 hover:opacity-100",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRule(item.rule_code)}
                        className="rounded-md"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div>
                        <h4 className="text-sm font-black text-foreground">
                          {item.title}
                        </h4>
                      </div>
                    </div>
                    {severityBadge}
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed pl-7">
                    {item.reason}
                  </p>

                  <div className="mt-3.5 pl-7 flex flex-col gap-1.5 text-xs">
                    <div className="rounded-xl border border-border/50 bg-card/60 p-2.5 flex items-center justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Antes
                        </span>
                        <span className="text-xs font-medium text-muted-foreground line-through truncate">
                          {item.before_summary}
                        </span>
                      </div>

                      <ArrowRight className="size-3.5 text-muted-foreground/60 shrink-0" />

                      <div className="flex flex-col min-w-0 text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          Ajuste propuesto
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          {item.after_summary}
                        </span>
                      </div>
                    </div>

                    {item.affected_weeks && item.affected_weeks.length > 0 && (
                      <span className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                        Afecta a Semana {item.affected_weeks.join(", ")} ({item.affected_workouts_count} entrenamientos)
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto rounded-full font-bold text-xs"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>

          <Button
            type="button"
            disabled={selectedCodes.size === 0 || applyMutation.isPending}
            className="w-full sm:w-auto rounded-full bg-primary text-primary-foreground font-bold text-xs gap-1.5 shadow-glow"
            onClick={() => applyMutation.mutate()}
          >
            {applyMutation.isPending ? (
              "Aplicando ajustes..."
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                <span>
                  Aplicar {selectedCodes.size}{" "}
                  {selectedCodes.size === 1 ? "ajuste" : "ajustes"}
                </span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

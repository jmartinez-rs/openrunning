import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Gauge,
  History,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import {
  RunningPlansService,
  type PlanRecalibrationPublic,
  type RecalibrationPreviewPublic,
} from "@/client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { formatPace } from "@/lib/running-math"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"

const PACE_ROW_LABELS: Record<string, { label: string; desc: string; color: string }> = {
  easy_min: {
    label: "Ritmo Suave / Fácil",
    desc: "Rodajes de base y regeneración (Zona 2)",
    color: "text-emerald-400",
  },
  marathon: {
    label: "Ritmo Maratón",
    desc: "Tiradas largas con ritmo específico",
    color: "text-blue-400",
  },
  threshold: {
    label: "Ritmo Umbral (Tempo)",
    desc: "Ritmo de 1h de carrera (Zona 4)",
    color: "text-amber-400",
  },
  interval: {
    label: "Ritmo Intervalo (VO2máx)",
    desc: "Series de 3 a 5 minutos al 95-100% FCM",
    color: "text-orange-400",
  },
  repetition: {
    label: "Ritmo Repetición",
    desc: "Series cortas para economía y velocidad",
    color: "text-red-400",
  },
}

interface PlanRecalibrationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  currentVdot?: number | null
  suggestedVdot?: number | null
  onApplied?: () => void
}

export function PlanRecalibrationModal({
  open,
  onOpenChange,
  planId,
  currentVdot,
  suggestedVdot,
  onApplied,
}: PlanRecalibrationModalProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [vdotInput, setVdotInput] = useState<string>("")
  const [acknowledgeRisk, setAcknowledgeRisk] = useState<boolean>(false)
  const [showHistory, setShowHistory] = useState<boolean>(false)

  // Reset or preset input when modal opens
  useEffect(() => {
    if (open) {
      const initial = suggestedVdot ?? currentVdot ?? 40.0
      setVdotInput(initial.toFixed(1))
      setAcknowledgeRisk(false)
    }
  }, [open, suggestedVdot, currentVdot])

  const parsedVdot = parseFloat(vdotInput)
  const isValidVdot = !Number.isNaN(parsedVdot) && parsedVdot >= 20.0 && parsedVdot <= 85.0

  // Preview query
  const previewQuery = useQuery<RecalibrationPreviewPublic>({
    queryKey: ["recalibration-preview", planId, parsedVdot],
    queryFn: () =>
      RunningPlansService.previewRecalibration({
        planId,
        requestBody: isValidVdot ? { new_vdot: parsedVdot } : null,
      }),
    enabled: open && isValidVdot,
  })

  // History query
  const historyQuery = useQuery({
    queryKey: ["recalibrations-history", planId],
    queryFn: () =>
      RunningPlansService.readRecalibrations({
        planId,
        limit: 5,
      }),
    enabled: open && showHistory,
  })

  const preview = previewQuery.data

  const applyMutation = useMutation({
    mutationFn: () =>
      RunningPlansService.applyPlanRecalibration({
        planId,
        requestBody: {
          new_vdot: parsedVdot,
          confirm: true,
          acknowledge_risk: acknowledgeRisk,
        },
      }),
    onSuccess: (data) => {
      showSuccessToast(
        `Plan recalibrado con éxito a VDOT ${data.new_vdot ?? parsedVdot}`,
      )
      queryClient.invalidateQueries({ queryKey: ["running-plan", planId] })
      queryClient.invalidateQueries({ queryKey: ["running-plans"] })
      queryClient.invalidateQueries({ queryKey: ["recalibrations-history", planId] })
      queryClient.invalidateQueries({ queryKey: ["recalibration-preview", planId] })
      onApplied?.()
      onOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
  })

  const deltaVdot = preview?.delta_vdot ?? (isValidVdot && currentVdot ? parsedVdot - currentVdot : 0)
  const isSuspicious = preview?.suspicious ?? Math.abs(deltaVdot) >= 2.0
  const canApply =
    isValidVdot &&
    !previewQuery.isLoading &&
    !applyMutation.isPending &&
    (!isSuspicious || acknowledgeRisk)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-card border-border p-6 text-foreground">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Gauge className="size-4" />
            <span>Ajuste Adaptativo de Ritmos</span>
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black font-display tracking-tight text-foreground">
            Recalibrar plan (VDOT)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Ajustá el VDOT del plan en base a tus resultados recientes. Solo se actualizarán los ritmos de las sesiones futuras; tu historial permanece intacto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* 1. Selector de nuevo VDOT */}
          <div className="rounded-2xl border border-border/70 bg-surface-container-high/40 p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <Label htmlFor="vdot-input" className="text-xs font-bold text-foreground">
                  Nuevo VDOT objetivo
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  VDOT actual:{" "}
                  <span className="font-bold text-foreground">
                    {currentVdot != null ? currentVdot.toFixed(1) : "No definido"}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  id="vdot-input"
                  type="number"
                  step="0.5"
                  min="20"
                  max="85"
                  value={vdotInput}
                  onChange={(e) => setVdotInput(e.target.value)}
                  className="w-24 font-mono font-bold text-center text-sm h-10 rounded-xl"
                />

                {deltaVdot !== 0 && isValidVdot && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono font-bold text-xs px-2.5 py-1 gap-1",
                      deltaVdot > 0
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-400",
                    )}
                  >
                    {deltaVdot > 0 ? (
                      <TrendingUp className="size-3" />
                    ) : (
                      <TrendingDown className="size-3" />
                    )}
                    {deltaVdot > 0 ? `+${deltaVdot.toFixed(1)}` : deltaVdot.toFixed(1)}
                  </Badge>
                )}
              </div>
            </div>

            {suggestedVdot && Math.abs(suggestedVdot - (currentVdot ?? 0)) > 0.1 && (
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" />
                  Sugerido de tu última actividad:
                </span>
                <button
                  type="button"
                  onClick={() => setVdotInput(suggestedVdot.toFixed(1))}
                  className="font-bold text-primary hover:underline cursor-pointer"
                >
                  Usar VDOT {suggestedVdot.toFixed(1)}
                </button>
              </div>
            )}
          </div>

          {/* 2. Advertencia si el salto es sospechoso */}
          {isSuspicious && (
            <Alert className="rounded-2xl border-amber-500/40 bg-amber-500/10 text-amber-300">
              <AlertTriangle className="size-4 text-amber-400" />
              <AlertTitle className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Cambio significativo de VDOT ({deltaVdot > 0 ? `+${deltaVdot.toFixed(1)}` : deltaVdot.toFixed(1)})
              </AlertTitle>
              <AlertDescription className="text-xs text-amber-200/90 mt-1">
                Un salto mayor a 2.0 puntos VDOT aumenta la exigencia de las sesiones. Asegurate de que responda a una marca o test real.
                <div className="mt-3 flex items-center gap-2">
                  <Checkbox
                    id="acknowledge-risk"
                    checked={acknowledgeRisk}
                    onCheckedChange={(checked) => setAcknowledgeRisk(Boolean(checked))}
                  />
                  <label
                    htmlFor="acknowledge-risk"
                    className="text-xs font-semibold text-white cursor-pointer select-none"
                  >
                    Confirmo este cambio en mis ritmos
                  </label>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* 3. Comparativa de ritmos de entrenamiento */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Comparativa de Ritmos de Entrenamiento
              </span>
              {preview?.effective_from_week && (
                <span className="text-[11px] font-semibold text-primary">
                  Aplica desde Semana {preview.effective_from_week}
                </span>
              )}
            </div>

            {previewQuery.isLoading ? (
              <div className="space-y-2 py-2">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : preview?.new_paces ? (
              <div className="divide-y divide-border/40">
                {Object.entries(PACE_ROW_LABELS).map(([key, meta]) => {
                  const oldPace = preview.old_paces?.[key]
                  const newPace = preview.new_paces?.[key]
                  const diffSeconds =
                    oldPace && newPace ? Math.round(newPace - oldPace) : null

                  return (
                    <div
                      key={key}
                      className="py-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className={cn("text-xs font-bold", meta.color)}>
                          {meta.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {meta.desc}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs text-muted-foreground line-through">
                          {oldPace ? `${formatPace(oldPace)}/km` : "--"}
                        </span>
                        <ArrowRight className="size-3 text-muted-foreground/60" />
                        <span className="font-mono text-xs font-black text-foreground">
                          {newPace ? `${formatPace(newPace)}/km` : "--"}
                        </span>
                        {diffSeconds != null && diffSeconds !== 0 && (
                          <span
                            className={cn(
                              "font-mono text-[10px] font-bold px-1.5 py-0.5 rounded",
                              diffSeconds < 0
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-amber-500/10 text-amber-400",
                            )}
                          >
                            {diffSeconds < 0 ? `${diffSeconds}s` : `+${diffSeconds}s`}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Ingresá un valor VDOT válido para previsualizar los nuevos ritmos.
              </p>
            )}

            {preview?.changes && preview.changes.length > 0 && (
              <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Sesiones futuras impactadas:</span>
                <span className="font-bold text-foreground">
                  {preview.changes.length} entrenamientos
                </span>
              </div>
            )}
          </div>

          {/* 4. Historial colapsable de recalibraciones */}
          <div>
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <History className="size-3.5" />
              <span>
                {showHistory ? "Ocultar historial de calibraciones" : "Ver calibraciones anteriores"}
              </span>
            </button>

            {showHistory && (
              <div className="mt-2 rounded-2xl border border-border/60 bg-surface-container-high/30 p-3 space-y-2">
                {historyQuery.isLoading ? (
                  <Skeleton className="h-12 w-full rounded-xl" />
                ) : historyQuery.data?.data && historyQuery.data.data.length > 0 ? (
                  <div className="divide-y divide-border/30 text-xs">
                    {historyQuery.data.data.map((item: PlanRecalibrationPublic) => (
                      <div key={item.id} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-foreground">
                            VDOT {item.new_vdot.toFixed(1)}
                          </span>
                          <span className="text-muted-foreground text-[10px] ml-1.5">
                            (desde {item.old_vdot.toFixed(1)})
                          </span>
                          <p className="text-[10px] text-muted-foreground">
                            Semana {item.effective_from_week} · {item.source}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-2 text-center">
                    No hay calibraciones registradas todavía.
                  </p>
                )}
              </div>
            )}
          </div>
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
            disabled={!canApply}
            className="w-full sm:w-auto rounded-full bg-primary text-primary-foreground font-bold text-xs gap-1.5 shadow-glow"
            onClick={() => applyMutation.mutate()}
          >
            {applyMutation.isPending ? (
              "Aplicando calibración..."
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                <span>Aplicar nueva calibración</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock,
  Loader2,
  Palmtree,
} from "lucide-react"

import {
  type PlanPausePreviewPublic,
  RunningPlansService,
} from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import useCustomToast from "@/hooks/useCustomToast"
import { addDaysToIso, formatShortDate } from "./running-utils"

interface PlanPauseModalProps {
  planId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PlanPauseModal({
  planId,
  open,
  onOpenChange,
}: PlanPauseModalProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const todayIso = new Date().toISOString().slice(0, 10)
  const defaultEndIso = addDaysToIso(todayIso, 6)

  const [startDate, setStartDate] = useState<string>(todayIso)
  const [endDate, setEndDate] = useState<string>(defaultEndIso)
  const [reason, setReason] = useState<string>("Vacaciones")

  const isValidRange = Boolean(startDate && endDate && startDate <= endDate)

  // Preview query
  const previewQuery = useQuery({
    queryKey: ["plan-pause-preview", planId, startDate, endDate],
    queryFn: () =>
      RunningPlansService.previewPlanPause({
        planId,
        requestBody: {
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim() || undefined,
        },
      }),
    enabled: open && isValidRange,
  })

  // Apply mutation
  const applyMutation = useMutation({
    mutationFn: () =>
      RunningPlansService.applyPlanPause({
        planId,
        requestBody: {
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim() || undefined,
          confirm: true,
        },
      }),
    onSuccess: (res) => {
      showSuccessToast(
        `¡Plan reprogramado! Se desplazaron ${res.shifted_days} días respetando los días de entrenamiento.`
      )
      queryClient.invalidateQueries({ queryKey: ["running-plan", planId] })
      queryClient.invalidateQueries({ queryKey: ["running-plans"] })
      onOpenChange(false)
    },
    onError: (err: any) => {
      showErrorToast(
        err?.body?.detail || "No se pudo reprogramar el plan por pausa."
      )
    },
  })

  const preview = previewQuery.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl bg-[#12151a] border-white/10 text-white p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-primary">
            <Palmtree className="size-5 text-amber-400" />
            <DialogTitle className="text-xl font-black font-display text-white">
              Pausar Plan / Modo Vacaciones
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-zinc-400 mt-1">
            Poné en pausa tus entrenamientos. Las sesiones a partir de la fecha
            indicada se desplazarán hacia adelante conservando el orden y los días de la semana.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Rango de fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300 font-semibold">
                Inicio de pausa
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white/5 border-white/10 text-white text-xs h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300 font-semibold">
                Fin de pausa
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white/5 border-white/10 text-white text-xs h-10 rounded-xl"
              />
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-300 font-semibold">
              Motivo (opcional)
            </Label>
            <Input
              type="text"
              placeholder="Ej: Vacaciones de verano, viaje de trabajo, descanso"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-white/5 border-white/10 text-white text-xs h-10 rounded-xl"
            />
          </div>

          {/* Estado de cálculo / Error de rango */}
          {!isValidRange && (
            <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
              <AlertCircle className="size-4 shrink-0" />
              <span>La fecha de fin debe ser igual o posterior a la fecha de inicio.</span>
            </div>
          )}

          {previewQuery.isLoading && isValidRange && (
            <div className="flex items-center justify-center gap-2 p-6 text-zinc-400 text-xs">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>Calculando reajuste del calendario...</span>
            </div>
          )}

          {/* Preview del desplazamiento */}
          {preview && isValidRange && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4" />
                  Impacto en tu calendario
                </span>
                <span className="bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  +{preview.shift_days} días ({Math.round(preview.shift_days / 7)} sem)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col">
                  <span className="text-[10px] text-zinc-400">Sesiones desplazadas</span>
                  <span className="text-sm font-bold text-white mt-0.5">
                    {preview.affected_workouts_count} entrenamientos
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col">
                  <span className="text-[10px] text-zinc-400">Nueva fecha de fin</span>
                  <span className="text-sm font-bold text-white mt-0.5">
                    {preview.new_end_date ? formatShortDate(preview.new_end_date) : "-"}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Tus entrenamientos no se cancelan ni pierden: todo el bloque futuro se corre hacia adelante de forma sincronizada con tus días de corrida.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="ghost"
            className="rounded-full text-xs text-zinc-400 hover:text-white"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!isValidRange || previewQuery.isLoading || applyMutation.isPending}
            onClick={() => applyMutation.mutate()}
            className="rounded-full bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs px-5 h-10 gap-2 cursor-pointer shadow-md"
          >
            {applyMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Aplicando pausa...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                <span>Confirmar pausa y desplazar</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

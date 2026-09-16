import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Dumbbell, Footprints, HeartPulse, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import { SettingsService } from "@/client"
import { SettingsRow } from "./SettingsSection"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

export function WeeklyGoals() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [targetKm, setTargetKm] = useState("")
  const [targetGymDays, setTargetGymDays] = useState("")
  const [targetCardioMinutes, setTargetCardioMinutes] = useState("")

  const goalsQuery = useQuery({
    queryKey: ["weekly-goals"],
    queryFn: () => SettingsService.readGoals(),
  })

  useEffect(() => {
    const goals = goalsQuery.data
    if (goals) {
      setTargetKm(goals.target_km != null ? String(goals.target_km) : "")
      setTargetGymDays(
        goals.target_gym_days != null ? String(goals.target_gym_days) : "",
      )
      setTargetCardioMinutes(
        goals.target_cardio_minutes != null
          ? String(goals.target_cardio_minutes)
          : "",
      )
    }
  }, [goalsQuery.data])

  const mutation = useMutation({
    mutationFn: () =>
      SettingsService.updateGoals({
        requestBody: {
          target_km: targetKm ? Number(targetKm) : null,
          target_gym_days: targetGymDays ? Number(targetGymDays) : null,
          target_cardio_minutes: targetCardioMinutes
            ? Number(targetCardioMinutes)
            : null,
        },
      }),
    onSuccess: () => {
      showSuccessToast("Metas semanales guardadas")
      queryClient.invalidateQueries({ queryKey: ["weekly-goals"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  return (
    <div className="space-y-2">
      <SettingsRow
        icon={Footprints}
        iconBg="bg-emerald-500/15"
        iconColor="text-emerald-400"
        title="Distancia semanal objetivo"
        subtitle="Kilómetros de carrera planeados por semana"
      >
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            step="0.1"
            className="w-24 h-8 rounded-xl border-slate-800 bg-slate-950 text-xs text-center text-slate-200"
            value={targetKm}
            onChange={(e) => setTargetKm(e.target.value)}
            placeholder="Ej: 30"
          />
          <span className="text-xs text-slate-400 font-medium">km</span>
        </div>
      </SettingsRow>

      <SettingsRow
        icon={Dumbbell}
        iconBg="bg-purple-500/15"
        iconColor="text-purple-400"
        title="Días de gimnasio objetivo"
        subtitle="Sesiones de fuerza semanales"
      >
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            className="w-24 h-8 rounded-xl border-slate-800 bg-slate-950 text-xs text-center text-slate-200"
            value={targetGymDays}
            onChange={(e) => setTargetGymDays(e.target.value)}
            placeholder="Ej: 3"
          />
          <span className="text-xs text-slate-400 font-medium">días</span>
        </div>
      </SettingsRow>

      <SettingsRow
        icon={HeartPulse}
        iconBg="bg-rose-500/15"
        iconColor="text-rose-400"
        title="Minutos de cardio objetivo"
        subtitle="Tiempo total de cardio acumulado por semana"
      >
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            className="w-24 h-8 rounded-xl border-slate-800 bg-slate-950 text-xs text-center text-slate-200"
            value={targetCardioMinutes}
            onChange={(e) => setTargetCardioMinutes(e.target.value)}
            placeholder="Ej: 150"
          />
          <span className="text-xs text-slate-400 font-medium">min</span>
        </div>
      </SettingsRow>

      <div className="pt-2 flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          className="rounded-xl bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400"
        >
          {mutation.isPending && (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          )}
          Guardar metas
        </Button>
      </div>
    </div>
  )
}

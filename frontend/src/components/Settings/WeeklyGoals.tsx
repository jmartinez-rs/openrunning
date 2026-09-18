import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Dumbbell, Footprints, HeartPulse, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import { SettingsService } from "@/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { SettingsRow } from "./SettingsSection"

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
        iconBg="bg-primary/15"
        iconColor="text-primary"
        title="Distancia semanal objetivo"
        subtitle="Kilómetros de carrera planeados por semana"
      >
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            step="0.1"
            className="w-24 h-8 rounded-xl border-border bg-background text-xs text-center text-foreground"
            value={targetKm}
            onChange={(e) => setTargetKm(e.target.value)}
            placeholder="Ej: 30"
          />
          <span className="text-xs text-muted-foreground font-medium">km</span>
        </div>
      </SettingsRow>

      <SettingsRow
        icon={Dumbbell}
        iconBg="bg-primary/15"
        iconColor="text-primary"
        title="Días de gimnasio objetivo"
        subtitle="Sesiones de fuerza semanales"
      >
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            className="w-24 h-8 rounded-xl border-border bg-background text-xs text-center text-foreground"
            value={targetGymDays}
            onChange={(e) => setTargetGymDays(e.target.value)}
            placeholder="Ej: 3"
          />
          <span className="text-xs text-muted-foreground font-medium">
            días
          </span>
        </div>
      </SettingsRow>

      <SettingsRow
        icon={HeartPulse}
        iconBg="bg-destructive/15"
        iconColor="text-destructive"
        title="Minutos de cardio objetivo"
        subtitle="Tiempo total de cardio acumulado por semana"
      >
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            className="w-24 h-8 rounded-xl border-border bg-background text-xs text-center text-foreground"
            value={targetCardioMinutes}
            onChange={(e) => setTargetCardioMinutes(e.target.value)}
            placeholder="Ej: 150"
          />
          <span className="text-xs text-muted-foreground font-medium">min</span>
        </div>
      </SettingsRow>

      <div className="pt-2 flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          className="rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90"
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

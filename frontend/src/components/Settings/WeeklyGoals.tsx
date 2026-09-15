import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Target } from "lucide-react"
import { useEffect, useState } from "react"

import { SettingsService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Target className="size-5" />
          </div>
          <div>
            <CardTitle>Metas semanales</CardTitle>
            <CardDescription>
              Objetivos por defecto para comparar con tu rendimiento.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {goalsQuery.isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-km">Kilómetros por semana</Label>
              <Input
                id="goal-km"
                type="number"
                step="0.1"
                value={targetKm}
                onChange={(e) => setTargetKm(e.target.value)}
                placeholder="Ej: 30"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-gym">Días de gimnasio</Label>
              <Input
                id="goal-gym"
                type="number"
                value={targetGymDays}
                onChange={(e) => setTargetGymDays(e.target.value)}
                placeholder="Ej: 3"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-cardio">Minutos de cardio</Label>
              <Input
                id="goal-cardio"
                type="number"
                value={targetCardioMinutes}
                onChange={(e) => setTargetCardioMinutes(e.target.value)}
                placeholder="Ej: 150"
              />
            </div>
            <div className="sm:col-span-3">
              <Button
                type="button"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Guardar metas
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

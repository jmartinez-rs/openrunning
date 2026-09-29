import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Flag, Loader2, Trophy } from "lucide-react"
import { useEffect, useState } from "react"

import { ActivitiesService, type RacePublic, RacesService } from "@/client"
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
import { handleError } from "@/utils"
import { parseRaceTime, secondsToTimeInput } from "./race-utils"

interface RaceFinishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  race: RacePublic
}

export function RaceFinishDialog({
  open,
  onOpenChange,
  race,
}: RaceFinishDialogProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [officialTime, setOfficialTime] = useState(
    secondsToTimeInput(race.official_time_seconds),
  )
  const [chipTime, setChipTime] = useState(
    secondsToTimeInput(race.chip_time_seconds),
  )
  const [position, setPosition] = useState(
    race.position != null ? String(race.position) : "",
  )
  const [category, setCategory] = useState(race.category ?? "")
  const [activityId, setActivityId] = useState(race.activity_id ?? "")

  // Reset al abrir (por si el dialog se reutiliza con otra carrera).
  useEffect(() => {
    if (open) {
      setOfficialTime(secondsToTimeInput(race.official_time_seconds))
      setChipTime(secondsToTimeInput(race.chip_time_seconds))
      setPosition(race.position != null ? String(race.position) : "")
      setCategory(race.category ?? "")
      setActivityId(race.activity_id ?? "")
    }
  }, [open, race])

  const activitiesQuery = useQuery({
    queryKey: ["activities", "strava"],
    queryFn: () =>
      ActivitiesService.readActivities({ sourceType: "strava", limit: 100 }),
    enabled: open,
  })

  // Ordena las actividades por cercanía a la fecha de la carrera.
  const raceTime = new Date(race.date).getTime()
  const activities = [...(activitiesQuery.data?.data ?? [])].sort((a, b) => {
    const da = Math.abs(new Date(a.timestamp).getTime() - raceTime)
    const db = Math.abs(new Date(b.timestamp).getTime() - raceTime)
    return da - db
  })

  const mutation = useMutation({
    mutationFn: () =>
      RacesService.updateRace({
        raceId: race.id,
        requestBody: {
          official_time_seconds: parseRaceTime(officialTime),
          chip_time_seconds: parseRaceTime(chipTime),
          position: position ? Number(position) : null,
          category: category || null,
          activity_id: activityId || null,
        },
      }),
    onSuccess: () => {
      showSuccessToast("Carrera finalizada")
      queryClient.invalidateQueries({ queryKey: ["races"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["shoe-stats"] })
      onOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black text-white">
            <Flag className="size-5 text-primary" /> Finalizar carrera
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {race.event_name} · {race.distance_km} km — registrá el resultado y
            vinculá la actividad.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Actividad de Strava vinculada
            </Label>
            <select
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
            >
              <option value="">Ninguna</option>
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name} · {activity.timestamp.slice(0, 10)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Tiempo Oficial
              </Label>
              <Input
                className="bg-background border-border text-white focus-visible:ring-primary/50 rounded-xl"
                value={officialTime}
                onChange={(e) => setOfficialTime(e.target.value)}
                placeholder="01:15:00"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Tiempo Neto (Chip)
              </Label>
              <Input
                className="bg-background border-border text-white focus-visible:ring-primary/50 rounded-xl"
                value={chipTime}
                onChange={(e) => setChipTime(e.target.value)}
                placeholder="01:14:45"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Puesto General
              </Label>
              <Input
                className="bg-background border-border text-white focus-visible:ring-primary/50 rounded-xl"
                type="number"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Puesto (ej: 12)"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Categoría
              </Label>
              <Input
                className="bg-background border-border text-white focus-visible:ring-primary/50 rounded-xl"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ej: M40"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-foreground hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-card shadow-primary/20"
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Trophy className="mr-2 size-4" />
            )}
            Guardar resultado
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

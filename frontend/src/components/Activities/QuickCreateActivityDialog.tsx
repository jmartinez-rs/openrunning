import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Footprints, Loader2 } from "lucide-react"
import { useState } from "react"

import { ActivitiesService, type ActivityCreate } from "@/client"
import { Button } from "@/components/ui/button"
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
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface QuickCreateActivityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickCreateActivityDialog({
  open,
  onOpenChange,
}: QuickCreateActivityDialogProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [name, setName] = useState("Carrera manual")
  const [distanceKm, setDistanceKm] = useState("5.0")
  const [durationMin, setDurationMin] = useState("25")
  const [avgHr, setAvgHr] = useState("")

  const distMeters = Number(distanceKm) * 1000
  const durSec = Number(durationMin) * 60
  const paceSecPerKm =
    distMeters > 0 && durSec > 0 ? durSec / (distMeters / 1000) : 0

  const formatPace = (sec: number) => {
    if (!sec || !Number.isFinite(sec)) return "—"
    const m = Math.floor(sec / 60)
    const s = Math.round(sec % 60)
    return `${m}:${String(s).padStart(2, "0")} /km`
  }

  const mutation = useMutation({
    mutationFn: (requestBody: ActivityCreate) =>
      ActivitiesService.createActivity({ requestBody }),
    onSuccess: () => {
      showSuccessToast("Carrera registrada correctamente")
      queryClient.invalidateQueries({ queryKey: ["activities"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      onOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!distanceKm || Number(distanceKm) <= 0) {
      showErrorToast("Ingresá una distancia válida")
      return
    }
    if (!durationMin || Number(durationMin) <= 0) {
      showErrorToast("Ingresá una duración válida")
      return
    }

    const payload: ActivityCreate = {
      source_id: `manual_${Date.now()}`,
      source_type: "manual",
      sport_type: "Run",
      name: name.trim() || "Carrera manual",
      timestamp: new Date().toISOString(),
      duration_seconds: durSec,
      cardio: {
        distance_meters: distMeters,
        avg_pace_seconds_per_km: paceSecPerKm > 0 ? paceSecPerKm : null,
        avg_hr: avgHr ? Number(avgHr) : null,
      },
    }

    mutation.mutate(payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl border-border bg-background p-6 text-foreground">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Footprints className="size-5" />
            </div>
            <DialogTitle className="text-xl font-bold">
              Registrar Carrera Manual
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Ingresá los datos de tu sesión de running para incluirla en tus
            estadísticas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="act-name" className="text-xs text-muted-foreground">
              Nombre de la actividad
            </Label>
            <Input
              id="act-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Carrera matutina, Fondito 10k"
              className="h-9 rounded-xl border-border bg-card text-xs text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="act-dist"
                className="text-xs text-muted-foreground"
              >
                Distancia (km)
              </Label>
              <Input
                id="act-dist"
                type="number"
                step="0.01"
                min="0.01"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="5.0"
                className="h-9 rounded-xl border-border bg-card text-xs text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="act-dur"
                className="text-xs text-muted-foreground"
              >
                Duración (minutos)
              </Label>
              <Input
                id="act-dur"
                type="number"
                min="1"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                placeholder="25"
                className="h-9 rounded-xl border-border bg-card text-xs text-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="act-hr" className="text-xs text-muted-foreground">
                Frecuencia Cardíaca (ppm)
              </Label>
              <Input
                id="act-hr"
                type="number"
                min="40"
                max="230"
                value={avgHr}
                onChange={(e) => setAvgHr(e.target.value)}
                placeholder="Opcional: 145"
                className="h-9 rounded-xl border-border bg-card text-xs text-foreground"
              />
            </div>
            <div className="flex flex-col justify-end p-2.5 rounded-xl border border-border/80 bg-card/60 text-center">
              <span className="text-[10px] uppercase font-medium text-muted-foreground">
                Ritmo Calculado
              </span>
              <span className="text-sm font-bold text-primary">
                {formatPace(paceSecPerKm)}
              </span>
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border-border text-xs text-muted-foreground"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.isPending}
              className="rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90"
            >
              {mutation.isPending && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              )}
              Guardar Carrera
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

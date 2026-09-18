import { useQuery } from "@tanstack/react-query"
import { Activity, Check, Footprints, X } from "lucide-react"
import type React from "react"
import { useState } from "react"
import { type ShoePublic, ShoesService } from "@/client"
import { formatPace } from "../../lib/running-math"
import { Stepper } from "../ui/Stepper"

interface ManualRunSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    date: string
    distanceKm: number
    durationSeconds: number
    rpe: number
    shoeId?: string
    notes?: string
  }) => void
}

export const ManualRunSheet: React.FC<ManualRunSheetProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [distanceKm, setDistanceKm] = useState<number>(5.0)
  const [durationMinutes, setDurationMinutes] = useState<number>(25)
  const [rpe, setRpe] = useState<number>(5)
  const [notes, setNotes] = useState<string>("")
  const [shoeId, setShoeId] = useState<string>("")
  const [dateStr, setDateStr] = useState<string>(
    new Date().toISOString().split("T")[0],
  )

  const { data: shoesData } = useQuery({
    queryKey: ["shoes"],
    queryFn: () => ShoesService.readShoes({}),
    enabled: isOpen,
  })

  const activeShoes: ShoePublic[] = (shoesData?.data ?? []).filter(
    (s) => s.is_active !== false,
  )

  if (!isOpen) return null

  const durationSeconds = durationMinutes * 60
  const paceSecondsPerKm = distanceKm > 0 ? durationSeconds / distanceKm : 0

  const getRpeBadge = (val: number) => {
    if (val <= 3)
      return {
        text: "Muy Suave / Regenerativo",
        color: "text-blue-400 bg-blue-500/10",
      }
    if (val <= 5)
      return {
        text: "Z2 Cómodo / Rodaje",
        color: "text-primary bg-primary/10",
      }
    if (val <= 7)
      return {
        text: "Z3 Tempo / Ritmo Cruzero",
        color: "text-primary bg-primary/10",
      }
    if (val <= 9)
      return {
        text: "Z4 Umbral / Series",
        color: "text-primary bg-primary/10",
      }
    return {
      text: "Z5 Esfuerzo Máximo / Carrera",
      color: "text-destructive bg-destructive/10",
    }
  }

  const rpeBadge = getRpeBadge(rpe)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      date: dateStr,
      distanceKm,
      durationSeconds,
      rpe,
      shoeId: shoeId || undefined,
      notes,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-3xl p-5 shadow-card max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/15 text-primary">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Registrar Carrera Manual
              </h2>
              <p className="text-xs text-muted-foreground">
                Sin necesidad de reloj GPS ni Strava
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-surface-container-high text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Date Picker */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Fecha de entrenamiento
            </label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full bg-surface-container-high border border-border rounded-xl px-3 py-2 text-sm text-white font-medium focus:outline-none focus:border-primary"
            />
          </div>

          {/* Steppers for Distance & Duration */}
          <div className="grid grid-cols-2 gap-3">
            <Stepper
              label="Distancia"
              value={distanceKm}
              onChange={setDistanceKm}
              step={0.5}
              unit="km"
              decimals={1}
            />

            <Stepper
              label="Duración"
              value={durationMinutes}
              onChange={setDurationMinutes}
              step={1}
              unit="min"
              decimals={0}
            />
          </div>

          {/* Calculated Pace Preview */}
          <div className="flex items-center justify-between bg-surface-container-high/60 border border-border/60 rounded-xl p-3">
            <div className="text-xs text-muted-foreground font-medium">
              Ritmo Medio Calculado
            </div>
            <div className="text-base font-extrabold text-primary">
              {formatPace(paceSecondsPerKm)}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                /km
              </span>
            </div>
          </div>

          {/* RPE Stepper & Badge */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-muted-foreground">
                Esfuerzo Percibido (RPE 1-10)
              </label>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${rpeBadge.color}`}
              >
                {rpeBadge.text}
              </span>
            </div>
            <Stepper
              value={rpe}
              onChange={setRpe}
              step={1}
              min={1}
              max={10}
              unit="/10"
              decimals={0}
            />
          </div>

          {/* Shoe Selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
              <Footprints className="size-3.5 text-primary" /> Calzado utilizado
            </label>
            <select
              value={shoeId}
              onChange={(e) => setShoeId(e.target.value)}
              className="w-full bg-surface-container-high border border-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
            >
              <option value="">Sin calzado asignado</option>
              {activeShoes.map((shoe: ShoePublic) => (
                <option key={shoe.id} value={shoe.id}>
                  {shoe.name} {shoe.brand ? `(${shoe.brand})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Notas y Sensaciones
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Clima, terreno, sensaciones físicas..."
              className="w-full bg-surface-container-high border border-border rounded-xl p-3 text-sm text-white placeholder:text-on-surface-variant focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-98 transition-all flex items-center justify-center gap-2 shadow-card shadow-primary/20 cursor-pointer"
          >
            <Check className="w-5 h-5 stroke-[3]" />
            Guardar Carrera
          </button>
        </form>
      </div>
    </div>
  )
}

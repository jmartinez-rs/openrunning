import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"

import type { RacePublic } from "@/client"
import { Button } from "@/components/ui/button"
import { formatRacePace } from "./race-utils"

export function RaceYearMetrics({ completed }: { completed: RacePublic[] }) {
  const totalKm = completed.reduce((acc, race) => acc + race.distance_km, 0)
  const paces = completed
    .map((race) => race.official_pace_seconds_per_km)
    .filter((pace): pace is number => pace != null && pace > 0)
  const avgPace =
    paces.length > 0
      ? paces.reduce((acc, pace) => acc + pace, 0) / paces.length
      : null

  return (
    <div className="flex flex-col justify-between rounded-2xl bg-card/80 border border-border p-6 shadow-card">
      <div>
        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Métricas del año
        </h3>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-5xl font-black text-white tabular-nums tracking-tighter">
            {completed.length}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            carreras completadas
          </span>
        </div>

        <dl className="mt-6 space-y-0">
          <div className="flex items-center justify-between gap-4 border-b border-border/80 py-3">
            <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Distancia total
            </dt>
            <dd className="text-xl font-bold text-white tabular-nums">
              {totalKm % 1 === 0 ? totalKm.toFixed(0) : totalKm.toFixed(1)}
              <span className="ml-1 text-sm font-medium text-muted-foreground">
                km
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-border/80 py-3">
            <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Ritmo promedio
            </dt>
            <dd className="text-xl font-bold text-white tabular-nums">
              {formatRacePace(avgPace)}
            </dd>
          </div>
        </dl>
      </div>

      <Button
        asChild
        variant="outline"
        className="mt-6 w-full rounded-xl bg-card border-border text-foreground hover:text-white hover:bg-surface-container-high"
      >
        <Link to="/analytics/cardio">
          Ver detalles
          <ArrowRight className="ml-2 size-4" />
        </Link>
      </Button>
    </div>
  )
}

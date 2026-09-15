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
    <div className="flex flex-col justify-between rounded-2xl bg-card p-6 shadow-card dark:border dark:border-border/50">
      <div>
        <h3 className="text-label-sm text-on-surface-variant uppercase">
          Métricas del año
        </h3>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-display-lg tabular-nums text-primary">
            {completed.length}
          </span>
          <span className="text-body-md text-on-surface-variant">
            carreras completadas
          </span>
        </div>

        <dl className="mt-6 space-y-0">
          <div className="flex items-center justify-between gap-4 border-b border-border/50 py-2.5">
            <dt className="text-label-sm text-on-surface-variant uppercase">
              Distancia total
            </dt>
            <dd className="text-title-lg tabular-nums text-primary">
              {totalKm % 1 === 0 ? totalKm.toFixed(0) : totalKm.toFixed(1)}
              <span className="ml-1 text-body-md text-on-surface-variant">
                km
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-border/50 py-2.5">
            <dt className="text-label-sm text-on-surface-variant uppercase">
              Ritmo promedio
            </dt>
            <dd className="text-title-lg tabular-nums text-primary">
              {formatRacePace(avgPace)}
            </dd>
          </div>
        </dl>
      </div>

      <Button asChild variant="outline" className="mt-6 w-full rounded-lg">
        <Link to="/analytics/cardio">
          Ver detalles
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </div>
  )
}

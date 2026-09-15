import type { ActivityCardioBase } from "@/client"

import { formatPace } from "./activity-utils"

interface Split {
  distance?: number
  moving_time?: number
  split?: number
  pace?: number
}

function splitPace(split: Split): string {
  const distance = Number(split.distance) || 0
  const movingTime = Number(split.moving_time) || 0
  if (distance <= 0 || movingTime <= 0) return "—"
  return formatPace(movingTime / (distance / 1000))
}

export function CardioSummary({ cardio }: { cardio: ActivityCardioBase }) {
  const splits = (cardio.splits ?? []) as unknown as Split[]
  const zones = (cardio.heart_rate_zones ?? []) as unknown as Array<{
    min?: number
    max?: number
    time?: number
  }>
  const hasZones = zones.some((z) => Number(z.time) > 0)

  if (splits.length === 0 && !hasZones) {
    return null
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl bg-card p-6 shadow-card dark:border dark:border-border/50">
      <h2 className="text-title-lg text-primary">Parciales y zonas</h2>

      {splits.length > 0 ? (
        <div>
          <h4 className="mb-3 text-title-lg text-primary">Parciales</h4>
          <div className="overflow-hidden rounded-xl border border-border/50">
            <table className="w-full text-body-md">
              <thead className="bg-surface-container-low text-left">
                <tr>
                  <th className="px-4 py-2 text-label-sm uppercase tracking-wider text-on-surface-variant">
                    Km
                  </th>
                  <th className="px-4 py-2 text-label-sm uppercase tracking-wider text-on-surface-variant">
                    Ritmo
                  </th>
                  <th className="px-4 py-2 text-label-sm uppercase tracking-wider text-on-surface-variant">
                    Tiempo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {splits.map((split, index) => (
                  <tr key={index}>
                    <td className="px-4 py-1.5 font-semibold text-primary">
                      {split.split ?? index + 1}
                    </td>
                    <td className="px-4 py-1.5 text-primary">
                      {splitPace(split)}
                    </td>
                    <td className="px-4 py-1.5 text-on-surface-variant">
                      {Number(split.moving_time)
                        ? `${Math.floor(Number(split.moving_time) / 60)}:${String(Math.round(Number(split.moving_time) % 60)).padStart(2, "0")}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {hasZones ? (
        <div>
          <h4 className="mb-3 text-title-lg text-primary">
            Zonas de frecuencia cardíaca
          </h4>
          <div className="flex flex-col gap-3">
            {zones.map((zone, index) => {
              const time = Number(zone.time) || 0
              const maxTime = Math.max(
                ...zones.map((z) => Number(z.time) || 0),
                1,
              )
              const width = Math.max((time / maxTime) * 100, 2)
              return (
                <div key={index} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-label-sm text-on-surface-variant">
                    {zone.min ?? "?"}–{zone.max ?? "?"} bpm
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-variant">
                    <div
                      className="h-full rounded-full bg-domain-cardio"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-label-sm text-on-surface-variant">
                    {Math.floor(time / 60)}:
                    {String(Math.round(time % 60)).padStart(2, "0")}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

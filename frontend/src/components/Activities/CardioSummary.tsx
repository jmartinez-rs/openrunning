import { Activity, Flame, Layers } from "lucide-react"

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

const ZONE_CONFIGS = [
  {
    name: "Z1 Recuperación",
    color: "bg-on-surface-variant",
    text: "text-muted-foreground",
  },
  { name: "Z2 Aeróbico", color: "bg-primary", text: "text-primary" },
  { name: "Z3 Tempo", color: "bg-cyan-500", text: "text-cyan-400" },
  { name: "Z4 Umbral", color: "bg-primary", text: "text-primary" },
  { name: "Z5 Máximo", color: "bg-destructive", text: "text-destructive" },
]

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

  const totalZoneTime = zones.reduce((acc, z) => acc + (Number(z.time) || 0), 0)

  return (
    <div className="bg-card/80 border border-border rounded-2xl p-4 sm:p-5 shadow-card space-y-6">
      <div className="flex items-center gap-2 pb-1 border-b border-border/80">
        <Activity className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-bold text-white tracking-tight">
          Parciales y Zonas
        </h2>
      </div>

      {/* Splits Table */}
      {splits.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-on-surface-variant" />{" "}
              Parciales (Km)
            </span>
            <span className="text-[11px] text-on-surface-variant font-normal">
              Total {splits.length} km
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/80 bg-surface-container-lowest/60">
            <table className="w-full text-xs">
              <thead className="bg-card/90 text-left border-b border-border/80">
                <tr>
                  <th className="px-3.5 py-2 font-bold text-muted-foreground uppercase tracking-wider">
                    Km
                  </th>
                  <th className="px-3.5 py-2 font-bold text-muted-foreground uppercase tracking-wider">
                    Ritmo
                  </th>
                  <th className="px-3.5 py-2 font-bold text-muted-foreground uppercase tracking-wider text-right">
                    Tiempo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {splits.map((split, index) => (
                  <tr
                    key={index}
                    className="hover:bg-surface-container-high/30 transition-colors"
                  >
                    <td className="px-3.5 py-2 font-bold text-white font-display">
                      {split.split ?? index + 1}
                    </td>
                    <td className="px-3.5 py-2 font-bold text-primary font-display">
                      {splitPace(split)}
                    </td>
                    <td className="px-3.5 py-2 text-muted-foreground font-display text-right">
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

      {/* Heart Rate Zones */}
      {hasZones ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-destructive" /> Zonas
              Frecuencia Cardíaca
            </span>
          </div>

          <div className="space-y-2.5">
            {zones.map((zone, index) => {
              const time = Number(zone.time) || 0
              const percentage =
                totalZoneTime > 0 ? Math.round((time / totalZoneTime) * 100) : 0
              const cfg = ZONE_CONFIGS[index] || {
                name: `Z${index + 1}`,
                color: "bg-primary",
                text: "text-primary",
              }

              return (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${cfg.color}`} />
                      <span className="text-muted-foreground font-semibold">
                        {cfg.name}
                      </span>
                      <span className="text-on-surface-variant font-display">
                        ({zone.min ?? "?"}–{zone.max ?? "?"} bpm)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-display">
                      <span className={`font-bold ${cfg.text}`}>
                        {percentage}%
                      </span>
                      <span className="text-muted-foreground">
                        {Math.floor(time / 60)}:
                        {String(Math.round(time % 60)).padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-border/50">
                    <div
                      className={`h-full rounded-full ${cfg.color} transition-all duration-500`}
                      style={{
                        width: `${Math.max(percentage, time > 0 ? 3 : 0)}%`,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

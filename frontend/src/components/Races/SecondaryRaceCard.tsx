import { Calendar, MapPin } from "lucide-react"

import type { RacePublic } from "@/client"
import { parseRaceNotes } from "./race-meta"
import { formatRaceDate } from "./race-utils"

export function SecondaryRaceCard({ race }: { race: RacePublic }) {
  const meta = parseRaceNotes(race.notes)

  const priorityLabel = meta.priority === "B" ? "Tune-up Race" : "Test de Ritmo"
  const priorityColor =
    meta.priority === "B"
      ? "text-primary bg-primary/15"
      : "text-primary bg-primary/15"

  return (
    <div className="flex flex-col md:flex-row gap-4 p-5 rounded-2xl bg-card/60 border border-border shadow-card hover:border-border transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${priorityColor}`}
          >
            {priorityLabel}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
            <MapPin className="size-3" />
            {race.location || "Ubicación pendiente"}
          </span>
        </div>

        <h3 className="text-xl font-bold text-white tracking-tight mb-1">
          {race.event_name}
        </h3>

        <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="size-3.5" />
            {formatRaceDate(race.date)}
          </span>
          <span>•</span>
          <span className="font-bold text-white">{race.distance_km} KM</span>
        </div>
      </div>

      <div className="flex md:flex-col items-center md:items-end justify-between gap-3 pt-3 md:pt-0 border-t md:border-t-0 md:border-l border-border/80 md:pl-4">
        <div className="text-left md:text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Ritmo Obj.
          </p>
          <p className="text-sm font-bold text-white tabular-nums">
            {meta.target_pace || "--:--"}
          </p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Estado
          </p>
          <div className="flex items-center gap-1.5 justify-end">
            <div
              className={`w-1.5 h-1.5 rounded-full ${meta.status === "confirmed" ? "bg-primary" : "bg-primary"}`}
            />
            <p className="text-xs font-bold text-foreground capitalize">
              {meta.status ? meta.status.replace("_", " ") : "Incompleto"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

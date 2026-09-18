import type { RacePublic } from "@/client"
import { MedalCard3D } from "./MedalCard3D"
import { PBWall } from "./PBWall"
import { RaceGlobalMetrics } from "./RaceGlobalMetrics"

interface HistoryRacesTabProps {
  completed: RacePublic[]
  onOpenMemoryModal: (race: RacePublic) => void
}

export function HistoryRacesTab({
  completed,
  onOpenMemoryModal,
}: HistoryRacesTabProps) {
  // Simple heuristic for PB to highlight ribbons (simplification: if it's the fastest in its distance bracket)
  const isPBRace = (race: RacePublic) => {
    if (!race.official_time_seconds) return false
    // Find all races in same distance bracket (e.g. +/- 0.5km)
    const similar = completed.filter(
      (r) =>
        r.official_time_seconds &&
        Math.abs(r.distance_km - race.distance_km) < 0.5,
    )
    if (similar.length <= 1) return true // Only race in this distance
    const best = similar.reduce((prev, curr) =>
      curr.official_time_seconds! < prev.official_time_seconds! ? curr : prev,
    )
    return best.id === race.id
  }

  return (
    <div className="flex flex-col gap-10 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <RaceGlobalMetrics completedRaces={completed} />

      {completed.length > 0 && (
        <PBWall
          completedRaces={completed}
          onOpenMemoryModal={onOpenMemoryModal}
        />
      )}

      <div className="flex flex-col gap-6">
        <div className="flex items-end justify-between border-b border-border/80 pb-2">
          <h2 className="text-xl font-black text-white tracking-tight">
            Baúl y Medallero
          </h2>
          <span className="text-xs font-medium text-muted-foreground">
            {completed.length} {completed.length === 1 ? "carrera" : "carreras"}
          </span>
        </div>

        {completed.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-16 text-center">
            <h3 className="text-lg font-bold text-white mb-2">
              Aún no hay carreras completadas
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Cuando termines una carrera oficial, aparecerá aquí en tu vitrina
              de medallas.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map((race) => (
              <div key={race.id}>
                <MedalCard3D
                  race={race}
                  isPB={isPBRace(race)}
                  onClick={() => onOpenMemoryModal(race)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

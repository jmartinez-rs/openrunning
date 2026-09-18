import { Plus } from "lucide-react"

import type { RacePublic } from "@/client"
import { PriorityRaceCard } from "./PriorityRaceCard"
import { SecondaryRaceCard } from "./SecondaryRaceCard"
import { parseRaceNotes } from "./race-meta"

interface UpcomingRacesTabProps {
  upcoming: RacePublic[]
  onOpenForm: () => void
}

export function UpcomingRacesTab({ upcoming, onOpenForm }: UpcomingRacesTabProps) {
  // Sort upcoming by priority A > B > C > None, then by date
  const sortedUpcoming = [...upcoming].sort((a, b) => {
    const metaA = parseRaceNotes(a.notes)
    const metaB = parseRaceNotes(b.notes)
    const pA = metaA.priority || "Z" // Z so unassigned goes last
    const pB = metaB.priority || "Z"
    
    if (pA !== pB) return pA.localeCompare(pB)
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })

  // Group into A and others
  const priorityA = sortedUpcoming.filter(r => parseRaceNotes(r.notes).priority === "A")
  const secondary = sortedUpcoming.filter(r => parseRaceNotes(r.notes).priority !== "A")

  return (
    <div className="flex flex-col gap-10 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Target Race (A) */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-black text-white tracking-tight">Objetivo Principal</h2>
        {priorityA.length > 0 ? (
          <div className="grid gap-6">
            {priorityA.map(race => (
              <PriorityRaceCard key={race.id} race={race} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/50 p-8 text-center flex flex-col items-center justify-center min-h-[220px]">
            <h3 className="text-lg font-bold text-white mb-2">Sin objetivo principal</h3>
            <p className="text-sm text-slate-400 max-w-sm mb-6">
              Registra tu próxima carrera objetivo (Prioridad A) para visualizar la cuenta regresiva y estrategia.
            </p>
            <button
              onClick={onOpenForm}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-colors"
            >
              <Plus className="size-4" /> Añadir Carrera Objetivo
            </button>
          </div>
        )}
      </div>

      {/* Secondary Races (B/C or None) */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-black text-white tracking-tight">Carreras Preparatorias</h2>
        {secondary.length > 0 ? (
          <div className="grid gap-4">
            {secondary.map(race => (
              <SecondaryRaceCard key={race.id} race={race} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-6 text-center">
            <p className="text-sm text-slate-500">
              No tienes carreras preparatorias (B/C) programadas.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

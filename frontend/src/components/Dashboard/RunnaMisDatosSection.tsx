import { ChevronDown, ChevronRight, RefreshCw, Zap } from "lucide-react"
import type React from "react"
import { useState } from "react"

interface RunnaMisDatosSectionProps {
  stravaLastSyncText: string
  isSyncingStrava: boolean
  onSyncStrava: () => void
}

export const RunnaMisDatosSection: React.FC<RunnaMisDatosSectionProps> = ({
  stravaLastSyncText,
  isSyncingStrava,
  onSyncStrava,
}) => {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <section aria-label="Mis datos" className="space-y-3">
      {/* Header con botón expandir/contraer */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-display font-black text-white tracking-tight">
          Mis datos
        </h2>
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-white uppercase tracking-wider transition-colors cursor-pointer"
        >
          <span>{isExpanded ? "Contraer" : "Expandir"}</span>
          {isExpanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>
      </div>

      {/* Contenido expandible: Strava & Actividades */}
      {isExpanded && (
        <div className="rounded-3xl bg-[#17171a] border border-white/10 p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="size-8 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
                <Zap className="size-4 fill-current stroke-none" />
              </div>
              <h3 className="text-sm font-bold text-white">
                Strava & Actividades
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {stravaLastSyncText}
            </p>
          </div>

          <div className="pt-2 sm:pt-0">
            <button
              type="button"
              disabled={isSyncingStrava}
              onClick={onSyncStrava}
              className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 active:scale-95"
            >
              <RefreshCw
                className={`size-3.5 ${isSyncingStrava ? "animate-spin text-primary" : ""}`}
              />
              <span>{isSyncingStrava ? "Sincronizando..." : "Sincronizar ahora"}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

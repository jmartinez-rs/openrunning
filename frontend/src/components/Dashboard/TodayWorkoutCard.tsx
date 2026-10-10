import {
  ChevronRight,
  HelpCircle,
  Sun,
} from "lucide-react"
import type React from "react"
import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  blocksDistanceKm,
  formatDistance,
  formatPace,
  WORKOUT_TYPE_META,
  type WorkoutType,
} from "@/components/RunningPlans/running-utils"
import { Skeleton } from "@/components/ui/skeleton"

interface TodayWorkoutCardProps {
  workout?: {
    id: string
    title?: string | null
    type: string
    date: string
    distance_km?: number | null
    pace_seconds_per_km?: number | null
    description?: string | null
    blocks?: Array<{
      name?: string | null
      repeats?: number | null
      distance_m?: number | null
      pace_seconds_per_km?: number | null
      pace_range_end_seconds_per_km?: number | null
    }>
  } | null
  planId?: string | null
  weekNumber?: number
  weatherTemp?: string
  weatherDescription?: string
  isLoading?: boolean
  onOpenManualRun?: () => void
}

type TabMode = "resumen" | "paso_a_paso" | "clima"
type UnitMode = "pace" | "kmh"

export const TodayWorkoutCard: React.FC<TodayWorkoutCardProps> = ({
  workout,
  planId,
  weekNumber,
  weatherTemp = "17°C",
  weatherDescription = "Clima agradable",
  isLoading = false,
  onOpenManualRun,
}) => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabMode>("resumen")
  const [unitMode, setUnitMode] = useState<UnitMode>("pace")

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-3xl bg-[#121214] border border-white/10" />
  }

  // Si no hay entrenamiento hoy o no hay plan
  if (!workout) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#121214] p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
            Entrenamiento de hoy
          </span>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Sun className="size-4 text-amber-400" />
            <span>{weatherTemp}</span>
          </div>
        </div>

        <div className="py-4 text-center">
          <p className="text-base font-bold text-white">Día de Descanso Activo</p>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
            Hoy no hay sesiones estructuradas asignadas. Puedes recuperar o registrar un trote suave si lo deseas.
          </p>
          {onOpenManualRun && (
            <button
              type="button"
              onClick={onOpenManualRun}
              className="mt-4 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all cursor-pointer"
            >
              Registrar actividad manual
            </button>
          )}
        </div>
      </div>
    )
  }

  const workoutTypeMeta = WORKOUT_TYPE_META[workout.type as WorkoutType]
  const displayTitle = workout.title || workoutTypeMeta?.label || "Entrenamiento de hoy"
  const distanceKm = workout.distance_km ?? (workout.blocks ? blocksDistanceKm(workout.blocks) : null)

  // Formato ritmo vs km/h
  const basePaceSec = workout.pace_seconds_per_km
  let paceFormatted = "--:--"
  let speedFormatted = "--.-"
  if (basePaceSec && basePaceSec > 0) {
    paceFormatted = formatPace(basePaceSec).replace("/km", "").trim()
    const kmh = (3600 / basePaceSec).toFixed(1)
    speedFormatted = kmh
  }

  const handleCardClick = () => {
    if (planId) {
      navigate({
        to: "/routines/run/$planId",
        params: { planId },
        search: weekNumber ? { week: weekNumber } : {},
      })
    }
  }

  return (
    <div className="space-y-2">
      {/* Label and Weather Row */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-black uppercase tracking-wider text-white">
          Entrenamiento de Hoy
        </h3>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
          <Sun className="size-4 text-amber-400" />
          <span>{weatherTemp}</span>
        </div>
      </div>

      {/* Main Workout Card */}
      <div className="rounded-3xl border border-white/10 bg-[#121214] p-5 shadow-card transition-all">
        {/* Title + Unit Switch */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-display font-black text-white tracking-tight">
              {displayTitle}
            </h2>
            <HelpCircle className="size-4 text-amber-400 shrink-0 cursor-help" />
          </div>

          {/* Unit Toggle Pill (Paccer style: PACE / KM/H) */}
          <div className="flex items-center rounded-full bg-black/40 border border-white/10 p-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setUnitMode("pace")}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                unitMode === "pace"
                  ? "bg-primary text-black font-extrabold shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              PACE
            </button>
            <button
              type="button"
              onClick={() => setUnitMode("kmh")}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                unitMode === "kmh"
                  ? "bg-primary text-black font-extrabold shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              KM/H
            </button>
          </div>
        </div>

        {/* Tab Navigation: Resumen | Paso a paso | Clima */}
        <div className="flex items-center border-b border-white/10 gap-6 text-xs font-bold mb-4">
          <button
            type="button"
            onClick={() => setActiveTab("resumen")}
            className={`pb-2.5 transition-all relative cursor-pointer ${
              activeTab === "resumen"
                ? "text-white font-extrabold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Resumen
            {activeTab === "resumen" && (
              <div className="absolute bottom-0 inset-x-0 h-0.5 bg-primary rounded-full shadow-[0_0_8px_rgba(234,252,95,0.6)]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("paso_a_paso")}
            className={`pb-2.5 transition-all relative cursor-pointer ${
              activeTab === "paso_a_paso"
                ? "text-white font-extrabold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Paso a paso
            {activeTab === "paso_a_paso" && (
              <div className="absolute bottom-0 inset-x-0 h-0.5 bg-primary rounded-full shadow-[0_0_8px_rgba(234,252,95,0.6)]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("clima")}
            className={`pb-2.5 transition-all relative cursor-pointer ${
              activeTab === "clima"
                ? "text-white font-extrabold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Clima
            {activeTab === "clima" && (
              <div className="absolute bottom-0 inset-x-0 h-0.5 bg-primary rounded-full shadow-[0_0_8px_rgba(234,252,95,0.6)]" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "resumen" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-black/30 border border-white/5 rounded-2xl p-3">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">
                  Distancia
                </span>
                <span className="text-lg font-display font-black text-white">
                  {distanceKm ? `${formatDistance(distanceKm).replace(" km", "")} km` : "--"}
                </span>
              </div>

              <div className="bg-black/30 border border-white/5 rounded-2xl p-3">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">
                  {unitMode === "pace" ? "Ritmo Objetivo" : "Velocidad"}
                </span>
                <span className="text-lg font-display font-black text-white">
                  {unitMode === "pace" ? `${paceFormatted}/km` : `${speedFormatted} km/h`}
                </span>
              </div>

              <div className="bg-black/30 border border-white/5 rounded-2xl p-3">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">
                  Zona FC
                </span>
                <span className="text-lg font-display font-black text-primary">
                  Z2 / Base
                </span>
              </div>
            </div>

            {workout.description && (
              <p className="text-xs text-zinc-400 leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5">
                {workout.description}
              </p>
            )}
          </div>
        )}

        {activeTab === "paso_a_paso" && (
          <div className="space-y-2.5 py-1">
            {workout.blocks && workout.blocks.length > 0 ? (
              workout.blocks.map((b, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-xl bg-black/30 border-l-4 border-l-primary border-t border-r border-b border-white/5 text-xs text-zinc-200"
                >
                  <span className="font-bold text-white">{b.name || `Bloque ${idx + 1}`}:</span>
                  <span>
                    {b.distance_m ? `${b.distance_m}m` : ""}
                    {b.repeats && b.repeats > 1 ? ` (${b.repeats} reps)` : ""}
                    {b.pace_seconds_per_km ? ` @ ${formatPace(b.pace_seconds_per_km)}` : ""}
                  </span>
                </div>
              ))
            ) : (
              <div className="space-y-2 text-xs text-zinc-300">
                <div className="p-3 rounded-xl bg-black/30 border-l-4 border-l-zinc-500">
                  <span className="font-bold text-white">Calentamiento:</span> 1.5 km muy suave + movilidad articular
                </div>
                <div className="p-3 rounded-xl bg-black/30 border-l-4 border-l-primary">
                  <span className="font-bold text-white">Bloque Principal:</span> {distanceKm ? `${distanceKm} km` : "Rodaje"} a ritmo conversacional continuo
                </div>
                <div className="p-3 rounded-xl bg-black/30 border-l-4 border-l-zinc-500">
                  <span className="font-bold text-white">Vuelta a la calma:</span> 5 min caminata + estiramientos suaves
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "clima" && (
          <div className="space-y-3 py-1 text-xs">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-black/30 border border-white/5">
              <div className="flex items-center gap-2">
                <Sun className="size-5 text-amber-400" />
                <div>
                  <span className="font-bold text-white">{weatherTemp} · {weatherDescription}</span>
                  <p className="text-[11px] text-zinc-400">Viento 7 km/h · Humedad 76%</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                Ideal
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-black/20 border border-white/5">
              <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">
                Indumentaria recomendada
              </span>
              <p className="text-zinc-200">
                Remera técnica transpirable, shorts y protección solar ligera.
              </p>
            </div>
          </div>
        )}

        {/* Footer Action link */}
        {planId && (
          <button
            type="button"
            onClick={handleCardClick}
            className="w-full mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer group"
          >
            <span>Ver sesión completa en el plan</span>
            <ChevronRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>
    </div>
  )
}

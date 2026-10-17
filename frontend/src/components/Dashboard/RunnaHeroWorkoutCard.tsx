import {
  Check,
  ChevronRight,
  Cloud,
  Coffee,
  Lightbulb,
  Sun,
} from "lucide-react"
import type React from "react"
import type { RunningWorkoutPublic } from "@/client"
import {
  blocksDistanceKm,
  formatDistance,
  WORKOUT_TYPE_META,
  type WorkoutType,
} from "@/components/RunningPlans/running-utils"
import { formatWeekdayDayMonth } from "@/lib/dashboard-dates"
import { isWorkoutCompleted, resolveHeroState } from "@/lib/dashboard-model"

interface RunnaHeroWorkoutCardProps {
  workout: RunningWorkoutPublic | null
  selectedDateIso: string
  isToday: boolean
  weatherTemp?: string
  weatherCondition?: "sunny" | "cloudy"
  onToggleComplete?: (workoutId: string, currentCompleted: boolean) => void
  isTogglingComplete?: boolean
  onViewDetails?: () => void
  onOpenManualRun?: () => void
  /** Plan detail still loading: render the skeleton instead of "Día de descanso" (E7). */
  isLoading?: boolean
}

/** Cabecera compartida por las tres ramas (carga, descanso y sesión). */
const HeroHeader: React.FC<{
  sectionTitle: string
  weatherTemp: string
  weatherCondition: "sunny" | "cloudy"
}> = ({ sectionTitle, weatherTemp, weatherCondition }) => (
  <div className="flex items-center justify-between px-1">
    <h2 className="text-base font-display font-black text-white tracking-tight">
      {sectionTitle}
    </h2>
    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
      {weatherCondition === "sunny" ? (
        <Sun className="size-4 text-amber-400" />
      ) : (
        <Cloud className="size-4 text-zinc-400" />
      )}
      <span>{weatherTemp}</span>
    </div>
  </div>
)

/** Formatea duración estimada estilo Runna: "40m - 45m" o "50m" */
function formatRunnaDuration(
  seconds?: number | null,
  distanceKm?: number | null,
): string {
  if (seconds && seconds > 0) {
    const min = Math.round(seconds / 60)
    const lower = Math.max(10, min - 5)
    return `${lower}m - ${min}m`
  }
  if (distanceKm && distanceKm > 0) {
    // Estimación ~6 min/km base
    const min = Math.round(distanceKm * 6)
    const lower = Math.max(10, min - 5)
    return `${lower}m - ${min}m`
  }
  return "40m - 50m"
}

export const RunnaHeroWorkoutCard: React.FC<RunnaHeroWorkoutCardProps> = ({
  workout,
  selectedDateIso,
  isToday,
  weatherTemp = "18°",
  weatherCondition = "cloudy",
  onToggleComplete,
  isTogglingComplete = false,
  onViewDetails,
  onOpenManualRun,
  isLoading = false,
}) => {
  // Etiqueta de fecha en la zona fijada (RUNNING_TIMEZONE): "jueves, 22 oct"
  const dateFormatted = formatWeekdayDayMonth(selectedDateIso)

  // Título de la sección
  const sectionTitle = isToday
    ? "Entrenamientos de hoy"
    : `Entrenamientos · ${dateFormatted}`

  // Estado del hero resuelto una sola vez: fuente única para las tres ramas (E7)
  const heroState = resolveHeroState({ workout, isLoading })

  // El detalle del plan todavía está cargando: skeleton, nunca "Día de descanso" (E7)
  if (heroState === "loading") {
    return (
      <section
        aria-label="Entrenamientos"
        aria-busy="true"
        data-testid="hero-skeleton"
        className="space-y-3"
      >
        <HeroHeader
          sectionTitle={sectionTitle}
          weatherTemp={weatherTemp}
          weatherCondition={weatherCondition}
        />

        <div className="relative overflow-hidden rounded-3xl bg-[#17171a] border border-white/10 p-5 sm:p-6 shadow-card">
          <div className="absolute left-0 top-0 bottom-0 w-2.5 rounded-l-3xl bg-white/10 animate-pulse" />
          <div className="pl-2 animate-pulse space-y-3">
            <div className="h-6 w-2/3 rounded-lg bg-white/10" />
            <div className="h-3 w-1/3 rounded bg-white/5" />
            <div className="h-3 w-1/2 rounded bg-white/5" />
            <div className="mt-5 h-11 rounded-2xl bg-white/5" />
          </div>
        </div>
      </section>
    )
  }

  // 1. Día de Descanso (sin sesión en este día). `heroState` es la decisión
  // única; la comprobación `null` es sólo el estrechamiento de tipos hacia la
  // rama de sesión (`resolveHeroState` ya clasifica un workout nulo como "rest").
  if (heroState === "rest" || workout === null) {
    return (
      <section aria-label="Entrenamientos" className="space-y-3">
        <HeroHeader
          sectionTitle={sectionTitle}
          weatherTemp={weatherTemp}
          weatherCondition={weatherCondition}
        />

        {/* Tarjeta de Día de Descanso */}
        <div className="relative overflow-hidden rounded-3xl bg-[#17171a] border border-white/5 p-6 shadow-card text-center">
          <div className="flex justify-center mb-3">
            <div className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400">
              <Coffee className="size-6 text-zinc-300" />
            </div>
          </div>
          <h3 className="text-lg font-display font-black text-white">
            Día de descanso
          </h3>
          <p className="text-xs text-zinc-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
            Hoy no tienes entrenamientos asignados en tu plan. Aprovecha para
            recuperar fibras, hidratarte y descansar.
          </p>
          {onOpenManualRun && (
            <button
              type="button"
              onClick={onOpenManualRun}
              className="mt-4 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all cursor-pointer active:scale-95"
            >
              Registrar sesión libre
            </button>
          )}
        </div>
      </section>
    )
  }

  // 2. Sesión programada
  const typeMeta = WORKOUT_TYPE_META[workout.type as WorkoutType]
  const displayTitle = workout.name || typeMeta?.label || "Sesión de running"
  const distanceKm =
    workout.distance_km ??
    (workout.blocks ? blocksDistanceKm(workout.blocks) : null)
  const durationText = formatRunnaDuration(workout.duration_seconds, distanceKm)

  // Determinar si está completada (R8: solo el status resuelto por el backend)
  const isCompleted = isWorkoutCompleted(workout)

  // Barra de color lateral y categoría estilo Runna
  let leftBarGradient = "from-lime-400 to-emerald-500"
  let categoryLabel = typeMeta?.label || "Carrera fácil"

  switch (workout.type) {
    case "tempo":
      leftBarGradient = "from-amber-400 via-orange-400 to-amber-500"
      categoryLabel = "Tempo"
      break
    case "intervals":
      leftBarGradient = "from-orange-500 via-amber-500 to-orange-400"
      categoryLabel = "Intervalos"
      break
    case "long_run":
      leftBarGradient = "from-purple-500 via-violet-500 to-purple-600"
      categoryLabel = "Carrera larga"
      break
    case "test":
    case "race":
      leftBarGradient = "from-rose-500 to-red-600"
      categoryLabel = workout.type === "race" ? "Carrera" : "Test"
      break
    default:
      leftBarGradient = "from-lime-400 via-emerald-400 to-lime-500"
      categoryLabel = "Carrera fácil"
      break
  }

  const distanceFormatted = distanceKm ? formatDistance(distanceKm) : ""

  return (
    <section aria-label="Entrenamientos" className="space-y-3">
      <HeroHeader
        sectionTitle={sectionTitle}
        weatherTemp={weatherTemp}
        weatherCondition={weatherCondition}
      />

      {/* Tarjeta Hero estilo Runna */}
      <div className="relative overflow-hidden rounded-3xl bg-[#17171a] border border-white/10 p-5 sm:p-6 shadow-card hover:border-white/20 transition-all">
        {/* Barra de acento vertical izquierda */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-2.5 rounded-l-3xl bg-gradient-to-b ${leftBarGradient}`}
        />

        {/* Contenido principal */}
        <div className="pl-2">
          {/* Fila superior: Título + Checkbox */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3
                onClick={onViewDetails}
                className="text-xl sm:text-2xl font-display font-black text-white tracking-tight hover:text-primary transition-colors cursor-pointer truncate"
              >
                {displayTitle}
              </h3>
              <p className="text-xs font-semibold text-zinc-400 mt-1 capitalize">
                {dateFormatted} · {durationText}
              </p>
              <p className="text-sm font-bold text-zinc-200 mt-2">
                {categoryLabel}
                {distanceFormatted ? ` · ${distanceFormatted}` : ""}
              </p>
            </div>

            {/* Checkbox redondeado estilo Runna */}
            {onToggleComplete && (
              <button
                type="button"
                disabled={isTogglingComplete}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleComplete(workout.id, isCompleted)
                }}
                className={`size-8 rounded-xl border-2 transition-all flex items-center justify-center cursor-pointer shrink-0 active:scale-90 ${
                  isCompleted
                    ? "bg-primary border-primary text-black shadow-[0_0_12px_rgba(234,252,95,0.4)]"
                    : "border-white/25 hover:border-white/50 bg-white/5 text-transparent"
                }`}
                aria-label={
                  isCompleted
                    ? "Marcar como pendiente"
                    : "Marcar como completado"
                }
                title={isCompleted ? "Completado" : "Pendiente"}
              >
                <Check
                  className={`size-5 stroke-[3] ${isCompleted ? "opacity-100" : "opacity-0"}`}
                />
              </button>
            )}
          </div>

          {/* Callout pill inferior estilo Runna */}
          <button
            type="button"
            onClick={onViewDetails}
            className="w-full mt-5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 px-4 py-3 flex items-center justify-between text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <Lightbulb className="size-4 text-amber-400 shrink-0" />
              <span>Ver detalle y desglose de la sesión</span>
            </div>
            <ChevronRight className="size-4 text-zinc-400 group-hover:translate-x-0.5 group-hover:text-white transition-all shrink-0" />
          </button>
        </div>
      </div>
    </section>
  )
}

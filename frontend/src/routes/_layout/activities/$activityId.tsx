import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  Footprints,
  Lock,
  MapPin,
  MessageSquarePlus,
  MoreHorizontal,
  Share2,
  Trophy,
} from "lucide-react"
import { useState } from "react"

import { ActivitiesService, ShoesService } from "@/client"
import { ActivityMap } from "@/components/Activities/ActivityMap"
import {
  formatPace,
  formatRunnaTime,
} from "@/components/Activities/activity-utils"
import { AIWorkoutAnalysisCard } from "@/components/Activities/AIWorkoutAnalysisCard"
import { CardioSummary } from "@/components/Activities/CardioSummary"
import { WorkoutFeedbackModal } from "@/components/Activities/WorkoutFeedbackModal"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/activities/$activityId")({
  component: ActivityDetail,
  head: () => ({ meta: [{ title: "Actividad - OpenRunning" }] }),
})

function formatActivityHeaderDate(dateString: string): string {
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return dateString
  const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "short" })
    .format(d)
    .replace(".", "")
  const day = d.getDate()
  const month = new Intl.DateTimeFormat("es-AR", { month: "short" })
    .format(d)
    .replace(".", "")
  const time = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d)
  return `${weekday}, ${day} ${month} · ${time}`
}

function getSportTypeLabel(sportType?: string | null): string {
  if (!sportType) return "Carrera libre"
  const st = sportType.toLowerCase()
  if (st === "run" || st === "carrera") return "Carrera libre"
  if (st === "trailrun") return "Trail Running"
  if (st === "virtualrun") return "Carrera virtual"
  if (st === "walk") return "Caminata"
  if (st === "workout") return "Entrenamiento"
  return sportType
}

function ShoeSelector({
  activityId,
  shoeId,
}: {
  activityId: string
  shoeId: string | null | undefined
}) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const shoesQuery = useQuery({
    queryKey: ["shoes"],
    queryFn: () => ShoesService.readShoes({ limit: 100 }),
  })
  const shoes = shoesQuery.data?.data ?? []
  const selectedShoe = shoes.find((s) => s.id === shoeId)

  const assignMutation = useMutation({
    mutationFn: (value: string) =>
      ActivitiesService.assignActivityShoe({
        activityId,
        requestBody: { shoe_id: value || null },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity", activityId] })
      queryClient.invalidateQueries({ queryKey: ["shoe-stats"] })
      showSuccessToast("Calzado actualizado")
    },
    onError: handleError.bind(showErrorToast),
  })

  return (
    <div className="rounded-3xl bg-[#17171a] border border-white/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-card">
      <div className="flex items-center gap-3.5">
        <div className="size-11 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-zinc-300 shrink-0">
          <Footprints className="size-5 text-zinc-300" />
        </div>
        <div>
          <p className="text-xs font-semibold text-zinc-400">Calzado</p>
          <p className="text-sm font-bold text-white tracking-tight">
            {selectedShoe
              ? `${selectedShoe.name}${selectedShoe.brand ? ` · ${selectedShoe.brand}` : ""}`
              : "Sin calzado asignado"}
          </p>
        </div>
      </div>

      <div className="relative shrink-0">
        <select
          className="w-full sm:w-auto appearance-none pl-3.5 pr-8 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-white/30 cursor-pointer disabled:opacity-50 transition-colors"
          value={shoeId ?? ""}
          disabled={assignMutation.isPending || shoesQuery.isLoading}
          onChange={(e) => assignMutation.mutate(e.target.value)}
        >
          <option value="" className="bg-[#1c1c20] text-zinc-300">
            {shoesQuery.isLoading ? "Cargando..." : "Sin calzado"}
          </option>
          {shoes.map((shoe) => (
            <option
              key={shoe.id}
              value={shoe.id}
              className="bg-[#1c1c20] text-white"
            >
              {shoe.name}
              {shoe.brand ? ` (${shoe.brand})` : ""}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
      </div>
    </div>
  )
}

function ActivityDetail() {
  const { activityId } = Route.useParams()
  const navigate = useNavigate()
  const { showSuccessToast } = useCustomToast()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const query = useQuery({
    queryKey: ["activity", activityId],
    queryFn: () => ActivitiesService.readActivity({ activityId }),
  })

  if (query.isLoading) {
    return (
      <div className="max-w-2xl mx-auto w-full flex flex-col gap-6 pb-24 pt-4">
        <Skeleton className="h-72 w-full rounded-3xl bg-surface-container-high" />
        <Skeleton className="h-32 w-full rounded-3xl bg-surface-container-high" />
        <Skeleton className="h-64 w-full rounded-3xl bg-surface-container-high" />
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <div className="max-w-md mx-auto w-full flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="size-16 rounded-3xl bg-[#17171a] border border-white/10 flex items-center justify-center text-zinc-400">
          <Footprints className="size-8 text-zinc-400" />
        </div>
        <h3 className="text-xl font-black text-white">
          No se pudo cargar la actividad
        </h3>
        <p className="text-xs text-zinc-400 max-w-sm">
          La actividad no existe o hubo un error al obtener la información desde el servidor.
        </p>
        <Link
          to="/activities"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.12] border border-white/15 text-white text-xs font-bold transition-all"
        >
          <ArrowLeft className="size-4" /> Volver a actividades
        </Link>
      </div>
    )
  }

  const activity = query.data
  const cardio = activity.cardio
  const isStrava = activity.source_type === "strava"
  const polyline = cardio?.map_summary_polyline

  const distanceKm = cardio?.distance_meters
    ? cardio.distance_meters / 1000
    : undefined
  const paceSeconds = cardio?.avg_pace_seconds_per_km ?? undefined

  const distanceFormatted =
    cardio?.distance_meters != null
      ? `${(cardio.distance_meters / 1000).toLocaleString("es-AR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} km`
      : "—"

  const timeFormatted = formatRunnaTime(activity.duration_seconds)
  const paceFormatted = formatPace(cardio?.avg_pace_seconds_per_km)
  const elevationFormatted =
    cardio?.elevation_gain_meters != null
      ? `▲ ${Math.round(cardio.elevation_gain_meters)} m`
      : "—"
  const hrFormatted =
    cardio?.avg_hr != null ? `${Math.round(cardio.avg_hr)}` : "—"
  const cadenceFormatted =
    cardio?.cadence_avg != null ? `${Math.round(cardio.cadence_avg)}` : "—"
  const caloriesFormatted =
    cardio?.calories != null ? `${Math.round(cardio.calories)}` : "—"

  const handleShare = async () => {
    const shareData = {
      title: activity.name || "Entrenamiento en OpenRunning",
      text: `Mirá mi entrenamiento en OpenRunning: ${activity.name || "Sesión de running"}`,
      url: window.location.href,
    }
    if (
      typeof navigator !== "undefined" &&
      navigator.share &&
      navigator.canShare &&
      navigator.canShare(shareData)
    ) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          await navigator.clipboard.writeText(window.location.href)
          showSuccessToast("Enlace de actividad copiado al portapapeles")
        }
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href)
      showSuccessToast("Enlace de actividad copiado al portapapeles")
    }
  }

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col gap-6 pb-28 pt-2">
      {/* Hero GPS Map or Header Card */}
      <div className="relative w-full rounded-3xl overflow-hidden border border-white/10 bg-[#121214] shadow-card">
        {polyline ? (
          <div className="relative h-72 sm:h-80 md:h-96 w-full">
            <ActivityMap
              encoded={polyline}
              className="h-full w-full"
              lineColor="#FC5200"
            />
            {/* Subtle bottom gradient into background */}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#121214] via-[#121214]/60 to-transparent pointer-events-none" />

            {/* Bottom-right route indicator icon */}
            <div className="absolute bottom-4 right-4 z-10 size-9 rounded-2xl bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/80 shadow-md pointer-events-none">
              <MapPin className="size-4 text-[#FC5200]" />
            </div>
          </div>
        ) : (
          <div className="h-40 w-full bg-gradient-to-br from-white/[0.04] to-transparent flex items-center justify-center">
            <div className="size-14 rounded-3xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-500">
              <Footprints className="size-7" />
            </div>
          </div>
        )}

        {/* Top-left Floating Back Button */}
        <button
          type="button"
          onClick={() => navigate({ to: "/activities" })}
          className="absolute top-4 left-4 z-10 size-10 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-black/80 transition-all cursor-pointer shadow-md active:scale-95"
          aria-label="Volver a actividades"
        >
          <ArrowLeft className="size-5" />
        </button>

        {/* Top-right Floating Options Menu */}
        <div className="absolute top-4 right-4 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="size-10 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-black/80 transition-all cursor-pointer shadow-md active:scale-95"
                aria-label="Más opciones"
              >
                <MoreHorizontal className="size-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-[#17171a] border-white/10 text-white shadow-2xl p-1.5 rounded-2xl"
            >
              <DropdownMenuItem
                onClick={() => setFeedbackOpen(true)}
                className="gap-2.5 cursor-pointer text-xs font-semibold py-2.5 rounded-xl hover:bg-white/[0.08]"
              >
                <MessageSquarePlus className="size-4 text-[#00E599]" />
                ¿Cómo te sentiste?
              </DropdownMenuItem>

              {isStrava && (
                <DropdownMenuItem asChild>
                  <Link
                    to="/races/new"
                    search={{ activityId }}
                    className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold py-2.5 rounded-xl hover:bg-white/[0.08]"
                  >
                    <Trophy className="size-4 text-amber-400" />
                    Marcar como carrera
                  </Link>
                </DropdownMenuItem>
              )}

              {isStrava && (
                <DropdownMenuItem asChild>
                  <a
                    href={`https://www.strava.com/activities/${activity.source_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold py-2.5 rounded-xl text-[#FC6100] hover:bg-[#FC6100]/10"
                  >
                    <ExternalLink className="size-4" />
                    Ver en Strava
                  </a>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                onClick={handleShare}
                className="gap-2.5 cursor-pointer text-xs font-semibold py-2.5 rounded-xl hover:bg-white/[0.08]"
              >
                <Share2 className="size-4 text-zinc-300" />
                Compartir actividad
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Activity Title, Sport Type Pill, and Date/Location */}
      <div className="space-y-2 px-1">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          {activity.name || "Entrenamiento de Running"}
        </h1>

        <div className="flex items-center gap-2.5 flex-wrap pt-0.5">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/[0.07] border border-white/10 text-white text-xs font-bold">
            {getSportTypeLabel(activity.sport_type)}
          </span>

          <span className="text-xs font-medium text-zinc-400">
            {formatActivityHeaderDate(activity.timestamp)}
          </span>

          {isStrava && (
            <a
              href={`https://www.strava.com/activities/${activity.source_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#FC6100] hover:underline"
            >
              <span>Ver en Strava</span>
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>

      {/* Runna 3-Column Metrics Grid */}
      <div className="rounded-3xl bg-[#17171a] border border-white/10 p-5 shadow-card">
        {/* Row 1: Distancia, Tiempo, Ritmo promedio */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 pb-4 border-b border-white/[0.08]">
          <div>
            <p className="text-xs font-semibold text-zinc-400">Distancia</p>
            <p className="text-xl sm:text-2xl font-black text-white font-display tracking-tight mt-1">
              {distanceFormatted}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-400">Tiempo</p>
            <p className="text-xl sm:text-2xl font-black text-white font-display tracking-tight mt-1">
              {timeFormatted}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-400">Ritmo promedio</p>
            <p className="text-xl sm:text-2xl font-black text-white font-display tracking-tight mt-1">
              {paceFormatted}
            </p>
          </div>
        </div>

        {/* Row 2: Desnivel positivo, FC media, Cadencia */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 py-4 border-b border-white/[0.08]">
          <div>
            <p className="text-xs font-semibold text-zinc-400 truncate">
              Desnivel positivo
            </p>
            <p className="text-xl sm:text-2xl font-black text-white font-display tracking-tight mt-1">
              {elevationFormatted}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-400">FC media</p>
            <p className="text-xl sm:text-2xl font-black text-white font-display tracking-tight mt-1">
              {hrFormatted}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-400">Cadencia</p>
            <p className="text-xl sm:text-2xl font-black text-white font-display tracking-tight mt-1">
              {cadenceFormatted}
            </p>
          </div>
        </div>

        {/* Row 3: Calorías */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-4">
          <div>
            <p className="text-xs font-semibold text-zinc-400">Calorías</p>
            <p className="text-xl sm:text-2xl font-black text-white font-display tracking-tight mt-1">
              {caloriesFormatted}
            </p>
          </div>
        </div>
      </div>


      {/* Shoe Selector */}
      {activity.cardio ? (
        <ShoeSelector
          activityId={activity.id}
          shoeId={activity.cardio.shoe_id}
        />
      ) : null}

      {/* Private Notes Card */}
      <div className="rounded-3xl bg-[#17171a] border border-white/10 p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-zinc-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              Notas privadas
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="text-xs font-bold text-[#00E599] hover:underline cursor-pointer"
          >
            {cardio?.perceived_effort_notes || cardio?.rpe
              ? "Editar notas"
              : "Añadir notas"}
          </button>
        </div>

        {cardio?.rpe || cardio?.perceived_effort_notes ? (
          <div className="space-y-2 pt-1">
            {cardio.rpe && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.05] border border-white/10 text-xs font-bold text-white">
                Esfuerzo percibido: {cardio.rpe} / 10
              </div>
            )}
            {cardio.perceived_effort_notes && (
              <p className="text-xs text-zinc-300 leading-relaxed italic bg-white/[0.02] p-3.5 rounded-2xl border border-white/5">
                "{cardio.perceived_effort_notes}"
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-zinc-400">
            Solo vos podés ver estas notas. Registrá cómo te sentiste, sensaciones o clima.
          </p>
        )}
      </div>

      {/* Splits & Heart Rate Zones */}
      {activity.cardio ? <CardioSummary cardio={activity.cardio} /> : null}

      {/* AI Workout Analysis Card */}
      <AIWorkoutAnalysisCard
        workoutType={getSportTypeLabel(activity.sport_type)}
        completedKm={distanceKm}
        avgPace={
          cardio?.avg_pace_seconds_per_km
            ? `${Math.floor(cardio.avg_pace_seconds_per_km / 60)}:${Math.floor(cardio.avg_pace_seconds_per_km % 60).toString().padStart(2, "0")}/km`
            : undefined
        }
      />

      {/* Workout Feedback Modal */}
      <WorkoutFeedbackModal
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        initialData={{
          distanceKm: distanceKm,
          paceSecondsPerKm: paceSeconds,
          durationSeconds: activity.duration_seconds,
          avgBpm: cardio?.avg_hr,
        }}
        onSubmitFeedback={async () => {
          // Invalidate activity query to refresh notes
          query.refetch()
        }}
      />
    </div>
  )
}

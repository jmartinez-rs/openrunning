import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  Footprints,
  MessageSquarePlus,
  Trophy,
} from "lucide-react"
import { useState } from "react"

import { ActivitiesService, ShoesService } from "@/client"
import {
  formatDate,
  formatDuration,
  formatTime,
} from "@/components/Activities/activity-utils"
import { AIWorkoutAnalysisCard } from "@/components/Activities/AIWorkoutAnalysisCard"
import { CardioDetail } from "@/components/Activities/CardioDetail"
import { CardioSummary } from "@/components/Activities/CardioSummary"
import {
  WorkoutFeedbackModal,
} from "@/components/Activities/WorkoutFeedbackModal"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/activities/$activityId")({
  component: ActivityDetail,
  head: () => ({ meta: [{ title: "Actividad - OpenRunning" }] }),
})

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

  if (shoesQuery.isLoading) {
    return (
      <div className="flex items-center justify-between gap-3 p-3.5 bg-card/80 border border-border rounded-2xl">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-surface-container-high text-muted-foreground">
            <Footprints className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            Cargando zapatillas...
          </span>
        </div>
      </div>
    )
  }

  if (shoes.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3 p-3.5 bg-card/80 border border-border rounded-2xl">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-orange-500/15 text-orange-400">
            <Footprints className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            Sin calzado disponible.{" "}
            <Link
              to="/shoes"
              className="text-orange-400 font-semibold hover:underline"
            >
              Crear calzado
            </Link>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-card/80 border border-border rounded-2xl">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-orange-500/15 text-orange-400">
          <Footprints className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs font-bold text-white tracking-tight">
            Calzado de la sesión
          </p>
          <p className="text-[11px] font-medium text-muted-foreground">
            Asigná las zapatillas usadas
          </p>
        </div>
      </div>

      <select
        className="px-3 py-1.5 rounded-xl bg-background border border-border text-foreground text-xs font-semibold focus:outline-none focus:border-primary/50 cursor-pointer disabled:opacity-50 transition-colors"
        value={shoeId ?? ""}
        disabled={assignMutation.isPending}
        onChange={(e) => assignMutation.mutate(e.target.value)}
      >
        <option value="">Sin calzado asignado</option>
        {shoes.map((shoe) => (
          <option key={shoe.id} value={shoe.id}>
            {shoe.name}
            {shoe.brand ? ` · ${shoe.brand}` : ""}
          </option>
        ))}
      </select>
    </div>
  )
}

function hasCardioAside(cardio: {
  splits?: unknown[] | null
  heart_rate_zones?: unknown[] | null
}): boolean {
  const splits = (cardio.splits ?? []) as unknown as Array<{
    moving_time?: number
  }>
  const zones = (cardio.heart_rate_zones ?? []) as unknown as Array<{
    time?: number
  }>
  const hasSplits = splits.length > 0
  const hasZones = zones.some((z) => Number(z.time) > 0)
  return hasSplits || hasZones
}

function ActivityDetail() {
  const { activityId } = Route.useParams()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const query = useQuery({
    queryKey: ["activity", activityId],
    queryFn: () => ActivitiesService.readActivity({ activityId }),
  })

  if (query.isLoading) {
    return (
      <div className="col-span-12 flex flex-col gap-6 pb-20">
        <Skeleton className="h-10 w-48 rounded-xl bg-surface-container-high" />
        <Skeleton className="h-96 w-full rounded-2xl bg-surface-container-high" />
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <div className="col-span-12 flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="p-4 rounded-2xl bg-card border border-border text-muted-foreground">
          <Footprints className="w-8 h-8 text-on-surface-variant" />
        </div>
        <h3 className="text-xl font-bold text-white">
          No se pudo cargar la actividad
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          La actividad no existe o hubo un error al obtener la información desde
          el servidor.
        </p>
        <Link
          to="/activities"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-white text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a actividades
        </Link>
      </div>
    )
  }

  const activity = query.data
  const isStrava = activity.source_type === "strava"
  const sourceLabel =
    activity.source_type === "strava"
      ? "Strava"
      : activity.source_type === "manual"
        ? "Manual"
        : activity.source_type === "gpx_upload" ||
            activity.source_type === "fit_upload"
          ? "Archivo GPS"
          : "Actividad"
  const hasCardioSummary =
    isStrava && Boolean(activity.cardio) && hasCardioAside(activity.cardio!)

  const cardio = activity.cardio
  const distanceKm = cardio?.distance_meters ? cardio.distance_meters / 1000 : undefined
  const paceSeconds = cardio?.avg_pace_seconds_per_km ?? undefined

  return (
    <div className="col-span-12 flex flex-col gap-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div className="flex items-start sm:items-center gap-3">
          <Link
            to="/activities"
            className="p-2.5 rounded-xl bg-card border border-border text-muted-foreground hover:text-white transition-colors shrink-0"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {activity.name || "Sesión cardio"}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold">
                <Footprints className="w-3.5 h-3.5" /> {sourceLabel}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-on-surface-variant" />
                {formatDate(activity.timestamp)} ·{" "}
                {formatTime(activity.timestamp)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-on-surface-variant" />
                {formatDuration(activity.duration_seconds)}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-primary">
                <Check className="w-3.5 h-3.5" /> Sincronizado
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-black font-extrabold hover:bg-primary/90 transition-all text-xs cursor-pointer shadow-sm"
          >
            <MessageSquarePlus className="w-4 h-4" /> ¿Cómo te sentiste?
          </button>

          {isStrava && (
            <Link
              to="/races/new"
              search={{ activityId }}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-white hover:bg-surface-container-high transition-colors text-xs font-bold"
            >
              <Trophy className="w-4 h-4 text-primary" /> Marcar como carrera
            </Link>
          )}
        </div>
      </div>

      {/* Main Grid Content */}
      <div
        className={
          hasCardioSummary
            ? "grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"
            : "flex flex-col gap-5"
        }
      >
        <div className="flex flex-col gap-5">
          {/* AI Workout Analysis Card (Mockup 12-treinos-analise.png) */}
          <AIWorkoutAnalysisCard
            workoutType={activity.sport_type || "Corrida"}
            completedKm={distanceKm}
            avgPace={cardio?.avg_pace_seconds_per_km ? `${Math.floor(cardio.avg_pace_seconds_per_km / 60)}:${Math.floor(cardio.avg_pace_seconds_per_km % 60).toString().padStart(2, "0")}/km` : undefined}
          />

          {activity.cardio ? (
            <div className="flex flex-col gap-5">
              {isStrava ? (
                <ShoeSelector
                  activityId={activity.id}
                  shoeId={activity.cardio.shoe_id}
                />
              ) : null}
              <CardioDetail cardio={activity.cardio} />
            </div>
          ) : (
            <div className="p-8 bg-card/80 border border-border rounded-2xl text-center text-muted-foreground text-xs font-medium">
              Sin métricas cargadas para esta sesión.
            </div>
          )}
        </div>

        {hasCardioSummary ? (
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <CardioSummary cardio={activity.cardio!} />
          </aside>
        ) : null}
      </div>

      {/* Workout Feedback Modal (11-treinos-como-foi.png) */}
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
          // Feedback registrado
        }}
      />
    </div>
  )
}


import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  Dumbbell,
  Footprints,
  Trophy,
} from "lucide-react"

import { ActivitiesService, AnalyticsService, ShoesService } from "@/client"
import { ActivitySummary } from "@/components/Activities/ActivitySummary"
import {
  formatDate,
  formatDuration,
  formatTime,
} from "@/components/Activities/activity-utils"
import { CardioDetail } from "@/components/Activities/CardioDetail"
import { CardioSummary } from "@/components/Activities/CardioSummary"
import {
  type ExerciseRecord,
  StrengthDetail,
} from "@/components/Activities/StrengthDetail"
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

  const query = useQuery({
    queryKey: ["activity", activityId],
    queryFn: () => ActivitiesService.readActivity({ activityId }),
  })

  const recordsQuery = useQuery({
    queryKey: ["strength-records"],
    queryFn: () => AnalyticsService.readStrengthRecords(),
    enabled: Boolean(query.data?.strength),
  })
  const records = (recordsQuery.data ?? {}) as unknown as Record<
    string,
    ExerciseRecord
  >

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
  const isStrength = activity.source_type === "hevy"
  const isStrava = activity.source_type === "strava"
  const strengthData = activity.strength
  const hasStrengthSummary = isStrength && Boolean(strengthData)
  const hasCardioSummary =
    isStrava && Boolean(activity.cardio) && hasCardioAside(activity.cardio!)

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
                {activity.name ||
                  (isStrength ? "Sesión de fuerza" : "Sesión cardio")}
              </h1>
              <span
                className={
                  isStrength
                    ? "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-bold"
                    : "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold"
                }
              >
                {isStrength ? (
                  <>
                    <Dumbbell className="w-3.5 h-3.5" /> Hevy
                  </>
                ) : (
                  <>
                    <Footprints className="w-3.5 h-3.5" /> Strava
                  </>
                )}
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

        {isStrava && (
          <Link
            to="/races/new"
            search={{ activityId }}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-white hover:bg-surface-container-high transition-colors text-xs font-bold w-full sm:w-auto"
          >
            <Trophy className="w-4 h-4 text-primary" /> Marcar como carrera
          </Link>
        )}
      </div>

      {/* Main Grid Content */}
      <div
        className={
          hasStrengthSummary || hasCardioSummary
            ? "grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"
            : "flex flex-col gap-5"
        }
      >
        <div className="flex flex-col gap-5">
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
          ) : activity.strength ? (
            <StrengthDetail strength={activity.strength} records={records} />
          ) : (
            <div className="p-8 bg-card/80 border border-border rounded-2xl text-center text-muted-foreground text-xs font-medium">
              Sin métricas cargadas para esta sesión.
            </div>
          )}
        </div>

        {hasStrengthSummary ? (
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <ActivitySummary
              strength={strengthData!}
              durationSeconds={activity.duration_seconds}
            />
          </aside>
        ) : hasCardioSummary ? (
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <CardioSummary cardio={activity.cardio!} />
          </aside>
        ) : null}
      </div>
    </div>
  )
}

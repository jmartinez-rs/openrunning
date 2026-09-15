import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, Dumbbell, Footprints } from "lucide-react"

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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
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
      <div className="flex flex-col gap-1.5">
        <Label>Calzado</Label>
        <select
          disabled
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option>Cargando zapatillas…</option>
        </select>
      </div>
    )
  }

  if (shoes.length === 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>Calzado</Label>
        <p className="text-body-md text-on-surface-variant">
          Creá una zapatilla para asignarla a tus sesiones{" "}
          <Link to="/shoes" className="text-primary underline">
            acá
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Calzado</Label>
      <select
        className="rounded-md border bg-background px-3 py-2 text-sm"
        value={shoeId ?? ""}
        disabled={assignMutation.isPending}
        onChange={(e) => assignMutation.mutate(e.target.value)}
      >
        <option value="">Sin calzado</option>
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
      <div className="col-span-12 flex flex-col gap-4">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <div className="col-span-12 flex flex-col items-center gap-4 py-16 text-center">
        <h3 className="text-title-lg text-primary">
          No se pudo cargar la actividad
        </h3>
        <p className="text-body-md text-on-surface-variant">
          La actividad no existe o hubo un error al cargarla.
        </p>
        <Button type="button" variant="outline" asChild className="rounded-lg">
          <Link to="/activities">
            <ArrowLeft className="mr-2 size-4" /> Volver a actividades
          </Link>
        </Button>
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
    <div className="col-span-12 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          asChild
          className="rounded-lg"
        >
          <Link to="/activities">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-headline-lg text-primary">
            {activity.name || "Actividad"}
          </h1>
          <p className="text-body-md text-on-surface-variant">
            {formatDate(activity.timestamp)} · {formatTime(activity.timestamp)}{" "}
            · {formatDuration(activity.duration_seconds)}
          </p>
        </div>
      </div>

      <div
        className={
          hasStrengthSummary || hasCardioSummary
            ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
            : "flex flex-col gap-6"
        }
      >
        <div className="flex flex-col gap-6">
          <Card className="rounded-2xl shadow-card dark:border dark:border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-title-lg text-primary">
                  {isStrength ? (
                    <Dumbbell className="size-5 text-domain-strength" />
                  ) : (
                    <Footprints className="size-5 text-domain-cardio" />
                  )}
                  {isStrength ? "Sesión de fuerza" : "Sesión cardio"}
                </CardTitle>
                <span
                  className={
                    isStrength
                      ? "inline-flex items-center gap-1 rounded bg-domain-strength/10 px-2 py-0.5 text-label-lg text-domain-strength"
                      : "inline-flex items-center gap-1 rounded bg-domain-cardio/10 px-2 py-0.5 text-label-lg text-domain-cardio"
                  }
                >
                  {isStrength ? "Hevy" : "Strava"}
                </span>
              </div>
            </CardHeader>
            <CardContent>
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
                <StrengthDetail
                  strength={activity.strength}
                  records={records}
                />
              ) : (
                <p className="text-body-md text-on-surface-variant">
                  Sin métricas cargadas.
                </p>
              )}
            </CardContent>
          </Card>
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

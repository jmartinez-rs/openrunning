import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, Calendar, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"

import { ShoesService } from "@/client"
import { ShoeFormDialog } from "@/components/Shoes/ShoeFormDialog"
import { ShoeStats } from "@/components/Shoes/ShoeStats"
import {
  formatKm,
  formatPace,
  shoeCategoryLabel,
} from "@/components/Shoes/shoe-utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/shoes/$shoeId")({
  component: ShoeDetail,
  head: () => ({ meta: [{ title: "Calzado - OpenRunning" }] }),
})

const CATEGORY_BADGE: Record<string, string> = {
  training: "bg-domain-cardio/10 text-domain-cardio",
  race: "bg-domain-race/10 text-domain-race",
  trail: "bg-emerald-500/10 text-emerald-600",
  easy: "bg-teal-500/10 text-teal-600",
  mixed: "bg-domain-strength/10 text-domain-strength",
}

const ACTIVITIES_PAGE_SIZE = 10

function ShoeDetail() {
  const { shoeId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [formOpen, setFormOpen] = useState(false)
  const [activitiesSkip, setActivitiesSkip] = useState(0)

  const shoeQuery = useQuery({
    queryKey: ["shoe", shoeId],
    queryFn: () => ShoesService.readShoe({ shoeId }),
  })

  const statsQuery = useQuery({
    queryKey: ["shoe-stats", shoeId],
    queryFn: () => ShoesService.readShoeStats({ shoeId }),
    enabled: Boolean(shoeId),
  })

  const activitiesQuery = useQuery({
    queryKey: ["shoe-activities", shoeId, activitiesSkip],
    queryFn: () =>
      ShoesService.readShoeActivities({
        shoeId,
        skip: activitiesSkip,
        limit: ACTIVITIES_PAGE_SIZE,
      }),
    enabled: Boolean(shoeId),
  })

  const deleteMutation = useMutation({
    mutationFn: () => ShoesService.deleteShoe({ shoeId }),
    onSuccess: () => {
      showSuccessToast("Zapatilla eliminada")
      queryClient.invalidateQueries({ queryKey: ["shoes"] })
      navigate({ to: "/shoes" })
    },
    onError: handleError.bind(showErrorToast),
  })

  if (shoeQuery.isLoading) {
    return (
      <div className="col-span-12 flex flex-col gap-4">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (shoeQuery.isError || !shoeQuery.data) {
    return (
      <div className="col-span-12 flex flex-col items-center gap-4 py-16 text-center">
        <h3 className="text-title-lg text-primary">
          No se pudo cargar la zapatilla
        </h3>
        <p className="text-body-md text-on-surface-variant">
          La zapatilla no existe o hubo un error al cargarla.
        </p>
        <Button type="button" variant="outline" asChild className="rounded-lg">
          <Link to="/shoes">
            <ArrowLeft className="mr-2 size-4" /> Volver a calzado
          </Link>
        </Button>
      </div>
    )
  }

  const shoe = shoeQuery.data
  const stats = statsQuery.data
  const activities = activitiesQuery.data?.data ?? []
  const totalActivities = activitiesQuery.data?.count ?? 0
  const races = stats?.races ?? []

  const percent = (() => {
    if (!shoe.target_distance_km || !stats?.total_distance_meters) return 0
    const usedKm = stats.total_distance_meters / 1000
    return Math.min(Math.round((usedKm / shoe.target_distance_km) * 100), 100)
  })()

  const hasMoreActivities =
    activitiesSkip + ACTIVITIES_PAGE_SIZE < totalActivities

  return (
    <div className="col-span-12 flex flex-col gap-6">
      <Link
        to="/shoes"
        className="inline-flex w-fit items-center gap-1.5 text-body-md text-on-surface-variant transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Volver a Calzado
      </Link>

      {/* Hero */}
      <div className="relative flex flex-col gap-5 overflow-hidden rounded-2xl bg-card p-6 shadow-card dark:border dark:border-border/50 md:flex-row md:items-center">
        {/* Avatar / Photo */}
        {shoe.photo_url ? (
          <img
            src={shoe.photo_url}
            alt={shoe.name}
            className="size-40 shrink-0 rounded-2xl object-cover shadow-md"
          />
        ) : (
          <div
            className="flex size-20 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white shadow-md"
            style={{
              background: shoe.color
                ? shoe.color
                : "linear-gradient(135deg, #6366f1, #ec4899)",
            }}
          >
            {shoe.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-headline-lg text-primary">{shoe.name}</h1>
            <span
              className={`rounded-full px-3 py-1 text-label-sm ${CATEGORY_BADGE[shoe.category] ?? "bg-surface-container-low text-on-surface-variant"}`}
            >
              {shoeCategoryLabel(shoe.category)}
            </span>
            {shoe.strava_gear_id && (
              <span className="rounded-full bg-domain-cardio/10 px-3 py-1 text-label-sm text-domain-cardio">
                Importada de Strava
              </span>
            )}
          </div>
          <p className="mt-1 text-body-md text-on-surface-variant">
            {[shoe.brand, shoe.model].filter(Boolean).join(" · ") || "—"}
          </p>
          {shoe.purchase_date && (
            <p className="mt-1 flex items-center gap-1 text-body-md text-on-surface-variant">
              <Calendar className="size-3.5" />
              Comprada el{" "}
              {new Intl.DateTimeFormat("es-AR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }).format(new Date(shoe.purchase_date))}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 md:shrink-0">
          <Button
            type="button"
            variant="outline"
            className="rounded-lg"
            onClick={() => setFormOpen(true)}
          >
            <Pencil className="mr-2 size-4" /> Editar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-lg"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            <Trash2 className="mr-2 size-4 text-destructive" /> Eliminar
          </Button>
        </div>

        {/* Progress bar full width */}
        <div className="w-full">
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-container-low">
            <div
              className="h-full rounded-full bg-domain-cardio transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-label-sm text-on-surface-variant">
            {formatKm(stats?.total_distance_meters)}
            {shoe.target_distance_km ? ` de ${shoe.target_distance_km} km` : ""}
            {shoe.target_distance_km ? ` (${percent}%)` : ""}
          </p>
        </div>

        {/* Notes */}
        {shoe.notes && (
          <div className="w-full border-t border-border/50 pt-4">
            <p className="whitespace-pre-wrap text-body-md text-on-surface-variant leading-relaxed">
              {shoe.notes}
            </p>
          </div>
        )}
      </div>

      {/* Stats */}
      {statsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <ShoeStats stats={stats} />
      ) : null}

      {/* Activities */}
      <section className="rounded-2xl bg-card p-6 shadow-card dark:border dark:border-border/50">
        <div className="flex items-end justify-between border-b border-border/50 pb-2">
          <h2 className="text-title-lg text-primary">
            Sesiones con este calzado
          </h2>
          <span className="text-label-sm text-on-surface-variant">
            {totalActivities} {totalActivities === 1 ? "sesión" : "sesiones"}
          </span>
        </div>

        {activitiesQuery.isLoading ? (
          <div className="flex flex-col gap-3 pt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border bg-surface-container-low px-4 py-8 text-center text-body-md text-on-surface-variant">
            Todavía no hay sesiones registradas con esta zapatilla.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-2">
              {activities.map((activity) => (
                <Link
                  key={activity.id}
                  to="/activities/$activityId"
                  params={{ activityId: activity.id }}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border/30 px-4 py-3 transition-colors hover:bg-surface-container-low"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-md font-medium text-primary">
                      {activity.name || "Sin nombre"}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {new Intl.DateTimeFormat("es-AR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(activity.timestamp))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-label-sm text-on-surface-variant">
                    {activity.cardio?.distance_meters != null && (
                      <span>{formatKm(activity.cardio.distance_meters)}</span>
                    )}
                    {activity.cardio?.avg_pace_seconds_per_km != null && (
                      <span>
                        {formatPace(activity.cardio.avg_pace_seconds_per_km)}
                      </span>
                    )}
                    {activity.cardio?.avg_hr != null && (
                      <span>{Math.round(activity.cardio.avg_hr)} bpm</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            {(activitiesSkip > 0 || hasMoreActivities) && (
              <div className="mt-4 flex items-center justify-center gap-2">
                {activitiesSkip > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-lg"
                    onClick={() =>
                      setActivitiesSkip((prev) =>
                        Math.max(0, prev - ACTIVITIES_PAGE_SIZE),
                      )
                    }
                  >
                    Anterior
                  </Button>
                )}
                {hasMoreActivities && (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-lg"
                    onClick={() =>
                      setActivitiesSkip((prev) => prev + ACTIVITIES_PAGE_SIZE)
                    }
                  >
                    Ver más
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* Races */}
      <section className="rounded-2xl bg-card p-6 shadow-card dark:border dark:border-border/50">
        <h2 className="border-b border-border/50 pb-2 text-title-lg text-primary">
          Carreras
        </h2>

        {races.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border bg-surface-container-low px-4 py-8 text-center text-body-md text-on-surface-variant">
            Esta zapatilla no se usó en carreras todavía.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {races.map((race) => (
              <Link
                key={race.id}
                to="/races/$raceId"
                params={{ raceId: race.id }}
                className="flex items-center justify-between gap-4 rounded-xl border border-border/30 px-4 py-3 transition-colors hover:bg-surface-container-low"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-md font-medium text-primary">
                    {race.event_name}
                  </p>
                  <p className="text-label-sm text-on-surface-variant">
                    {new Intl.DateTimeFormat("es-AR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(race.date))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-label-sm text-on-surface-variant">
                  <span>{race.distance_km} km</span>
                  {race.official_time_seconds != null && (
                    <span>
                      {(() => {
                        const s = race.official_time_seconds
                        const h = Math.floor(s / 3600)
                        const m = Math.floor((s % 3600) / 60)
                        const sec = Math.round(s % 60)
                        return h > 0
                          ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
                          : `${m}:${String(sec).padStart(2, "0")}`
                      })()}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <ShoeFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
        }}
        shoe={shoe}
      />
    </div>
  )
}

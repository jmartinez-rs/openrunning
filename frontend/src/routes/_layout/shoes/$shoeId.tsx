import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  Activity,
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Footprints,
  HeartPulse,
  Pencil,
  Trash2,
  Trophy,
} from "lucide-react"
import { useState } from "react"

import { ShoesService } from "@/client"
import { ShoeFormDialog } from "@/components/Shoes/ShoeFormDialog"
import { ShoeStats } from "@/components/Shoes/ShoeStats"
import {
  formatKm,
  formatPace,
  getFoamHealth,
  shoeCategoryMeta,
} from "@/components/Shoes/shoe-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/shoes/$shoeId")({
  component: ShoeDetail,
  head: () => ({ meta: [{ title: "Detalle de Calzado - OpenRunning" }] }),
})

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
        <Skeleton className="h-8 w-48 rounded-lg bg-surface-container-high" />
        <Skeleton className="h-64 w-full rounded-2xl bg-surface-container-high" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-20 w-full rounded-xl bg-surface-container-high"
            />
          ))}
        </div>
      </div>
    )
  }

  if (shoeQuery.isError || !shoeQuery.data) {
    return (
      <div className="col-span-12 flex flex-col items-center gap-4 py-16 text-center bg-card border border-border rounded-3xl p-8">
        <h3 className="text-lg font-bold text-white">
          No se pudo cargar la zapatilla
        </h3>
        <p className="text-xs text-muted-foreground">
          La zapatilla no existe o fue removida.
        </p>
        <Button
          type="button"
          variant="outline"
          asChild
          className="rounded-xl bg-surface-container-high border-border text-white"
        >
          <Link to="/shoes">
            <ArrowLeft className="mr-2 size-4" /> Volver a Calzado
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

  const health = getFoamHealth(
    stats?.total_distance_meters,
    shoe.target_distance_km,
  )
  const categoryMeta = shoeCategoryMeta(shoe.category)

  const hasMoreActivities =
    activitiesSkip + ACTIVITIES_PAGE_SIZE < totalActivities

  return (
    <div className="col-span-12 flex flex-col gap-6">
      {/* Back Button */}
      <Link
        to="/shoes"
        className="inline-flex w-fit items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-white"
      >
        <ArrowLeft className="size-4 text-primary" /> Volver a Shoe Locker
      </Link>

      {/* ── Shoe Hero Card ─────────────────────────────────────────── */}
      <div className="relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-card md:flex-row md:items-center">
        {/* Photo / Avatar */}
        {shoe.photo_url ? (
          <img
            src={shoe.photo_url}
            alt={shoe.name}
            className="size-36 shrink-0 rounded-2xl object-cover shadow-card border border-border"
          />
        ) : (
          <div
            className="flex size-32 shrink-0 items-center justify-center rounded-2xl text-3xl font-extrabold text-white shadow-card relative overflow-hidden"
            style={{
              background: shoe.color
                ? `linear-gradient(135deg, ${shoe.color} 30%, #0e0e0e 100%)`
                : "linear-gradient(135deg, #EAFC5F 0%, #0e0e0e 100%)",
            }}
          >
            <Footprints className="size-14 text-white/30" />
            <span className="absolute">
              {shoe.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">
              {shoe.name}
            </h1>
            <Badge
              className={cn(
                "text-xs font-extrabold border px-2.5 py-0.5",
                categoryMeta.badgeClass,
              )}
            >
              {categoryMeta.label}
            </Badge>
            {shoe.strava_gear_id && (
              <Badge className="bg-surface-container-high text-muted-foreground border-border text-xs font-bold">
                Strava Gear
              </Badge>
            )}
            {shoe.is_active === false && (
              <Badge
                variant="outline"
                className="text-muted-foreground border-border"
              >
                Retirada / Inactiva
              </Badge>
            )}
          </div>

          <p className="mt-1 text-sm font-semibold text-foreground">
            {[shoe.brand, shoe.model].filter(Boolean).join(" · ") ||
              "Sin marca o modelo cargados"}
          </p>

          {shoe.purchase_date && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Calendar className="size-3.5 text-on-surface-variant" />
              Comprada el{" "}
              {new Intl.DateTimeFormat("es-AR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }).format(new Date(shoe.purchase_date))}
            </p>
          )}

          {/* Notes */}
          {shoe.notes && (
            <p className="mt-3 text-xs italic text-muted-foreground bg-surface-container-high/60 border border-border/60 p-2.5 rounded-xl max-w-xl">
              "{shoe.notes}"
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 md:shrink-0">
          <Button
            type="button"
            variant="outline"
            className="bg-surface-container-high border-border text-muted-foreground hover:bg-surface-container-highest hover:text-white rounded-xl text-xs font-bold"
            onClick={() => setFormOpen(true)}
          >
            <Pencil className="mr-2 size-4" /> Editar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="bg-surface-container-high border-border text-destructive hover:bg-surface-container-highest hover:text-destructive rounded-xl text-xs font-bold"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `¿Eliminás la zapatilla "${shoe.name}"? Se perderá la vinculación en sus sesiones.`,
                )
              ) {
                deleteMutation.mutate()
              }
            }}
          >
            <Trash2 className="mr-2 size-4" /> Eliminar
          </Button>
        </div>
      </div>

      {/* ── Foam Health Meter Card ─────────────────────────────────── */}
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <HeartPulse className="size-5 text-primary" />
            <h2 className="text-base font-bold text-white">
              Salud de la Espuma & Desgaste Estima
            </h2>
          </div>
          <Badge
            className={cn(
              "text-xs font-extrabold border px-3 py-1 w-fit",
              health.badgeClass,
            )}
          >
            ● {health.statusLabel}
          </Badge>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-muted-foreground">Kilometraje Acumulado</span>
            <span className="text-white font-extrabold text-sm">
              {health.usedKm}{" "}
              <span className="text-muted-foreground text-xs font-normal">
                / {health.targetKm} km
              </span>
            </span>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-surface-container-high border border-border/60 p-0.5">
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r transition-all duration-500",
                health.barColorClass,
              )}
              style={{ width: `${Math.min(health.percent, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium pt-1">
            <span>
              Uso:{" "}
              <strong className="text-white font-bold">
                {health.percent}%
              </strong>
            </span>
            <span>
              Vida útil restante estimada:{" "}
              <strong className="text-primary font-bold">
                ~{health.remainingKm} km
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* ── Stats Grid ─────────────────────────────────────────────── */}
      {statsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-20 w-full rounded-xl bg-surface-container-high"
            />
          ))}
        </div>
      ) : stats ? (
        <ShoeStats stats={stats} />
      ) : null}

      {/* ── Sessions List ──────────────────────────────────────────── */}
      <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-primary" />
            <h2 className="text-base font-bold text-white">
              Sesiones Registradas con este Calzado
            </h2>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {totalActivities} {totalActivities === 1 ? "sesión" : "sesiones"}
          </span>
        </div>

        {activitiesQuery.isLoading ? (
          <div className="flex flex-col gap-3 pt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-16 w-full rounded-xl bg-surface-container-high"
              />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border bg-card/60 px-4 py-8 text-center text-xs text-muted-foreground">
            Todavía no hay sesiones registradas con esta zapatilla.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-2.5">
              {activities.map((activity) => (
                <Link
                  key={activity.id}
                  to="/activities/$activityId"
                  params={{ activityId: activity.id }}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-container-high/40 px-4 py-3 transition-colors hover:bg-surface-container-high hover:border-border group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white group-hover:text-primary transition-colors">
                      {activity.name || "Carrera sin nombre"}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium">
                      {new Intl.DateTimeFormat("es-AR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(activity.timestamp))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-xs font-semibold text-foreground">
                    {activity.cardio?.distance_meters != null && (
                      <span className="text-primary font-extrabold">
                        {formatKm(activity.cardio.distance_meters)}
                      </span>
                    )}
                    {activity.cardio?.avg_pace_seconds_per_km != null && (
                      <span>
                        {formatPace(activity.cardio.avg_pace_seconds_per_km)}
                      </span>
                    )}
                    {activity.cardio?.avg_hr != null && (
                      <span className="text-primary">
                        {Math.round(activity.cardio.avg_hr)} bpm
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination Controls */}
            {(activitiesSkip > 0 || hasMoreActivities) && (
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={activitiesSkip === 0}
                  onClick={() =>
                    setActivitiesSkip((prev) =>
                      Math.max(0, prev - ACTIVITIES_PAGE_SIZE),
                    )
                  }
                  className="bg-surface-container-high border-border text-muted-foreground hover:text-white rounded-xl text-xs font-semibold"
                >
                  <ChevronLeft className="mr-1 size-4" /> Anterior
                </Button>

                <span className="text-xs text-muted-foreground font-medium">
                  Página {Math.floor(activitiesSkip / ACTIVITIES_PAGE_SIZE) + 1}
                </span>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!hasMoreActivities}
                  onClick={() =>
                    setActivitiesSkip((prev) => prev + ACTIVITIES_PAGE_SIZE)
                  }
                  className="bg-surface-container-high border-border text-muted-foreground hover:text-white rounded-xl text-xs font-semibold"
                >
                  Siguiente <ChevronRight className="ml-1 size-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Races Section ─────────────────────────────────────────── */}
      <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Trophy className="size-5 text-primary" />
          <h2 className="text-base font-bold text-white">
            Carreras Disputadas con este Par ({races.length})
          </h2>
        </div>

        {races.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border bg-card/60 px-4 py-8 text-center text-xs text-muted-foreground">
            Esta zapatilla no se usó en carreras oficiales todavía.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-2.5">
            {races.map((race) => (
              <Link
                key={race.id}
                to="/races/$raceId"
                params={{ raceId: race.id }}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-container-high/40 px-4 py-3 transition-colors hover:bg-surface-container-high hover:border-border group"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white group-hover:text-primary transition-colors">
                    {race.event_name}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">
                    {new Intl.DateTimeFormat("es-AR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(race.date))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs font-bold text-foreground">
                  <span className="text-primary">{race.distance_km} km</span>
                  {race.official_time_seconds != null && (
                    <span className="text-white">
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

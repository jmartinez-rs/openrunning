import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, MapPin, Medal, Pencil, Trash2, Trophy } from "lucide-react"
import { useState } from "react"

import { ActivitiesService, RacesService } from "@/client"
import { ActivityMap } from "@/components/Activities/ActivityMap"
import { RaceFormDialog } from "@/components/Races/RaceFormDialog"
import {
  formatRaceDate,
  formatRacePace,
  formatRaceTime,
} from "@/components/Races/race-utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/races/$raceId")({
  component: RaceDetail,
  head: () => ({ meta: [{ title: "Carrera - OpenRunning" }] }),
})

function raceTypeLabel(distanceKm: number): string {
  if (distanceKm >= 42) return "MARATÓN"
  if (distanceKm >= 21) return "MEDIO MARATÓN"
  return "CARRERA"
}

function RaceDetail() {
  const { raceId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [formOpen, setFormOpen] = useState(false)

  const raceQuery = useQuery({
    queryKey: ["race", raceId],
    queryFn: () => RacesService.readRace({ raceId }),
  })

  const activityQuery = useQuery({
    queryKey: ["race-activity", raceQuery.data?.activity_id],
    queryFn: () =>
      ActivitiesService.readActivity({
        activityId: raceQuery.data!.activity_id!,
      }),
    enabled: Boolean(raceQuery.data?.activity_id),
  })

  const deleteMutation = useMutation({
    mutationFn: () => RacesService.deleteRace({ raceId }),
    onSuccess: () => {
      showSuccessToast("Carrera eliminada")
      queryClient.invalidateQueries({ queryKey: ["races"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      navigate({ to: "/races" })
    },
    onError: handleError.bind(showErrorToast),
  })

  if (raceQuery.isLoading) {
    return (
      <div className="col-span-12 flex flex-col gap-4">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    )
  }

  if (raceQuery.isError || !raceQuery.data) {
    return (
      <div className="col-span-12 flex flex-col items-center gap-4 py-16 text-center">
        <h3 className="text-title-lg text-primary">
          No se pudo cargar la carrera
        </h3>
        <p className="text-body-md text-on-surface-variant">
          La carrera no existe o hubo un error al cargarla.
        </p>
        <Button type="button" variant="outline" asChild className="rounded-lg">
          <Link to="/races">
            <ArrowLeft className="mr-2 size-4" /> Volver a carreras
          </Link>
        </Button>
      </div>
    )
  }

  const race = raceQuery.data
  const photos = race.photos_urls ?? []
  const cover = photos[0]
  const cardio = activityQuery.data?.cardio
  const polyline = cardio?.map_summary_polyline
  const elevationMeters = cardio?.elevation_gain_meters
  const isUpcoming = new Date(race.date).getTime() > Date.now()

  return (
    <div className="col-span-12 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          to="/races"
          className="inline-flex w-fit items-center gap-1.5 text-body-md text-on-surface-variant transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Volver a Carreras
        </Link>
        <div className="flex items-center gap-2">
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
      </div>

      {/* Hero */}
      <div className="relative h-64 w-full overflow-hidden rounded-2xl md:h-80">
        {cover ? (
          <img
            src={cover}
            alt={race.event_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-variant">
            <Trophy className="size-12 text-on-surface-variant/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
          {isUpcoming ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-domain-success px-3 py-1 text-label-sm text-white">
              Próxima
            </span>
          ) : null}
          {race.position ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1 text-label-sm text-primary shadow-sm">
              <Medal className="size-3" /> Puesto {race.position}
              {race.category ? ` · ${race.category}` : ""}
            </span>
          ) : null}
          {race.bib_number ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-card/80 px-3 py-1 text-label-sm text-primary backdrop-blur-sm">
              Dorsal {race.bib_number}
            </span>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-domain-race px-3 py-1 text-label-sm text-white">
              {raceTypeLabel(race.distance_km)}
            </span>
            <span className="text-label-sm text-white/80">
              {formatRaceDate(race.date)}
            </span>
          </div>
          <h1 className="mt-2 text-headline-lg text-white md:text-display-lg">
            {race.event_name}
          </h1>
          {race.location ? (
            <p className="mt-1 flex items-center gap-1.5 text-body-md text-white/80">
              <MapPin className="size-4" /> {race.location}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Resultados oficiales */}
        <section className="col-span-12 rounded-2xl bg-card p-6 shadow-card dark:border dark:border-border/50 md:col-span-8">
          <h2 className="text-label-sm text-on-surface-variant uppercase">
            Resultados Oficiales
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-label-sm text-on-surface-variant uppercase">
                Tiempo Chip
              </p>
              <p className="mt-1 text-headline-md tabular-nums text-primary">
                {formatRaceTime(race.chip_time_seconds)}
              </p>
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant uppercase">
                Tiempo Oficial
              </p>
              <p className="mt-1 text-headline-md tabular-nums text-primary">
                {formatRaceTime(race.official_time_seconds)}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border/50 pt-4">
            <div>
              <p className="text-label-sm text-on-surface-variant uppercase">
                Ritmo Medio
              </p>
              <p className="mt-1 text-title-lg tabular-nums text-primary">
                {formatRacePace(race.official_pace_seconds_per_km)}
              </p>
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant uppercase">
                Pos. General
              </p>
              <p className="mt-1 text-title-lg tabular-nums text-primary">
                {race.position != null ? String(race.position) : "—"}
              </p>
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant uppercase">
                Pos. Categoría
              </p>
              <p className="mt-1 text-title-lg text-primary">
                {race.category ?? "—"}
              </p>
            </div>
          </div>
        </section>

        {/* Recorrido */}
        <section className="col-span-12 flex flex-col overflow-hidden rounded-2xl bg-card shadow-card dark:border dark:border-border/50 md:col-span-4">
          <div className="p-6 pb-0">
            <h2 className="text-label-sm text-on-surface-variant uppercase">
              Recorrido
            </h2>
          </div>
          <div className="relative mt-4 min-h-[240px] flex-grow bg-surface-variant">
            {polyline ? (
              <ActivityMap encoded={polyline} />
            ) : activityQuery.isLoading ? (
              <Skeleton className="absolute inset-0 rounded-none" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                <MapPin className="size-8 text-on-surface-variant/50" />
                <p className="text-body-md text-on-surface-variant">
                  Sin recorrido disponible
                </p>
              </div>
            )}
            <div className="absolute bottom-3 right-3 flex items-center gap-4 rounded-lg border border-white/5 bg-card/80 px-3 py-2 shadow-card backdrop-blur-md">
              <div className="flex flex-col items-center">
                <span className="text-label-sm text-on-surface-variant">
                  Dist.
                </span>
                <span className="text-title-lg tabular-nums text-primary">
                  {race.distance_km} km
                </span>
              </div>
              {elevationMeters != null && elevationMeters > 0 ? (
                <>
                  <div className="h-6 w-px bg-border" />
                  <div className="flex flex-col items-center">
                    <span className="text-label-sm text-on-surface-variant">
                      Elev.
                    </span>
                    <span className="text-title-lg tabular-nums text-primary">
                      {Math.round(elevationMeters)} m
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </section>

        {/* Bitácora */}
        <section className="col-span-12 rounded-2xl bg-card p-6 shadow-card dark:border dark:border-border/50">
          <h2 className="text-label-sm text-on-surface-variant uppercase">
            Bitácora Personal
          </h2>
          {race.notes ? (
            <p className="mt-4 whitespace-pre-wrap text-body-md text-on-surface-variant leading-relaxed">
              {race.notes}
            </p>
          ) : (
            <p className="mt-4 text-body-md text-on-surface-variant">
              Todavía no escribiste la bitácora de esta carrera.
            </p>
          )}
        </section>

        {/* Galería */}
        {photos.length ? (
          <section className="col-span-12">
            <h2 className="text-label-sm text-on-surface-variant uppercase">
              Galería ({photos.length})
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              {photos.map((url, index) => (
                <div
                  key={index}
                  className="group aspect-square overflow-hidden rounded-xl border border-border/50"
                >
                  <img
                    src={url}
                    alt={`Foto ${index + 1}`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <RaceFormDialog open={formOpen} onOpenChange={setFormOpen} race={race} />
    </div>
  )
}

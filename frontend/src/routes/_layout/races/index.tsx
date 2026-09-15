import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { useState } from "react"

import { type RacePublic, RacesService } from "@/client"
import { RaceCard } from "@/components/Races/RaceCard"
import { RaceFormDialog } from "@/components/Races/RaceFormDialog"
import { RaceHeroCard } from "@/components/Races/RaceHeroCard"
import { RaceYearMetrics } from "@/components/Races/RaceYearMetrics"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/races/")({
  component: Races,
  head: () => ({ meta: [{ title: "Carreras - OpenRunning" }] }),
})

const DISTANCE_FILTERS = [
  { label: "Todas", value: "" },
  { label: "10k", value: "10" },
  { label: "15k", value: "15" },
  { label: "21k", value: "21.1" },
  { label: "42k", value: "42.2" },
  { label: "Trail", value: "trail" },
]

function Races() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [distance, setDistance] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RacePublic | null>(null)

  const query = useQuery({
    queryKey: ["races", distance],
    queryFn: () =>
      RacesService.readRaces({
        distanceKm: distance
          ? distance === "trail"
            ? null
            : Number(distance)
          : null,
        limit: 100,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => RacesService.deleteRace({ raceId: id }),
    onSuccess: () => {
      showSuccessToast("Carrera eliminada")
      queryClient.invalidateQueries({ queryKey: ["races"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const races = query.data?.data ?? []
  const now = Date.now()
  const upcoming = races
    .filter((race) => new Date(race.date).getTime() > now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const nextRace = upcoming[0] ?? null
  const completed = races.filter((race) => new Date(race.date).getTime() <= now)

  return (
    <div className="col-span-12 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-lg text-primary">Carreras</h1>
          <p className="text-body-md text-on-surface-variant">
            Tus próximos desafíos y tu historial de competencias.
          </p>
        </div>
        <Button
          type="button"
          className="rounded-lg bg-primary text-primary-foreground"
          onClick={() => setFormOpen(true)}
        >
          <Plus className="mr-2 size-4" /> Nueva carrera
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {DISTANCE_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setDistance(filter.value)}
            className={
              distance === filter.value
                ? "rounded-lg bg-primary px-4 py-1.5 text-label-sm text-primary-foreground shadow-sm transition-all"
                : "rounded-lg bg-surface-container-low px-4 py-1.5 text-label-sm text-on-surface-variant transition-colors hover:text-primary"
            }
          >
            {filter.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-12 gap-6">
            <Skeleton className="h-64 w-full rounded-2xl col-span-12 md:col-span-8" />
            <Skeleton className="h-64 w-full rounded-2xl col-span-12 md:col-span-4" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : query.isError ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="rounded-full bg-surface-container-low p-4">
            <RefreshCw className="size-8 text-primary" />
          </div>
          <h3 className="text-title-lg text-primary">
            No pudimos cargar tus carreras
          </h3>
          <p className="text-body-md text-on-surface-variant">
            Verificá que el backend esté disponible.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-2 rounded-lg"
            onClick={() => query.refetch()}
          >
            <RefreshCw className="mr-2 size-4" /> Reintentar
          </Button>
        </div>
      ) : races.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="rounded-full bg-surface-container-low p-4">
            <RefreshCw className="size-8 text-primary" />
          </div>
          <h3 className="text-title-lg text-primary">
            Todavía no registraste carreras
          </h3>
          <p className="text-body-md text-on-surface-variant">
            Registrá tu primera carrera para armar tu muro de competencias.
          </p>
          <Button
            type="button"
            className="mt-2 rounded-lg bg-primary text-primary-foreground"
            onClick={() => setFormOpen(true)}
          >
            <Plus className="mr-2 size-4" /> Registrar carrera
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-8">
            <RaceHeroCard
              race={nextRace}
              onRegister={() => setFormOpen(true)}
            />
          </div>

          <div className="col-span-12 md:col-span-4">
            <RaceYearMetrics completed={completed} />
          </div>

          <div className="flex flex-col gap-4 md:col-span-12">
            <div className="flex items-end justify-between border-b border-border/50 pb-2">
              <h2 className="text-title-lg text-primary">
                Carreras Completadas
              </h2>
              <span className="text-label-sm text-on-surface-variant">
                {completed.length}{" "}
                {completed.length === 1 ? "carrera" : "carreras"}
              </span>
            </div>

            {completed.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-surface-container-low px-4 py-8 text-center text-body-md text-on-surface-variant">
                Aún no hay carreras completadas.
              </p>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {completed.map((race) => (
                  <div className="group relative" key={race.id}>
                    <RaceCard race={race} />
                    <div className="absolute right-3 top-3 z-10 hidden items-center gap-1 group-hover:flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg bg-card shadow-sm"
                        onClick={(event) => {
                          event.preventDefault()
                          setEditing(race)
                          setFormOpen(true)
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg bg-card shadow-sm"
                        disabled={deleteMutation.isPending}
                        onClick={(event) => {
                          event.preventDefault()
                          deleteMutation.mutate(race.id)
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <RaceFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        race={editing}
      />
    </div>
  )
}

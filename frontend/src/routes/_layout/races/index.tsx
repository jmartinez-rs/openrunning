import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Archive, Plus, RefreshCw, Trophy } from "lucide-react"
import { useState } from "react"

import { type RacePublic, RacesService } from "@/client"
import { HistoryRacesTab } from "@/components/Races/HistoryRacesTab"
import { RaceMemoryModal } from "@/components/Races/RaceMemoryModal"
import { UpcomingRacesTab } from "@/components/Races/UpcomingRacesTab"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/races/")({
  component: Races,
  head: () => ({ meta: [{ title: "Mis Carreras - OpenRunning" }] }),
})

function Races() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [memoryModalOpen, setMemoryModalOpen] = useState(false)
  const [selectedRaceForMemory, setSelectedRaceForMemory] =
    useState<RacePublic | null>(null)

  const query = useQuery({
    queryKey: ["races", ""],
    queryFn: () => RacesService.readRaces({ limit: 100 }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => RacesService.deleteRace({ raceId: id }),
    onSuccess: () => {
      showSuccessToast("Carrera eliminada")
      queryClient.invalidateQueries({ queryKey: ["races"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      setMemoryModalOpen(false)
    },
    onError: handleError.bind(showErrorToast),
  })

  const races = query.data?.data ?? []
  const now = Date.now()

  // Split into upcoming and completed
  const upcoming = races.filter((race) => new Date(race.date).getTime() > now)

  const completed = races
    .filter((race) => new Date(race.date).getTime() <= now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Newest first for history

  const handleOpenMemoryModal = (race: RacePublic) => {
    setSelectedRaceForMemory(race)
    setMemoryModalOpen(true)
  }

  return (
    <div className="col-span-12 flex flex-col gap-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Race Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona tus próximos desafíos y tu baúl de recuerdos.
          </p>
        </div>
        <Button
          type="button"
          className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-glow"
          asChild
        >
          <Link to="/races/new">
            <Plus className="mr-2 size-4" /> Nueva carrera
          </Link>
        </Button>
      </div>

      {query.isLoading ? (
        <div className="flex flex-col gap-6 mt-4">
          <Skeleton className="h-10 w-64 rounded-xl bg-surface-container-high" />
          <Skeleton className="h-64 w-full rounded-2xl bg-surface-container-high" />
          <Skeleton className="h-64 w-full rounded-2xl bg-surface-container-high" />
        </div>
      ) : query.isError ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="rounded-full bg-card border border-border p-4">
            <RefreshCw className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold text-white">
            No pudimos cargar tus carreras
          </h3>
          <p className="text-sm text-muted-foreground">
            Verificá que el backend esté disponible.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-2 rounded-xl bg-card border-border text-muted-foreground hover:text-white"
            onClick={() => query.refetch()}
          >
            <RefreshCw className="mr-2 size-4" /> Reintentar
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="upcoming" className="mt-4">
          <TabsList className="bg-surface-container-low border border-border rounded-xl p-1">
            <TabsTrigger
              value="upcoming"
              className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary text-muted-foreground data-[state=active]:shadow-card px-6 py-2"
            >
              <Trophy className="size-4 mr-2" /> Próximas
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary text-muted-foreground data-[state=active]:shadow-card px-6 py-2"
            >
              <Archive className="size-4 mr-2" /> Historial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="focus-visible:outline-none">
            <UpcomingRacesTab
              upcoming={upcoming}
              onOpenForm={() => navigate({ to: "/races/new" })}
            />
          </TabsContent>

          <TabsContent value="history" className="focus-visible:outline-none">
            <HistoryRacesTab
              completed={completed}
              onOpenMemoryModal={handleOpenMemoryModal}
            />
          </TabsContent>
        </Tabs>
      )}

      <RaceMemoryModal
        open={memoryModalOpen}
        onOpenChange={setMemoryModalOpen}
        race={selectedRaceForMemory}
        onEdit={(race) => {
          setMemoryModalOpen(false)
          navigate({ to: "/races/new", search: { edit: race.id } })
        }}
        onDelete={(race) => deleteMutation.mutate(race.id)}
      />
    </div>
  )
}

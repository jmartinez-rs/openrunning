import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  ChevronLeft,
  ChevronRight,
  History as HistoryIcon,
  Loader2,
  RefreshCw,
  Search,
  SearchX,
  Upload,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"

import { ActivitiesService } from "@/client"
import { ActivityRow } from "@/components/Activities/ActivityRow"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"

export const Route = createFileRoute("/_layout/activities/")({
  component: ActivitiesHistory,
  head: () => ({ meta: [{ title: "Historial de Actividades - OpenRunning" }] }),
})

const PAGE_SIZE = 20

function ActivitiesHistory() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [feedTab, setFeedTab] = useState<"plan" | "others">("plan")
  const [searchTerm, setSearchTerm] = useState("")
  const [skip, setSkip] = useState(0)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    try {
      await ActivitiesService.uploadActivityFile({
        formData: { file: file as unknown as string },
      })

      showSuccessToast("Actividad GPS importada correctamente")
      queryClient.invalidateQueries({ queryKey: ["activities"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    } catch (err: any) {
      showErrorToast(err.message || "No se pudo procesar el archivo GPS")
    } finally {
      setIsUploading(false)
      e.target.value = ""
    }
  }

  const query = useQuery({
    queryKey: ["activities", skip],
    queryFn: () =>
      ActivitiesService.readActivities({
        skip,
        limit: PAGE_SIZE,
      }),
  })

  const rawActivities = query.data?.data ?? []
  const totalCount = query.data?.count ?? 0

  // Split into "Treinos do Plano" vs "Outros treinos"
  const planActivities = useMemo(() => {
    return rawActivities.filter((act) => {
      const sport = (act.sport_type || "").toLowerCase()
      const isRun =
        sport.includes("run") ||
        sport.includes("carrera") ||
        act.source_type === "strava" ||
        (act.cardio && !sport.includes("ride") && !sport.includes("bike"))
      return Boolean(isRun)
    })
  }, [rawActivities])

  const otherActivities = useMemo(() => {
    return rawActivities.filter((act) => {
      const sport = (act.sport_type || "").toLowerCase()
      const isOther =
        sport.includes("ride") ||
        sport.includes("bike") ||
        sport.includes("walk") ||
        sport.includes("swim")
      return Boolean(isOther)
    })
  }, [rawActivities])

  const activeActivities = feedTab === "plan" ? planActivities : otherActivities

  const filteredActivities = useMemo(() => {
    if (!searchTerm.trim()) return activeActivities
    return activeActivities.filter((act) =>
      (act.name || "").toLowerCase().includes(searchTerm.toLowerCase().trim()),
    )
  }, [activeActivities, searchTerm])

  return (
    <div className="col-span-12 flex flex-col gap-6 pb-8">
      {/* Header section — styled after OpenGym .hdr */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/80">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Historial
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {query.isLoading
              ? "Cargando actividades…"
              : `${totalCount} ${totalCount === 1 ? "actividad registrada" : "actividades registradas"}`}
          </p>
        </div>

        {/* Upload Button */}
        <label className="cursor-pointer self-start sm:self-auto font-semibold bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl inline-flex items-center gap-2 text-sm shadow-md transition-all active:scale-95">
          {isUploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4 stroke-[2.5]" />
          )}
          <span>Importar .fit / .gpx</span>
          <input
            type="file"
            accept=".gpx,.fit"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Top Filter Tabs: Entrenamientos del Plan vs Otras actividades */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="inline-flex rounded-xl bg-[#141416] p-1 border border-border/80">
          <button
            type="button"
            onClick={() => setFeedTab("plan")}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              feedTab === "plan"
                ? "bg-primary text-black font-extrabold shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Entrenamientos del Plan ({planActivities.length})
          </button>
          <button
            type="button"
            onClick={() => setFeedTab("others")}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              feedTab === "others"
                ? "bg-primary text-black font-extrabold shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Otras actividades ({otherActivities.length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-full rounded-xl border border-border/80 bg-[#121214] pl-9 pr-8 py-1.5 text-xs placeholder:text-muted-foreground text-foreground focus:border-primary/50"
            placeholder="Buscar actividad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Activities List */}
      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton className="h-20 w-full rounded-2xl bg-[#121214]" key={i} />
          ))}
        </div>
      ) : query.isError ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center border border-border/80 rounded-2xl bg-card/40">
          <RefreshCw className="size-8 text-primary animate-pulse" />
          <h3 className="text-base font-semibold text-foreground">
            No se pudo cargar el historial
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            Verificá la conexión con el servidor e intentá nuevamente.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            className="mt-1 rounded-xl border-border text-xs"
          >
            Reintentar
          </Button>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center border border-dashed border-border/70 rounded-2xl bg-[#121214]/50">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-card border border-border text-muted-foreground">
            {searchTerm ? (
              <SearchX className="size-7" />
            ) : (
              <HistoryIcon className="size-7" />
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {searchTerm
                ? "Sin resultados para la búsqueda"
                : feedTab === "plan"
                  ? "No hay entrenamientos de running registrados"
                  : "No hay otras actividades registradas"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              Sincronizá tu cuenta de Strava o importá un archivo .fit/.gpx para comenzar.
            </p>
          </div>
          {searchTerm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchTerm("")}
              className="mt-2 rounded-xl border-border text-xs text-muted-foreground"
            >
              Limpiar búsqueda
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredActivities.map((activity) => (
            <ActivityRow activity={activity} key={activity.id} />
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/60 text-xs text-muted-foreground">
          <span>
            Mostrando {skip + 1}–{Math.min(skip + PAGE_SIZE, totalCount)} de{" "}
            {totalCount} actividades
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={skip === 0}
              onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
              className="h-8 rounded-xl border-border text-xs text-muted-foreground disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5 mr-1" />
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={skip + PAGE_SIZE >= totalCount}
              onClick={() => setSkip(skip + PAGE_SIZE)}
              className="h-8 rounded-xl border-border text-xs text-muted-foreground disabled:opacity-40"
            >
              Siguiente
              <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

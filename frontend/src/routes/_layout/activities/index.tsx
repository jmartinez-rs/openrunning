import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  SearchX,
  Upload,
} from "lucide-react"
import { useState } from "react"

import { ActivitiesService, AnalyticsService } from "@/client"
import { ActivityCard } from "@/components/Activities/ActivityCard"
import { ActivityTypeCards } from "@/components/Activities/ActivityTypeCards"
import { MiniCalendar } from "@/components/Common/MiniCalendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"

export const Route = createFileRoute("/_layout/activities/")({
  component: Activities,
  head: () => ({ meta: [{ title: "Actividades - OpenRunning" }] }),
})

const PAGE_SIZE = 20

function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function Activities() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [sourceType, setSourceType] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [skip, setSkip] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [applied, setApplied] = useState({
    sourceType: "all",
    fromDate: "",
    toDate: "",
  })

  const monthKey = currentMonthKey()

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const token = localStorage.getItem("access_token")
      const response = await fetch("/api/v1/activities/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Error al subir el archivo")
      }

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
    queryKey: ["activities", applied, skip],
    queryFn: () =>
      ActivitiesService.readActivities({
        sourceType: applied.sourceType === "all" ? null : applied.sourceType,
        fromDate: applied.fromDate || null,
        toDate: applied.toDate || null,
        skip,
        limit: PAGE_SIZE,
      }),
  })

  const summaryQuery = useQuery({
    queryKey: ["activities-summary", monthKey],
    queryFn: () => AnalyticsService.readActivitiesSummary({ month: monthKey }),
  })

  const selectTab = (tab: string) => {
    setSourceType(tab)
    setSkip(0)
    setApplied((prev) => ({ ...prev, sourceType: tab }))
  }

  const applyFilters = () => {
    setSkip(0)
    setApplied({ sourceType, fromDate, toDate })
  }

  const clearFilters = () => {
    setSourceType("all")
    setSearchTerm("")
    setFromDate("")
    setToDate("")
    setSkip(0)
    setApplied({ sourceType: "all", fromDate: "", toDate: "" })
  }

  const data = query.data
  const hasFilters =
    applied.sourceType !== "all" ||
    applied.fromDate !== "" ||
    applied.toDate !== ""

  return (
    <div className="col-span-12 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-lg text-primary">Actividades</h1>
          <p className="text-body-md text-on-surface-variant">
            Tus sesiones de running y carreras registradas.
          </p>
        </div>
        <label className="cursor-pointer font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl inline-flex items-center gap-2 text-sm shadow-md transition-all">
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

      {summaryQuery.isLoading ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-64 w-full rounded-2xl lg:col-span-2" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      ) : summaryQuery.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border bg-muted/30 py-8 text-center">
          <p className="text-sm font-medium">No se pudo cargar el resumen</p>
          <p className="text-xs text-muted-foreground">
            Verificá la conexión e intentá nuevamente.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => summaryQuery.refetch()}
          >
            <RefreshCw className="mr-1.5 size-3.5" /> Reintentar
          </Button>
        </div>
      ) : summaryQuery.data ? (
        <div className="grid w-full grid-cols-3 gap-4">
          <ActivityTypeCards by_type={summaryQuery.data.by_type} />
          <MiniCalendar className="h-full" />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex rounded-lg bg-surface-container-low p-1">
          {["all", "strava", "hevy"].map((tab) => (
            <button
              type="button"
              key={tab}
              onClick={() => selectTab(tab)}
              className={
                sourceType === tab
                  ? "rounded-md bg-card px-6 py-2 text-label-lg text-primary shadow-sm transition-all"
                  : "rounded-md px-6 py-2 text-label-lg text-on-surface-variant transition-colors hover:text-primary"
              }
            >
              {tab === "all" ? "Todas" : tab === "strava" ? "Cardio" : "Fuerza"}
            </button>
          ))}
        </div>

        <div className="relative flex-1 md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
          <Input
            className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2 text-body-md placeholder:text-on-surface-variant/50"
            placeholder="Buscar actividad…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Input
          type="date"
          className="w-40 rounded-lg border-border bg-card"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <Input
          type="date"
          className="w-40 rounded-lg border-border bg-card"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
        <Button
          type="button"
          className="rounded-lg bg-primary text-primary-foreground"
          onClick={applyFilters}
        >
          Aplicar
        </Button>
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            className="rounded-lg"
            onClick={clearFilters}
          >
            Limpiar
          </Button>
        ) : null}
      </div>

      {query.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton className="h-24 w-full rounded-xl" key={i} />
          ))}
        </div>
      ) : query.isError ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="rounded-full bg-surface-container-low p-4">
            <RefreshCw className="size-8 text-primary" />
          </div>
          <h3 className="text-title-lg text-primary">
            No se pudieron cargar las actividades
          </h3>
          <p className="text-body-md text-on-surface-variant">
            Verificá que el backend esté disponible e intentá de vuelta.
          </p>
          <Button
            variant="outline"
            onClick={() => query.refetch()}
            className="mt-2 rounded-lg"
          >
            <RefreshCw className="mr-2 size-4" /> Reintentar
          </Button>
        </div>
      ) : data && data.data.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="rounded-full bg-surface-container-low p-4">
            <SearchX className="size-8 text-primary" />
          </div>
          <h3 className="text-title-lg text-primary">
            {hasFilters
              ? "Sin resultados para los filtros"
              : "Todavía no hay actividades"}
          </h3>
          <p className="text-body-md text-on-surface-variant">
            {hasFilters
              ? "Probá ajustar el rango de fechas o la fuente."
              : "Sincronizá Strava o Hevy desde Configuración para ver tus sesiones."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {(data?.data ?? []).map((activity) => (
              <ActivityCard activity={activity} key={activity.id} />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-body-md text-on-surface-variant">
              {skip + 1}–{Math.min(skip + PAGE_SIZE, data?.count ?? 0)} de{" "}
              {data?.count ?? 0}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={skip === 0}
                onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
                className="size-8 rounded-lg"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={skip + PAGE_SIZE >= (data?.count ?? 0)}
                onClick={() => setSkip(skip + PAGE_SIZE)}
                className="size-8 rounded-lg"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

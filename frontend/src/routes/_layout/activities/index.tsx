import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
  History as HistoryIcon,
  Loader2,
  RefreshCw,
  Search,
  SearchX,
  Upload,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { ActivitiesService, AnalyticsService } from "@/client"
import { ActivityRow } from "@/components/Activities/ActivityRow"
import { WorkoutCard } from "@/components/Activities/WorkoutCard"
import { ChartCard } from "@/components/Analytics/ChartCard"
import {
  AXIS_TICK_STYLE,
  CHART_HEIGHTS,
  DOMAIN_COLORS,
  TOOLTIP_CONTENT_STYLE,
} from "@/components/Analytics/chart-theme"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"

// Helper function
function formatMonthLabel(month: string): string {
  if (!month) return ""
  const date = new Date(`${month}-01T12:00:00`)
  if (Number.isNaN(date.getTime())) return month
  return new Intl.DateTimeFormat("es-AR", { month: "short" })
    .format(date)
    .replace(".", "")
    .toUpperCase()
}

export const Route = createFileRoute("/_layout/activities/")({
  component: ActivitiesHistory,
  head: () => ({ meta: [{ title: "Historial de Actividades - OpenRunning" }] }),
})

const PAGE_SIZE = 20

function ActivitiesHistory() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [sourceType, setSourceType] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [skip, setSkip] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [showAllActivities, setShowAllActivities] = useState(false)
  const [applied, setApplied] = useState({
    sourceType: "all",
    fromDate: "",
    toDate: "",
  })

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
        sourceType:
          applied.sourceType === "all" ||
          applied.sourceType === "cardio" ||
          applied.sourceType === "running"
            ? null
            : applied.sourceType,
        fromDate: applied.fromDate || null,
        toDate: applied.toDate || null,
        skip,
        limit: PAGE_SIZE,
      }),
  })

  const cardioMonthlyQuery = useQuery({
    queryKey: ["stats-cardio-monthly"],
    queryFn: () => AnalyticsService.readCardioMonthly({ months: 12 }),
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
  const totalCount = data?.count ?? 0
  const hasFilters =
    applied.sourceType !== "all" ||
    applied.fromDate !== "" ||
    applied.toDate !== "" ||
    searchTerm !== ""

  // Client-side filter on current page data for search term and category tabs
  const rawActivities = data?.data ?? []
  const filteredActivities = rawActivities.filter((act) => {
    if (
      searchTerm.trim() &&
      !(act.name || "").toLowerCase().includes(searchTerm.toLowerCase().trim())
    ) {
      return false
    }

    if (applied.sourceType === "cardio") {
      return (
        act.source_type !== "hevy" &&
        (Boolean(act.cardio) ||
          act.source_type === "strava" ||
          act.source_type === "gpx_upload" ||
          act.source_type === "fit_upload")
      )
    }

    if (applied.sourceType === "running") {
      const sport = (act.sport_type || "").toLowerCase()
      const isRun =
        sport.includes("run") ||
        sport.includes("carrera") ||
        (act.cardio &&
          !sport.includes("ride") &&
          !sport.includes("bike") &&
          !sport.includes("walk") &&
          !sport.includes("swim"))
      return Boolean(isRun) && act.source_type !== "hevy"
    }

    return true
  })

  // Chart calculation
  const monthlyKm = useMemo(() => {
    return (cardioMonthlyQuery.data ?? []).map((m) => ({
      name: formatMonthLabel(m.month as string),
      monthKey: m.month as string,
      km: Number(m.distance_meters ?? 0) / 1000,
      sessions: Number(m.sessions ?? 0),
    }))
  }, [cardioMonthlyQuery.data])

  return (
    <div className="col-span-12 flex flex-col gap-6 pb-8">
      {/* Header section — styled after OpenGym .hdr */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
            Historial
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {query.isLoading
              ? "Cargando actividades…"
              : `${totalCount} ${totalCount === 1 ? "actividad registrada" : "actividades registradas"}`}
          </p>
        </div>

        {/* Upload Button */}
        <label className="cursor-pointer self-start sm:self-auto font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl inline-flex items-center gap-2 text-sm shadow-md transition-all active:scale-95">
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

      {/* Filter Chips & Search Bar — OpenGym style */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Category Chips */}
          <div className="inline-flex gap-2 items-center flex-wrap">
            {[
              { id: "all", label: "Todas" },
              { id: "cardio", label: "Cardio" },
              { id: "running", label: "Carreras" },
            ].map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => selectTab(tab.id)}
                className={
                  sourceType === tab.id
                    ? "rounded-full border border-emerald-400 text-emerald-400 font-semibold px-5 py-1.5 text-xs sm:text-sm shadow-sm transition-all"
                    : "rounded-full border border-slate-700 bg-transparent px-5 py-1.5 text-xs sm:text-sm text-slate-400 font-medium transition-colors hover:text-slate-200"
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search and toggle options - Only show in All Activities mode */}
          {showAllActivities && (
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  className="w-full rounded-xl border border-slate-800/80 bg-slate-900/60 pl-9 pr-3 py-1.5 text-sm placeholder:text-slate-500 text-slate-200 focus:border-emerald-500/50"
                  placeholder="Buscar por nombre…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={
                  showAdvancedFilters || fromDate || toDate
                    ? "rounded-xl border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs gap-1.5"
                    : "rounded-xl border-slate-800 bg-slate-900/60 text-slate-400 text-xs gap-1.5 hover:text-slate-200"
                }
              >
                <Filter className="size-3.5" />
                <span className="hidden sm:inline">Fechas</span>
              </Button>
            </div>
          )}
        </div>

        {/* Collapsible Date Filters */}
        {showAllActivities && showAdvancedFilters && (
          <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-2xl border border-slate-800/80 bg-slate-900/40 animate-in fade-in slide-in-from-top-2 duration-150">
            <span className="text-xs font-medium text-slate-400">
              Rango de fechas:
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                className="w-36 rounded-xl border-slate-800 bg-slate-900/80 text-xs text-slate-200"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <span className="text-xs text-slate-500">–</span>
              <Input
                type="date"
                className="w-36 rounded-xl border-slate-800 bg-slate-900/80 text-xs text-slate-200"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="rounded-xl bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 text-xs"
              onClick={applyFilters}
            >
              Aplicar
            </Button>
            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl text-xs text-slate-400 hover:text-slate-200"
                onClick={clearFilters}
              >
                Limpiar todo
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Main List Container — OpenGym .list style */}
      {query.isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton
              className="h-16 w-full rounded-2xl bg-slate-900/60"
              key={i}
            />
          ))}
        </div>
      ) : query.isError ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center border border-slate-800/80 rounded-2xl bg-slate-900/40">
          <RefreshCw className="size-8 text-emerald-400 animate-pulse" />
          <h3 className="text-base font-semibold text-slate-200">
            No se pudo cargar el historial
          </h3>
          <p className="text-xs text-slate-400 max-w-sm">
            Verificá la conexión con el servidor e intentá nuevamente.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            className="mt-1 rounded-xl border-slate-800 text-xs"
          >
            Reintentar
          </Button>
        </div>
      ) : filteredActivities.length === 0 ? (
        /* Empty State — OpenGym style .empty */
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-500">
            {hasFilters ? (
              <SearchX className="size-7" />
            ) : (
              <HistoryIcon className="size-7" />
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-200">
              {hasFilters
                ? "Sin resultados para los filtros seleccionados"
                : "Aún no hay actividades registradas"}
            </h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              {hasFilters
                ? "Probá ajustar la búsqueda, las fechas o el tipo de actividad."
                : "Sincronizá tu cuenta de Strava o Hevy, o importá un archivo .fit/.gpx."}
            </p>
          </div>
          {hasFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="mt-2 rounded-xl border-slate-800 text-xs text-slate-300"
            >
              Restablecer filtros
            </Button>
          )}
        </div>
      ) : !showAllActivities ? (
        /* Dashboard-like View */
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Last Workouts Horizontal Carousel */}
          <div className="overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-200">
                Últimas actividades
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10"
                onClick={() => setShowAllActivities(true)}
              >
                Ver todas
              </Button>
            </div>
            <div className="relative">
              {/* Decorative timeline line */}
              <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-slate-800 -translate-y-1/2 z-0" />

              <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 pt-2 px-2 scrollbar-hide relative z-10">
                {filteredActivities.slice(0, 10).map((activity, index) => (
                  <div key={activity.id} className="snap-center shrink-0">
                    <WorkoutCard activity={activity} isActive={index === 0} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Volume Chart */}
          <div>
            <h2 className="text-xl font-bold text-slate-200 mb-4">
              Volumen mensual
            </h2>
            <ChartCard
              title=""
              loading={cardioMonthlyQuery.isLoading}
              error={cardioMonthlyQuery.isError}
              onRetry={() => cardioMonthlyQuery.refetch()}
            >
              {monthlyKm.length > 0 &&
                !cardioMonthlyQuery.isLoading &&
                !cardioMonthlyQuery.isError && (
                  <ResponsiveContainer width="100%" height={CHART_HEIGHTS.sm}>
                    <BarChart
                      data={monthlyKm}
                      margin={{ top: 20, right: 0, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        vertical={false}
                        strokeDasharray="3 3"
                        stroke="#1e293b"
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={AXIS_TICK_STYLE}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={AXIS_TICK_STYLE}
                        tickFormatter={(value: number) =>
                          value === 0 ? "" : `${value}`
                        }
                      />
                      <Tooltip
                        cursor={{ fill: "#0f172a", opacity: 0.4 }}
                        contentStyle={TOOLTIP_CONTENT_STYLE}
                        formatter={(value: any) => {
                          const numValue = Number(value) || 0
                          return [`${numValue.toFixed(1)} km`, "Distancia"]
                        }}
                      />
                      <Bar
                        dataKey="km"
                        fill={DOMAIN_COLORS.cardio}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </ChartCard>
          </div>
        </div>
      ) : (
        /* All Activities List View */
        <div className="animate-in slide-in-from-right-4 duration-300">
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-slate-200 px-2"
              onClick={() => setShowAllActivities(false)}
            >
              <ArrowLeft className="size-4 mr-2" />
              Volver al panel
            </Button>
          </div>

          {/* List of Workout/Activity Rows */}
          <div id="all-activities" className="space-y-2.5 mt-2">
            {filteredActivities.map((activity) => (
              <ActivityRow activity={activity} key={activity.id} />
            ))}
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between pt-4 mt-6 border-t border-slate-800/60 text-xs text-slate-400">
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
                className="h-8 rounded-xl border-slate-800 text-xs text-slate-300 disabled:opacity-40"
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
                className="h-8 rounded-xl border-slate-800 text-xs text-slate-300 disabled:opacity-40"
              >
                Siguiente
                <ChevronRight className="size-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

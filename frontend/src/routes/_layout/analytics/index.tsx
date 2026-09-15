import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { AnalyticsService } from "@/client"
import { formatPace } from "@/components/Activities/activity-utils"
import { ChartCard } from "@/components/Analytics/ChartCard"
import {
  AXIS_TICK_STYLE,
  CHART_HEIGHTS,
  DOMAIN_COLORS,
  TOOLTIP_CONTENT_STYLE,
} from "@/components/Analytics/chart-theme"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/analytics/")({
  component: AnalyticsOverview,
  head: () => ({ meta: [{ title: "Analítica - OpenRunning" }] }),
})

const RANGES = [1, 3, 6, 12] as const

/** Etiquetas de las últimas 6 semanas (S-5 … S0). */
const ACTIVE_WEEK_LABELS = ["S-5", "S-4", "S-3", "S-2", "S-1", "S0"]

/** Colores para las 5 zonas de FC (Z1 … Z5). */
const HR_ZONE_COLORS = ["#14b8a6", "#10b981", "#f59e0b", "#f97316", "#ef4444"]

// ---------------------------------------------------------------------------
// Helpers de datos
// ---------------------------------------------------------------------------

type MonthPoint = { month: string; value: number }

/** Convierte una serie mensual del backend en puntos { month, value }. */
function toMonthPoints(
  data: Array<Record<string, unknown>>,
  valueKey: string,
  divisor = 1,
): MonthPoint[] {
  return (data ?? []).map((m) => ({
    month: String(m.month ?? ""),
    value: Number(m[valueKey] ?? 0) / divisor,
  }))
}

/** "2025-01" → "ENE". */
function formatMonthLabel(month: string): string {
  if (!month) return ""
  const date = new Date(`${month}-01T12:00:00`)
  if (Number.isNaN(date.getTime())) return month
  return new Intl.DateTimeFormat("es-AR", { month: "short" })
    .format(date)
    .replace(".", "")
    .toUpperCase()
}

/**
 * Une varias series mensuales sobre la unión ordenada de meses.
 * Devuelve labels (meses) + un array de valores por serie (0 si falta el mes).
 */
function mergeSeries(series: MonthPoint[][]): {
  labels: string[]
  values: number[][]
} {
  const months = Array.from(new Set(series.flat().map((p) => p.month))).sort()
  return {
    labels: months.map(formatMonthLabel),
    values: series.map((points) =>
      months.map((month) => points.find((p) => p.month === month)?.value ?? 0),
    ),
  }
}

/** True si la serie no tiene datos útiles (vacía o todo ceros). */
function isEmptySeries(points: MonthPoint[]): boolean {
  return points.length === 0 || points.every((p) => p.value === 0)
}

// ---------------------------------------------------------------------------
// Helpers de fechas (lunes de la semana)
// ---------------------------------------------------------------------------

function getMonday(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1))
  result.setHours(12, 0, 0, 0)
  return result
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

// ---------------------------------------------------------------------------
// Helpers de semanas (para los gráficos de tendencia semanal)
// ---------------------------------------------------------------------------

/** "2026-W32" → "S32". */
function formatWeekLabel(week: string): string {
  const match = week?.match(/W(\d+)/)
  return match ? `S${match[1]}` : (week ?? "")
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

function AnalyticsOverview() {
  const [months, setMonths] = useState(6)

  const cardioQuery = useQuery({
    queryKey: ["analytics-overview-cardio-monthly", months],
    queryFn: () => AnalyticsService.readCardioMonthly({ months }),
  })
  const strengthQuery = useQuery({
    queryKey: ["analytics-overview-strength-monthly", months],
    queryFn: () => AnalyticsService.readStrengthMonthly({ months }),
  })
  const muscleQuery = useQuery({
    queryKey: ["analytics-overview-muscle", months],
    queryFn: () => AnalyticsService.readMuscleDistribution({ months }),
  })
  const pacesQuery = useQuery({
    queryKey: ["analytics-overview-best-paces"],
    queryFn: () => AnalyticsService.readCardioBestPaces(),
  })
  // Días activos de las últimas 6 semanas (S-5…S0); el KPI es la semana actual.
  const activeWeeksQuery = useQuery({
    queryKey: ["analytics-overview-active-weeks"],
    queryFn: async () => {
      const thisMonday = getMonday(new Date())
      const weekStarts = Array.from({ length: 6 }, (_, i) =>
        addDays(thisMonday, (i - 5) * 7),
      )
      const dashboards = await Promise.all(
        weekStarts.map((start) =>
          AnalyticsService.readDashboard({ weekStart: formatDate(start) }),
        ),
      )
      return dashboards.map((d) => d.kpis?.active_days ?? 0)
    },
  })

  // ── Queries para los 4 gráficos nuevos ──
  const hrZonesQuery = useQuery({
    queryKey: ["analytics-hr-zones"],
    queryFn: () => AnalyticsService.readCardioHrZones({ weeks: 12 }),
  })
  const hrTrendQuery = useQuery({
    queryKey: ["analytics-hr-trend"],
    queryFn: () => AnalyticsService.readCardioHrTrend({ weeks: 12 }),
  })
  const rpeTrendQuery = useQuery({
    queryKey: ["analytics-rpe-trend"],
    queryFn: () => AnalyticsService.readStrengthRpeTrend({ weeks: 12 }),
  })
  const muscleVolumeQuery = useQuery({
    queryKey: ["analytics-muscle-volume"],
    queryFn: () => AnalyticsService.readMuscleVolume({ months }),
  })

  // Series derivadas
  const cardioKm = useMemo(
    () => toMonthPoints(cardioQuery.data ?? [], "distance_meters", 1000),
    [cardioQuery.data],
  )
  const strengthTons = useMemo(
    () => toMonthPoints(strengthQuery.data ?? [], "volume_kg", 1000),
    [strengthQuery.data],
  )
  const cardioSessions = useMemo(
    () => toMonthPoints(cardioQuery.data ?? [], "sessions"),
    [cardioQuery.data],
  )
  const strengthSessions = useMemo(
    () => toMonthPoints(strengthQuery.data ?? [], "sessions"),
    [strengthQuery.data],
  )
  const balance = useMemo(
    () => mergeSeries([cardioKm, strengthTons]),
    [cardioKm, strengthTons],
  )
  const sessionsMerged = useMemo(
    () => mergeSeries([cardioSessions, strengthSessions]),
    [cardioSessions, strengthSessions],
  )

  const lastCardioKm =
    cardioKm.length > 0 ? cardioKm[cardioKm.length - 1].value : 0
  const lastStrengthTons =
    strengthTons.length > 0 ? strengthTons[strengthTons.length - 1].value : 0

  const totalSessions = useMemo(
    () =>
      cardioSessions.reduce((acc, p) => acc + p.value, 0) +
      strengthSessions.reduce((acc, p) => acc + p.value, 0),
    [cardioSessions, strengthSessions],
  )
  const cardioTotalSessions = useMemo(
    () => cardioSessions.reduce((acc, p) => acc + p.value, 0),
    [cardioSessions],
  )
  const strengthTotalSessions = useMemo(
    () => strengthSessions.reduce((acc, p) => acc + p.value, 0),
    [strengthSessions],
  )

  const activeWeeks = activeWeeksQuery.data ?? []
  const currentWeekActiveDays =
    activeWeeks.length > 0 ? activeWeeks[activeWeeks.length - 1] : undefined

  const muscleData = useMemo(() => {
    const rows = (muscleQuery.data ?? []).map((entry) => ({
      group: String(entry.group ?? ""),
      sets: Number(entry.sets ?? 0),
    }))
    return rows.sort((a, b) => b.sets - a.sets)
  }, [muscleQuery.data])
  const maxMuscleSets = muscleData.reduce(
    (acc, row) => Math.max(acc, row.sets),
    1,
  )

  const paces = useMemo(() => {
    return [...(pacesQuery.data ?? [])].sort(
      (a, b) =>
        Number(a.pace_seconds_per_km ?? Infinity) -
        Number(b.pace_seconds_per_km ?? Infinity),
    )
  }, [pacesQuery.data])

  const distributionData = [
    {
      id: "cardio",
      value: cardioTotalSessions,
      label: "Cardio",
      color: DOMAIN_COLORS.cardio,
    },
    {
      id: "strength",
      value: strengthTotalSessions,
      label: "Fuerza",
      color: DOMAIN_COLORS.strength,
    },
  ]

  // ── Datos derivados para los gráficos nuevos ──

  /** Zonas de FC de la semana más reciente (donut). */
  const latestHrZones = useMemo(() => {
    const weeks = (hrZonesQuery.data?.weeks ?? []) as Array<{
      week: string
      zones?: Array<{ zone: number; label: string; seconds: number }>
    }>
    if (weeks.length === 0) return null
    const last = weeks[weeks.length - 1]
    const zones = (last.zones ?? []).filter((z) => z.seconds > 0)
    if (zones.length === 0) return null
    return zones
  }, [hrZonesQuery.data])

  /** Datos de tendencia de FC (línea avg_hr + max_hr). */
  const hrTrendData = useMemo(() => {
    const points = (hrTrendQuery.data?.data ?? []).filter(
      (p) => p.avg_hr != null || p.max_hr != null,
    )
    if (points.length === 0) return null
    return {
      labels: points.map((p) => formatWeekLabel(p.week)),
      avgHr: points.map((p) => p.avg_hr ?? null),
      maxHr: points.map((p) => p.max_hr ?? null),
    }
  }, [hrTrendQuery.data])

  /** Datos de tendencia de RPE (línea). */
  const rpeTrendData = useMemo(() => {
    const points = (rpeTrendQuery.data?.data ?? []).filter(
      (p) => p.avg_rpe != null,
    )
    if (points.length === 0) return null
    return {
      labels: points.map((p) => formatWeekLabel(p.week)),
      rpe: points.map((p) => p.avg_rpe ?? null),
    }
  }, [rpeTrendQuery.data])

  /** Volumen por músculo (barras, ordenado desc). */
  const muscleVolumeData = useMemo(() => {
    const data = (muscleVolumeQuery.data?.data ?? [])
      .map((d) => ({ group: d.group, kg: d.volume_kg }))
      .filter((d) => d.kg > 0)
      .sort((a, b) => b.kg - a.kg)
    return data.length > 0 ? data : null
  }, [muscleVolumeQuery.data])

  return (
    <div className="col-span-12 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-headline-lg text-primary">
            Analítica de Rendimiento
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Métricas consolidadas de entrenamiento y progreso.
          </p>
        </div>
        <fieldset
          aria-label="Rango de meses"
          className="m-0 flex w-fit gap-1 rounded-lg border-0 bg-surface-container-low p-1"
        >
          {RANGES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMonths(value)}
              className={cn(
                "cursor-pointer rounded-md px-4 py-1.5 text-label-sm transition-colors",
                months === value
                  ? "bg-card text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-primary",
              )}
            >
              {value}M
            </button>
          ))}
        </fieldset>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="running">
        <TabsList>
          <TabsTrigger value="running">Running</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="flex flex-col">
          <div className="grid grid-cols-12 gap-6">
            {/* Días activos semanales */}
            <ChartCard
              className="col-span-12 lg:col-span-6"
              title="Días activos semanales"
              kpi={currentWeekActiveDays}
              kpiHint="de 7 días esta semana"
              loading={activeWeeksQuery.isLoading}
              error={activeWeeksQuery.isError}
              onRetry={() => activeWeeksQuery.refetch()}
              empty={
                !activeWeeksQuery.isLoading &&
                !activeWeeksQuery.isError &&
                activeWeeks.every((days) => days === 0)
              }
            >
              <div className="text-on-surface-variant">
                <ResponsiveContainer width="100%" height={CHART_HEIGHTS.sm}>
                  <BarChart
                    data={activeWeeks.map((v, i) => ({
                      name: ACTIVE_WEEK_LABELS[i],
                      value: v,
                    }))}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
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
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_CONTENT_STYLE}
                      cursor={{
                        fill: "var(--color-surface-container-high, rgba(128,128,128,0.1))",
                      }}
                    />
                    <Bar
                      dataKey="value"
                      fill={DOMAIN_COLORS.active}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Distancia mensual (área) */}
            <ChartCard
              className="col-span-12 lg:col-span-6"
              title="Distancia mensual"
              kpi={
                cardioQuery.data ? `${lastCardioKm.toFixed(1)} km` : undefined
              }
              kpiHint="último mes"
              loading={cardioQuery.isLoading}
              error={cardioQuery.isError}
              onRetry={() => cardioQuery.refetch()}
              empty={
                !cardioQuery.isLoading &&
                !cardioQuery.isError &&
                (cardioKm.length < 2 || isEmptySeries(cardioKm))
              }
              emptyText={
                cardioKm.length < 2
                  ? "Se necesitan al menos 2 meses de datos para este gráfico."
                  : "Todavía no hay datos para este período."
              }
            >
              <div className="text-on-surface-variant">
                <ResponsiveContainer width="100%" height={CHART_HEIGHTS.sm}>
                  <AreaChart
                    data={cardioKm.map((p) => ({
                      name: formatMonthLabel(p.month),
                      value: p.value,
                    }))}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorCardio"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={DOMAIN_COLORS.cardio}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor={DOMAIN_COLORS.cardio}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
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
                    />
                    <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={DOMAIN_COLORS.cardio}
                      fillOpacity={1}
                      fill="url(#colorCardio)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Balance de carga: volumen cardio vs fuerza */}
            <ChartCard
              className="col-span-12 lg:col-span-12"
              title="Volumen cardio vs fuerza"
              loading={cardioQuery.isLoading || strengthQuery.isLoading}
              error={cardioQuery.isError || strengthQuery.isError}
              onRetry={() => {
                void cardioQuery.refetch()
                void strengthQuery.refetch()
              }}
              empty={
                !cardioQuery.isLoading &&
                !strengthQuery.isLoading &&
                !cardioQuery.isError &&
                !strengthQuery.isError &&
                (balance.labels.length < 2 ||
                  (isEmptySeries(cardioKm) && isEmptySeries(strengthTons)))
              }
              emptyText={
                balance.labels.length < 2
                  ? "Se necesitan al menos 2 meses de datos para este gráfico."
                  : "Todavía no hay datos para este período."
              }
            >
              <div className="text-on-surface-variant">
                <ResponsiveContainer width="100%" height={CHART_HEIGHTS.md}>
                  <AreaChart
                    data={balance.labels.map((lbl, i) => ({
                      name: lbl,
                      cardio: balance.values[0][i],
                      strength: balance.values[1][i],
                    }))}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorCardio2"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={DOMAIN_COLORS.cardio}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor={DOMAIN_COLORS.cardio}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
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
                    />
                    <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: "12px" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="cardio"
                      name="Cardio (km)"
                      stroke={DOMAIN_COLORS.cardio}
                      fillOpacity={1}
                      fill="url(#colorCardio2)"
                    />
                    <Line
                      type="monotone"
                      dataKey="strength"
                      name="Fuerza (ton)"
                      stroke={DOMAIN_COLORS.strength}
                      dot={false}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Distribución de actividad */}
            <ChartCard
              className="col-span-12 lg:col-span-6"
              title="Distribución de actividad"
              loading={cardioQuery.isLoading || strengthQuery.isLoading}
              error={cardioQuery.isError || strengthQuery.isError}
              onRetry={() => {
                void cardioQuery.refetch()
                void strengthQuery.refetch()
              }}
              empty={
                !cardioQuery.isLoading &&
                !strengthQuery.isLoading &&
                !cardioQuery.isError &&
                !strengthQuery.isError &&
                totalSessions === 0
              }
            >
              <div className="text-on-surface-variant">
                <ResponsiveContainer width="100%" height={CHART_HEIGHTS.md}>
                  <PieChart>
                    <Pie
                      data={distributionData}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="80%"
                      paddingAngle={2}
                      label={({
                        cx,
                        cy,
                        midAngle = 0,
                        innerRadius = 0,
                        outerRadius = 0,
                        value,
                      }: any) => {
                        if (value === 0) return null
                        const RADIAN = Math.PI / 180
                        const radius =
                          innerRadius + (outerRadius - innerRadius) * 0.5
                        const x = cx + radius * Math.cos(-midAngle * RADIAN)
                        const y = cy + radius * Math.sin(-midAngle * RADIAN)
                        return (
                          <text
                            x={x}
                            y={y}
                            fill="white"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="12"
                          >
                            {`${Math.round((value / totalSessions) * 100)}%`}
                          </text>
                        )
                      }}
                      labelLine={false}
                    >
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Sesiones por mes */}
            <ChartCard
              className="col-span-12 lg:col-span-6"
              title="Sesiones por mes"
              loading={cardioQuery.isLoading || strengthQuery.isLoading}
              error={cardioQuery.isError || strengthQuery.isError}
              onRetry={() => {
                void cardioQuery.refetch()
                void strengthQuery.refetch()
              }}
              empty={
                !cardioQuery.isLoading &&
                !strengthQuery.isLoading &&
                !cardioQuery.isError &&
                !strengthQuery.isError &&
                isEmptySeries(cardioSessions) &&
                isEmptySeries(strengthSessions)
              }
            >
              <div className="text-on-surface-variant">
                <ResponsiveContainer width="100%" height={CHART_HEIGHTS.md}>
                  <BarChart
                    data={sessionsMerged.labels.map((lbl, i) => ({
                      name: lbl,
                      cardio: sessionsMerged.values[0][i],
                      strength: sessionsMerged.values[1][i],
                    }))}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
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
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_CONTENT_STYLE}
                      cursor={{
                        fill: "var(--color-surface-container-high, rgba(128,128,128,0.1))",
                      }}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: "12px" }}
                    />
                    <Bar
                      dataKey="cardio"
                      name="Cardio"
                      fill={DOMAIN_COLORS.cardio}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="strength"
                      name="Fuerza"
                      fill={DOMAIN_COLORS.strength}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="gimnasio" className="flex flex-col">
          <div className="grid grid-cols-12 gap-6">
            {/* Tonelaje mensual */}
            <ChartCard
              className="col-span-12 lg:col-span-8"
              title="Tonelaje mensual"
              kpi={
                strengthQuery.data
                  ? `${lastStrengthTons.toFixed(1)} t`
                  : undefined
              }
              kpiHint="último mes"
              loading={strengthQuery.isLoading}
              error={strengthQuery.isError}
              onRetry={() => strengthQuery.refetch()}
              empty={
                !strengthQuery.isLoading &&
                !strengthQuery.isError &&
                isEmptySeries(strengthTons)
              }
            >
              <div className="text-on-surface-variant">
                <ResponsiveContainer width="100%" height={CHART_HEIGHTS.md}>
                  <BarChart
                    data={strengthTons.map((p) => ({
                      name: formatMonthLabel(p.month),
                      value: p.value,
                    }))}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
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
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_CONTENT_STYLE}
                      cursor={{
                        fill: "var(--color-surface-container-high, rgba(128,128,128,0.1))",
                      }}
                      formatter={(val: any) => [
                        `${Number(val).toFixed(1)} ton`,
                        "Volumen",
                      ]}
                    />
                    <Bar
                      dataKey="value"
                      fill={DOMAIN_COLORS.strength}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Distribución muscular */}
            <ChartCard
              className="col-span-12 lg:col-span-4"
              title="Distribución muscular"
              loading={muscleQuery.isLoading}
              error={muscleQuery.isError}
              onRetry={() => muscleQuery.refetch()}
              empty={
                !muscleQuery.isLoading &&
                !muscleQuery.isError &&
                muscleData.length === 0
              }
            >
              <div className="flex flex-col gap-3 py-2">
                {muscleData.map((row, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-body-md text-primary">
                      {row.group}
                    </span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-variant">
                      <div
                        className="h-full rounded-full bg-domain-strength"
                        style={{
                          width: `${(row.sets / maxMuscleSets) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right text-label-sm text-on-surface-variant tabular-nums">
                      {row.sets}
                    </span>
                  </div>
                ))}
              </div>
            </ChartCard>

            {/* ── NUEVO: RPE promedio ── */}
            <ChartCard
              className="col-span-12 lg:col-span-4"
              title="RPE promedio"
              loading={rpeTrendQuery.isLoading}
              error={rpeTrendQuery.isError}
              onRetry={() => rpeTrendQuery.refetch()}
              empty={
                !rpeTrendQuery.isLoading &&
                !rpeTrendQuery.isError &&
                rpeTrendData === null
              }
            >
              <div className="text-on-surface-variant">
                <ResponsiveContainer width="100%" height={CHART_HEIGHTS.md}>
                  <LineChart
                    data={(rpeTrendData?.labels ?? []).map((lbl, i) => ({
                      name: lbl,
                      value: rpeTrendData?.rpe?.[i],
                    }))}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
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
                      domain={[0, 10]}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_CONTENT_STYLE}
                      formatter={(val: any) => [
                        `${Number(val).toFixed(1)}`,
                        "RPE",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={DOMAIN_COLORS.strength}
                      strokeWidth={2}
                      dot={{ r: 4, fill: DOMAIN_COLORS.strength }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* ── NUEVO: Volumen por músculo ── */}
            <ChartCard
              className="col-span-12 lg:col-span-8"
              title="Volumen por músculo"
              loading={muscleVolumeQuery.isLoading}
              error={muscleVolumeQuery.isError}
              onRetry={() => muscleVolumeQuery.refetch()}
              empty={
                !muscleVolumeQuery.isLoading &&
                !muscleVolumeQuery.isError &&
                muscleVolumeData === null
              }
            >
              <div className="text-on-surface-variant">
                <ResponsiveContainer width="100%" height={CHART_HEIGHTS.md}>
                  <BarChart
                    data={(muscleVolumeData ?? []).map((d) => ({
                      name: d.group,
                      value: d.kg,
                    }))}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
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
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_CONTENT_STYLE}
                      cursor={{
                        fill: "var(--color-surface-container-high, rgba(128,128,128,0.1))",
                      }}
                      formatter={(val: any) => [
                        `${Number(val).toFixed(1)} kg`,
                        "Volumen",
                      ]}
                    />
                    <Bar
                      dataKey="value"
                      fill={DOMAIN_COLORS.strength}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="running" className="flex flex-col">
          <div className="grid grid-cols-12 gap-6">
            {/* Distancia mensual */}
            <ChartCard
              className="col-span-12 lg:col-span-8"
              title="Distancia mensual"
              kpi={
                cardioQuery.data ? `${lastCardioKm.toFixed(1)} km` : undefined
              }
              kpiHint="último mes"
              loading={cardioQuery.isLoading}
              error={cardioQuery.isError}
              onRetry={() => cardioQuery.refetch()}
              empty={
                !cardioQuery.isLoading &&
                !cardioQuery.isError &&
                isEmptySeries(cardioKm)
              }
            >
              <div className="text-on-surface-variant">
                <ResponsiveContainer width="100%" height={CHART_HEIGHTS.md}>
                  <BarChart
                    data={cardioKm.map((p) => ({
                      name: formatMonthLabel(p.month),
                      value: p.value,
                    }))}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
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
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_CONTENT_STYLE}
                      cursor={{
                        fill: "var(--color-surface-container-high, rgba(128,128,128,0.1))",
                      }}
                      formatter={(val: any) => [
                        `${Number(val).toFixed(1)} km`,
                        "Distancia",
                      ]}
                    />
                    <Bar
                      dataKey="value"
                      fill={DOMAIN_COLORS.cardio}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Mejores marcas por distancia */}
            <ChartCard
              className="col-span-12 lg:col-span-4"
              title="Mejores marcas por distancia"
              loading={pacesQuery.isLoading}
              error={pacesQuery.isError}
              onRetry={() => pacesQuery.refetch()}
              empty={
                !pacesQuery.isLoading &&
                !pacesQuery.isError &&
                paces.length === 0
              }
            >
              <div className="flex flex-col gap-2 py-1">
                {paces.map((pace, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-surface-container-low px-3 py-2"
                  >
                    <span className="text-body-md text-primary">
                      {String(pace.distance_label)}
                    </span>
                    <span className="text-title-lg tabular-nums text-primary">
                      {formatPace(Number(pace.pace_seconds_per_km))}
                    </span>
                    <span className="text-label-sm text-on-surface-variant">
                      {String(pace.date ?? "").slice(0, 10)}
                    </span>
                  </div>
                ))}
              </div>
            </ChartCard>

            {/* ── NUEVO: Zonas de frecuencia cardíaca (donut) ── */}
            <ChartCard
              className="col-span-12 lg:col-span-4"
              title="Zonas de frecuencia cardíaca"
              loading={hrZonesQuery.isLoading}
              error={hrZonesQuery.isError}
              onRetry={() => hrZonesQuery.refetch()}
              empty={
                !hrZonesQuery.isLoading &&
                !hrZonesQuery.isError &&
                latestHrZones === null
              }
            >
              <div className="text-on-surface-variant">
                <ResponsiveContainer width="100%" height={CHART_HEIGHTS.md}>
                  <PieChart>
                    <Pie
                      data={(latestHrZones ?? []).map((z, i) => ({
                        name: z.label || `Z${z.zone}`,
                        value: z.seconds,
                        color: HR_ZONE_COLORS[i % HR_ZONE_COLORS.length],
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="80%"
                      paddingAngle={2}
                      label={({
                        cx,
                        cy,
                        midAngle = 0,
                        innerRadius = 0,
                        outerRadius = 0,
                        value,
                      }: any) => {
                        const total =
                          latestHrZones?.reduce((s, z) => s + z.seconds, 0) ?? 1
                        if (value === 0) return null
                        const RADIAN = Math.PI / 180
                        const radius =
                          innerRadius + (outerRadius - innerRadius) * 0.5
                        const x = cx + radius * Math.cos(-midAngle * RADIAN)
                        const y = cy + radius * Math.sin(-midAngle * RADIAN)
                        return (
                          <text
                            x={x}
                            y={y}
                            fill="white"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="12"
                            fontWeight="bold"
                          >
                            {`${Math.round((value / total) * 100)}%`}
                          </text>
                        )
                      }}
                      labelLine={false}
                    >
                      {(latestHrZones ?? []).map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={HR_ZONE_COLORS[index % HR_ZONE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_CONTENT_STYLE}
                      formatter={(val: any) => [
                        `${Math.round(Number(val) / 60)} min`,
                        "Tiempo",
                      ]}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* ── NUEVO: Frecuencia cardíaca (tendencia) ── */}
            <ChartCard
              className="col-span-12 lg:col-span-8"
              title="Frecuencia cardíaca"
              loading={hrTrendQuery.isLoading}
              error={hrTrendQuery.isError}
              onRetry={() => hrTrendQuery.refetch()}
              empty={
                !hrTrendQuery.isLoading &&
                !hrTrendQuery.isError &&
                hrTrendData === null
              }
            >
              <div className="text-on-surface-variant">
                <ResponsiveContainer width="100%" height={CHART_HEIGHTS.md}>
                  <LineChart
                    data={(hrTrendData?.labels ?? []).map((lbl, i) => ({
                      name: lbl,
                      avgHr: hrTrendData?.avgHr?.[i],
                      maxHr: hrTrendData?.maxHr?.[i],
                    }))}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
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
                    />
                    <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: "12px" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="maxHr"
                      name="FC Máx"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "#ef4444" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgHr"
                      name="FC Prom"
                      stroke={DOMAIN_COLORS.cardio}
                      strokeWidth={2}
                      dot={{ r: 4, fill: DOMAIN_COLORS.cardio }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

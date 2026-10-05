import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  CalendarDays,
  ChevronRight,
  Flame,
  MapPin,
  Timer,
  Trophy,
} from "lucide-react"
import { useMemo, useState } from "react"
import {
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

import {
  ActivitiesService,
  type ActivityPublic,
  AnalyticsService,
  RacesService,
} from "@/client"
import { formatPace } from "@/components/Activities/activity-utils"
import { ChartCard } from "@/components/Analytics/ChartCard"
import {
  AXIS_TICK_STYLE,
  CHART_HEIGHTS,
  DOMAIN_COLORS,
  HR_MAX_COLOR,
  MONTH_LABELS_ES,
  TOOLTIP_CONTENT_STYLE,
} from "@/components/Analytics/chart-theme"
import { PeriodSelector } from "@/components/Analytics/PeriodSelector"
import { RunningHeatmap } from "@/components/Analytics/RunningHeatmap"
import { StatTile } from "@/components/Analytics/StatTile"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/analytics/")({
  component: RunningStats,
  head: () => ({ meta: [{ title: "Stats - OpenRunning" }] }),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PERIOD_OPTIONS = [
  { key: "3M", label: "3M", months: 3 },
  { key: "6M", label: "6M", months: 6 },
  { key: "12M", label: "12M", months: 12 },
  { key: "24M", label: "24M", months: 24 },
] as const

type PeriodKey = (typeof PERIOD_OPTIONS)[number]["key"]

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

function formatMonthLabel(month: string): string {
  if (!month) return ""
  const index = Number(month.slice(5, 7)) - 1
  return MONTH_LABELS_ES[index] ?? month
}

function formatWeekLabel(week: string): string {
  const match = week?.match(/W(\d+)/)
  return match ? `S${match[1]}` : (week ?? "")
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** Tiempo total de una marca en formato mm:ss (o h:mm:ss). */
function formatRaceTime(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return "—"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }
  return `${m}:${String(s).padStart(2, "0")}`
}

/** Colores para las 5 zonas de FC (Z1 … Z5). */
const HR_ZONE_COLORS = ["#4d5a1a", "#6a8220", "#a9cc33", "#EAFC5F", "#EF4444"]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function RunningStats() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<PeriodKey>("12M")
  const [monthlyMetric, setMonthlyMetric] = useState<"km" | "sessions">("km")

  const periodOption =
    PERIOD_OPTIONS.find((option) => option.key === period) ?? PERIOD_OPTIONS[2]
  const months = periodOption.months
  const weeks = Math.round(months * 4.345)

  const periodRange = useMemo(() => {
    const now = new Date()
    const from = new Date(now)
    from.setMonth(from.getMonth() - months)
    return { fromDate: formatDate(from), toDate: formatDate(now) }
  }, [months])

  // ── Queries ──

  /** Cardio monthly — ventana del selector global */
  const cardioMonthlyQuery = useQuery({
    queryKey: ["stats-cardio-monthly", months],
    queryFn: () => AnalyticsService.readCardioMonthly({ months }),
  })

  /** Best paces (all-time) */
  const pacesQuery = useQuery({
    queryKey: ["stats-best-paces"],
    queryFn: () => AnalyticsService.readCardioBestPaces(),
  })

  /** HR zones — ventana del selector global */
  const hrZonesQuery = useQuery({
    queryKey: ["stats-hr-zones", weeks],
    queryFn: () => AnalyticsService.readCardioHrZones({ weeks }),
  })

  /** HR trend — ventana del selector global */
  const hrTrendQuery = useQuery({
    queryKey: ["stats-hr-trend", weeks],
    queryFn: () => AnalyticsService.readCardioHrTrend({ weeks }),
  })

  /** Cardio analytics del período (tile de ritmo) */
  const cardioPeriodQuery = useQuery({
    queryKey: ["stats-cardio-period", period],
    queryFn: () => AnalyticsService.readCardioAnalytics(periodRange),
  })

  /** Recent activities (for the recent list + all-time totals) */
  const activitiesQuery = useQuery({
    queryKey: ["stats-recent-activities"],
    queryFn: () => ActivitiesService.readActivities({ limit: 100 }),
  })

  /** Heatmap activities — paginadas para cubrir toda la ventana */
  const heatmapActivitiesQuery = useQuery({
    queryKey: ["stats-heatmap-activities", period],
    queryFn: async () => {
      const collected: ActivityPublic[] = []
      const pageSize = 100
      for (let skip = 0; skip <= 2000; skip += pageSize) {
        const page = await ActivitiesService.readActivities({
          fromDate: periodRange.fromDate,
          limit: pageSize,
          skip,
        })
        const batch = page.data ?? []
        collected.push(...batch)
        if (batch.length < pageSize) break
      }
      return collected
    },
  })

  /** Races (for the Carreras tile) */
  const racesQuery = useQuery({
    queryKey: ["stats-races"],
    queryFn: () => RacesService.readRaces({ limit: 100 }),
  })

  // ── Derived data ──

  const rawActivities = activitiesQuery.data?.data ?? []

  const allRaces = racesQuery.data?.data ?? []
  const pastRaces = allRaces.filter((r) => new Date(r.date) <= new Date())
  const pastRacesCount = pastRaces.length

  // Add past races that aren't linked to an activity as manual activities
  const unlinkedRacesAsActivities = pastRaces
    .filter((r) => !r.activity_id)
    .map((r) => ({
      id: r.id,
      timestamp: r.date,
      name: r.event_name,
      source_type: "manual_race",
      source_id: `race-${r.id}`,
      user_id: r.user_id,
      created_at: r.created_at,
      duration_seconds:
        r.official_time_seconds ||
        r.chip_time_seconds ||
        (r as any).target_time_seconds ||
        0,
      cardio: {
        distance_meters: r.distance_km * 1000,
        avg_pace_seconds_per_km:
          r.official_pace_seconds_per_km ||
          (r as any).target_pace_seconds_per_km ||
          0,
      } as any,
    }))

  const allActivities = [...rawActivities, ...unlinkedRacesAsActivities].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )

  const totalActivities = allActivities.length

  const thisMonthKey = new Date().toISOString().slice(0, 7)
  const thisMonthRuns = allActivities.filter(
    (a) => a.timestamp?.slice(0, 7) === thisMonthKey,
  ).length

  // Week streak: count consecutive active weeks back from the current one,
  // with a grace week so an in-progress empty week doesn't collapse it.
  const weekStreak = useMemo(() => {
    const weeksWithActivity = new Set<string>()
    for (const a of allActivities) {
      weeksWithActivity.add(formatDate(getMonday(new Date(a.timestamp))))
    }
    let cursor = getMonday(new Date())
    if (!weeksWithActivity.has(formatDate(cursor))) {
      cursor = addDays(cursor, -7)
    }
    let streak = 0
    while (weeksWithActivity.has(formatDate(cursor))) {
      streak++
      cursor = addDays(cursor, -7)
    }
    return streak
  }, [allActivities])

  const avgPace = cardioPeriodQuery.data?.average_pace_seconds_per_km

  // Heatmap data: period-scoped activities + unlinked races inside the window
  const heatmapActivities = heatmapActivitiesQuery.data ?? []
  const heatmapData = useMemo(() => {
    const days = heatmapActivities
      .filter((a) => a.cardio?.distance_meters)
      .map((a) => ({
        date: a.timestamp.slice(0, 10),
        km: (a.cardio?.distance_meters ?? 0) / 1000,
        sessions: 1,
      }))
    for (const r of unlinkedRacesAsActivities) {
      if (!r.cardio?.distance_meters) continue
      if (r.timestamp.slice(0, 10) < periodRange.fromDate) continue
      days.push({
        date: r.timestamp.slice(0, 10),
        km: r.cardio.distance_meters / 1000,
        sessions: 1,
      })
    }
    return days
  }, [heatmapActivities, unlinkedRacesAsActivities, periodRange.fromDate])

  // Monthly volume (frontend override to include manual races)
  const monthlyKm = useMemo(() => {
    const backendData = [...(cardioMonthlyQuery.data ?? [])].map((m) => ({
      name: formatMonthLabel(m.month as string),
      monthKey: m.month as string,
      km: Number(m.distance_meters ?? 0) / 1000,
      sessions: Number(m.sessions ?? 0),
    }))

    const minMonthKey = periodRange.fromDate.slice(0, 7)
    for (const r of unlinkedRacesAsActivities) {
      if (!r.cardio?.distance_meters) continue
      const monthKey = r.timestamp.slice(0, 7)
      // No inyectar meses fuera de la ventana del selector de período.
      if (monthKey < minMonthKey) continue
      let bucket = backendData.find((b) => b.monthKey === monthKey)
      if (!bucket) {
        bucket = {
          name: formatMonthLabel(monthKey),
          monthKey,
          km: 0,
          sessions: 0,
        }
        backendData.push(bucket)
      }
      bucket.km += r.cardio.distance_meters / 1000
      bucket.sessions += 1
    }

    return backendData.sort((a, b) => a.monthKey.localeCompare(b.monthKey))
  }, [cardioMonthlyQuery.data, unlinkedRacesAsActivities, periodRange.fromDate])

  const lastMonth = monthlyKm[monthlyKm.length - 1]
  const monthlyKpi =
    monthlyMetric === "km"
      ? lastMonth
        ? `${lastMonth.km.toFixed(1)} km`
        : undefined
      : lastMonth
        ? `${lastMonth.sessions}`
        : undefined
  const monthlyKpiHint =
    monthlyMetric === "km" ? "km · último mes" : "sesiones · último mes"

  // Best paces sorted
  const paces = useMemo(() => {
    return [...(pacesQuery.data ?? [])].sort(
      (a, b) =>
        Number(a.pace_seconds_per_km ?? Infinity) -
        Number(b.pace_seconds_per_km ?? Infinity),
    )
  }, [pacesQuery.data])

  // HR zones donut (latest week in the window)
  const latestHrZones = useMemo(() => {
    const rows = (hrZonesQuery.data?.weeks ?? []) as Array<{
      week: string
      zones?: Array<{ zone: number; label: string; seconds: number }>
    }>
    if (rows.length === 0) return null
    const last = rows[rows.length - 1]
    const zones = (last.zones ?? []).filter((z) => z.seconds > 0)
    if (zones.length === 0) return null
    return zones
  }, [hrZonesQuery.data])

  // HR trend
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

  // Recent activities (last 6)
  const recentActivities = useMemo(() => {
    return [...allActivities]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 6)
  }, [allActivities])

  const hrEmptyText = (
    <>
      <p>Sin datos de pulso en los últimos {periodOption.label}.</p>
      <p className="mt-1 text-muted-foreground/80">
        Tus actividades no incluyen frecuencia cardíaca.
      </p>
    </>
  )
  const hrEmptyAction = (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="rounded-full border-border bg-secondary text-xs font-bold text-foreground hover:bg-surface-bright"
    >
      <Link to="/settings">Sincronizar actividades</Link>
    </Button>
  )

  // ── Render ──

  return (
    <div className="col-span-12 flex flex-col gap-6 pb-20">
      {/* ── Header ── */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-black font-display text-foreground tracking-tight">
            Estadísticas
          </h1>
          <p className="text-xs font-medium text-muted-foreground">
            Progreso e historial de rendimiento
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="bg-secondary border-border text-muted-foreground hover:bg-surface-bright hover:text-foreground rounded-full text-xs font-bold"
          onClick={() => navigate({ to: "/activities" })}
        >
          Historial
          <ChevronRight className="ml-1 size-4" />
        </Button>
      </div>

      {/* ── Global period selector — one instrument for every card ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[11px] font-bold font-display uppercase tracking-wider text-muted-foreground">
          Período
        </span>
        <PeriodSelector
          value={period}
          options={PERIOD_OPTIONS}
          onChange={(key) => setPeriod(key as PeriodKey)}
          className="w-full justify-between sm:w-auto sm:justify-start"
        />
      </div>

      {/* ── Stat Tiles (2×2 grid) ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={<Trophy className="size-4" />}
          label="Carreras"
          value={pastRacesCount}
        />
        <StatTile
          icon={<CalendarDays className="size-4" />}
          label="Actividades en el mes"
          value={thisMonthRuns}
        />
        <StatTile
          icon={<Flame className="size-4" />}
          label="Racha"
          value={weekStreak > 0 ? `${weekStreak} sem` : "—"}
          hint={
            weekStreak > 0
              ? undefined
              : "Sin semanas activas · sincronizá Strava"
          }
          to={weekStreak > 0 ? undefined : "/settings"}
        />
        <StatTile
          icon={<Timer className="size-4" />}
          label={`Ritmo ${periodOption.label}`}
          value={avgPace ? formatPace(avgPace) : "—"}
          valueColor={avgPace ? DOMAIN_COLORS.cardio : undefined}
        />
      </div>

      {/* ── Activity Heatmap ── */}
      <div className="rounded-2xl bg-card border border-border p-4 sm:p-5 shadow-card">
        <h2 className="mb-3 text-[11px] font-bold uppercase font-display tracking-wider text-muted-foreground">
          Actividad — últimos {periodOption.label}{" "}
          <span className="normal-case tracking-normal font-normal font-sans opacity-70">
            · por distancia
          </span>
        </h2>
        {heatmapActivitiesQuery.isLoading ? (
          <div className="h-28 animate-pulse rounded-xl bg-secondary" />
        ) : (
          <RunningHeatmap
            data={heatmapData}
            weeks={weeks}
            onDay={(iso) =>
              navigate({
                to: "/activities",
                search: { from: iso, to: iso } as any,
              })
            }
          />
        )}
      </div>

      {/* ── Monthly volume (single card, km │ sesiones toggle) ── */}
      <ChartCard
        title={`Volumen mensual · ${periodOption.label}`}
        action={
          <div className="inline-flex shrink-0 rounded-full border border-border bg-secondary/60 p-0.5">
            {(["km", "sessions"] as const).map((metric) => (
              <button
                key={metric}
                type="button"
                aria-pressed={monthlyMetric === metric}
                onClick={() => setMonthlyMetric(metric)}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-bold font-display uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                  monthlyMetric === metric
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {metric === "km" ? "km" : "sesiones"}
              </button>
            ))}
          </div>
        }
        kpi={monthlyKpi}
        kpiHint={monthlyKpiHint}
        loading={cardioMonthlyQuery.isLoading}
        error={cardioMonthlyQuery.isError}
        onRetry={() => cardioMonthlyQuery.refetch()}
        empty={
          !cardioMonthlyQuery.isLoading &&
          !cardioMonthlyQuery.isError &&
          monthlyKm.length === 0
        }
      >
        <div className="text-muted-foreground">
          <ResponsiveContainer width="100%" height={CHART_HEIGHTS.md}>
            <BarChart
              data={monthlyKm}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#262626"
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
                allowDecimals={monthlyMetric === "sessions" ? false : undefined}
              />
              <Tooltip
                contentStyle={TOOLTIP_CONTENT_STYLE}
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                formatter={(val: any) =>
                  monthlyMetric === "km"
                    ? [`${Number(val).toFixed(1)} km`, "Distancia"]
                    : [`${val}`, "Sesiones"]
                }
              />
              <Bar
                dataKey={monthlyMetric}
                name={monthlyMetric === "km" ? "Distancia" : "Sesiones"}
                fill={
                  monthlyMetric === "km"
                    ? DOMAIN_COLORS.cardio
                    : DOMAIN_COLORS.active
                }
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* ── Two-column section (desktop) ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Zonas de FC (donut) */}
        <ChartCard
          title={`Zonas de frecuencia cardíaca · ${periodOption.label}`}
          loading={hrZonesQuery.isLoading}
          error={hrZonesQuery.isError}
          onRetry={() => hrZonesQuery.refetch()}
          empty={
            !hrZonesQuery.isLoading &&
            !hrZonesQuery.isError &&
            latestHrZones === null
          }
          emptyText={hrEmptyText}
          emptyAction={hrEmptyAction}
        >
          <div className="text-muted-foreground">
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
                <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Frecuencia cardíaca (tendencia) */}
        <ChartCard
          title={`Frecuencia cardíaca · ${periodOption.label}`}
          loading={hrTrendQuery.isLoading}
          error={hrTrendQuery.isError}
          onRetry={() => hrTrendQuery.refetch()}
          empty={
            !hrTrendQuery.isLoading &&
            !hrTrendQuery.isError &&
            hrTrendData === null
          }
          emptyText={hrEmptyText}
          emptyAction={hrEmptyAction}
        >
          <div className="text-muted-foreground">
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
                  stroke="#262626"
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
                <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  type="monotone"
                  dataKey="maxHr"
                  name="FC Máx"
                  stroke={HR_MAX_COLOR}
                  strokeWidth={2}
                  dot={{ r: 4, fill: HR_MAX_COLOR }}
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

      {/* ── Best Paces ── */}
      <ChartCard
        title="Mejores marcas por distancia"
        loading={pacesQuery.isLoading}
        error={pacesQuery.isError}
        onRetry={() => pacesQuery.refetch()}
        empty={
          !pacesQuery.isLoading && !pacesQuery.isError && paces.length === 0
        }
      >
        <div className="flex flex-col gap-2 py-1">
          {paces.map((pace, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/30 px-3.5 py-2.5"
            >
              <span className="text-sm font-bold font-display text-foreground">
                {String(pace.distance_label)}
              </span>
              <span className="text-lg font-black font-display tabular-nums text-primary">
                {formatPace(Number(pace.pace_seconds_per_km))}
              </span>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-sm font-bold font-display tabular-nums text-foreground">
                  {formatRaceTime(Number(pace.duration_seconds))}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  {String(pace.date ?? "").slice(0, 10)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ChartCard>

      {/* ── Recent Workouts ── */}
      {recentActivities.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[11px] font-bold font-display uppercase tracking-wider text-muted-foreground">
              Últimas carreras
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full"
              onClick={() => navigate({ to: "/activities" })}
            >
              Todas ({totalActivities})
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
          <div className="flex flex-col gap-2.5">
            {recentActivities.map((activity) => {
              const km = activity.cardio?.distance_meters
                ? (activity.cardio.distance_meters / 1000).toFixed(1)
                : null
              const pace = activity.cardio?.avg_pace_seconds_per_km
                ? formatPace(activity.cardio.avg_pace_seconds_per_km)
                : null
              const date = new Date(activity.timestamp)
              const dateStr = new Intl.DateTimeFormat("es-AR", {
                day: "numeric",
                month: "short",
              }).format(date)

              return (
                <Link
                  key={activity.id}
                  to="/activities/$activityId"
                  params={{ activityId: activity.id }}
                  className="flex items-center gap-3.5 rounded-2xl bg-card border border-border px-4 py-3 shadow-card transition-colors hover:bg-secondary hover:border-primary/20 group"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold group-hover:scale-110 transition-transform">
                    <MapPin className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-bold font-display text-foreground">
                      {activity.name || "Carrera"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dateStr}
                      {km && ` · ${km} km`}
                      {activity.duration_seconds
                        ? ` · ${formatDuration(activity.duration_seconds)}`
                        : ""}
                    </p>
                  </div>
                  {pace && (
                    <span className="shrink-0 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20 tabular-nums">
                      {pace}
                    </span>
                  )}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

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
import { useMemo } from "react"
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

import { ActivitiesService, AnalyticsService, RacesService } from "@/client"
import { formatPace } from "@/components/Activities/activity-utils"
import { ChartCard } from "@/components/Analytics/ChartCard"
import { RunningHeatmap } from "@/components/Analytics/RunningHeatmap"
import { StatTile } from "@/components/Analytics/StatTile"
import {
  AXIS_TICK_STYLE,
  CHART_HEIGHTS,
  DOMAIN_COLORS,
  TOOLTIP_CONTENT_STYLE,
} from "@/components/Analytics/chart-theme"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/_layout/analytics/")(({
  component: RunningStats,
  head: () => ({ meta: [{ title: "Stats - OpenRunning" }] }),
}))

// ---------------------------------------------------------------------------
// Helpers
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

function formatMonthLabel(month: string): string {
  if (!month) return ""
  const date = new Date(`${month}-01T12:00:00`)
  if (Number.isNaN(date.getTime())) return month
  return new Intl.DateTimeFormat("es-AR", { month: "short" })
    .format(date)
    .replace(".", "")
    .toUpperCase()
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

/** Colores para las 5 zonas de FC (Z1 … Z5). */
const HR_ZONE_COLORS = ["#14b8a6", "#10b981", "#f59e0b", "#f97316", "#ef4444"]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function RunningStats() {
  const navigate = useNavigate()

  // ── Queries ──

  /** Cardio monthly (12 months for heatmap and charts) */
  const cardioMonthlyQuery = useQuery({
    queryKey: ["stats-cardio-monthly"],
    queryFn: () => AnalyticsService.readCardioMonthly({ months: 12 }),
  })

  /** Best paces */
  const pacesQuery = useQuery({
    queryKey: ["stats-best-paces"],
    queryFn: () => AnalyticsService.readCardioBestPaces(),
  })

  /** HR zones (latest 12 weeks) */
  const hrZonesQuery = useQuery({
    queryKey: ["stats-hr-zones"],
    queryFn: () => AnalyticsService.readCardioHrZones({ weeks: 12 }),
  })

  /** HR trend (latest 12 weeks) */
  const hrTrendQuery = useQuery({
    queryKey: ["stats-hr-trend"],
    queryFn: () => AnalyticsService.readCardioHrTrend({ weeks: 12 }),
  })

  /** Active weeks (6 weeks for streak + tile KPIs) */
  const activeWeeksQuery = useQuery({
    queryKey: ["stats-active-weeks"],
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
      return dashboards
    },
  })

  /** Recent activities (for the heatmap + list) */
  const activitiesQuery = useQuery({
    queryKey: ["stats-recent-activities"],
    queryFn: () => ActivitiesService.readActivities({ limit: 100 }),
  })

  /** Races (for the Carreras tile) */
  const racesQuery = useQuery({
    queryKey: ["stats-races"],
    queryFn: () => RacesService.readRaces({ limit: 100 }),
  })

  /** Cardio analytics for 30d (for pace tile) */
  const cardio30dQuery = useQuery({
    queryKey: ["stats-cardio-30d"],
    queryFn: () => {
      const now = new Date()
      const from = new Date(now)
      from.setDate(from.getDate() - 30)
      return AnalyticsService.readCardioAnalytics({
        fromDate: formatDate(from),
        toDate: formatDate(now),
      })
    },
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
      duration_seconds: r.official_time_seconds || r.chip_time_seconds || (r as any).target_time_seconds || 0,
      cardio: {
        distance_meters: r.distance_km * 1000,
        avg_pace_seconds_per_km: r.official_pace_seconds_per_km || (r as any).target_pace_seconds_per_km || 0,
      } as any,
    }))
  
  const allActivities = [...rawActivities, ...unlinkedRacesAsActivities].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const totalActivities = allActivities.length
  
  const thisMonthKey = new Date().toISOString().slice(0, 7)
  const thisMonthRuns = allActivities.filter(
    (a) => a.timestamp?.slice(0, 7) === thisMonthKey,
  ).length

  // Week streak: count consecutive weeks (from current back) with at least 1 active day
  const weekStreak = useMemo(() => {
    const dashboards = activeWeeksQuery.data ?? []
    let streak = 0
    for (let i = dashboards.length - 1; i >= 0; i--) {
      const kpis = dashboards[i]?.kpis
      if (kpis && kpis.active_days > 0) {
        streak++
      } else {
        break
      }
    }
    return streak
  }, [activeWeeksQuery.data])

  const avgPace30d = cardio30dQuery.data?.average_pace_seconds_per_km

  // Heatmap data: build from activities
  const heatmapData = useMemo(() => {
    return allActivities
      .filter((a) => a.cardio?.distance_meters)
      .map((a) => ({
        date: a.timestamp.slice(0, 10),
        km: (a.cardio?.distance_meters ?? 0) / 1000,
        sessions: 1,
      }))
  }, [allActivities])

  // Monthly distance chart (frontend override to include manual races)
  const monthlyKm = useMemo(() => {
    // Start with backend data
    const backendData = [...(cardioMonthlyQuery.data ?? [])].map((m) => ({
      name: formatMonthLabel(m.month as string),
      monthKey: m.month as string,
      km: Number(m.distance_meters ?? 0) / 1000,
      sessions: Number(m.sessions ?? 0),
    }))
    
    // Add unlinked races to the monthly aggregations
    for (const r of unlinkedRacesAsActivities) {
      if (!r.cardio?.distance_meters) continue
      const monthKey = r.timestamp.slice(0, 7)
      let bucket = backendData.find(b => b.monthKey === monthKey)
      if (!bucket) {
        bucket = { name: formatMonthLabel(monthKey), monthKey, km: 0, sessions: 0 }
        backendData.push(bucket)
      }
      bucket.km += r.cardio.distance_meters / 1000
      bucket.sessions += 1
    }
    
    return backendData.sort((a, b) => a.monthKey.localeCompare(b.monthKey))
  }, [cardioMonthlyQuery.data, unlinkedRacesAsActivities])

  // Best paces sorted
  const paces = useMemo(() => {
    return [...(pacesQuery.data ?? [])].sort(
      (a, b) =>
        Number(a.pace_seconds_per_km ?? Infinity) -
        Number(b.pace_seconds_per_km ?? Infinity),
    )
  }, [pacesQuery.data])

  // HR zones donut (latest week)
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

  // ── Render ──

  return (
    <div className="col-span-12 flex flex-col gap-6 pb-20">
      {/* ── Header ── */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Estadísticas</h1>
          <p className="text-xs font-medium text-slate-400">
            Progreso e historial de rendimiento
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white rounded-xl text-xs font-bold"
          onClick={() => navigate({ to: "/activities" })}
        >
          Historial
          <ChevronRight className="ml-1 size-4" />
        </Button>
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
        />
        <StatTile
          icon={<Timer className="size-4" />}
          label="Ritmo 30d"
          value={avgPace30d ? formatPace(avgPace30d) : "—"}
          valueColor={
            avgPace30d ? DOMAIN_COLORS.cardio : undefined
          }
        />
      </div>

      {/* ── Activity Heatmap ── */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5 shadow-xl">
        <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-400">
          Actividad — últimos 12 meses{" "}
          <span className="normal-case tracking-normal font-normal text-slate-500">· por distancia</span>
        </h2>
        {activitiesQuery.isLoading ? (
          <div className="h-28 animate-pulse rounded-xl bg-slate-800/60" />
        ) : (
          <RunningHeatmap
            data={heatmapData}
            onDay={(iso) =>
              navigate({
                to: "/activities",
                search: { from: iso, to: iso } as any,
              })
            }
          />
        )}
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
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-800/40 px-3.5 py-2.5"
            >
              <span className="text-sm font-bold text-white">
                {String(pace.distance_label)}
              </span>
              <span className="text-lg font-black tabular-nums text-emerald-400">
                {formatPace(Number(pace.pace_seconds_per_km))}
              </span>
              <span className="text-xs font-medium text-slate-400">
                {String(pace.date ?? "").slice(0, 10)}
              </span>
            </div>
          ))}
        </div>
      </ChartCard>

      {/* ── Two-column section (desktop) ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Zonas de FC (donut) */}
        <ChartCard
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
          <div className="text-slate-300">
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

        {/* Frecuencia cardíaca (tendencia) */}
        <ChartCard
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
          <div className="text-slate-300">
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

      {/* ── Two-column section: Distance + Sessions ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Distancia mensual */}
        <ChartCard
          title="Distancia mensual"
          kpi={
            monthlyKm.length > 0
              ? `${monthlyKm[monthlyKm.length - 1].km.toFixed(1)} km`
              : undefined
          }
          kpiHint="último mes"
          loading={cardioMonthlyQuery.isLoading}
          error={cardioMonthlyQuery.isError}
          onRetry={() => cardioMonthlyQuery.refetch()}
          empty={
            !cardioMonthlyQuery.isLoading &&
            !cardioMonthlyQuery.isError &&
            monthlyKm.length === 0
          }
        >
          <div className="text-slate-300">
            <ResponsiveContainer width="100%" height={CHART_HEIGHTS.md}>
              <BarChart
                data={monthlyKm}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
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
                />
                <Tooltip
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  cursor={{
                    fill: "rgba(255,255,255,0.05)",
                  }}
                  formatter={(val: any) => [
                    `${Number(val).toFixed(1)} km`,
                    "Distancia",
                  ]}
                />
                <Bar
                  dataKey="km"
                  fill={DOMAIN_COLORS.cardio}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Sesiones mensuales */}
        <ChartCard
          title="Sesiones por mes"
          loading={cardioMonthlyQuery.isLoading}
          error={cardioMonthlyQuery.isError}
          onRetry={() => cardioMonthlyQuery.refetch()}
          empty={
            !cardioMonthlyQuery.isLoading &&
            !cardioMonthlyQuery.isError &&
            monthlyKm.length === 0
          }
        >
          <div className="text-slate-300">
            <ResponsiveContainer width="100%" height={CHART_HEIGHTS.md}>
              <BarChart
                data={monthlyKm}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
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
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  cursor={{
                    fill: "rgba(255,255,255,0.05)",
                  }}
                />
                <Bar
                  dataKey="sessions"
                  name="Sesiones"
                  fill={DOMAIN_COLORS.active}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* ── Recent Workouts ── */}
      {recentActivities.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Últimas carreras
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
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
                  className="flex items-center gap-3.5 rounded-2xl bg-slate-900 border border-slate-800 px-4 py-3 shadow-lg transition-all hover:bg-slate-800/60 hover:border-slate-700"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 font-bold">
                    <MapPin className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      {activity.name || "Carrera"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {dateStr}
                      {km && ` · ${km} km`}
                      {activity.duration_seconds
                        ? ` · ${formatDuration(activity.duration_seconds)}`
                        : ""}
                    </p>
                  </div>
                  {pace && (
                    <span className="shrink-0 text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 tabular-nums">
                      {pace} /km
                    </span>
                  )}
                  <ChevronRight className="size-4 shrink-0 text-slate-500" />
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

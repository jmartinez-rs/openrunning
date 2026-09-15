import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Dumbbell } from "lucide-react"
import { useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { AnalyticsService } from "@/client"
import {
  AXIS_TICK_STYLE,
  CHART_HEIGHTS,
  DOMAIN_COLORS,
  TOOLTIP_CONTENT_STYLE,
} from "@/components/Analytics/chart-theme"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/_layout/analytics/strength")({
  component: StrengthAnalytics,
  head: () => ({ meta: [{ title: "Analítica Fuerza - OpenRunning" }] }),
})

const MONTH_LABELS = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
]

function monthLabel(month: string): string {
  const num = Number(month.slice(5))
  return num >= 1 && num <= 12 ? MONTH_LABELS[num - 1] : month.slice(5)
}

function StrengthAnalytics() {
  const [selectedExercise, setSelectedExercise] = useState("")
  const [months, setMonths] = useState(12)

  const monthly = useQuery({
    queryKey: ["analytics-strength-monthly", months],
    queryFn: () => AnalyticsService.readStrengthMonthly({ months }),
  })
  const muscle = useQuery({
    queryKey: ["analytics-strength-muscle", months],
    queryFn: () => AnalyticsService.readMuscleDistribution({ months }),
  })
  const records = useQuery({
    queryKey: ["analytics-strength-records"],
    queryFn: () => AnalyticsService.readStrengthRecords(),
  })
  const progress = useQuery({
    queryKey: ["analytics-strength-1rm", selectedExercise],
    queryFn: () =>
      AnalyticsService.readOneRmProgress({ exercise: selectedExercise }),
    enabled: Boolean(selectedExercise),
  })

  const monthlyData = (monthly.data ?? []).map((m) => ({
    label: monthLabel(m.month as string),
    value: Number(m.volume_kg ?? 0) / 1000,
  }))
  const lastTons = monthlyData[monthlyData.length - 1]?.value ?? 0

  const exercises = Object.keys(
    (records.data ?? {}) as Record<string, object>,
  ).sort()
  const progressData = (progress.data ?? []).map((p) => ({
    label: String(p.date ?? "").slice(0, 10),
    value: Number(p.one_rm ?? 0),
  }))
  const current1rm = progressData[progressData.length - 1]?.value ?? 0
  const first1rm = progressData[0]?.value ?? 0
  const deltaPct = first1rm > 0 ? ((current1rm - first1rm) / first1rm) * 100 : 0
  const deltaPositive = deltaPct >= 0

  return (
    <div className="col-span-12 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            asChild
            className="rounded-lg"
          >
            <Link to="/analytics">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-headline-lg text-primary">Analítica Fuerza</h1>
            <p className="text-body-md text-on-surface-variant">
              Tonelaje, distribución muscular y 1RM.
            </p>
          </div>
        </div>
        <div className="flex gap-1 rounded-lg bg-surface-container-low p-1">
          {[3, 6, 12, 24].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMonths(value)}
              className={`rounded-md px-4 py-1.5 text-label-sm transition-colors ${
                months === value
                  ? "bg-card text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              {value}M
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-card dark:border dark:border-border/50 col-span-12 lg:col-span-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-label-sm text-on-surface-variant uppercase">
                Carga Fuerza
              </h3>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-headline-md tabular-nums text-primary">
                  {lastTons.toFixed(1)}
                </span>
                <span className="text-label-sm text-on-surface-variant uppercase">
                  TON / MES
                </span>
              </div>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-domain-strength/10 text-domain-strength">
              <Dumbbell className="size-5" />
            </div>
          </div>

          {monthly.isLoading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : monthlyData.length === 0 ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-center text-body-md text-on-surface-variant">
                Todavía no hay datos de fuerza en este período.
              </p>
            </div>
          ) : (
            <div className="text-on-surface-variant">
              <ResponsiveContainer width="100%" height={CHART_HEIGHTS.md}>
                <BarChart
                  data={monthlyData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="label"
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
                    formatter={(value: any) => [
                      `${Number(value).toFixed(1)} ton`,
                      "Volumen",
                    ]}
                    cursor={{
                      fill: "var(--color-surface-container-high, rgba(128,128,128,0.1))",
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill={DOMAIN_COLORS.strength}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-card dark:border dark:border-border/50 col-span-12 lg:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-label-sm text-on-surface-variant uppercase">
                Evolución Récord (1RM)
              </h3>
              {selectedExercise ? (
                <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-headline-md tabular-nums text-primary">
                    {current1rm}
                  </span>
                  <span className="text-label-sm text-on-surface-variant uppercase">
                    KG
                  </span>
                  {progressData.length >= 2 && (
                    <span
                      className={`flex items-center gap-0.5 text-body-md font-semibold tabular-nums ${deltaPositive ? "text-domain-success" : "text-destructive"}`}
                    >
                      {deltaPositive ? (
                        <ArrowUpRight className="size-4" />
                      ) : (
                        <ArrowDownRight className="size-4" />
                      )}
                      {deltaPositive ? "+" : ""}
                      {deltaPct.toFixed(0)}%
                    </span>
                  )}
                </div>
              ) : null}
            </div>
            <Select
              value={selectedExercise}
              onValueChange={setSelectedExercise}
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Seleccioná un ejercicio" />
              </SelectTrigger>
              <SelectContent>
                {exercises.map((exercise) => (
                  <SelectItem key={exercise} value={exercise}>
                    {exercise}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!selectedExercise ? (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border bg-surface-container-low">
              <p className="text-center text-body-md text-on-surface-variant">
                Elegí un ejercicio para ver su progresión de 1RM.
              </p>
            </div>
          ) : progress.isLoading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : progressData.length < 2 ? (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border bg-surface-container-low">
              <p className="text-center text-body-md text-on-surface-variant">
                Necesitás al menos dos sesiones con este ejercicio para graficar
                la progresión.
              </p>
            </div>
          ) : (
            <div className="text-on-surface-variant">
              <ResponsiveContainer width="100%" height={CHART_HEIGHTS.md}>
                <LineChart
                  data={progressData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="label"
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
                    formatter={(value: any) => [
                      `${Number(value).toFixed(1)} kg`,
                      "1RM Estimado",
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
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-card dark:border dark:border-border/50 col-span-12 lg:col-span-12">
          <div className="flex items-center justify-between">
            <h3 className="text-label-sm text-on-surface-variant uppercase">
              Distribución por grupo muscular
            </h3>
            <span className="text-label-sm text-on-surface-variant">
              Series efectivas
            </span>
          </div>
          {muscle.isLoading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (muscle.data ?? []).length === 0 ? (
            <p className="py-10 text-center text-body-md text-on-surface-variant">
              Todavía no hay datos de fuerza en este período.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(muscle.data ?? []).map((entry, index) => {
                const max = Math.max(
                  ...(muscle.data ?? []).map((e) => Number(e.sets ?? 0)),
                  1,
                )
                const sets = Number(entry.sets ?? 0)
                return (
                  <div key={index} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-body-md text-primary">
                      {String(entry.group)}
                    </span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-variant">
                      <div
                        className="h-full rounded-full bg-domain-strength"
                        style={{ width: `${(sets / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right text-label-sm tabular-nums text-on-surface-variant">
                      {sets}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

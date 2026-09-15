import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Activity, ArrowLeft } from "lucide-react"
import { useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { AnalyticsService } from "@/client"
import { formatPace } from "@/components/Activities/activity-utils"
import {
  AXIS_TICK_STYLE,
  CHART_HEIGHTS,
  DOMAIN_COLORS,
  TOOLTIP_CONTENT_STYLE,
} from "@/components/Analytics/chart-theme"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/_layout/analytics/cardio")({
  component: CardioAnalytics,
  head: () => ({ meta: [{ title: "Analítica Cardio - OpenRunning" }] }),
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

function CardioAnalytics() {
  const [months, setMonths] = useState(12)

  const monthly = useQuery({
    queryKey: ["analytics-cardio-monthly", months],
    queryFn: () => AnalyticsService.readCardioMonthly({ months }),
  })
  const paces = useQuery({
    queryKey: ["analytics-cardio-paces"],
    queryFn: () => AnalyticsService.readCardioBestPaces(),
  })

  const monthlyData = (monthly.data ?? []).map((m) => ({
    label: monthLabel(m.month as string),
    value: Number(m.distance_meters ?? 0) / 1000,
  }))
  const lastKm = monthlyData[monthlyData.length - 1]?.value ?? 0

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
            <h1 className="text-headline-lg text-primary">Analítica Cardio</h1>
            <p className="text-body-md text-on-surface-variant">
              Evolución de tu running.
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
        <div className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-card dark:border dark:border-border/50 col-span-12 lg:col-span-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-label-sm text-on-surface-variant uppercase">
                Volumen Cardio
              </h3>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-headline-md tabular-nums text-primary">
                  {lastKm.toFixed(1)}
                </span>
                <span className="text-label-sm text-on-surface-variant uppercase">
                  KM / MES
                </span>
              </div>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-domain-cardio/10 text-domain-cardio">
              <Activity className="size-5" />
            </div>
          </div>

          {monthly.isLoading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : monthlyData.length === 0 ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-center text-body-md text-on-surface-variant">
                Todavía no hay datos de cardio en este período.
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
                      `${Number(value).toFixed(1)} km`,
                      "Distancia",
                    ]}
                    cursor={{
                      fill: "var(--color-surface-container-high, rgba(128,128,128,0.1))",
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill={DOMAIN_COLORS.cardio}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-card dark:border dark:border-border/50 col-span-12 lg:col-span-4">
          <h3 className="text-label-sm text-on-surface-variant uppercase">
            Mejores Marcas
          </h3>
          {paces.isLoading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (paces.data ?? []).length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-center text-body-md text-on-surface-variant">
                Sin marcas registradas todavía.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {(paces.data ?? []).map((pace, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-surface-container-low px-3 py-2"
                >
                  <span className="text-body-md text-primary">
                    {String(pace.distance_label)}
                  </span>
                  <span className="text-title-lg tabular-nums text-domain-cardio">
                    {formatPace(Number(pace.pace_seconds_per_km))}
                  </span>
                  <span className="text-label-sm text-on-surface-variant">
                    {String(pace.date ?? "").slice(0, 10)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

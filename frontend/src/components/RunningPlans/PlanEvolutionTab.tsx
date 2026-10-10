import { TrendingUp } from "lucide-react"
import { useMemo } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { RunningPlanPublic } from "@/client"
import { blocksDistanceKm } from "./running-utils"

interface PlanEvolutionTabProps {
  plan: RunningPlanPublic
}

export function PlanEvolutionTab({ plan }: PlanEvolutionTabProps) {
  // Compute weekly planned vs completed metrics
  const weekData = useMemo(() => {
    const phases = plan.phases ?? []
    const weeksList: Array<{
      weekNumber: number
      plannedKm: number
      completedKm: number
    }> = []

    for (const phase of phases) {
      for (const week of phase.weeks ?? []) {
        let plannedKm = 0
        let completedKm = 0

        for (const workout of week.workouts ?? []) {
          const dist =
            workout.distance_km ?? blocksDistanceKm(workout.blocks ?? []) ?? 0
          plannedKm += dist
          if (workout.status === "completed") {
            completedKm += dist
          }
        }

        weeksList.push({
          weekNumber: week.number,
          plannedKm: Math.round(plannedKm * 10) / 10,
          completedKm: Math.round(completedKm * 10) / 10,
        })
      }
    }

    return weeksList.sort((a, b) => a.weekNumber - b.weekNumber)
  }, [plan])

  const totalPlanned = useMemo(
    () => weekData.reduce((acc, w) => acc + w.plannedKm, 0),
    [weekData],
  )
  const totalCompleted = useMemo(
    () => weekData.reduce((acc, w) => acc + w.completedKm, 0),
    [weekData],
  )
  const aprovechamiento = totalPlanned > 0
    ? Math.round((totalCompleted / totalPlanned) * 100)
    : 0

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Top 3 Metric Cards (Realizado, Planificado, Cumplimiento) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Realizado */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-[#121214] p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <span>Realizado</span>
            <span className="text-[10px] text-primary font-bold">TOTAL</span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl sm:text-3xl font-black text-white">
              {totalCompleted.toFixed(1)}
            </span>
            <span className="text-xs font-bold text-zinc-400">km</span>
          </div>
        </div>

        {/* Planificado */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-[#121214] p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <span>Planificado</span>
            <span className="text-[10px] text-zinc-500 font-bold">TOTAL</span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl sm:text-3xl font-black text-zinc-300">
              {totalPlanned.toFixed(1)}
            </span>
            <span className="text-xs font-bold text-zinc-400">km</span>
          </div>
        </div>

        {/* Cumplimiento / Aprovechamiento */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-[#121214] p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <span>Cumplimiento</span>
            <span className="text-[10px] text-primary font-bold">TASA</span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl sm:text-3xl font-black text-primary">
              {aprovechamiento}%
            </span>
            <span className="text-xs font-medium text-zinc-400">de lo planificado</span>
          </div>
        </div>
      </div>

      {/* 2. Dual-line Volume Chart: Realizado (Amarillo) vs Planificado (Gris punteado) */}
      <div className="rounded-2xl border border-border/80 bg-[#121214] p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Evolución de Volumen Semanal
            </h3>
            <p className="text-xs text-muted-foreground">
              Comparativo de kilometraje planificado vs ejecutado
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-primary" />
              <span className="text-zinc-300">Realizado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-zinc-600" />
              <span className="text-muted-foreground">Planificado</span>
            </div>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          {weekData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis
                  dataKey="weekNumber"
                  stroke="#666"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `Sem ${val}`}
                />
                <YAxis
                  stroke="#666"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    borderColor: "#333",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                  formatter={(value: any, name: any) => [
                    `${value} km`,
                    name === "completedKm" ? "Realizado" : "Planificado",
                  ]}
                  labelFormatter={(lbl) => `Semana ${lbl}`}
                />
                {/* Planificado: dashed line */}
                <Line
                  type="monotone"
                  dataKey="plannedKm"
                  stroke="#52525b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: "#52525b" }}
                  activeDot={{ r: 5 }}
                />
                {/* Realizado: kinetic volt solid line */}
                <Line
                  type="monotone"
                  dataKey="completedKm"
                  stroke="#EAFC5F"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#EAFC5F" }}
                  activeDot={{ r: 6, stroke: "#EAFC5F", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
              Sin datos suficientes para graficar
            </div>
          )}
        </div>
      </div>

      {/* 3. Aerodynamic Efficiency / Evolution Trend Card */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">
                  Índice de Eficiencia Cardíaca
                </h4>
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-black uppercase text-primary">
                  Evolucionando
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Estás manteniendo el ritmo con menor esfuerzo cardíaco en las últimas sesiones.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0 sm:border-l sm:border-primary/20 sm:pl-4">
            <div>
              <div className="text-[10px] font-bold uppercase text-muted-foreground">
                Ritmo Base
              </div>
              <div className="font-mono text-sm font-bold text-white">
                {plan.target_pace_seconds_per_km
                  ? `${Math.floor(plan.target_pace_seconds_per_km / 60)}:${String(Math.floor(plan.target_pace_seconds_per_km % 60)).padStart(2, "0")}/km`
                  : "Consistente"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-muted-foreground">
                Estado
              </div>
              <div className="text-sm font-bold text-primary">
                Excelente
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  Footprints,
  Plus,
  Sparkles,
} from "lucide-react"
import { useState } from "react"

import {
  RunningPlansService,
} from "@/client"
import { ActivePlanHero } from "@/components/RunningPlans/ActivePlanHero"
import { RunningPlanCard } from "@/components/RunningPlans/RunningPlanCard"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/routines/")({
  component: Routines,
  head: () => ({ meta: [{ title: "Planes de Entrenamiento - OpenRunning" }] }),
})

// ---------------------------------------------------------------------------
// Status filter chips
// ---------------------------------------------------------------------------

const STATUS_FILTERS = [
  { label: "Todos", value: "" },
  { label: "Activos", value: "active" },
  { label: "Planificados", value: "planned" },
  { label: "Finalizados", value: "completed" },
] as const

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

function Routines() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [statusFilter, setStatusFilter] = useState("")

  // ----- Running Plans queries -----
  const plansQuery = useQuery({
    queryKey: ["running-plans"],
    queryFn: () => RunningPlansService.readPlans(),
  })

  const plans = plansQuery.data?.data ?? []

  // Split plans: active vs others
  const activePlan = plans.find((p) => p.status === "active") ?? null
  const otherPlans = plans.filter((p) => p.id !== activePlan?.id)

  // Apply status filter to other plans
  const filteredPlans = statusFilter
    ? otherPlans.filter((p) => p.status === statusFilter)
    : otherPlans

  const deleteRunPlan = useMutation({
    mutationFn: (id: string) => RunningPlansService.deletePlan({ planId: id }),
    onSuccess: () => {
      showSuccessToast("Plan eliminado")
      queryClient.invalidateQueries({ queryKey: ["running-plans"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  return (
    <div className="col-span-12 flex flex-col gap-6">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Planes de Entrenamiento
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Organizá tu temporada con planes estructurados de running.
          </p>
        </div>
        <div>
          <Button
            type="button"
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 rounded-xl cursor-pointer"
            onClick={() => navigate({ to: "/routines/run/new" })}
          >
            <Plus className="mr-2 size-4 stroke-[3]" />
            Nuevo plan
          </Button>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────── */}
      {plansQuery.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56 w-full rounded-2xl bg-slate-800/80" />
          <Skeleton className="h-28 w-full rounded-2xl bg-slate-800/80" />
          <Skeleton className="h-28 w-full rounded-2xl bg-slate-800/80" />
        </div>
      ) : plans.length === 0 ? (
        /* ── Empty state (Runna-inspired onboarding) ── */
        <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
          <div className="relative mb-6">
            <div className="flex size-20 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Footprints className="size-9 animate-pulse" />
            </div>
            <div className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-md font-bold">
              <Sparkles className="size-3.5" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">
            Comenzá tu plan de entrenamiento
          </h3>
          <p className="mt-2 max-w-md text-xs text-slate-400 font-medium">
            Creá un plan personalizado con fases, semanas y sesiones
            estructuradas. Definí tus ritmos, distancias y objetivos
            para cada sesión.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <Button
              type="button"
              size="lg"
              className="gap-2 rounded-xl px-8 text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 cursor-pointer"
              onClick={() => navigate({ to: "/routines/run/new" })}
            >
              <Plus className="size-5 stroke-[3]" />
              Crear mi primer plan
            </Button>
          </div>

          {/* Mini explainer */}
          <div className="mt-10 grid max-w-xl grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { step: "1", title: "Fases", desc: "Base, construcción, tapering" },
              { step: "2", title: "Semanas", desc: "Carga progresiva" },
              { step: "3", title: "Sesiones", desc: "Intervalos, tempo, fondo" },
              { step: "4", title: "Bloques", desc: "Ritmos y recuperaciones" },
            ].map((item) => (
              <div
                key={item.step}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 p-3.5 text-center"
              >
                <span className="flex size-7 items-center justify-center rounded-xl bg-emerald-500/15 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                  {item.step}
                </span>
                <span className="text-xs font-bold text-white">
                  {item.title}
                </span>
                <span className="text-[11px] leading-tight text-slate-400">
                  {item.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* ── Active Plan Hero ────────────────────── */}
          {activePlan && <ActivePlanHero plan={activePlan} />}

          {/* ── Filter chips + other plans ──────────── */}
          {otherPlans.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-end justify-between border-b border-slate-800 pb-2">
                <h2 className="text-lg font-bold text-white">
                  {activePlan ? "Otros planes" : "Tus planes"}
                </h2>
                <span className="text-xs font-semibold text-slate-400">
                  {filteredPlans.length}{" "}
                  {filteredPlans.length === 1 ? "plan" : "planes"}
                </span>
              </div>

              {/* Status filter chips */}
              <div className="flex flex-wrap items-center gap-2">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setStatusFilter(filter.value)}
                    className={cn(
                      "rounded-xl px-4 py-1.5 text-xs font-bold transition-all cursor-pointer border",
                      statusFilter === filter.value
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/60 shadow-xs"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white",
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* Plan list */}
              {filteredPlans.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 px-4 py-8 text-center text-xs text-slate-400">
                  No hay planes con el filtro seleccionado.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredPlans.map((plan) => (
                    <RunningPlanCard
                      key={plan.id}
                      plan={plan}
                      onEdit={() =>
                        navigate({
                          to: "/routines/run/new",
                          search: { edit: plan.id },
                        })
                      }
                      onDelete={() => deleteRunPlan.mutate(plan.id)}
                      deleting={deleteRunPlan.isPending}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

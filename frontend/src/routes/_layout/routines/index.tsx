import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ChevronDown, Footprints, Plus, Sparkles } from "lucide-react"
import { useState } from "react"

import { RunningPlansService } from "@/client"
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
  const [showOtherPlans, setShowOtherPlans] = useState(false)

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
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="min-w-0">
          <h1 className="text-2xl font-black font-display text-foreground tracking-tight">
            Planes de Entrenamiento
          </h1>
          <p className="text-xs text-muted-foreground font-medium">
            Organizá tu temporada con planes estructurados de running.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: "/routines/run/new" })}
          className="size-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-glow flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-all"
          title="Nuevo plan"
          aria-label="Nuevo plan"
        >
          <Plus className="size-5 stroke-[2.5]" />
        </button>
      </div>

      {/* ── Main Content ────────────────────────────────────────────── */}
      {plansQuery.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56 w-full rounded-[2rem] bg-card" />
          <Skeleton className="h-28 w-full rounded-2xl bg-card" />
          <Skeleton className="h-28 w-full rounded-2xl bg-card" />
        </div>
      ) : plans.length === 0 ? (
        /* ── Empty state (onboarding) ── */
        <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-[2rem] p-8 shadow-card">
          <div className="relative mb-6">
            <div className="flex size-20 items-center justify-center rounded-[2rem] bg-primary/10 text-primary border border-primary/20">
              <Footprints className="size-9 animate-pulse" />
            </div>
            <div className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow font-bold">
              <Sparkles className="size-3.5" />
            </div>
          </div>
          <h3 className="text-xl font-bold font-display text-foreground tracking-tight">
            Comenzá tu plan de entrenamiento
          </h3>
          <p className="mt-2 max-w-md text-xs text-muted-foreground font-medium">
            Creá un plan personalizado con fases, semanas y sesiones
            estructuradas. Definí tus ritmos, distancias y objetivos para cada
            sesión.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <Button
              type="button"
              size="lg"
              className="gap-2 rounded-full px-8 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow cursor-pointer"
              onClick={() => navigate({ to: "/routines/run/new" })}
            >
              <Plus className="size-5 stroke-[3]" />
              Crear mi primer plan
            </Button>
          </div>

          {/* Mini explainer */}
          <div className="mt-10 grid max-w-xl grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                step: "1",
                title: "Fases",
                desc: "Base, construcción, tapering",
              },
              { step: "2", title: "Semanas", desc: "Carga progresiva" },
              {
                step: "3",
                title: "Sesiones",
                desc: "Intervalos, tempo, fondo",
              },
              { step: "4", title: "Bloques", desc: "Ritmos y recuperaciones" },
            ].map((item) => (
              <div
                key={item.step}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-secondary/30 border border-border p-3.5 text-center"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary border border-primary/30">
                  {item.step}
                </span>
                <span className="text-xs font-bold text-foreground">
                  {item.title}
                </span>
                <span className="text-[11px] leading-tight text-muted-foreground">
                  {item.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* ── Plan Activo Destacado (Reemplazo de ActivePlanHero) ── */}
          {activePlan && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black uppercase tracking-wider text-primary">
                  Tu plan activo
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {activePlan.weeks} {activePlan.weeks === 1 ? "semana" : "semanas"} · {activePlan.planned_km} km
                </span>
              </div>
              <RunningPlanCard
                plan={activePlan}
                isActiveFeatured
                onEdit={() =>
                  navigate({
                    to: "/routines/run/new",
                    search: { edit: activePlan.id },
                  })
                }
                onDelete={() => deleteRunPlan.mutate(activePlan.id)}
                deleting={deleteRunPlan.isPending}
              />
            </div>
          )}

          {/* ── Otros planes / Historial (Colapsable para mantener la vista limpia) ── */}
          {otherPlans.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <button
                  type="button"
                  onClick={() => setShowOtherPlans(!showOtherPlans)}
                  className="flex items-center gap-2 text-left cursor-pointer group"
                >
                  <h2 className="text-sm sm:text-base font-bold font-display text-muted-foreground group-hover:text-foreground transition-colors">
                    {activePlan ? "Otros planes e historial" : "Tus planes"}
                  </h2>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {otherPlans.length}
                  </span>
                  {activePlan && (
                    <ChevronDown
                      className={cn(
                        "size-4 text-muted-foreground transition-transform duration-200",
                        showOtherPlans ? "rotate-180" : "",
                      )}
                    />
                  )}
                </button>
              </div>

              {(showOtherPlans || !activePlan) && (
                <div className="flex flex-col gap-3 mt-1">
                  {/* Status filter chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    {STATUS_FILTERS.map((filter) => (
                      <button
                        key={filter.value}
                        type="button"
                        onClick={() => setStatusFilter(filter.value)}
                        className={cn(
                          "rounded-full px-3 py-1 text-[11px] uppercase font-bold transition-all cursor-pointer border",
                          statusFilter === filter.value
                            ? "bg-primary/20 text-primary border-primary shadow-glow"
                            : "bg-secondary border-border text-muted-foreground hover:bg-surface-bright hover:text-foreground",
                        )}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>

                  {/* Plan list */}
                  {filteredPlans.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-xs text-muted-foreground">
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
      )}
    </div>
  )
}

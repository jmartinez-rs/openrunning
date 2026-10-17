import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ChevronDown, Footprints, History, Plus, Sparkles } from "lucide-react"
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
// Main page component
// ---------------------------------------------------------------------------

function Routines() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { showSuccessToast, showErrorToast } = useCustomToast()
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

  const deleteRunPlan = useMutation({
    mutationFn: (id: string) => RunningPlansService.deletePlan({ planId: id }),
    onSuccess: () => {
      showSuccessToast("Plan eliminado")
      queryClient.invalidateQueries({ queryKey: ["running-plans"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const updatePlanStatus = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string
      status: "planned" | "active" | "completed"
    }) =>
      RunningPlansService.updatePlan({
        planId: id,
        requestBody: { status },
      }),
    onSuccess: (_, variables) => {
      const msg =
        variables.status === "completed"
          ? "Plan finalizado exitosamente"
          : variables.status === "active"
            ? "Plan activado como tu plan principal"
            : "Estado del plan actualizado"
      showSuccessToast(msg)
      queryClient.invalidateQueries({ queryKey: ["running-plans"] })
      queryClient.invalidateQueries({ queryKey: ["running-plan"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
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
      ) : activePlan ? (
        <div className="flex flex-col gap-6">
          {/* ── Plan Activo Destacado ── */}
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
              onStatusChange={(status) =>
                updatePlanStatus.mutate({ id: activePlan.id, status })
              }
              changingStatus={updatePlanStatus.isPending}
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

          {/* ── Historial de planes (Discreto y colapsable al final para no mezclarlo con el activo) ── */}
          {otherPlans.length > 0 && (
            <div className="pt-2 flex flex-col items-center sm:items-start">
              <button
                type="button"
                onClick={() => setShowOtherPlans(!showOtherPlans)}
                className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-2 px-3 rounded-full hover:bg-secondary/50"
              >
                <History className="size-3.5" />
                <span>Historial de planes ({otherPlans.length})</span>
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform duration-200",
                    showOtherPlans ? "rotate-180" : "",
                  )}
                />
              </button>

              {showOtherPlans && (
                <div className="w-full mt-3 flex flex-col gap-3">
                  {otherPlans.map((plan) => (
                    <RunningPlanCard
                      key={plan.id}
                      plan={plan}
                      onStatusChange={(status) =>
                        updatePlanStatus.mutate({ id: plan.id, status })
                      }
                      changingStatus={updatePlanStatus.isPending}
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
      ) : (
        /* ── Sin plan activo en curso (todos completados o planificados) ── */
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center justify-center p-6 sm:p-8 rounded-[2rem] bg-card border border-border text-center shadow-card">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 mb-3">
              <Footprints className="size-7" />
            </div>
            <h2 className="text-lg font-bold font-display text-foreground tracking-tight">
              No tenés ningún plan activo
            </h2>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground font-medium">
              Activá un plan de tu historial o creá uno nuevo para comenzar tus entrenamientos.
            </p>
            <div className="mt-4">
              <Button
                type="button"
                className="rounded-full px-6 font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow cursor-pointer"
                onClick={() => navigate({ to: "/routines/run/new" })}
              >
                <Plus className="mr-1.5 size-4 stroke-[3]" /> Crear nuevo plan
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Historial de planes ({plans.length})
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {plans.map((plan) => (
                <RunningPlanCard
                  key={plan.id}
                  plan={plan}
                  onStatusChange={(status) =>
                    updatePlanStatus.mutate({ id: plan.id, status })
                  }
                  changingStatus={updatePlanStatus.isPending}
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
          </div>
        </div>
      )}
    </div>
  )
}

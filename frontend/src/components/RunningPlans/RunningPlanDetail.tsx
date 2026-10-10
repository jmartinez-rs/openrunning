import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileDown,
  Flag,
  Footprints,
  Pencil,
  Timer,
  Trash2,
  TrendingUp,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  RacesService,
  RunningPlansService,
  type RunningWorkoutPublic,
} from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"
import { PhaseTimeline } from "./PhaseTimeline"
import { WeekCarouselStrip } from "./WeekCarouselStrip"
import { PaccerSessionCard } from "./PaccerSessionCard"
import { PaccerWorkoutSheet } from "./PaccerWorkoutSheet"
import {
  buildPlanMarkdown,
  downloadPlanFile,
  type PlanExportScope,
  planExportFilename,
} from "./plan-export"
import {
  blocksDistanceKm,
  computeProgress,
  formatDateRange,
  formatDistance,
  formatDuration,
  formatObjectiveText,
  formatPace,
  getCurrentWeekFromPhases,
  isWithinPlanRange,
  PHASE_COLORS,
  type PhaseColor,
  PLAN_STATUS_META,
  type PlanStatus,
  todayIsoLocal,
} from "./running-utils"
import { WeekSessionCard } from "./WeekSessionCard"
import { WorkoutBlocksDrawer } from "./WorkoutBlocksDrawer"

type SelectedWorkout = {
  workout: RunningWorkoutPublic
  phaseName: string
  weekNumber: number
}

function StatChip({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string
  value: string | number
  icon?: React.ComponentType<{ className?: string }>
  className?: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      {Icon && <Icon className="size-4 text-primary/80 shrink-0" />}
      <div className="flex flex-col">
        <span
          className={cn(
            "text-base font-display font-black text-white leading-none tracking-tight tabular-nums",
            className,
          )}
        >
          {value}
        </span>
        <span className="mt-1 text-[11px] text-muted-foreground leading-none font-medium">
          {label}
        </span>
      </div>
    </div>
  )
}

export function RunningPlanDetail({
  planId,
  initialWeek,
}: {
  planId: string
  initialWeek?: number
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [, copyToClipboard] = useCopyToClipboard()
  const [selected, setSelected] = useState<SelectedWorkout | null>(null)
  const [paccerSheetOpen, setPaccerSheetOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"paccer" | "expanded">("paccer")
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number>(initialWeek ?? 1)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [collapseInitialized, setCollapseInitialized] = useState(false)
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null)
  const weekRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const query = useQuery({
    queryKey: ["running-plan", planId],
    queryFn: () => RunningPlansService.readPlan({ planId }),
  })

  const plan = query.data

  const raceQuery = useQuery({
    queryKey: ["race", plan?.race_id ?? ""],
    queryFn: () => RacesService.readRace({ raceId: plan!.race_id! }),
    enabled: Boolean(plan?.race_id),
  })

  const phases = plan?.phases ?? []

  const currentWeek = useMemo(() => {
    if (!plan || phases.length === 0) return null
    // La semana 1 puede arrancar antes de start_date: sin ventana real de plan
    // no marcamos ninguna semana como actual.
    if (!isWithinPlanRange(todayIsoLocal(), plan.start_date, plan.end_date)) {
      return null
    }
    return getCurrentWeekFromPhases(phases, undefined, plan.week_start_day ?? 1)
  }, [phases, plan])

  const summary = useMemo(() => {
    let weeks = 0
    let sessions = 0
    let plannedKm = 0
    let completed = 0
    let missed = 0
    let planned = 0
    for (const phase of phases) {
      weeks += phase.weeks?.length ?? 0
      for (const week of phase.weeks ?? []) {
        for (const workout of week.workouts ?? []) {
          sessions += 1
          if (workout.status === "completed") completed += 1
          else if (workout.status === "missed") missed += 1
          else if (workout.status === "planned") planned += 1

          const distance =
            workout.distance_km ?? blocksDistanceKm(workout.blocks ?? [])
          if (distance != null) plannedKm += distance
        }
      }
    }
    return {
      weeks,
      sessions,
      plannedKm: Math.round(plannedKm * 10) / 10,
      completed,
      missed,
      planned,
    }
  }, [phases])

  const progress = useMemo(() => computeProgress(summary), [summary])

  // Antes de arrancar el plan, el chrome de 0 completadas / 0 perdidas / 0% es
  // ruido: se colapsa en una sola línea.
  const hasStarted = progress.completed > 0 || progress.missed > 0

  // Initial collapse state: keep current week expanded, collapse others if many
  useEffect(() => {
    if (!plan || collapseInitialized) return
    setCollapseInitialized(true)
    if (initialWeek) {
      setSelectedWeekNumber(initialWeek)
    } else if (currentWeek?.weekNumber) {
      setSelectedWeekNumber(currentWeek.weekNumber)
    }
    const weekIds =
      plan.phases?.flatMap((phase) => phase.weeks?.map((w) => w.id) ?? []) ?? []

    if (weekIds.length > 2) {
      // Si llegamos con ?week=, expandir esa semana; si no, la semana actual.
      const targetWeekId = initialWeek
        ? plan.phases
            ?.flatMap((phase) => phase.weeks ?? [])
            .find((w) => w.number === initialWeek)?.id
        : currentWeek?.weekId
      const initialCollapsed = new Set(
        weekIds.filter((id) => id !== targetWeekId),
      )
      setCollapsed(initialCollapsed)
    }
  }, [plan, currentWeek, collapseInitialized, initialWeek])

  // Scroll a la semana indicada por ?week= (desde el dashboard "Hoy").
  useEffect(() => {
    if (!plan || !initialWeek) return
    const targetId = plan.phases
      ?.flatMap((phase) => phase.weeks ?? [])
      .find((w) => w.number === initialWeek)?.id
    if (!targetId) return
    const el = weekRefs.current.get(targetId)
    if (el) {
      const t = window.setTimeout(
        () => el.scrollIntoView({ behavior: "smooth", block: "start" }),
        150,
      )
      return () => window.clearTimeout(t)
    }
  }, [plan, initialWeek])

  const toggleWeek = (weekId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(weekId)) {
        next.delete(weekId)
      } else {
        next.add(weekId)
      }
      return next
    })
  }

  const deletePlan = useMutation({
    mutationFn: () => RunningPlansService.deletePlan({ planId }),
    onSuccess: () => {
      showSuccessToast("Plan eliminado")
      queryClient.invalidateQueries({ queryKey: ["running-plans"] })
      navigate({ to: "/routines" })
    },
    onError: handleError.bind(showErrorToast),
  })

  const updateStatusMutation = useMutation({
    mutationFn: (newStatus: PlanStatus) =>
      RunningPlansService.replacePlan({
        planId,
        requestBody: {
          name: plan!.name,
          goal: plan!.goal,
          distance_km: plan!.distance_km,
          distance_unit: plan!.distance_unit === "mi" ? "mi" : "km",
          target_time_seconds: plan!.target_time_seconds,
          target_pace_seconds_per_km: plan!.target_pace_seconds_per_km,
          start_date: plan!.start_date,
          end_date: plan!.end_date,
          week_start_day: plan!.week_start_day,
          status: newStatus,
          race_id: plan!.race_id,
          notes: plan!.notes,
          phases: (plan!.phases ?? []).map((phase, pi) => ({
            position: pi + 1,
            name: phase.name,
            color: phase.color,
            start_week: phase.start_week,
            end_week: phase.end_week,
            objective: phase.objective,
            description: phase.description,
            weeks: (phase.weeks ?? []).map((week) => ({
              number: week.number,
              start_date: week.start_date,
              end_date: week.end_date,
              name: week.name,
              objective: week.objective,
              notes: week.notes,
              workouts: (week.workouts ?? []).map((workout) => ({
                date: workout.date,
                type: workout.type,
                objective: workout.objective,
                name: workout.name,
                distance_km: workout.distance_km,
                duration_seconds: workout.duration_seconds,
                pace_seconds_per_km: workout.pace_seconds_per_km,
                intensity: workout.intensity,
                description: workout.description,
                notes: workout.notes,
                cancelled: workout.cancelled,
                status_override: workout.status_override,
                blocks: (workout.blocks ?? []).map((block, bi) => ({
                  position: bi + 1,
                  block_type: block.block_type,
                  repeats: block.repeats,
                  distance_m: block.distance_m,
                  duration_seconds: block.duration_seconds,
                  pace_seconds_per_km: block.pace_seconds_per_km,
                  pace_range_end_seconds_per_km:
                    block.pace_range_end_seconds_per_km,
                  recovery_seconds: block.recovery_seconds,
                  recovery_type:
                    block.recovery_type === "walk" ? "walk" : "jog",
                  notes: block.notes,
                })),
              })),
            })),
          })),
        },
      }),
    onSuccess: (_, newStatus) => {
      showSuccessToast(
        `Estado del plan actualizado a "${PLAN_STATUS_META[newStatus].label}"`,
      )
      queryClient.invalidateQueries({ queryKey: ["running-plans"] })
      queryClient.invalidateQueries({ queryKey: ["running-plan", planId] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const handleDelete = () => {
    if (!plan) return
    if (
      !window.confirm(
        `¿Eliminás el plan "${plan.name}"? Se borran todas sus fases, semanas y sesiones. Esta acción no se puede deshacer.`,
      )
    ) {
      return
    }
    deletePlan.mutate()
  }

  const handleCopyExport = async (scope: PlanExportScope) => {
    if (!plan) return
    const ok = await copyToClipboard(buildPlanMarkdown(plan, scope))
    if (ok) {
      showSuccessToast(
        scope === "current"
          ? "Semana actual copiada como Markdown"
          : "Plan copiado como Markdown",
      )
    } else {
      showErrorToast("No se pudo copiar al portapapeles")
    }
  }

  const handleDownloadExport = (scope: PlanExportScope) => {
    if (!plan) return
    downloadPlanFile(
      buildPlanMarkdown(plan, scope),
      planExportFilename(plan, scope),
    )
    showSuccessToast(
      scope === "current"
        ? "Semana actual descargada (.md)"
        : "Plan descargado (.md)",
    )
  }

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (query.isError || !plan) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-lg font-semibold">No se pudo cargar el plan</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => query.refetch()}
          >
            Reintentar
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/routines">
              <ArrowLeft className="mr-2 size-4" /> Volver a rutinas
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const planStatus = PLAN_STATUS_META[plan.status]

  // Filter phases if selectedPhaseId is set
  const filteredPhases = selectedPhaseId
    ? phases.filter((p) => p.id === selectedPhaseId)
    : phases

  return (
    <div className="flex flex-col gap-5">
      {/* Top Bar Navigation & Actions */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Volver a rutinas"
              className="size-11 sm:size-10"
              asChild
            >
              <Link to="/routines">
                <ArrowLeft className="size-5" />
              </Link>
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="truncate text-2xl font-display font-black tracking-tight">
                  {plan.name}
                </h1>

                {/* Interactive Status Changer */}
                <Select
                  value={plan.status}
                  onValueChange={(val: PlanStatus) =>
                    updateStatusMutation.mutate(val)
                  }
                  disabled={updateStatusMutation.isPending}
                >
                  <SelectTrigger
                    className={cn(
                      "w-auto h-11 sm:h-7 px-3 gap-1.5 border font-extrabold text-xs rounded-full shadow-xs cursor-pointer hover:brightness-105 transition-all",
                      planStatus.className,
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="active"
                      className="font-bold text-primary"
                    >
                      Activo (En curso)
                    </SelectItem>
                    <SelectItem
                      value="planned"
                      className="font-bold text-primary"
                    >
                      Pausado / Planificado
                    </SelectItem>
                    <SelectItem
                      value="completed"
                      className="font-bold text-primary"
                    >
                      Finalizado (Concluido)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="truncate text-xs text-muted-foreground mt-0.5">
                {plan.goal ? `${formatObjectiveText(plan.goal)} · ` : ""}
                {formatDateRange(plan.start_date, plan.end_date)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 sm:h-9"
                >
                  <Download className="mr-2 size-4" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 bg-card border-border text-muted-foreground"
              >
                <DropdownMenuLabel className="text-foreground">
                  Plan completo
                </DropdownMenuLabel>
                <DropdownMenuItem
                  className="cursor-pointer hover:bg-surface-container-high hover:text-foreground focus:bg-surface-container-high focus:text-foreground"
                  onClick={() => handleCopyExport("full")}
                >
                  <Copy className="mr-2 size-4" /> Copiar Markdown
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer hover:bg-surface-container-high hover:text-foreground focus:bg-surface-container-high focus:text-foreground"
                  onClick={() => handleDownloadExport("full")}
                >
                  <FileDown className="mr-2 size-4" /> Descargar .md
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuLabel className="text-foreground">
                  Semana actual
                </DropdownMenuLabel>
                <DropdownMenuItem
                  className="cursor-pointer hover:bg-surface-container-high hover:text-foreground focus:bg-surface-container-high focus:text-foreground"
                  onClick={() => handleCopyExport("current")}
                >
                  <Copy className="mr-2 size-4" /> Copiar Markdown
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer hover:bg-surface-container-high hover:text-foreground focus:bg-surface-container-high focus:text-foreground"
                  onClick={() => handleDownloadExport("current")}
                >
                  <FileDown className="mr-2 size-4" /> Descargar .md
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 sm:h-9"
              asChild
            >
              <Link to="/routines/run/new" search={{ edit: planId }}>
                <Pencil className="mr-2 size-4" /> Editar plan
              </Link>
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-11 sm:h-9"
              disabled={deletePlan.isPending}
              onClick={handleDelete}
            >
              <Trash2 className="mr-2 size-4" /> Eliminar
            </Button>
          </div>
        </div>

        {plan.race_id && (
          <Badge
            variant="outline"
            asChild
            className="w-fit gap-1.5 border-domain-cardio/30 bg-domain-cardio/10 px-3 py-1 text-domain-cardio hover:bg-domain-cardio/15"
          >
            <Link to="/races/$raceId" params={{ raceId: plan.race_id }}>
              <Flag className="size-3.5" />
              <span className="font-semibold">Carrera Objetivo:</span>
              <span>{raceQuery.data?.event_name ?? "Ver evento"}</span>
            </Link>
          </Badge>
        )}
      </div>

      {/* Progress & Target Time Hero Card */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/80 p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          {/* Progress bar */}
          <div className="flex max-w-md flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground">
                Progreso General
              </span>
              <span className="font-display font-bold text-primary tabular-nums">
                {hasStarted
                  ? `${progress.percent}% completado`
                  : "Aún no empezaste"}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Progreso general del plan"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent}
              className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high"
            >
              <div className="flex h-full">
                <div
                  className="h-full rounded-l-full bg-gradient-to-r from-primary/70 to-primary transition-[width] duration-500"
                  style={{
                    width: `${(progress.completed / (progress.total || 1)) * 100}%`,
                  }}
                />
                <div
                  className="h-full bg-destructive/70 transition-[width] duration-500"
                  style={{
                    width: `${(progress.missed / (progress.total || 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Target Race Time / Pace — tonos planos, sin chips anidados */}
          {(plan.target_time_seconds || plan.target_pace_seconds_per_km) && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {plan.target_time_seconds && (
                <div className="flex items-center gap-2.5">
                  <Timer className="size-4 shrink-0 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground">
                      Tiempo Objetivo
                    </span>
                    <span className="text-lg font-display font-black leading-tight text-primary tabular-nums">
                      {formatDuration(plan.target_time_seconds)}
                    </span>
                  </div>
                </div>
              )}
              {plan.target_time_seconds && plan.target_pace_seconds_per_km && (
                <div className="hidden h-9 w-px bg-border sm:block" />
              )}
              {plan.target_pace_seconds_per_km && (
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="size-4 shrink-0 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground">
                      Ritmo Objetivo
                    </span>
                    <span className="text-lg font-display font-black leading-tight text-white tabular-nums">
                      {formatPace(plan.target_pace_seconds_per_km)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Stats — una sola superficie, sin chips anidados */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatChip label="Semanas" value={summary.weeks} icon={CalendarDays} />
          <StatChip
            label="Sesiones total"
            value={summary.sessions}
            icon={Footprints}
          />
          <StatChip
            label="Km planificados"
            value={formatDistance(summary.plannedKm)}
            icon={TrendingUp}
          />
          {hasStarted ? (
            <>
              <StatChip
                label="Completadas"
                value={progress.completed}
                className="text-primary"
              />
              <StatChip
                label="Perdidas"
                value={progress.missed}
                className="text-destructive"
              />
              <StatChip
                label="Pendientes"
                value={progress.planned}
                className="text-muted-foreground"
              />
            </>
          ) : (
            <div className="col-span-2 flex items-center gap-2 sm:col-span-3 lg:col-span-3">
              <span className="font-display text-base font-black text-primary tabular-nums">
                0 / {progress.total}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                sesiones completadas · Aún no empezaste
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Mode switcher: Vista Limpia (Paccer) vs Vista Completa */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "paccer" ? "default" : "outline"}
            onClick={() => setViewMode("paccer")}
            className={`rounded-xl text-xs font-bold ${
              viewMode === "paccer"
                ? "bg-primary text-black font-extrabold shadow-sm"
                : "text-zinc-400"
            }`}
          >
            Vista Semanal
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "expanded" ? "default" : "outline"}
            onClick={() => setViewMode("expanded")}
            className={`rounded-xl text-xs font-bold ${
              viewMode === "expanded"
                ? "bg-primary text-black font-extrabold shadow-sm"
                : "text-zinc-400"
            }`}
          >
            Vista Completa (Todas las fases)
          </Button>
        </div>
      </div>

      {viewMode === "paccer" ? (
        /* PACCER VIEW (Imágenes 8, 9, 10) */
        <div className="space-y-6">
          {/* 1. Selector Horizontal de Semanas (Image 8) */}
          <WeekCarouselStrip
            weeks={Array.from({ length: summary.weeks || 12 }).map((_, idx) => {
              const num = idx + 1
              return {
                number: num,
                isCurrent: currentWeek?.weekNumber === num,
                isCompleted: currentWeek?.weekNumber ? num < currentWeek.weekNumber : false,
              }
            })}
            selectedWeek={selectedWeekNumber}
            onSelectWeek={setSelectedWeekNumber}
          />

          {/* 2. Lista de Sesiones de la Semana Seleccionada */}
          {(() => {
            // Encontrar la semana y sus sesiones
            let activeWeekData: any = null
            let activePhaseData: any = null
            for (const p of phases) {
              const w = (p.weeks ?? []).find((wk) => wk.number === selectedWeekNumber)
              if (w) {
                activeWeekData = w
                activePhaseData = p
                break
              }
            }

            const workouts = activeWeekData?.workouts ?? []

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-display font-black text-white">
                      Semana {selectedWeekNumber}
                    </h3>
                    {activePhaseData && (
                      <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                        {activePhaseData.name}
                      </span>
                    )}
                  </div>
                  {activeWeekData?.target_volume_km && (
                    <span className="text-xs font-semibold text-zinc-400">
                      Volumen: {activeWeekData.target_volume_km} km
                    </span>
                  )}
                </div>

                {workouts.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-[#121214] border border-white/5 text-center">
                    <p className="text-sm font-bold text-zinc-400">
                      No hay entrenamientos programados para esta semana.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workouts.map((workout: RunningWorkoutPublic) => (
                      <PaccerSessionCard
                        key={workout.id}
                        workout={workout}
                        onClick={() => {
                          setSelected({
                            workout,
                            phaseName: activePhaseData?.name || "Fase",
                            weekNumber: selectedWeekNumber,
                          })
                          setPaccerSheetOpen(true)
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      ) : (
        /* EXPANDED VIEW */
        <>
          {/* Phase Timeline & Filter Navigator */}
          <PhaseTimeline
            phases={phases}
            selectedPhaseId={selectedPhaseId}
            onSelectPhase={setSelectedPhaseId}
            currentWeekNumber={currentWeek?.weekNumber}
          />

          {/* Plan Phases & Weeks Container */}
          <div className="flex flex-col gap-5">
            {filteredPhases.map((phase) => {
              const phaseColor =
                PHASE_COLORS[phase.color as PhaseColor] ?? PHASE_COLORS.slate
              return (
                <section key={phase.id} className="flex flex-col gap-3">
                  <div className="flex items-start gap-3 px-0.5">
                    <div
                      className={cn(
                        "w-1.5 self-stretch rounded-full",
                        phaseColor.bar,
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-bold text-base text-white">
                          {phase.name}
                        </h3>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "shrink-0 text-[11px] font-semibold",
                            phaseColor.badge,
                          )}
                        >
                          Semanas {phase.start_week}–{phase.end_week}
                        </Badge>
                      </div>
                      {phase.objective && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatObjectiveText(phase.objective)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Weeks List */}
                  <div className="flex flex-col gap-3">
                    {(phase.weeks ?? []).map((week) => {
                      const isCollapsed = collapsed.has(week.id)
                      const workouts = week.workouts ?? []
                      const isCurrentWeek = currentWeek?.weekId === week.id

                      return (
                        <div
                          key={week.id}
                          ref={(el) => {
                            if (el) weekRefs.current.set(week.id, el)
                            else weekRefs.current.delete(week.id)
                          }}
                          className={cn(
                            "rounded-xl border border-border bg-card/80 transition-colors duration-200 overflow-hidden shadow-md scroll-mt-24",
                            isCurrentWeek &&
                              "ring-2 ring-primary border-primary/50 shadow-card",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => toggleWeek(week.id)}
                            aria-expanded={!isCollapsed}
                            aria-controls={`week-panel-${week.id}`}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-high/60"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {isCollapsed ? (
                                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                              )}
                              <div className="flex flex-wrap items-center gap-2 min-w-0">
                                <span className="font-display font-bold text-sm text-white">
                                  Semana {week.number}
                                </span>
                                {week.name &&
                                  week.name !== `Semana ${week.number}` && (
                                    <span className="truncate text-xs text-muted-foreground font-medium">
                                      · {week.name}
                                    </span>
                                  )}
                                {isCurrentWeek && (
                                  <Badge className="bg-primary text-primary-foreground text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md">
                                    Semana Actual
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                              {formatDateRange(week.start_date, week.end_date)}
                              {workouts.length > 0 &&
                                ` · ${workouts.length} sesiones`}
                            </span>
                          </button>

                          {!isCollapsed && (
                            <section
                              id={`week-panel-${week.id}`}
                              aria-label={`Semana ${week.number}`}
                              className="flex flex-col gap-3 border-t border-border p-4 bg-surface-container-lowest/40"
                            >
                              {week.objective && (
                                <p className="text-xs text-muted-foreground font-medium italic">
                                  Objetivo: {formatObjectiveText(week.objective)}
                                </p>
                              )}

                              {workouts.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2">
                                  Sin sesiones en esta semana.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {workouts.map((workout) => (
                                    <WeekSessionCard
                                      key={workout.id}
                                      workout={workout}
                                      onClick={() =>
                                        setSelected({
                                          workout,
                                          phaseName: phase.name,
                                          weekNumber: week.number,
                                        })
                                      }
                                    />
                                  ))}
                                </div>
                              )}
                            </section>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </>
      )}

      {/* Paccer Bottom Sheet Drawer (Images 9, 10) */}
      <PaccerWorkoutSheet
        open={paccerSheetOpen}
        onOpenChange={setPaccerSheetOpen}
        workout={selected?.workout ?? null}
        phaseName={selected?.phaseName}
        weekNumber={selected?.weekNumber}
      />

      {/* Slide-out Session Detail Drawer para edición avanzada */}
      {selected && !paccerSheetOpen && (
        <WorkoutBlocksDrawer
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null)
          }}
          planId={planId}
          workout={selected.workout}
          phaseName={selected.phaseName}
          weekNumber={selected.weekNumber}
        />
      )}
    </div>
  )
}

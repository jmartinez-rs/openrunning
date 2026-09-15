import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  CalendarDays,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
} from "lucide-react"

import {
  ApiError,
  RunningPlansService,
  type RunningWorkoutPublic,
  type WorkoutBlockPublic,
} from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"
import {
  BLOCK_TYPE_META,
  blocksDistanceKm,
  buildBlockPreview,
  formatDistance,
  formatDuration,
  formatPace,
  formatShortDate,
  WORKOUT_STATUS_META,
  WORKOUT_TYPE_META,
} from "./running-utils"

type MatchedActivity = {
  activity_id?: string
  name?: string | null
  distance_meters?: number | null
  duration_seconds?: number | null
}

type StatusOption = "auto" | "completed" | "missed" | "cancelled"

function formatBlockDistance(meters: number | null | undefined): string {
  if (meters == null) return "—"
  if (meters >= 1000) return formatDistance(meters / 1000)
  return `${Math.round(meters)} m`
}

function formatPaceRange(block: WorkoutBlockPublic): string {
  const start = block.pace_seconds_per_km
  if (start == null) return "—"
  const a = formatPace(start).replace("/km", "")
  const end = block.pace_range_end_seconds_per_km
  if (end == null) return a
  return `${a}–${formatPace(end).replace("/km", "")}`
}

function formatRecovery(block: WorkoutBlockPublic): string {
  if (block.recovery_seconds == null || block.recovery_seconds <= 0) return "—"
  const mins = block.recovery_seconds / 60
  const rec = mins % 1 === 0 ? `${mins}'` : `${mins.toFixed(1)}'`
  const tipo =
    block.recovery_type === "jog"
      ? " trotando"
      : block.recovery_type === "walk"
        ? " caminando"
        : ""
  return `${rec}${tipo}`
}

export function WorkoutBlocksDrawer({
  open,
  onOpenChange,
  planId,
  workout,
  phaseName,
  weekNumber,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  workout: RunningWorkoutPublic
  phaseName?: string
  weekNumber?: number
}) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const typeMeta = WORKOUT_TYPE_META[workout.type]
  const statusMeta = WORKOUT_STATUS_META[workout.status]
  const matched = workout.matched_activity as MatchedActivity | null
  const blocks = workout.blocks ?? []

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["running-plan", planId] })
    queryClient.invalidateQueries({ queryKey: ["running-plans"] })
  }

  const duplicateMutation = useMutation({
    mutationFn: () =>
      RunningPlansService.duplicateWorkout({
        planId,
        workoutId: workout.id,
      }),
    onSuccess: () => {
      showSuccessToast("Sesión duplicada (fecha +7 días)")
      invalidate()
      onOpenChange(false)
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        showErrorToast(
          "Ya existe una sesión ese día. Movela o elegí otra fecha al duplicar.",
        )
      } else {
        handleError.call(showErrorToast, err as ApiError)
      }
    },
  })

  const statusMutation = useMutation({
    mutationFn: (value: StatusOption) =>
      RunningPlansService.updateWorkout({
        planId,
        workoutId: workout.id,
        requestBody:
          value === "auto"
            ? { status_override: null, cancelled: false }
            : value === "cancelled"
              ? { status_override: null, cancelled: true }
              : { status_override: value, cancelled: false },
      }),
    onSuccess: () => {
      showSuccessToast("Estado actualizado")
      invalidate()
    },
    onError: handleError.bind(showErrorToast),
  })

  const currentValue: StatusOption = workout.cancelled
    ? "cancelled"
    : (workout.status_override ?? "auto")

  const summaryDistance =
    workout.distance_km != null ? workout.distance_km : blocksDistanceKm(blocks)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2 pr-6">
            <span
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-full text-sm",
                typeMeta.badgeClass,
              )}
            >
              {typeMeta.emoji}
            </span>
            <span className="truncate">
              {typeMeta.label} ·{" "}
              {workout.name ??
                workout.objective ??
                WORKOUT_TYPE_META[workout.type].label}
            </span>
          </SheetTitle>
          <div className="pr-6 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" />
                {formatShortDate(workout.date)}
              </span>
              <Badge
                variant={statusMeta.variant}
                className={statusMeta.className}
              >
                {statusMeta.label}
              </Badge>
              {workout.status_override != null ? (
                <Badge variant="outline" className="text-muted-foreground">
                  Estado manual
                </Badge>
              ) : null}
            </div>
            {phaseName ? (
              <span className="mt-1 block">
                Fase {phaseName}
                {weekNumber ? ` · Semana ${weekNumber}` : ""}
              </span>
            ) : null}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-4">
            {workout.objective ? (
              <div className="flex flex-col gap-1">
                <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Objetivo
                </h4>
                <p className="text-sm font-medium">{workout.objective}</p>
              </div>
            ) : null}

            {workout.description ? (
              <div className="flex flex-col gap-1">
                <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Descripción
                </h4>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {workout.description}
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">Distancia</p>
                <p className="text-sm font-semibold">
                  {formatDistance(summaryDistance)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">Duración</p>
                <p className="text-sm font-semibold">
                  {formatDuration(workout.duration_seconds)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">Ritmo</p>
                <p className="text-sm font-semibold">
                  {formatPace(workout.pace_seconds_per_km)}
                </p>
              </div>
            </div>

            {blocks.length > 0 ? (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">Estructura</h3>
                <div className="flex flex-col gap-2">
                  {blocks.map((block) => (
                    <div
                      key={block.id}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {BLOCK_TYPE_META[block.block_type].label}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {buildBlockPreview(block)}
                        </p>
                      </div>
                      {block.repeats > 1 ? (
                        <Badge variant="secondary">×{block.repeats}</Badge>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="-mx-1 overflow-x-auto px-1">
                  <Table className="min-w-[32rem]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bloque</TableHead>
                        <TableHead className="w-16">Reps</TableHead>
                        <TableHead>Distancia</TableHead>
                        <TableHead>Duración</TableHead>
                        <TableHead>Ritmo</TableHead>
                        <TableHead>Recuperación</TableHead>
                        <TableHead>Notas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blocks.map((block) => (
                        <TableRow key={block.id} className="hover:bg-muted/40">
                          <TableCell className="font-medium">
                            {BLOCK_TYPE_META[block.block_type].label}
                          </TableCell>
                          <TableCell>{block.repeats}</TableCell>
                          <TableCell>
                            {formatBlockDistance(block.distance_m)}
                          </TableCell>
                          <TableCell>
                            {formatDuration(block.duration_seconds)}
                          </TableCell>
                          <TableCell>{formatPaceRange(block)}</TableCell>
                          <TableCell>{formatRecovery(block)}</TableCell>
                          <TableCell>{block.notes ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {workout.status === "completed" && matched ? (
              <div className="flex flex-col gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                  <CheckCircle2 className="size-4" />
                  Completada con Strava
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {matched.name ?? "Actividad"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistance((matched.distance_meters ?? 0) / 1000)} ·{" "}
                    {formatDuration(matched.duration_seconds)}
                  </p>
                </div>
                {matched.activity_id ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1 w-fit"
                    asChild
                  >
                    <Link
                      to="/activities/$activityId"
                      params={{ activityId: matched.activity_id }}
                    >
                      <ExternalLink className="mr-2 size-3.5" /> Ver actividad
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <SheetFooter className="border-t p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Label
                htmlFor="workout-status"
                className="shrink-0 text-sm font-medium"
              >
                Estado
              </Label>
              <Select
                value={currentValue}
                disabled={statusMutation.isPending}
                onValueChange={(value) =>
                  statusMutation.mutate(value as StatusOption)
                }
              >
                <SelectTrigger id="workout-status" className="min-w-0 flex-1">
                  {statusMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático</SelectItem>
                  <SelectItem value="completed">
                    {WORKOUT_STATUS_META.completed.label}
                  </SelectItem>
                  <SelectItem value="missed">
                    {WORKOUT_STATUS_META.missed.label}
                  </SelectItem>
                  <SelectItem value="cancelled">
                    {WORKOUT_STATUS_META.cancelled.label}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              disabled={duplicateMutation.isPending}
              onClick={() => duplicateMutation.mutate()}
            >
              {duplicateMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Copy className="mr-2 size-4" />
              )}
              Duplicar sesión
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

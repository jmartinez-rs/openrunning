import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import { type RoutinePublic, RoutinesService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import type { GymExercise, RunBlock } from "./routine-types"

interface RoutineFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routineType: "gym" | "run"
  routine?: RoutinePublic | null
}

export function RoutineFormDialog({
  open,
  onOpenChange,
  routineType,
  routine,
}: RoutineFormDialogProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [name, setName] = useState(routine?.name ?? "")
  const [description, setDescription] = useState(routine?.description ?? "")
  const [exercises, setExercises] = useState<GymExercise[]>(() => {
    if (routineType !== "gym") return []
    const data = (routine?.routine_data ?? {}) as { exercises?: GymExercise[] }
    return data.exercises?.length ? data.exercises : [{ title: "" }]
  })
  const [blocks, setBlocks] = useState<RunBlock[]>(() => {
    if (routineType !== "run") return []
    const data = (routine?.routine_data ?? {}) as { blocks?: RunBlock[] }
    return data.blocks?.length
      ? data.blocks
      : [
          {
            label: "Serie principal",
            intervals: [
              { repeats: 1, type: "distance", value: 400, unit: "m" },
            ],
          },
        ]
  })

  const mutation = useMutation({
    mutationFn: () => {
      const routineData =
        routineType === "gym"
          ? { exercises: exercises.filter((e) => e.title.trim()) }
          : { blocks }
      if (routine) {
        return RoutinesService.updateRoutine({
          routineId: routine.id,
          requestBody: {
            name,
            description: description || null,
            routine_data: routineData,
          },
        })
      }
      return RoutinesService.createRoutine({
        requestBody: {
          type: routineType,
          name,
          description: description || null,
          routine_data: routineData,
        },
      })
    },
    onSuccess: () => {
      showSuccessToast(routine ? "Rutina actualizada" : "Rutina creada")
      queryClient.invalidateQueries({ queryKey: ["routines"] })
      onOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
  })

  const updateExercise = (index: number, patch: Partial<GymExercise>) => {
    setExercises((prev) =>
      prev.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    )
  }

  const updateInterval = (
    blockIndex: number,
    intervalIndex: number,
    patch: Partial<RunBlock["intervals"][number]>,
  ) => {
    setBlocks((prev) =>
      prev.map((block, bi) =>
        bi === blockIndex
          ? {
              ...block,
              intervals: block.intervals.map((interval, ii) =>
                ii === intervalIndex ? { ...interval, ...patch } : interval,
              ),
            }
          : block,
      ),
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {routine ? "Editar rutina" : "Nueva rutina"}
          </DialogTitle>
          <DialogDescription>
            {routineType === "gym"
              ? "Rutina de fuerza con ejercicios y series objetivo."
              : "Estructura de pasadas con bloques e intervalos."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="routine-name">Nombre</Label>
            <Input
              id="routine-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Push A"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="routine-desc">Descripción</Label>
            <textarea
              id="routine-desc"
              className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          {routineType === "gym" ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label>Ejercicios</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setExercises((prev) => [...prev, { title: "" }])
                  }
                >
                  <Plus className="mr-1 size-3" /> Agregar
                </Button>
              </div>
              {exercises.map((exercise, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={exercise.title}
                    onChange={(e) =>
                      updateExercise(index, { title: e.target.value })
                    }
                    placeholder="Nombre del ejercicio"
                  />
                  <Input
                    type="number"
                    className="w-20"
                    value={exercise.target_sets ?? ""}
                    onChange={(e) =>
                      updateExercise(index, {
                        target_sets: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="Series"
                  />
                  <Input
                    type="number"
                    className="w-20"
                    value={exercise.target_reps ?? ""}
                    onChange={(e) =>
                      updateExercise(index, {
                        target_reps: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="Reps"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setExercises((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {blocks.map((block, blockIndex) => (
                <div key={blockIndex} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      value={block.label}
                      onChange={(e) =>
                        setBlocks((prev) =>
                          prev.map((b, bi) =>
                            bi === blockIndex
                              ? { ...b, label: e.target.value }
                              : b,
                          ),
                        )
                      }
                      placeholder="Etiqueta del bloque (ej: Entrada en calor)"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setBlocks((prev) =>
                          prev.filter((_, i) => i !== blockIndex),
                        )
                      }
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                  {block.intervals.map((interval, intervalIndex) => (
                    <div
                      key={intervalIndex}
                      className="mt-3 grid grid-cols-6 gap-2"
                    >
                      <Input
                        type="number"
                        className="col-span-1"
                        value={interval.repeats}
                        onChange={(e) =>
                          updateInterval(blockIndex, intervalIndex, {
                            repeats: Number(e.target.value) || 1,
                          })
                        }
                        placeholder="x"
                      />
                      <Input
                        className="col-span-2"
                        value={interval.value}
                        onChange={(e) =>
                          updateInterval(blockIndex, intervalIndex, {
                            value: Number(e.target.value) || 0,
                          })
                        }
                        placeholder={
                          interval.type === "distance" ? "Metros" : "Minutos"
                        }
                      />
                      <select
                        className="col-span-1 rounded-md border bg-background px-2 text-sm"
                        value={interval.type}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                          updateInterval(blockIndex, intervalIndex, {
                            type: e.target.value as "distance" | "time",
                          })
                        }
                      >
                        <option value="distance">distancia</option>
                        <option value="time">tiempo</option>
                      </select>
                      <Input
                        className="col-span-2"
                        value={interval.rest_seconds ?? ""}
                        onChange={(e) =>
                          updateInterval(blockIndex, intervalIndex, {
                            rest_seconds: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                        placeholder="Descanso (s)"
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() =>
                      setBlocks((prev) =>
                        prev.map((b, bi) =>
                          bi === blockIndex
                            ? {
                                ...b,
                                intervals: [
                                  ...b.intervals,
                                  {
                                    repeats: 1,
                                    type: "distance",
                                    value: 400,
                                    unit: "m",
                                  },
                                ],
                              }
                            : b,
                        ),
                      )
                    }
                  >
                    <Plus className="mr-1 size-3" /> Intervalo
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setBlocks((prev) => [
                    ...prev,
                    {
                      label: "",
                      intervals: [
                        { repeats: 1, type: "distance", value: 400, unit: "m" },
                      ],
                    },
                  ])
                }
              >
                <Plus className="mr-1 size-3" /> Agregar bloque
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!name.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  Footprints,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react"
import { useState } from "react"

import {
  type RoutinePublic,
  RoutinesService,
  RunningPlansService,
} from "@/client"
import { RoutineCard } from "@/components/Routines/RoutineCard"
import { RoutineFormDialog } from "@/components/Routines/RoutineFormDialog"
import { RunningPlanCard } from "@/components/RunningPlans/RunningPlanCard"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/routines/")({
  component: Routines,
  head: () => ({ meta: [{ title: "Planes de Running - OpenRunning" }] }),
})

function FolderDialog({
  open,
  onOpenChange,
  initialName,
  onSave,
  saving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName?: string
  onSave: (name: string) => void
  saving: boolean
}) {
  const [name, setName] = useState(initialName ?? "")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initialName ? "Renombrar carpeta" : "Nueva carpeta"}
          </DialogTitle>
          <DialogDescription>
            Agrupá tus rutinas en carpetas para organizar tu entrenamiento
            actual.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="folder-name">Nombre</Label>
          <Input
            id="folder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Rutina nueva"
          />
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
            disabled={!name.trim() || saving}
            onClick={() => onSave(name.trim())}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Routines() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [tab, setTab] = useState<"gym" | "run">("run")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<{
    type: "gym" | "run"
    id: string
  } | null>(null)
  const [folderDialog, setFolderDialog] = useState<{
    open: boolean
    folderId?: string
    initialName?: string
  }>({ open: false })
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleCollapsed = (folderId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  const query = useQuery({
    queryKey: ["routines", tab],
    queryFn: () => RoutinesService.readRoutines({ type: tab }),
    enabled: tab === "gym",
  })

  const plansQuery = useQuery({
    queryKey: ["running-plans"],
    queryFn: () => RunningPlansService.readPlans(),
    enabled: tab === "run",
  })

  const plans = plansQuery.data?.data ?? []

  const foldersQuery = useQuery({
    queryKey: ["routines-folders", tab],
    queryFn: () => RoutinesService.readFolders(),
    enabled: tab === "gym",
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["routines"] })
    queryClient.invalidateQueries({ queryKey: ["routines-folders"] })
  }

  const deleteRoutine = useMutation({
    mutationFn: (id: string) =>
      RoutinesService.deleteRoutine({ routineId: id }),
    onSuccess: () => {
      showSuccessToast("Rutina eliminada")
      invalidate()
    },
    onError: handleError.bind(showErrorToast),
  })

  const deleteRunPlan = useMutation({
    mutationFn: (id: string) => RunningPlansService.deletePlan({ planId: id }),
    onSuccess: () => {
      showSuccessToast("Plan eliminado")
      queryClient.invalidateQueries({ queryKey: ["running-plans"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const createFolder = useMutation({
    mutationFn: (name: string) =>
      RoutinesService.createFolder({ requestBody: { name } }),
    onSuccess: () => {
      showSuccessToast("Carpeta creada")
      setFolderDialog({ open: false })
      invalidate()
    },
    onError: handleError.bind(showErrorToast),
  })

  const renameFolder = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      RoutinesService.renameFolder({ folderId: id, requestBody: { name } }),
    onSuccess: () => {
      showSuccessToast("Carpeta renombrada")
      setFolderDialog({ open: false })
      invalidate()
    },
    onError: handleError.bind(showErrorToast),
  })

  const deleteFolder = useMutation({
    mutationFn: (id: string) => RoutinesService.deleteFolder({ folderId: id }),
    onSuccess: () => {
      showSuccessToast("Carpeta eliminada")
      invalidate()
    },
    onError: handleError.bind(showErrorToast),
  })

  const setPrimaryFolder = useMutation({
    mutationFn: (id: string) =>
      RoutinesService.setPrimaryFolder({ folderId: id }),
    onSuccess: () => {
      showSuccessToast("Carpeta principal actualizada")
      invalidate()
    },
    onError: handleError.bind(showErrorToast),
  })

  const clearPrimaryFolder = useMutation({
    mutationFn: (id: string) =>
      RoutinesService.clearPrimaryFolder({ folderId: id }),
    onSuccess: () => {
      showSuccessToast("Carpeta principal eliminada")
      invalidate()
    },
    onError: handleError.bind(showErrorToast),
  })

  const assignFolder = useMutation({
    mutationFn: ({
      routineId,
      folderId,
    }: {
      routineId: string
      folderId: string | null
    }) =>
      RoutinesService.assignRoutineFolder({
        routineId,
        requestBody: { folder_id: folderId },
      }),
    onSuccess: () => invalidate(),
    onError: handleError.bind(showErrorToast),
  })

  const routines = query.data?.data ?? []
  const folders = (
    tab === "gym" ? (foldersQuery.data?.data ?? []) : []
  ) as Array<{
    id: string
    name: string
    is_primary?: boolean
    routines?: RoutinePublic[]
  }>

  const unassigned = routines.filter((routine) => !routine.folder_id)
  const routineGroups = folders.map((folder) => ({
    folder,
    routines: (folder.routines ?? []).filter((r) => r.type === tab),
  }))

  const folderSaving = createFolder.isPending || renameFolder.isPending

  const folderSelect = (routine: RoutinePublic) => (
    <select
      className="rounded-md border bg-background px-2 py-1 text-xs"
      value={routine.folder_id ?? ""}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const folderId = e.target.value || null
        assignFolder.mutate({ routineId: routine.id, folderId })
      }}
    >
      <option value="">Sin carpeta</option>
      {folders.map((folder) => (
        <option key={folder.id} value={folder.id}>
          {folder.name}
        </option>
      ))}
    </select>
  )

  const actionsFor = (routine: RoutinePublic) => (
    <div className="absolute right-3 top-3 z-10 hidden items-center gap-1 group-hover:flex">
      {folderSelect(routine)}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={(event) => {
          event.preventDefault()
          setEditing({ type: tab, id: routine.id })
          setFormOpen(true)
        }}
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={deleteRoutine.isPending}
        onClick={(event) => {
          event.preventDefault()
          deleteRoutine.mutate(routine.id)
        }}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  )

  const renderRoutines = (items: RoutinePublic[]) => (
    <div className="flex flex-col gap-3">
      {items.map((routine) => (
        <div className="group relative" key={routine.id}>
          <RoutineCard routine={routine} />
          {actionsFor(routine)}
        </div>
      ))}
    </div>
  )

  return (
    <div className="col-span-12 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-lg text-primary">Rutinas</h1>
          <p className="text-body-md text-on-surface-variant">
            {tab === "run"
              ? "Tus planes de running con fases, semanas y sesiones."
              : "Tu biblioteca de entrenamientos planificados, organizada por carpetas."}
          </p>
        </div>
        <div className="flex gap-2">
          {tab === "gym" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setFolderDialog({ open: true })}
            >
              <FolderPlus className="mr-2 size-4" /> Nueva carpeta
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => {
              if (tab === "run") {
                navigate({ to: "/routines/run/new" })
              } else {
                setFormOpen(true)
              }
            }}
          >
            <Plus className="mr-2 size-4" />{" "}
            {tab === "run" ? "Nuevo plan" : "Nueva rutina"}
          </Button>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as "gym" | "run")}
      >
        <TabsList>
          <TabsTrigger value="run">Running</TabsTrigger>
          <TabsTrigger value="gym">Gimnasio</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="pt-4">
          {tab === "run" ? (
            plansQuery.isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton className="h-28 w-full" key={index} />
                ))}
              </div>
            ) : plans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 rounded-full bg-domain-cardio/10 p-4 text-domain-cardio">
                  <Footprints className="size-8" />
                </div>
                <h3 className="text-lg font-semibold">
                  No hay planes de running
                </h3>
                <p className="text-body-md text-on-surface-variant">
                  Creá tu primer plan para organizar tu temporada.
                </p>
                <Button
                  type="button"
                  className="mt-4"
                  onClick={() => navigate({ to: "/routines/run/new" })}
                >
                  <Plus className="mr-2 size-4" /> Crear plan
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {plans.map((plan) => (
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
            )
          ) : query.isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton className="h-24 w-full" key={index} />
              ))}
            </div>
          ) : routines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-full bg-surface-container-low p-4">
                <Search className="size-8 text-on-surface-variant" />
              </div>
              <h3 className="text-lg font-semibold">
                No hay rutinas de gimnasio
              </h3>
              <p className="text-body-md text-on-surface-variant">
                Creá tu primera rutina para empezar.
              </p>
              <Button
                type="button"
                className="mt-4"
                onClick={() => setFormOpen(true)}
              >
                <Plus className="mr-2 size-4" /> Crear rutina
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {routineGroups.map(({ folder, routines: groupRoutines }) => {
                const isCollapsed = collapsed.has(folder.id)
                return (
                  <section key={folder.id} className="flex flex-col gap-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="flex flex-1 items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-accent"
                        onClick={() => toggleCollapsed(folder.id)}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                        <Folder
                          className={`size-4 ${folder.is_primary ? "text-domain-race" : "text-muted-foreground"}`}
                        />
                        <h2 className="font-semibold">{folder.name}</h2>
                        {folder.is_primary ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-domain-race/10 px-2 py-0.5 text-label-sm text-domain-race">
                            <Star className="size-3" fill="currentColor" />
                            Principal
                          </span>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          ({groupRoutines.length})
                        </span>
                      </button>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={
                            folder.is_primary
                              ? "Quitar carpeta principal"
                              : "Definir como carpeta principal"
                          }
                          title={
                            folder.is_primary
                              ? "Quitar carpeta principal"
                              : "Definir como carpeta principal"
                          }
                          disabled={
                            setPrimaryFolder.isPending ||
                            clearPrimaryFolder.isPending
                          }
                          className={
                            folder.is_primary ? "text-domain-race" : ""
                          }
                          onClick={() => {
                            if (folder.is_primary) {
                              clearPrimaryFolder.mutate(folder.id)
                            } else {
                              setPrimaryFolder.mutate(folder.id)
                            }
                          }}
                        >
                          <Star
                            className="size-4"
                            fill={folder.is_primary ? "currentColor" : "none"}
                          />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setFolderDialog({
                              open: true,
                              folderId: folder.id,
                              initialName: folder.name,
                            })
                          }
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={deleteFolder.isPending}
                          onClick={() => deleteFolder.mutate(folder.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {!isCollapsed ? (
                      groupRoutines.length > 0 ? (
                        renderRoutines(groupRoutines)
                      ) : (
                        <p className="rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                          Carpeta vacía
                        </p>
                      )
                    ) : null}
                  </section>
                )
              })}

              {unassigned.length > 0 ? (
                <section className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-muted-foreground">
                      Sin carpeta
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      ({unassigned.length})
                    </span>
                  </div>
                  {renderRoutines(unassigned)}
                </section>
              ) : null}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <RoutineFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        routineType={tab}
        routine={
          editing
            ? (routines.find((routine) => routine.id === editing.id) ?? null)
            : null
        }
      />

      <FolderDialog
        open={folderDialog.open}
        onOpenChange={(open) => setFolderDialog((prev) => ({ ...prev, open }))}
        initialName={folderDialog.initialName}
        saving={folderSaving}
        onSave={(name) => {
          if (folderDialog.folderId) {
            renameFolder.mutate({ id: folderDialog.folderId, name })
          } else {
            createFolder.mutate(name)
          }
        }}
      />
    </div>
  )
}

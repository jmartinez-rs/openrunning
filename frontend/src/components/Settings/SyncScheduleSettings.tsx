import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Clock, Loader2 } from "lucide-react"
import { useState } from "react"

import { SettingsService, type SyncSchedulePublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

export function SyncScheduleSettings() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const query = useQuery({
    queryKey: ["sync-schedule"],
    queryFn: () => SettingsService.readSyncSchedule(),
  })

  const [drafts, setDrafts] = useState<
    Record<string, { enabled: boolean; interval: string }>
  >({})

  const getDraft = (provider: string, schedule?: SyncSchedulePublic) => {
    const existing = drafts[provider]
    if (!existing && schedule) {
      const next = {
        enabled: schedule.enabled ?? true,
        interval: String(schedule.interval_hours ?? 24),
      }
      setDrafts((prev) => ({ ...prev, [provider]: next }))
      return next
    }
    return existing ?? { enabled: true, interval: "24" }
  }

  const mutation = useMutation({
    mutationFn: ({
      provider,
      enabled,
      interval_hours,
    }: {
      provider: string
      enabled: boolean
      interval_hours: number
    }) =>
      SettingsService.updateSyncSchedule({
        provider,
        requestBody: { enabled, interval_hours },
      }),
    onSuccess: () => {
      showSuccessToast("Sincronización automática actualizada")
      queryClient.invalidateQueries({ queryKey: ["sync-schedule"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Clock className="size-5" />
          </div>
          <div>
            <CardTitle>Sincronización automática</CardTitle>
            <CardDescription>
              Programá la sincronización periódica de Strava y Hevy.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {(query.data ?? []).map((schedule) => {
              const draft = getDraft(schedule.provider, schedule)
              return (
                <div
                  key={schedule.provider}
                  className="flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      id={`sync-${schedule.provider}`}
                      checked={draft.enabled}
                      onCheckedChange={(checked) => {
                        setDrafts((prev) => ({
                          ...prev,
                          [schedule.provider]: { ...draft, enabled: checked },
                        }))
                      }}
                    />
                    <Label
                      htmlFor={`sync-${schedule.provider}`}
                      className="capitalize"
                    >
                      {schedule.provider}
                    </Label>
                  </div>
                  {schedule.last_run_at ? (
                    <span className="text-xs text-muted-foreground">
                      Última ejecución:{" "}
                      {new Intl.DateTimeFormat("es-AR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(schedule.last_run_at))}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Sin ejecuciones aún
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={1}
                        max={168}
                        className="w-20"
                        value={draft.interval}
                        onChange={(e) => {
                          setDrafts((prev) => ({
                            ...prev,
                            [schedule.provider]: {
                              ...draft,
                              interval: e.target.value,
                            },
                          }))
                        }}
                      />
                      <span className="text-xs text-muted-foreground">
                        horas
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={mutation.isPending || !draft.enabled}
                      onClick={() =>
                        mutation.mutate({
                          provider: schedule.provider,
                          enabled: draft.enabled,
                          interval_hours: Number(draft.interval) || 24,
                        })
                      }
                    >
                      {mutation.isPending && (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      )}
                      Guardar
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

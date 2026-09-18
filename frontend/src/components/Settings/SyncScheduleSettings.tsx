import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Clock, Loader2 } from "lucide-react"
import { useState } from "react"

import { SettingsService, type SyncSchedulePublic } from "@/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { SettingsRow } from "./SettingsSection"

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

  if (query.isLoading) {
    return <Skeleton className="h-14 w-full rounded-xl bg-card/60" />
  }

  return (
    <>
      {(query.data ?? []).map((schedule) => {
        const draft = getDraft(schedule.provider, schedule)
        const providerName =
          schedule.provider.charAt(0).toUpperCase() + schedule.provider.slice(1)

        const lastRunText = schedule.last_run_at
          ? `Último sync: ${new Intl.DateTimeFormat("es-AR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(schedule.last_run_at))}`
          : "Sin ejecuciones aún"

        return (
          <SettingsRow
            key={schedule.provider}
            icon={Clock}
            iconBg="bg-primary/15"
            iconColor="text-primary"
            title={`Auto-sync ${providerName}`}
            subtitle={lastRunText}
          >
            <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={168}
                  className="w-14 h-8 rounded-xl border-border bg-background text-xs text-center text-foreground"
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
                <span className="text-xs text-muted-foreground font-medium">
                  hs
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
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
                  <Loader2 className="mr-1 size-3 animate-spin" />
                )}
                Guardar
              </Button>
            </div>
          </SettingsRow>
        )
      })}
    </>
  )
}

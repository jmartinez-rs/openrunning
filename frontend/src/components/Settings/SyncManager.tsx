import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, RefreshCw } from "lucide-react"

import { SyncService } from "@/client"
import { Button } from "@/components/ui/button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { SettingsRow } from "./SettingsSection"

export function SyncManager() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["sync-logs"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    queryClient.invalidateQueries({ queryKey: ["integration-status"] })
    queryClient.invalidateQueries({ queryKey: ["activities"] })
    queryClient.invalidateQueries({ queryKey: ["shoes"] })
    queryClient.invalidateQueries({ queryKey: ["cardio-analytics"] })
    queryClient.invalidateQueries({ queryKey: ["running-plan"] })
    queryClient.invalidateQueries({ queryKey: ["running-plans"] })
  }

  const stravaSync = useMutation({
    mutationFn: () => SyncService.triggerSync({ provider: "strava" }),
    onSuccess: (log) => {
      showSuccessToast(
        String(log.details?.message ?? "Sincronización completada"),
      )
      invalidate()
    },
    onError: handleError.bind(showErrorToast),
  })

  const hevySync = useMutation({
    mutationFn: () => SyncService.triggerSync({ provider: "hevy" }),
    onSuccess: (log) => {
      showSuccessToast(
        String(log.details?.message ?? "Sincronización completada"),
      )
      invalidate()
    },
    onError: handleError.bind(showErrorToast),
  })

  const syncing = stravaSync.isPending || hevySync.isPending

  return (
    <SettingsRow
      icon={RefreshCw}
      iconBg="bg-primary/15"
      iconColor="text-primary"
      title="Sincronizar ahora"
      subtitle="Ejecutar importación inmediata de actividades"
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={syncing}
          onClick={() => stravaSync.mutate()}
          className="h-8 rounded-xl border-border text-xs text-muted-foreground"
        >
          {stravaSync.isPending ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 size-3.5" />
          )}
          Strava
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={syncing}
          onClick={() => hevySync.mutate()}
          className="h-8 rounded-xl border-border text-xs text-muted-foreground"
        >
          {hevySync.isPending ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 size-3.5" />
          )}
          Hevy
        </Button>
      </div>
    </SettingsRow>
  )
}

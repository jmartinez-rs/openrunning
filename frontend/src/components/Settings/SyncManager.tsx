import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, RefreshCw } from "lucide-react"

import { SyncService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

export function SyncManager() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["sync-logs"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    queryClient.invalidateQueries({ queryKey: ["integration-status"] })
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
    <Card>
      <CardHeader>
        <CardTitle>Sincronización manual</CardTitle>
        <CardDescription>
          Forzá la importación de actividades desde cada proveedor.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={syncing}
          onClick={() => stravaSync.mutate()}
        >
          {stravaSync.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          Sincronizar Strava
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={syncing}
          onClick={() => hevySync.mutate()}
        >
          {hevySync.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          Sincronizar Hevy
        </Button>
      </CardContent>
    </Card>
  )
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Plug, PlugZap, Unplug } from "lucide-react"
import type { ReactNode } from "react"

import { SettingsService } from "@/client"
import { Button } from "@/components/ui/button"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"
import { SettingsRow } from "./SettingsSection"

interface IntegrationCardProps {
  provider: "strava" | "hevy"
  title: string
  description: string
  children: ReactNode
}

export function IntegrationCard({
  provider,
  title,
  description,
  children,
}: IntegrationCardProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const statusQuery = useQuery({
    queryKey: ["integration-status", provider],
    queryFn: () => SettingsService.readIntegrationStatus({ provider }),
    enabled: true,
  })

  const testMutation = useMutation({
    mutationFn: () => SettingsService.testIntegration({ provider }),
    onSuccess: (result) => {
      if (result.success) {
        showSuccessToast(result.message)
      } else {
        showErrorToast(result.message)
      }
      queryClient.invalidateQueries({
        queryKey: ["integration-status", provider],
      })
    },
    onError: handleError.bind(showErrorToast),
  })

  const disconnectMutation = useMutation({
    mutationFn: () => SettingsService.disconnectIntegration({ provider }),
    onSuccess: () => {
      showSuccessToast("Integración desconectada")
      queryClient.invalidateQueries({
        queryKey: ["integration-status", provider],
      })
    },
    onError: handleError.bind(showErrorToast),
  })

  const connected = statusQuery.data?.connected ?? false

  return (
    <div className="space-y-2">
      <SettingsRow
        icon={connected ? PlugZap : Plug}
        iconBg={connected ? "bg-primary/15" : "bg-surface-container-high/80"}
        iconColor={connected ? "text-primary" : "text-muted-foreground"}
        title={title}
        subtitle={description}
        value={
          statusQuery.isLoading ? (
            <Loader2 className="size-4 animate-spin text-on-surface-variant" />
          ) : (
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs font-semibold",
                connected
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {connected ? "Conectado" : "Desconectado"}
            </span>
          )
        }
      />

      <div className="px-4 py-3 space-y-3 bg-surface-container-lowest/40">
        {children}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={testMutation.isPending}
            onClick={() => testMutation.mutate()}
            className="rounded-xl border-border text-xs text-muted-foreground"
          >
            {testMutation.isPending && (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            )}
            Probar conexión
          </Button>
          {connected && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-xl text-xs text-destructive hover:bg-red-500/10 hover:text-destructive"
              disabled={disconnectMutation.isPending}
              onClick={() => disconnectMutation.mutate()}
            >
              <Unplug className="mr-1.5 size-3.5" />
              Desconectar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

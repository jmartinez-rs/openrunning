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
        iconBg={connected ? "bg-emerald-500/15" : "bg-slate-800/80"}
        iconColor={connected ? "text-emerald-400" : "text-slate-400"}
        title={title}
        subtitle={description}
        value={
          statusQuery.isLoading ? (
            <Loader2 className="size-4 animate-spin text-slate-500" />
          ) : (
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs font-semibold",
                connected
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-slate-800 bg-slate-900 text-slate-400",
              )}
            >
              {connected ? "Conectado" : "Desconectado"}
            </span>
          )
        }
      />

      <div className="px-4 py-3 space-y-3 bg-slate-950/40">
        {children}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={testMutation.isPending}
            onClick={() => testMutation.mutate()}
            className="rounded-xl border-slate-800 text-xs text-slate-300"
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
              className="rounded-xl text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Plug, PlugZap, Unplug } from "lucide-react"
import type { ReactNode } from "react"

import { SettingsService } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"

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
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
              {connected ? (
                <PlugZap className="size-5 text-primary" />
              ) : (
                <Plug className="size-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription className="max-w-sm">
                {description}
              </CardDescription>
            </div>
          </div>
          {statusQuery.isLoading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <Badge variant={connected ? "default" : "secondary"}>
              {connected ? "Conectado" : "Desconectado"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {children}

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={testMutation.isPending}
            onClick={() => testMutation.mutate()}
          >
            {testMutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Probar conexión
          </Button>
          {connected && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={disconnectMutation.isPending}
              onClick={() => disconnectMutation.mutate()}
            >
              <Unplug className={cn("mr-2 size-4")} />
              Desconectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

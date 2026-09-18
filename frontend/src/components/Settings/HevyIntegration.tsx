import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Dumbbell, Loader2, Unplug } from "lucide-react"
import { useState } from "react"

import { type HevyCredentialsIn, SettingsService } from "@/client"
import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/ui/password-input"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { SettingsRow } from "./SettingsSection"

export function HevyIntegration() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [apiKey, setApiKey] = useState("")

  const statusQuery = useQuery({
    queryKey: ["integration-status", "hevy"],
    queryFn: () => SettingsService.readIntegrationStatus({ provider: "hevy" }),
  })

  const saveMutation = useMutation({
    mutationFn: (data: HevyCredentialsIn) =>
      SettingsService.saveHevyCredentials({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("API key de Hevy guardada")
      queryClient.invalidateQueries({
        queryKey: ["integration-status", "hevy"],
      })
      setApiKey("")
    },
    onError: handleError.bind(showErrorToast),
  })

  const testMutation = useMutation({
    mutationFn: () => SettingsService.testIntegration({ provider: "hevy" }),
    onSuccess: (result) => {
      if (result.success) {
        showSuccessToast(result.message)
      } else {
        showErrorToast(result.message)
      }
      queryClient.invalidateQueries({
        queryKey: ["integration-status", "hevy"],
      })
    },
    onError: handleError.bind(showErrorToast),
  })

  const disconnectMutation = useMutation({
    mutationFn: () =>
      SettingsService.disconnectIntegration({ provider: "hevy" }),
    onSuccess: () => {
      showSuccessToast("Hevy desconectado")
      queryClient.invalidateQueries({
        queryKey: ["integration-status", "hevy"],
      })
    },
    onError: handleError.bind(showErrorToast),
  })

  const connected = statusQuery.data?.connected ?? false

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!apiKey) return
    saveMutation.mutate({ api_key: apiKey })
  }

  return (
    <SettingsRow
      icon={Dumbbell}
      iconBg="bg-purple-500/15"
      iconColor="text-purple-400"
      title="Hevy"
      subtitle="Sincronizar sesiones de fuerza (requiere Hevy Pro API)"
    >
      <div className="flex items-center gap-2">
        {statusQuery.isLoading ? (
          <Loader2 className="size-4 animate-spin text-on-surface-variant" />
        ) : connected ? (
          <>
            <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              Conectado
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testMutation.isPending}
              onClick={() => testMutation.mutate()}
              className="h-8 rounded-xl border-border text-xs text-muted-foreground"
            >
              {testMutation.isPending && (
                <Loader2 className="mr-1 size-3 animate-spin" />
              )}
              Probar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-xl text-xs text-destructive hover:bg-red-500/10 hover:text-destructive"
              disabled={disconnectMutation.isPending}
              onClick={() => disconnectMutation.mutate()}
            >
              <Unplug className="size-3.5" />
            </Button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
            <PasswordInput
              id="hevy-api-key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="hevy_..."
              autoComplete="off"
              className="h-8 w-36 rounded-xl border-border bg-background text-xs text-foreground"
            />
            <Button
              type="submit"
              size="sm"
              disabled={saveMutation.isPending || !apiKey}
              className="h-8 rounded-xl bg-purple-500 text-slate-950 font-semibold text-xs hover:bg-purple-400"
            >
              {saveMutation.isPending && (
                <Loader2 className="mr-1 size-3 animate-spin" />
              )}
              Conectar
            </Button>
          </form>
        )}
      </div>
    </SettingsRow>
  )
}

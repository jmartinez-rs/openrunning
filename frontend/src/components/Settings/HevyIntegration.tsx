import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"

import { type HevyCredentialsIn, SettingsService } from "@/client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { IntegrationCard } from "./IntegrationCard"

export function HevyIntegration() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [apiKey, setApiKey] = useState("")

  const mutation = useMutation({
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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    mutation.mutate({ api_key: apiKey })
  }

  return (
    <IntegrationCard
      provider="hevy"
      title="Hevy"
      description="Guardá tu API key de Hevy (requiere suscripción Pro) para sincronizar tus rutinas de fuerza."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hevy-api-key">API Key</Label>
          <PasswordInput
            id="hevy-api-key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="hevy_..."
            autoComplete="off"
          />
        </div>
        <div className="pt-1">
          <Button type="submit" disabled={mutation.isPending || !apiKey}>
            {mutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Guardar API key
          </Button>
        </div>
      </form>
    </IntegrationCard>
  )
}

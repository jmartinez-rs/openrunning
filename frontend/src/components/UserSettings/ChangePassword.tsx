import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { KeyRound, Lock, ShieldCheck } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { type UpdatePassword, UsersService } from "@/client"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { LoadingButton } from "@/components/ui/loading-button"
import { PasswordInput } from "@/components/ui/password-input"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { SettingsRow } from "../Settings/SettingsSection"

const formSchema = z
  .object({
    current_password: z
      .string()
      .min(1, { message: "La contraseña es obligatoria" })
      .min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
    new_password: z
      .string()
      .min(1, { message: "La contraseña es obligatoria" })
      .min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
    confirm_password: z
      .string()
      .min(1, { message: "La confirmación de contraseña es obligatoria" }),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Las contraseñas no coinciden",
    path: ["confirm_password"],
  })

type FormData = z.infer<typeof formSchema>

const ChangePassword = () => {
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    criteriaMode: "all",
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: UpdatePassword) =>
      UsersService.updatePasswordMe({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Contraseña actualizada correctamente")
      form.reset()
    },
    onError: handleError.bind(showErrorToast),
  })

  const onSubmit = async (data: FormData) => {
    mutation.mutate(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        <FormField
          control={form.control}
          name="current_password"
          render={({ field, fieldState }) => (
            <FormItem className="space-y-0">
              <SettingsRow
                icon={KeyRound}
                iconBg="bg-primary/15"
                iconColor="text-primary"
                title="Contraseña actual"
                subtitle="Requerida para autorizar el cambio"
              >
                <FormControl>
                  <PasswordInput
                    data-testid="current-password-input"
                    placeholder="••••••••"
                    aria-invalid={fieldState.invalid}
                    {...field}
                    className="h-8 w-44 rounded-xl border-border bg-background text-xs text-foreground"
                  />
                </FormControl>
              </SettingsRow>
              <FormMessage className="text-xs text-destructive px-4 pt-1" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="new_password"
          render={({ field, fieldState }) => (
            <FormItem className="space-y-0">
              <SettingsRow
                icon={Lock}
                iconBg="bg-primary/15"
                iconColor="text-primary"
                title="Nueva contraseña"
                subtitle="Mínimo 8 caracteres"
              >
                <FormControl>
                  <PasswordInput
                    data-testid="new-password-input"
                    placeholder="••••••••"
                    aria-invalid={fieldState.invalid}
                    {...field}
                    className="h-8 w-44 rounded-xl border-border bg-background text-xs text-foreground"
                  />
                </FormControl>
              </SettingsRow>
              <FormMessage className="text-xs text-destructive px-4 pt-1" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirm_password"
          render={({ field, fieldState }) => (
            <FormItem className="space-y-0">
              <SettingsRow
                icon={ShieldCheck}
                iconBg="bg-primary/15"
                iconColor="text-primary"
                title="Confirmar nueva contraseña"
                subtitle="Repetí la nueva clave"
              >
                <FormControl>
                  <PasswordInput
                    data-testid="confirm-password-input"
                    placeholder="••••••••"
                    aria-invalid={fieldState.invalid}
                    {...field}
                    className="h-8 w-44 rounded-xl border-border bg-background text-xs text-foreground"
                  />
                </FormControl>
              </SettingsRow>
              <FormMessage className="text-xs text-destructive px-4 pt-1" />
            </FormItem>
          )}
        />

        <div className="pt-2 flex justify-end">
          <LoadingButton
            type="submit"
            size="sm"
            loading={mutation.isPending}
            className="rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90"
          >
            Actualizar contraseña
          </LoadingButton>
        </div>
      </form>
    </Form>
  )
}

export default ChangePassword

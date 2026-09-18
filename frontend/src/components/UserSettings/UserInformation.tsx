import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Mail, User } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { UsersService, type UserUpdateMe } from "@/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { SettingsRow } from "../Settings/SettingsSection"

const formSchema = z.object({
  full_name: z.string().max(30).optional(),
  email: z.email({ message: "Dirección de correo electrónico inválida" }),
})

type FormData = z.infer<typeof formSchema>

const UserInformation = () => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [editMode, setEditMode] = useState(false)
  const { user: currentUser } = useAuth()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      full_name: currentUser?.full_name ?? undefined,
      email: currentUser?.email,
    },
  })

  const toggleEditMode = () => {
    setEditMode(!editMode)
  }

  const mutation = useMutation({
    mutationFn: (data: UserUpdateMe) =>
      UsersService.updateUserMe({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Datos actualizados correctamente")
      toggleEditMode()
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries()
    },
  })

  const onSubmit = (data: FormData) => {
    const updateData: UserUpdateMe = {}

    if (data.full_name !== currentUser?.full_name) {
      updateData.full_name = data.full_name
    }
    if (data.email !== currentUser?.email) {
      updateData.email = data.email
    }

    mutation.mutate(updateData)
  }

  const onCancel = () => {
    form.reset()
    toggleEditMode()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
      <SettingsRow
        icon={User}
        iconBg="bg-emerald-500/15"
        iconColor="text-emerald-400"
        title="Nombre completo"
        subtitle="Nombre visible en la plataforma"
      >
        {editMode ? (
          <Input
            type="text"
            {...form.register("full_name")}
            className="h-8 w-44 rounded-xl border-slate-800 bg-slate-950 text-xs text-slate-200"
          />
        ) : (
          <span className="text-xs font-semibold text-slate-200">
            {currentUser?.full_name || "N/A"}
          </span>
        )}
      </SettingsRow>

      <SettingsRow
        icon={Mail}
        iconBg="bg-blue-500/15"
        iconColor="text-blue-400"
        title="Correo electrónico"
        subtitle="Dirección de email para acceder a la cuenta"
      >
        {editMode ? (
          <Input
            type="email"
            {...form.register("email")}
            className="h-8 w-44 rounded-xl border-slate-800 bg-slate-950 text-xs text-slate-200"
          />
        ) : (
          <span className="text-xs font-semibold text-slate-200">
            {currentUser?.email}
          </span>
        )}
      </SettingsRow>

      <div className="pt-2 flex justify-end gap-2">
        {editMode ? (
          <>
            <LoadingButton
              type="submit"
              size="sm"
              loading={mutation.isPending}
              disabled={!form.formState.isDirty}
              className="rounded-xl bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400"
            >
              Guardar
            </LoadingButton>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={mutation.isPending}
              className="rounded-xl border-slate-800 text-xs text-slate-300"
            >
              Cancelar
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleEditMode}
            className="rounded-xl border-slate-800 text-xs text-slate-300"
          >
            Editar perfil
          </Button>
        )}
      </div>
    </form>
  )
}

export default UserInformation

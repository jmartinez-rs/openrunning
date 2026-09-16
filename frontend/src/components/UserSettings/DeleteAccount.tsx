import { Trash2 } from "lucide-react"
import { SettingsRow } from "../Settings/SettingsSection"
import DeleteConfirmation from "./DeleteConfirmation"

const DeleteAccount = () => {
  return (
    <SettingsRow
      icon={Trash2}
      danger={true}
      title="Eliminar cuenta"
      subtitle="Eliminá permanentemente tu usuario y todas tus actividades registradas"
    >
      <DeleteConfirmation />
    </SettingsRow>
  )
}

export default DeleteAccount

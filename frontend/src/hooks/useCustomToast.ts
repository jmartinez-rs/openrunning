import { toast } from "sonner"

const useCustomToast = () => {
  const showSuccessToast = (description: string) => {
    toast.success("¡Éxito!", {
      description,
    })
  }

  const showErrorToast = (description: string) => {
    toast.error("Algo salió mal", {
      description,
    })
  }

  return { showSuccessToast, showErrorToast }
}

export default useCustomToast

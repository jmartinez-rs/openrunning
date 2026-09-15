import { Link } from "@tanstack/react-router"
import { CircleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"

const ErrorComponent = () => {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-background p-6"
      data-testid="error-component"
    >
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="rounded-full bg-surface-container-low p-4">
          <CircleAlert className="h-8 w-8 text-primary" aria-hidden="true" />
        </div>

        <h1 className="mt-6 text-title-lg font-semibold text-primary">
          Algo salió mal
        </h1>
        <p className="mt-2 text-body-md text-on-surface-variant">
          Hubo un error inesperado. Intentá recargar la página o volvé al
          inicio.
        </p>

        <Link to="/">
          <Button className="mt-6 rounded-lg bg-primary text-primary-foreground">
            Ir al inicio
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default ErrorComponent

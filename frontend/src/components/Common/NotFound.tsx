import { Link } from "@tanstack/react-router"
import { SearchX } from "lucide-react"

import { Button } from "@/components/ui/button"

const NotFound = () => {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-background p-6"
      data-testid="not-found"
    >
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="rounded-full bg-surface-container-low p-4">
          <SearchX className="h-8 w-8 text-primary" aria-hidden="true" />
        </div>

        <h1 className="mt-6 text-title-lg font-semibold text-primary">
          Página no encontrada
        </h1>
        <p className="mt-2 text-body-md text-on-surface-variant">
          La página que buscás no existe o fue movida. Revisá la URL o volvé al
          inicio.
        </p>

        <Link to="/">
          <Button className="mt-6 rounded-lg bg-primary text-primary-foreground">
            Volver al inicio
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default NotFound

import { CalendarRange, Layers, RefreshCw, ShieldQuestion } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface PlanGuideSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SECTIONS = [
  {
    icon: CalendarRange,
    title: "Cómo se estructura tu plan",
    body: "El plan avanza por semanas, y cada semana agrupa sesiones con un objetivo. Verás la semana actual resaltada y podés desplegar cualquier otra para revisar sus días. La línea de tiempo superior te muestra el recorrido completo: en qué fase estás y cuánto falta.",
  },
  {
    icon: Layers,
    title: "Para qué sirven las fases",
    body: "Las fases ordenan el entrenamiento por propósito: base, construcción, pico y afinamiento. Cada fase tiene un color tonal propio y un objetivo. No son etapas rígidas: marcan la intención de las semanas que agrupan.",
  },
  {
    icon: ShieldQuestion,
    title: "Qué hacer si faltás a una sesión",
    body: "Una sesión perdida no rompe el plan. Lo mejor es retomar en la siguiente sesión programada en lugar de acumular cargas. Si te atrasás varios días, priorizá las sesiones clave (fondos, series y tempo) y dejá las suaves como opcionales.",
  },
  {
    icon: RefreshCw,
    title: "Cómo se ajusta",
    body: "El progreso se mide contra lo planificado a la fecha, no contra el total: así refleja tu cumplimiento real semana a semana. Al registrar o vincular una actividad, la sesión se marca como completada y el avance se recalcula automáticamente.",
  },
] as const

/** Bottom sheet de ayuda: cómo funciona el plan (contenido propio, sin lógica). */
export function PlanGuideSheet({ open, onOpenChange }: PlanGuideSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-[32px] border-t border-border bg-surface-container p-6 text-foreground shadow-2xl"
      >
        <div className="mx-auto -mt-2 mb-1 h-1 w-12 shrink-0 rounded-full bg-on-surface-variant/30" />

        <SheetHeader className="space-y-1 p-0 text-left">
          <SheetTitle className="font-display text-2xl font-black tracking-tight text-foreground">
            Cómo funciona tu plan
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Una guía rápida para leer y aprovechar tu entrenamiento.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3">
          {SECTIONS.map(({ icon: Icon, title, body }) => (
            <section
              key={title}
              className="rounded-2xl border border-border bg-surface-container-high/50 p-4"
            >
              <div className="flex items-center gap-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="size-4" />
                </div>
                <h3 className="text-sm font-display font-bold text-foreground">
                  {title}
                </h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {body}
              </p>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

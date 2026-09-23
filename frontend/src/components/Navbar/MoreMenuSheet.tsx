import { MoreMenuContent } from "@/components/Navbar/MoreMenuContent"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface MoreMenuSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Menú secundario "Más" (mobile): bottom sheet con las secciones agrupadas. */
export function MoreMenuSheet({ open, onOpenChange }: MoreMenuSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-border bg-background p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] max-w-lg mx-auto"
      >
        <SheetHeader className="p-0 pb-3 border-b border-border/80">
          <SheetTitle className="text-lg font-bold text-foreground">
            Menú
          </SheetTitle>
        </SheetHeader>

        <MoreMenuContent
          onNavigate={() => onOpenChange(false)}
          className="mt-3"
        />
      </SheetContent>
    </Sheet>
  )
}

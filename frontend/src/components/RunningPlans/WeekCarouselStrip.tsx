import { ChevronLeft, ChevronRight } from "lucide-react"
import type React from "react"
import { useRef } from "react"

interface WeekCarouselStripProps {
  weeks: Array<{
    number: number
    isCurrent?: boolean
    isCompleted?: boolean
  }>
  selectedWeek: number
  onSelectWeek: (weekNumber: number) => void
}

export const WeekCarouselStrip: React.FC<WeekCarouselStripProps> = ({
  weeks,
  selectedWeek,
  onSelectWeek,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleScroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -180 : 180
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" })
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Semanas del entrenamiento
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleScroll("left")}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => handleScroll("right")}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Siguiente semana"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel (Paccer 8-treinos-lista.png style) */}
      <div
        ref={scrollRef}
        className="flex items-center gap-3 overflow-x-auto pb-3 pt-1 scrollbar-none no-scrollbar"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {weeks.map((w) => {
          const isSelected = w.number === selectedWeek
          const isCurrent = Boolean(w.isCurrent)
          const isCompleted = Boolean(w.isCompleted)

          return (
            <div key={w.number} className="flex flex-col items-center shrink-0">
              <button
                type="button"
                onClick={() => onSelectWeek(w.number)}
                className={`relative flex items-center justify-center size-12 rounded-full font-display font-black text-sm transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary text-black shadow-[0_0_15px_rgba(234,252,95,0.4)] scale-105"
                    : isCurrent
                      ? "border-2 border-primary text-white bg-transparent"
                      : isCompleted
                        ? "bg-amber-400/90 text-black font-extrabold"
                        : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
                }`}
              >
                {w.number}
              </button>

              {/* Triangle pointer for current / selected week */}
              <div className="h-2 flex items-center justify-center mt-1">
                {isCurrent && (
                  <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[5px] border-b-primary" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

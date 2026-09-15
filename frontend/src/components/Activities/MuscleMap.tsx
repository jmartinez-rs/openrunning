import type { ExtendedBodyPart, Slug } from "react-muscle-highlighter"
import Body from "react-muscle-highlighter"

interface MuscleMapProps {
  distribution: Record<string, number>
}

const COLORS = ["#99f6e4", "#2dd4bf", "#0f766e"] as const
const DEFAULT_FILL = "#d1d5db"

export function MuscleMap({ distribution }: MuscleMapProps) {
  const entries = Object.entries(distribution).filter(([_, value]) => value > 0)

  if (entries.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Sin datos musculares
      </p>
    )
  }

  const maxSets = Math.max(...entries.map(([_, value]) => value))

  const data: ExtendedBodyPart[] = entries.map(([slug, value]) => ({
    slug: slug as Slug,
    intensity: Math.max(1, Math.min(3, Math.ceil((value / maxSets) * 3))),
  }))

  return (
    <div
      className="flex items-start justify-center gap-2"
      role="img"
      aria-label="Mapa muscular activado en esta sesión"
    >
      <Body
        side="front"
        gender="male"
        scale={0.75}
        border="none"
        defaultFill={DEFAULT_FILL}
        hiddenParts={["hair"]}
        colors={COLORS}
        data={data}
      />
      <Body
        side="back"
        gender="male"
        scale={0.75}
        border="none"
        defaultFill={DEFAULT_FILL}
        hiddenParts={["hair"]}
        colors={COLORS}
        data={data}
      />
    </div>
  )
}

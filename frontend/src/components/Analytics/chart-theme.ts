/**
 * Tema de charts para ATOS — Recharts.
 */
export const DOMAIN_COLORS = {
  cardio: "#ff5722",
  strength: "#7c3aed",
  success: "#10b981",
  race: "#f59e0b",
  pace: "#14b8a6",
  active: "#3b82f6",
} as const

export type DomainColorKey = keyof typeof DOMAIN_COLORS

export const AXIS_TICK_STYLE = {
  fill: "currentColor",
  fontSize: 10,
} as const

export const AXIS_LABEL_STYLE = {
  fill: "currentColor",
  fontSize: 11,
} as const

export const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: "hsl(var(--card))",
  borderColor: "hsl(var(--border))",
  borderRadius: "8px",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  color: "hsl(var(--foreground))",
  fontSize: "12px",
}

export const CHART_HEIGHTS = {
  sm: 220,
  md: 300,
  lg: 360,
} as const

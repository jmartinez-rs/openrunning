/**
 * Tema de charts para OpenRunning — Recharts & Dark Slate.
 */
export const DOMAIN_COLORS = {
  cardio: "#EAFC5F",
  strength: "#A3E635",
  success: "#EAFC5F",
  race: "#F59E0B",
  pace: "#EAFC5F",
  active: "#A3E635",
} as const

export type DomainColorKey = keyof typeof DOMAIN_COLORS

export const AXIS_TICK_STYLE = {
  fill: "#94a3b8",
  fontSize: 11,
  fontWeight: 500,
} as const

export const AXIS_LABEL_STYLE = {
  fill: "#94a3b8",
  fontSize: 11,
  fontWeight: 600,
} as const

export const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: "#0f172a",
  borderColor: "#1e293b",
  borderRadius: "12px",
  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
  color: "#f8fafc",
  fontSize: "12px",
  fontWeight: "500",
}

export const CHART_HEIGHTS = {
  sm: 220,
  md: 300,
  lg: 360,
} as const

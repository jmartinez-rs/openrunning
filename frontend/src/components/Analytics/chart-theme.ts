/**
 * Tema de charts para OpenRunning — Recharts & Kinetic Volt.
 * Colores de dominio alineados con tokens/source/tokens.json.
 */
export const DOMAIN_COLORS = {
  cardio: "#EAFC5F",
  strength: "#FFFFFF",
  success: "#dbed52",
  race: "#EAFC5F",
  pace: "#c6c6c7",
  active: "#EAFC5F",
} as const

export type DomainColorKey = keyof typeof DOMAIN_COLORS

export const AXIS_TICK_STYLE = {
  fill: "#A1A1AA",
  fontSize: 11,
  fontWeight: 500,
} as const

export const AXIS_LABEL_STYLE = {
  fill: "#A1A1AA",
  fontSize: 11,
  fontWeight: 600,
} as const

export const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: "#1E1E1E",
  borderColor: "#262626",
  borderRadius: "12px",
  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
  color: "#FFFFFF",
  fontSize: "12px",
  fontWeight: "500",
}

export const CHART_HEIGHTS = {
  sm: 220,
  md: 300,
  lg: 360,
} as const

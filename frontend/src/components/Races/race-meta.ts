export interface RaceMeta {
  priority?: "A" | "B" | "C" | ""
  status?: "confirmed" | "pending_payment" | "pending_kit" | ""
  corral?: string
  start_time?: string
  target_pace?: string
  target_time?: string
  raw_notes?: string
  splits_strategy?: string
  nutrition_plan?: string
  surface_type?: "calle" | "pista" | "trail" | "mixto" | ""
  elevation_profile?: "plano" | "ondulado" | "subidas" | ""
  goal_type?: "completar" | "tiempo" | ""
  kit_retrieval_info?: string
  web_link?: string
}

/**
 * Parses the backend notes string into a structured RaceMeta object.
 * If the notes string is not valid JSON, it treats the entire string as raw_notes.
 */
export function parseRaceNotes(notes: string | null | undefined): RaceMeta {
  if (!notes) return { raw_notes: "" }
  try {
    const parsed = JSON.parse(notes)
    if (typeof parsed === "object" && parsed !== null) {
      return {
        priority: parsed.priority,
        status: parsed.status,
        corral: parsed.corral,
        start_time: parsed.start_time,
        target_pace: parsed.target_pace,
        target_time: parsed.target_time,
        raw_notes: parsed.raw_notes || "",
        splits_strategy: parsed.splits_strategy,
        nutrition_plan: parsed.nutrition_plan,
        surface_type: parsed.surface_type,
        elevation_profile: parsed.elevation_profile,
        goal_type: parsed.goal_type,
        kit_retrieval_info: parsed.kit_retrieval_info,
        web_link: parsed.web_link,
      }
    }
  } catch {
    // Not JSON, treat as raw notes
    return { raw_notes: notes }
  }
  return { raw_notes: notes }
}

/**
 * Stringifies a RaceMeta object into a JSON string to be saved in the backend notes field.
 */
export function stringifyRaceNotes(meta: RaceMeta): string {
  return JSON.stringify(meta)
}

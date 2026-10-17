import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { RunningWorkoutPublic } from "@/client"
import { RunnaHeroWorkoutCard } from "./RunnaHeroWorkoutCard"

type HeroProps = React.ComponentProps<typeof RunnaHeroWorkoutCard>

function workoutFixture(
  overrides: Partial<RunningWorkoutPublic> = {},
): RunningWorkoutPublic {
  return {
    id: "wo-1",
    date: "2026-03-10",
    type: "easy_run",
    objective: null,
    name: "Rodaje suave 40",
    distance_km: 8,
    duration_seconds: 2400,
    pace_seconds_per_km: 300,
    intensity: "easy",
    description: null,
    notes: null,
    cancelled: false,
    status_override: null,
    matched_activity_id: null,
    status: "planned",
    matched_activity: null,
    ...overrides,
  }
}

function renderHero(props: Partial<HeroProps> = {}): string {
  return renderToStaticMarkup(
    <RunnaHeroWorkoutCard
      workout={null}
      selectedDateIso="2026-03-10"
      isToday
      {...props}
    />,
  )
}

describe("RunnaHeroWorkoutCard", () => {
  it("renders the assigned non-cancelled session (S6)", () => {
    const html = renderHero({ workout: workoutFixture() })

    expect(html).toContain("Rodaje suave 40")
    expect(html).not.toContain("Día de descanso")
  })

  it("renders rest for a cancelled workout (E6)", () => {
    const html = renderHero({ workout: workoutFixture({ cancelled: true }) })

    expect(html).toContain("Día de descanso")
  })

  it("renders the skeleton — never rest — while loading (E7)", () => {
    const html = renderHero({ workout: null, isLoading: true })

    expect(html).toContain('data-testid="hero-skeleton"')
    expect(html).not.toContain("Día de descanso")
  })

  it("keeps the skeleton ahead of an already-resolved workout (E7)", () => {
    const html = renderHero({ workout: workoutFixture(), isLoading: true })

    expect(html).toContain('data-testid="hero-skeleton"')
    expect(html).not.toContain("Rodaje suave 40")
    expect(html).not.toContain("Día de descanso")
  })

  // E1 — the hero date label comes from the pinned day-key module, so it never
  // shifts with the browser's host timezone.
  it("formats the hero day label in the pinned running zone (E1)", () => {
    const html = renderHero({
      workout: workoutFixture({ date: "2026-10-22" }),
      selectedDateIso: "2026-10-22",
      isToday: false,
    })

    expect(html).toContain("jueves, 22 oct")
  })

  it("marks completion from the resolved backend status, not the legacy heuristic (S13/S14)", () => {
    const noop = () => {}

    const autoMatched = renderHero({
      workout: workoutFixture({
        status: "completed",
        status_override: null,
        matched_activity_id: null,
      }),
      onToggleComplete: noop,
    })
    expect(autoMatched).toContain('title="Completado"')

    const overrideOnly = renderHero({
      workout: workoutFixture({
        status: "planned",
        status_override: "completed",
        matched_activity_id: null,
      }),
      onToggleComplete: noop,
    })
    expect(overrideOnly).toContain('title="Pendiente"')
  })
})

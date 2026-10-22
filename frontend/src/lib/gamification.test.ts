import { describe, expect, it } from "bun:test"
import { calculateRunnerXp, getRunnerLevel } from "./gamification"

describe("gamification", () => {
  it("calculates XP accurately from kilometers, workouts, and streaks", () => {
    const xp = calculateRunnerXp({
      totalKm: 120, // 1200 XP
      completedWorkoutsCount: 10, // 500 XP
      streakWeeks: 3, // 300 XP
      personalBestsCount: 1, // 200 XP
    })

    expect(xp).toBe(2200)
  })

  it("determines runner level and progress percentage", () => {
    const levelInfo = getRunnerLevel(2200)
    expect(levelInfo.level).toBeGreaterThanOrEqual(4)
    expect(levelInfo.title).toContain("Corredor")
    expect(levelInfo.progressPercent).toBeGreaterThanOrEqual(0)
    expect(levelInfo.progressPercent).toBeLessThanOrEqual(100)
  })
})

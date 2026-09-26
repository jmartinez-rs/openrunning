import { describe, expect, it } from "vitest"
import { raceTimeInputToSeconds } from "./running-utils"

describe("raceTimeInputToSeconds", () => {
  it("parses mm:ss (2 parts) as minutes:seconds", () => {
    // Regresión: antes se interpretaba como hh:mm y colapsaba el VDOT.
    expect(raceTimeInputToSeconds("50:00")).toBe(3000)
    expect(raceTimeInputToSeconds("24:30")).toBe(1470)
  })

  it("parses h:mm:ss (3 parts)", () => {
    expect(raceTimeInputToSeconds("1:30:00")).toBe(5400)
    expect(raceTimeInputToSeconds("00:24:30")).toBe(1470)
  })

  it("parses a single number as minutes", () => {
    expect(raceTimeInputToSeconds("24")).toBe(1440)
  })

  it("returns null for empty or invalid input", () => {
    expect(raceTimeInputToSeconds("")).toBeNull()
    expect(raceTimeInputToSeconds("abc")).toBeNull()
    expect(raceTimeInputToSeconds("1:2:3:4")).toBeNull()
  })
})

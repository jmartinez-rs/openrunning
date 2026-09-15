import { describe, expect, it } from "vitest";
import {
  calculateHeartRateZones,
  calculateVDOT,
  formatPace,
  formatTime,
  getTrainingPaces,
  kmhToPaceSeconds,
  paceSecondsToKmh,
  parsePace,
  predictTimeRiegel,
} from "./running-math";

describe("running-math", () => {
  it("formats pace correctly", () => {
    expect(formatPace(300)).toBe("5:00");
    expect(formatPace(255)).toBe("4:15");
    expect(formatPace(0)).toBe("--:--");
  });

  it("parses pace correctly", () => {
    expect(parsePace("5:00")).toBe(300);
    expect(parsePace("4:15")).toBe(255);
    expect(parsePace("invalid")).toBe(0);
  });

  it("converts speed and pace bidirectionally", () => {
    expect(kmhToPaceSeconds(12)).toBe(300); // 12 km/h = 5:00 min/km
    expect(paceSecondsToKmh(300)).toBe(12);
  });

  it("predicts race time using Riegel formula", () => {
    // 10K (10000m) in 50 min (3000s) -> predict 21.1K (21097.5m)
    const predicted = predictTimeRiegel(10000, 3000, 21097.5);
    expect(predicted).toBeGreaterThan(6000); // Should be > 1h 40m
    expect(formatTime(predicted)).toContain("1:");
  });

  it("calculates VDOT score", () => {
    // 10K in 40:00 (2400s) -> VDOT should be around 50-52
    const vdot = calculateVDOT(10000, 2400);
    expect(vdot).toBeGreaterThan(45);
    expect(vdot).toBeLessThan(55);
  });

  it("calculates training paces based on VDOT", () => {
    const paces = getTrainingPaces(50);
    expect(paces.easyMin).not.toBe("--:--");
    expect(parsePace(paces.threshold)).toBeLessThan(parsePace(paces.easyMin));
    expect(parsePace(paces.interval)).toBeLessThan(parsePace(paces.threshold));
  });

  it("calculates heart rate zones", () => {
    const zones = calculateHeartRateZones(190, 60);
    expect(zones.z1Recovery[0]).toBe(125);
    expect(zones.z5Anaerobic[1]).toBe(190);
  });
});

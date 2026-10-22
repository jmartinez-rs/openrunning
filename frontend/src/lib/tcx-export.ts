/**
 * Garmin Training Center XML (TCX) Workout Generator.
 * Converts structured running workouts into standard TCX for Garmin, Coros, and Apple Watch.
 */

import type { RunningWorkoutPublic } from "@/client"

function paceSecToSpeedMps(paceSecPerKm: number): number {
  if (paceSecPerKm <= 0) return 2.78 // fallback ~6:00/km
  return Number((1000 / paceSecPerKm).toFixed(2))
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;"
      case ">":
        return "&gt;"
      case "&":
        return "&amp;"
      case "'":
        return "&apos;"
      case '"':
        return "&quot;"
      default:
        return c
    }
  })
}

export function generateWorkoutTcx(
  workout: RunningWorkoutPublic,
  planName = "OpenRunning"
): string {
  const workoutName = escapeXml(
    (workout.name?.trim() || `${workout.type} ${workout.distance_km || 0}k`).slice(0, 15)
  )

  const blocks = workout.blocks ?? []
  let stepsXml = ""

  if (blocks.length > 0) {
    blocks.forEach((block, idx) => {
      const stepId = idx + 1
      const stepName = escapeXml(`${block.block_type} ${stepId}`.slice(0, 15))
      const isRest = block.block_type === "recovery" || block.block_type === "rest"
      const intensity = isRest ? "Resting" : "Active"

      let durationXml = ""
      if (block.distance_m && block.distance_m > 0) {
        durationXml = `
        <Duration xsi:type="Distance_t">
          <Meters>${Math.round(block.distance_m)}</Meters>
        </Duration>`
      } else if (block.duration_seconds && block.duration_seconds > 0) {
        durationXml = `
        <Duration xsi:type="Time_t">
          <Seconds>${Math.round(block.duration_seconds)}</Seconds>
        </Duration>`
      } else {
        durationXml = `
        <Duration xsi:type="Distance_t">
          <Meters>1000</Meters>
        </Duration>`
      }

      let targetXml = `<Target xsi:type="None_t"/>`
      if (!isRest && block.pace_seconds_per_km && block.pace_seconds_per_km > 0) {
        const targetSpeed = paceSecToSpeedMps(block.pace_seconds_per_km)
        const low = (targetSpeed * 0.95).toFixed(2)
        const high = (targetSpeed * 1.05).toFixed(2)
        targetXml = `
        <Target xsi:type="Speed_t">
          <SpeedZone xsi:type="CustomSpeedZone_t">
            <LowInMetersPerSecond>${low}</LowInMetersPerSecond>
            <HighInMetersPerSecond>${high}</HighInMetersPerSecond>
          </SpeedZone>
        </Target>`
      }

      stepsXml += `
      <Step xsi:type="Step_t">
        <StepId>${stepId}</StepId>
        <Name>${stepName}</Name>${durationXml}
        <Intensity>${intensity}</Intensity>${targetXml}
      </Step>`
    })
  } else {
    // Single-step fallback
    const distMeters = Math.round((workout.distance_km || 5) * 1000)
    let targetXml = `<Target xsi:type="None_t"/>`
    if (workout.pace_seconds_per_km && workout.pace_seconds_per_km > 0) {
      const targetSpeed = paceSecToSpeedMps(workout.pace_seconds_per_km)
      targetXml = `
        <Target xsi:type="Speed_t">
          <SpeedZone xsi:type="CustomSpeedZone_t">
            <LowInMetersPerSecond>${(targetSpeed * 0.95).toFixed(2)}</LowInMetersPerSecond>
            <HighInMetersPerSecond>${(targetSpeed * 1.05).toFixed(2)}</HighInMetersPerSecond>
          </SpeedZone>
        </Target>`
    }

    stepsXml = `
      <Step xsi:type="Step_t">
        <StepId>1</StepId>
        <Name>${workoutName}</Name>
        <Duration xsi:type="Distance_t">
          <Meters>${distMeters}</Meters>
        </Duration>
        <Intensity>Active</Intensity>${targetXml}
      </Step>`
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Workouts>
    <Workout Sport="Running">
      <Creator xsi:type="Device_t">
        <Name>${escapeXml(planName)}</Name>
      </Creator>
      <Name>${workoutName}</Name>${stepsXml}
    </Workout>
  </Workouts>
</TrainingCenterDatabase>`
}

export function downloadWorkoutTcx(
  workout: RunningWorkoutPublic,
  planName = "OpenRunning"
): void {
  const xml = generateWorkoutTcx(workout, planName)
  const blob = new Blob([xml], { type: "application/vnd.garmin.tcx+xml" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  const dateStr = workout.date ? String(workout.date) : "sesion"
  a.href = url
  a.download = `entrenamiento-${dateStr}-${workout.type || "run"}.tcx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

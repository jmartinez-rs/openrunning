import fs from 'fs';
import path from 'path';
import { generatePlanStructure } from '../src/components/RunningPlans/PlanWizard';

const PROFILES = [
  {
    name: 'beginner_5k_8weeks',
    planType: 'race' as const,
    targetKm: 5,
    numWeeks: 8,
    userLevel: 'beginner' as const,
    refDistanceKm: 0,
    refTimeSeconds: 0,
    currentWeeklyKm: 10,
    longestRunKm: 3,
    selectedDays: [1, 3, 5],
    longRunDay: 0, // Sunday
  },
  {
    name: 'intermediate_10k_12weeks',
    planType: 'race' as const,
    targetKm: 10,
    numWeeks: 12,
    userLevel: 'intermediate' as const,
    refDistanceKm: 5,
    refTimeSeconds: 1500, // 25:00
    currentWeeklyKm: 25,
    longestRunKm: 8,
    selectedDays: [2, 4, 6, 0],
    longRunDay: 0,
  },
  {
    name: 'advanced_half_16weeks',
    planType: 'race' as const,
    targetKm: 21.1,
    numWeeks: 16,
    userLevel: 'advanced' as const,
    refDistanceKm: 10,
    refTimeSeconds: 2700, // 45:00
    currentWeeklyKm: 45,
    longestRunKm: 15,
    selectedDays: [1, 2, 4, 5, 0],
    longRunDay: 0,
  },
  {
    name: 'elite_marathon_20weeks',
    planType: 'race' as const,
    targetKm: 42.2,
    numWeeks: 20,
    userLevel: 'advanced' as const,
    refDistanceKm: 21.1,
    refTimeSeconds: 5100, // 1:25:00
    currentWeeklyKm: 80,
    longestRunKm: 28,
    selectedDays: [1, 2, 3, 4, 5, 0],
    longRunDay: 0,
  },
  {
    name: 'beginner_fitness_6weeks',
    planType: 'fitness' as const,
    targetKm: 5,
    numWeeks: 6,
    userLevel: 'beginner' as const,
    refDistanceKm: 0,
    refTimeSeconds: 0,
    currentWeeklyKm: 5,
    longestRunKm: 2,
    selectedDays: [1, 3],
    longRunDay: 6, // Saturday
  },
  {
    name: 'intermediate_5k_8weeks',
    planType: 'race' as const,
    targetKm: 5,
    numWeeks: 8,
    userLevel: 'intermediate' as const,
    refDistanceKm: 5,
    refTimeSeconds: 1620, // 27:00
    currentWeeklyKm: 20,
    longestRunKm: 6,
    selectedDays: [1, 3, 5, 0],
    longRunDay: 0,
  },
  {
    name: 'beginner_half_16weeks',
    planType: 'race' as const,
    targetKm: 21.1,
    numWeeks: 16,
    userLevel: 'beginner' as const,
    refDistanceKm: 0,
    refTimeSeconds: 0,
    currentWeeklyKm: 15,
    longestRunKm: 8,
    selectedDays: [2, 4, 0],
    longRunDay: 0,
  },
  {
    name: 'beginner_marathon_24weeks',
    planType: 'race' as const,
    targetKm: 42.2,
    numWeeks: 24,
    userLevel: 'beginner' as const,
    refDistanceKm: 10,
    refTimeSeconds: 3600, // 60:00
    currentWeeklyKm: 25,
    longestRunKm: 10,
    selectedDays: [2, 4, 5, 0],
    longRunDay: 0,
  },
  {
    name: 'advanced_10k_10weeks',
    planType: 'race' as const,
    targetKm: 10,
    numWeeks: 10,
    userLevel: 'advanced' as const,
    refDistanceKm: 5,
    refTimeSeconds: 1140, // 19:00
    currentWeeklyKm: 50,
    longestRunKm: 15,
    selectedDays: [1, 2, 4, 5, 0],
    longRunDay: 0,
  },
  {
    name: 'intermediate_fitness_12weeks',
    planType: 'fitness' as const,
    targetKm: 10,
    numWeeks: 12,
    userLevel: 'intermediate' as const,
    refDistanceKm: 5,
    refTimeSeconds: 1500, // 25:00
    currentWeeklyKm: 30,
    longestRunKm: 10,
    selectedDays: [1, 3, 5, 0],
    longRunDay: 0,
  },
];

const draftBase = {
  name: "Test Draft",
  goal: "",
  distance_km: 0,
  distance_unit: "km" as const,
  target_time_seconds: null,
  target_pace_seconds_per_km: null,
  start_date: "2026-01-01", // Jueves
  end_date: "",
  week_start_day: 1, // Lunes
  status: "active" as const,
  race_id: null,
  notes: "",
  phases: [],
};

const outputDir = path.join(__dirname, '../tests/golden_plans');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

for (const profile of PROFILES) {
  const result = generatePlanStructure({
    draft: {
      ...draftBase,
      distance_km: profile.targetKm,
    },
    planType: profile.planType,
    targetKm: profile.targetKm,
    numWeeks: profile.numWeeks,
    userLevel: profile.userLevel,
    refDistanceKm: profile.refDistanceKm,
    refTimeSeconds: profile.refTimeSeconds,
    currentWeeklyKm: profile.currentWeeklyKm,
    longestRunKm: profile.longestRunKm,
    selectedDays: profile.selectedDays,
    longRunDay: profile.longRunDay,
  });

  const filePath = path.join(outputDir, `${profile.name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Generated ${profile.name}.json`);
}

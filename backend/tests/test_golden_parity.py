import json
import os
from pathlib import Path
from typing import Any, Dict

from app.services.plan_generator_legacy import generate_plan_structure

PROFILES = [
  {
    "name": 'beginner_5k_8weeks',
    "planType": 'race',
    "targetKm": 5.0,
    "numWeeks": 8,
    "userLevel": 'beginner',
    "refDistanceKm": 0.0,
    "refTimeSeconds": 0,
    "currentWeeklyKm": 10.0,
    "longestRunKm": 3.0,
    "selectedDays": [1, 3, 5],
    "longRunDay": 0,
  },
  {
    "name": 'intermediate_10k_12weeks',
    "planType": 'race',
    "targetKm": 10.0,
    "numWeeks": 12,
    "userLevel": 'intermediate',
    "refDistanceKm": 5.0,
    "refTimeSeconds": 1500,
    "currentWeeklyKm": 25.0,
    "longestRunKm": 8.0,
    "selectedDays": [2, 4, 6, 0],
    "longRunDay": 0,
  },
  {
    "name": 'advanced_half_16weeks',
    "planType": 'race',
    "targetKm": 21.1,
    "numWeeks": 16,
    "userLevel": 'advanced',
    "refDistanceKm": 10.0,
    "refTimeSeconds": 2700,
    "currentWeeklyKm": 45.0,
    "longestRunKm": 15.0,
    "selectedDays": [1, 2, 4, 5, 0],
    "longRunDay": 0,
  },
  {
    "name": 'elite_marathon_20weeks',
    "planType": 'race',
    "targetKm": 42.2,
    "numWeeks": 20,
    "userLevel": 'advanced',
    "refDistanceKm": 21.1,
    "refTimeSeconds": 5100,
    "currentWeeklyKm": 80.0,
    "longestRunKm": 28.0,
    "selectedDays": [1, 2, 3, 4, 5, 0],
    "longRunDay": 0,
  },
  {
    "name": 'beginner_fitness_6weeks',
    "planType": 'fitness',
    "targetKm": 5.0,
    "numWeeks": 6,
    "userLevel": 'beginner',
    "refDistanceKm": 0.0,
    "refTimeSeconds": 0,
    "currentWeeklyKm": 5.0,
    "longestRunKm": 2.0,
    "selectedDays": [1, 3],
    "longRunDay": 6,
  },
  {
    "name": 'intermediate_5k_8weeks',
    "planType": 'race',
    "targetKm": 5.0,
    "numWeeks": 8,
    "userLevel": 'intermediate',
    "refDistanceKm": 5.0,
    "refTimeSeconds": 1620,
    "currentWeeklyKm": 20.0,
    "longestRunKm": 6.0,
    "selectedDays": [1, 3, 5, 0],
    "longRunDay": 0,
  },
  {
    "name": 'beginner_half_16weeks',
    "planType": 'race',
    "targetKm": 21.1,
    "numWeeks": 16,
    "userLevel": 'beginner',
    "refDistanceKm": 0.0,
    "refTimeSeconds": 0,
    "currentWeeklyKm": 15.0,
    "longestRunKm": 8.0,
    "selectedDays": [2, 4, 0],
    "longRunDay": 0,
  },
  {
    "name": 'beginner_marathon_24weeks',
    "planType": 'race',
    "targetKm": 42.2,
    "numWeeks": 24,
    "userLevel": 'beginner',
    "refDistanceKm": 10.0,
    "refTimeSeconds": 3600,
    "currentWeeklyKm": 25.0,
    "longestRunKm": 10.0,
    "selectedDays": [2, 4, 5, 0],
    "longRunDay": 0,
  },
  {
    "name": 'advanced_10k_10weeks',
    "planType": 'race',
    "targetKm": 10.0,
    "numWeeks": 10,
    "userLevel": 'advanced',
    "refDistanceKm": 5.0,
    "refTimeSeconds": 1140,
    "currentWeeklyKm": 50.0,
    "longestRunKm": 15.0,
    "selectedDays": [1, 2, 4, 5, 0],
    "longRunDay": 0,
  },
  {
    "name": 'intermediate_fitness_12weeks',
    "planType": 'fitness',
    "targetKm": 10.0,
    "numWeeks": 12,
    "userLevel": 'intermediate',
    "refDistanceKm": 5.0,
    "refTimeSeconds": 1500,
    "currentWeeklyKm": 30.0,
    "longestRunKm": 10.0,
    "selectedDays": [1, 3, 5, 0],
    "longRunDay": 0,
  },
]

DRAFT_BASE = {
  "name": "Test Draft",
  "goal": "",
  "distance_km": 0,
  "distance_unit": "km",
  "target_time_seconds": None,
  "target_pace_seconds_per_km": None,
  "start_date": "2026-01-01",
  "end_date": "",
  "week_start_day": 1,
  "status": "active",
  "race_id": None,
  "notes": "",
  "phases": [],
}


def clean_dict(d: Any) -> Any:
    """Removes None values recursively so we can compare with JS JSON.stringify() which drops undefined/null fields if configured, though we just want to ignore missing fields."""
    if isinstance(d, dict):
        return {k: clean_dict(v) for k, v in d.items() if v is not None}
    elif isinstance(d, list):
        return [clean_dict(x) for x in d]
    elif isinstance(d, float):
        return round(d, 4)
    return d


def dict_diff(d1, d2, path=''):
    if isinstance(d1, dict) and isinstance(d2, dict):
        for k in set(d1.keys()).union(d2.keys()):
            if k not in d1: print(f'{path}[{k}] missing in py')
            elif k not in d2: print(f'{path}[{k}] missing in js')
            else: dict_diff(d1[k], d2[k], path + f'[{k}]')
    elif isinstance(d1, list) and isinstance(d2, list):
        if len(d1) != len(d2): print(f'{path} length diff: py={len(d1)} js={len(d2)}')
        else:
            for i, (v1, v2) in enumerate(zip(d1, d2)): dict_diff(v1, v2, path + f'[{i}]')
    elif d1 != d2:
        print(f'{path}: py={repr(d1)} js={repr(d2)}')

def test_golden_parity():
    frontend_dir = Path(__file__).parent.parent.parent / "frontend"
    golden_dir = frontend_dir / "tests" / "golden_plans"
    
    for profile in PROFILES:
        draft = DRAFT_BASE.copy()
        draft["distance_km"] = profile["targetKm"]
        
        py_output_model = generate_plan_structure(
            draft=draft,
            plan_type=profile["planType"],
            target_km=profile["targetKm"],
            num_weeks=profile["numWeeks"],
            user_level=profile["userLevel"],
            ref_distance_km=profile["refDistanceKm"],
            ref_time_seconds=profile["refTimeSeconds"],
            current_weekly_km=profile["currentWeeklyKm"],
            longest_run_km=profile["longestRunKm"],
            selected_days=profile["selectedDays"],
            long_run_day=profile["longRunDay"],
        )
        
        py_dict = py_output_model.model_dump(mode="json", exclude_none=True)
        
        golden_file = golden_dir / f"{profile['name']}.json"
        assert golden_file.exists(), f"Missing golden file: {golden_file}"
        
        with open(golden_file, "r") as f:
            js_dict = json.load(f)
            
        py_clean = clean_dict(py_dict)
        js_clean = clean_dict(js_dict)
        
        if py_clean["phases"] != js_clean["phases"]:
            print(f"Mismatch in {profile['name']}")
            dict_diff(py_clean["phases"], js_clean["phases"], 'phases')
            assert False
        
        assert py_clean["distance_km"] == js_clean["distance_km"]
        assert py_clean["end_date"] == js_clean["end_date"]
        print(f"✅ {profile['name']} matches!")

if __name__ == "__main__":
    test_golden_parity()

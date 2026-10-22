"""Unit tests for the per-issue validator gate helper (R17 / S6 / NEW-1).

A pace-only recalibration cannot naturally produce a new error-severity issue,
so the gate identity comparator is proven here with injected issue lists.
"""

from app.models import PlanValidationIssue
from app.services.plan_validator import new_error_issues


def _issue(code: str, severity: str = "error", details=None, message: str = "m") -> PlanValidationIssue:
    return PlanValidationIssue(
        code=code, severity=severity, message=message, details=details  # type: ignore[arg-type]
    )


def test_detects_new_error_issue_when_error_code_set_is_unchanged():
    pre = [
        _issue("CONSECUTIVE_HARD_DAYS", details={"date_1": "2026-10-06", "date_2": "2026-10-07"}),
    ]
    post = [
        *pre,
        _issue("CONSECUTIVE_HARD_DAYS", details={"date_1": "2026-10-20", "date_2": "2026-10-21"}),
    ]

    new_issues = new_error_issues(pre, post)

    assert len(new_issues) == 1
    assert new_issues[0].details == {"date_1": "2026-10-20", "date_2": "2026-10-21"}


def test_identical_issue_lists_produce_no_new_errors():
    pre = [
        _issue("DUPLICATE_WORKOUT_DATES", details={"date": "2026-10-06"}),
        _issue("VOLUME_JUMP_EXCEEDED", details={"week": 3}),
    ]

    assert new_error_issues(pre, list(pre)) == []


def test_details_key_order_does_not_create_a_false_positive():
    pre = [_issue("DUPLICATE_WORKOUT_DATES", details={"date": "2026-10-06", "week": 2})]
    post = [_issue("DUPLICATE_WORKOUT_DATES", details={"week": 2, "date": "2026-10-06"})]

    assert new_error_issues(pre, post) == []


def test_message_changes_alone_do_not_count_as_a_new_issue():
    pre = [_issue("GOAL_GAP_HIGH", details={"week": 1}, message="old wording")]
    post = [_issue("GOAL_GAP_HIGH", details={"week": 1}, message="new wording")]

    assert new_error_issues(pre, post) == []


def test_new_warning_or_info_issues_never_block():
    pre = [_issue("MISSING_TAPER", severity="warning", details={"peak_volume": 40.0})]
    post = [
        *pre,
        _issue("LONG_RUN_TOO_HIGH", severity="warning", details={"week": 4}),
        _issue("CONSERVATIVE_MODE_ACTIVE", severity="info", details=None),
    ]

    assert new_error_issues(pre, post) == []


def test_detects_new_error_issue_with_a_brand_new_code():
    pre = [_issue("MISSING_TAPER", severity="warning", details=None)]
    post = [*pre, _issue("DUPLICATE_WORKOUT_DATES", details={"date": "2026-10-20"})]

    new_issues = new_error_issues(pre, post)

    assert [issue.code for issue in new_issues] == ["DUPLICATE_WORKOUT_DATES"]


def test_resolved_pre_existing_error_is_not_reported_as_new():
    pre = [_issue("DUPLICATE_WORKOUT_DATES", details={"date": "2026-10-06"})]
    post = [_issue("DUPLICATE_WORKOUT_DATES", details={"date": "2026-10-06"})]

    assert new_error_issues(pre, post) == []


def test_validator_m3_invariants():
    import datetime as dt
    from app.models import (
        AthleteBaseline,
        BaselineData,
        PlanGeneratorConfig,
        RunningPlanCreate,
        PhaseIn,
        WeekIn,
        WorkoutIn,
    )
    from app.services.plan_validator import validate_plan_invariants

    baseline = AthleteBaseline(
        weekly_km=BaselineData(value=30.0, confidence="measured"),
        longest_run_km=BaselineData(value=12.0, confidence="measured"),
        vdot=BaselineData(value=40.0, confidence="measured"),
        runs_per_week=BaselineData(value=4.0, confidence="measured"),
    )
    config = PlanGeneratorConfig(
        target_km=10.0,
        num_weeks=8,
        start_date=dt.date(2026, 10, 12),
        baseline=baseline,
        avoid_long_adjacent_quality=True,
        hard_day_min_gap_days=3,
        cutback_cadence=3,
    )

    # Build plan with adjacent quality to long run and quality sessions too close
    w_quality1 = WorkoutIn(
        date=dt.date(2026, 10, 14),
        type="intervals",
        distance_km=6.0,
        intensity="hard",
    )
    w_quality2 = WorkoutIn(
        date=dt.date(2026, 10, 16),  # Gap is 2 days (< min_gap 3)
        type="tempo",
        distance_km=6.0,
        intensity="hard",
    )
    w_long_run = WorkoutIn(
        date=dt.date(2026, 10, 17),  # Adjacent to quality2! (abs diff == 1)
        type="long_run",
        distance_km=10.0,
        intensity="easy",
    )
    week1 = WeekIn(
        number=1,
        start_date=dt.date(2026, 10, 12),
        end_date=dt.date(2026, 10, 18),
        workouts=[w_quality1, w_quality2, w_long_run],
    )
    phase1 = PhaseIn(
        position=1,
        name="Fase 1",
        color="emerald",
        start_week=1,
        end_week=8,
        weeks=[week1],
    )
    plan = RunningPlanCreate(
        name="Plan Test M3",
        distance_km=10.0,
        start_date=dt.date(2026, 10, 12),
        phases=[phase1],
    )

    issues = validate_plan_invariants(plan, config)
    codes = {issue.code for issue in issues}

    assert "LONG_RUN_ADJACENT_QUALITY" in codes
    assert "QUALITY_TOO_CLOSE" in codes


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

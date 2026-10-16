"""Approval tests locking the single week-start formula (F4 safety net).

`app.services.plan_calendar.week_start_offset` is the ONE formula the plan
generator and the recalibration core share. These tests pin its exact contract
across the whole ISO weekday x week-start-day grid so a future edit cannot make
the two callers drift apart again.
"""

import pytest

from app.services.plan_calendar import week_start_offset


@pytest.mark.parametrize("week_start_day", range(1, 8))
@pytest.mark.parametrize("iso_weekday", range(1, 8))
def test_week_start_offset_matches_the_reference_formula(iso_weekday, week_start_day):
    expected = (iso_weekday - week_start_day) % 7

    offset = week_start_offset(iso_weekday, week_start_day)

    assert offset == expected
    assert 0 <= offset <= 6


@pytest.mark.parametrize("week_start_day", range(1, 8))
def test_week_start_day_itself_maps_to_zero(week_start_day):
    assert week_start_offset(week_start_day, week_start_day) == 0


def test_week_start_offset_wraps_into_the_previous_week():
    # Sunday (ISO 7) with a Monday start (ISO 1) is 6 days into the week...
    assert week_start_offset(7, 1) == 6
    # ...but the same Sunday with a Sunday start is day 0.
    assert week_start_offset(7, 7) == 0
    # Thursday (ISO 4) with a Wednesday start (ISO 3) is day 1.
    assert week_start_offset(4, 3) == 1

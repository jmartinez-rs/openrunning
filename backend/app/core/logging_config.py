"""Minimal, explicit app-level logging configuration.

The recalibration service and routes emit INFO records (for example the
``empty_evidence`` observability event) through namespaced module loggers. Those
loggers used to inherit the ROOT logger's level, so they only worked because
``app.utils`` happened to call ``logging.basicConfig(level=INFO)`` at import. If
another module configured the root logger first (``basicConfig`` is then a
no-op) or raised its level, the app's INFO records were silently dropped.

``configure_logging`` pins the ``app`` logger to INFO and guarantees at least one
root handler exists, without replacing handles/formatters a host already
installed. Ancestor *logger* levels do not filter propagated records, so pinning
the app logger is enough for its INFO observability to reach a real sink.
"""

import logging

APP_LOGGER_NAME = "app"
DEFAULT_LEVEL = logging.INFO


def configure_logging(level: int = DEFAULT_LEVEL) -> None:
    """Pin the ``app`` logger to ``level`` and ensure a root handler exists.

    Idempotent and non-destructive: an existing root handler configuration is
    left untouched, and existing loggers keep their formatters.
    """
    root = logging.getLogger()
    if not root.handlers:
        logging.basicConfig(level=level)
    logging.getLogger(APP_LOGGER_NAME).setLevel(level)

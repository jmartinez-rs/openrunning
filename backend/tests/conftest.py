"""Shared pytest fixtures for the backend test suite.

Environment variables are set BEFORE importing ``app`` because
``app.core.config`` instantiates ``Settings()`` at import time (``config.py``),
and every required field (``PROJECT_NAME``, ``POSTGRES_SERVER``,
``POSTGRES_USER``, ``FIRST_SUPERUSER``, ``FIRST_SUPERUSER_PASSWORD``) has no
default.

The HTTP ``client`` fixture instantiates ``TestClient(app)`` WITHOUT a ``with``
block on purpose: entering the context manager would run the app lifespan and
start the background sync scheduler, which the tests must avoid.
"""

import os

os.environ.setdefault("PROJECT_NAME", "openrunning-tests")
os.environ.setdefault("POSTGRES_SERVER", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5432")
os.environ.setdefault("POSTGRES_USER", "postgres")
os.environ.setdefault("POSTGRES_PASSWORD", "postgres")
os.environ.setdefault("POSTGRES_DB", "openrunning-tests")
os.environ.setdefault("FIRST_SUPERUSER", "admin@example.com")
os.environ.setdefault("FIRST_SUPERUSER_PASSWORD", "admin-test-password")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("ENVIRONMENT", "local")

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel

from app.api.deps import get_current_user, get_db
from app.main import app
from app.models import User


def sqlite_session() -> Session:
    """A fresh in-memory SQLite session with the full schema created.

    Shared by the pure service tests that build live ORM graphs without the HTTP
    harness (previously duplicated as a local ``_session`` in each test module).
    """
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    return Session(engine)


@pytest.fixture()
def db_engine(tmp_path) -> Generator[Engine]:
    """A fresh file-backed SQLite database per test (shared across sessions)."""
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}",
        connect_args={"check_same_thread": False},
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture()
def user(db_engine: Engine) -> User:
    """A seeded, detached owner used for the dependency-injected auth."""
    with Session(db_engine) as session:
        seeded = User(
            email="runner@example.com",
            hashed_password="not-a-real-hash",
            is_active=True,
        )
        session.add(seeded)
        session.commit()
        session.refresh(seeded)
        session.expunge(seeded)
        return seeded


@pytest.fixture()
def client(db_engine: Engine, user: User) -> Generator[TestClient]:
    """A TestClient wired to the SQLite engine with an authenticated owner.

    ``get_db`` is overridden to the test engine and ``get_current_user`` to the
    seeded owner, so routes exercise routing, ``response_model`` serialization
    and dependency-injected auth/ownership over the real HTTP layer.
    """

    def _get_db() -> Generator[Session]:
        with Session(db_engine) as session:
            yield session

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user] = lambda: user
    # No `with` block: the lifespan (scheduler) must not start.
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()

<div align="center">

# 🏃 OpenRunning

<br>

**A self-hosted running & cardio tracker you actually own.**

Plan your season, design interval workouts, track your mileage, sync your activities from Strava,
and analyze your progress — on your phone, synced across devices, behind your own login.
No account on someone else's server, no subscription, no ads. Just `docker compose up`.

<br>

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-a3e635?style=flat-square)](LICENSE)
![Self-hosted](https://img.shields.io/badge/self--hosted-%F0%9F%8F%A0-60a5fa?style=flat-square)
![React](https://img.shields.io/badge/React-19-38bdf8?style=flat-square&logo=react&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![No tracking](https://img.shields.io/badge/telemetry-none-f472b6?style=flat-square)

</div>

<br>

## Why

Most running apps lock your data behind a login on their servers, nag you to upgrade to premium for
advanced analytics, or disappear when the startup does. OpenRunning is the opposite: **it runs on
your box, your data stays in a database you control, and it's yours to fork.** It still feels
modern — installable as a home-screen app, email/password sign-in, sync across your phone and laptop.

## Features

- 📅 **Structured Training Plans** — build your running season with Phases (Base, Build, Peak,
  Taper), Weeks, and individual Sessions. Generate plans from your VDOT or a recent race time
  (Riegel), or build them by hand.
- ⏱️ **Advanced Workout Builder** — create complex interval sessions with warm-ups, work intervals,
  recoveries, and cool-downs. Set pace, heart rate, or RPE targets for each block.
- 👟 **Shoe Mileage Tracker** — register your running shoes, set their lifespan, and track the
  distance run on each pair to know when it's time to replace them.
- 🏅 **Race Management** — add your upcoming races (5K, 10K, Half Marathon, Marathon) and align your
  training plans to peak perfectly on race day.
- 🏃 **Pace & VDOT Calculators** — integrated pace converters, race-time predictors, and VDOT-based
  training paces (Jack Daniels).
- 🔗 **Strava & Hevy Integration** — fetch your actual running data and match it against your
  planned workouts to calculate compliance and weekly mileage.
- 📥 **GPX / FIT Import** — bring your history with you by uploading files from your watch.
- 🟩 **Activity Heatmap & Analytics** — visualize your running volume over time with charts and
  GitHub-style year views, heart-rate zones, and best marks per distance.
- 🎨 **Designed, not assembled** — dark theme, premium dashboard UI with glassmorphism and a sleek
  Kinetic Volt design system.
- 📦 **Yours to keep** — self-hosted, **no telemetry**.

## Architecture

```
┌─────────────┐        ┌──────────────────────────────┐
│  Your phone │──HTTPS─▶│  frontend (Vite dev server)  │
│  / laptop   │        │   └─ calls /api/v1 ─────────┐ │
└─────────────┘        └──────────────────────────────┘│
                                                        ▼
                                        ┌──────────────────────────┐
                                        │  backend (FastAPI)       │
                                        │   ├─ PostgreSQL 16       │
                                        │   └─ ./storage (uploads) │
                                        └──────────────────────────┘
```

- **frontend/** — React 19 + Vite (TanStack Router, TanStack Query, Tailwind CSS v4, Recharts,
  Leaflet). Runs as a Vite dev server in the compose stack.
- **backend/** — Python FastAPI + SQLModel + Alembic. Serves the REST API (`/api/v1`), runs
  migrations, the Strava/Hevy sync scheduler, and (in production) the compiled frontend on the same
  origin.
- **db/** — PostgreSQL 16, reachable only from the internal Docker network.

## Quick start (self-host)

You need [Docker](https://docs.docker.com/get-docker/) with Compose.

```bash
git clone https://github.com/jmartinez-rs/openrunning
cd openrunning
cp .env.example .env
docker compose up -d --build
```

Open **http://localhost:5173**, log in with the first superuser
(`FIRST_SUPERUSER` / `FIRST_SUPERUSER_PASSWORD`, defaults `admin@example.com` / `changethis`), and
you're in.

> ⚠️ Change `SECRET_KEY`, `POSTGRES_PASSWORD` and `FIRST_SUPERUSER_PASSWORD` before any real
> deployment — the backend refuses to start with the default secrets when `ENVIRONMENT` is not
> `local`.

## Configuration

All via `.env` (see `.env.example`):

| Variable | What it is | Default |
|---|---|---|
| `PROJECT_NAME` | App name shown in the UI | `OpenRunning` |
| `ENVIRONMENT` | `local` / `staging` / `production` | `local` |
| `SECRET_KEY` | JWT signing key — **change it** | dev default |
| `FIRST_SUPERUSER` | Initial admin email | `admin@example.com` |
| `FIRST_SUPERUSER_PASSWORD` | Initial admin password — **change it** | `changethis` |
| `FRONTEND_HOST` | Public URL of the frontend (reset links, CORS) | `http://localhost:5173` |
| `BACKEND_CORS_ORIGINS` | Extra CORS origins (comma-separated) | `http://localhost:5173,http://localhost:8001` |
| `POSTGRES_*` | Database credentials | dev defaults |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | Strava app credentials (optional) | — |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Strava webhook verification token (optional) | — |
| `STRAVA_REDIRECT_URI` | Strava OAuth callback URL (optional) | — |
| `SMTP_*` / `EMAILS_FROM_*` | SMTP for password-reset emails (optional) | — |

## Deploy with Dockploy

The compose stack is ready for [Dockploy](https://dockploy.com) (or any Docker Compose PaaS).
Point it at this repository and set these environment variables in the Dockploy UI:

| Variable | Value for a real deploy |
|---|---|
| `ENVIRONMENT` | `production` |
| `SECRET_KEY` | a long random string |
| `POSTGRES_PASSWORD` | a strong password |
| `FIRST_SUPERUSER_PASSWORD` | a strong admin password |
| `FRONTEND_HOST` | `https://app.tu-dominio` |
| `BACKEND_CORS_ORIGINS` | `https://app.tu-dominio` |
| `VITE_API_URL` | `https://api.tu-dominio` (the public URL of the backend) |

Then expose two domains in Dockploy:

1. **`app.tu-dominio`** → the `frontend` service (port `5173`).
2. **`api.tu-dominio`** → the `backend` service (port `8001`).

The `db` service is **not** exposed to the internet (no host port) — only the backend reaches it
through the internal network.

> **Note:** the compose runs the Vite dev server and the FastAPI dev server (auto-reload). This is
> fine for a personal self-hosted instance. For a more production-grade setup (compiled frontend
> served by the backend on a single origin, `uvicorn` without reload), open an issue and we'll add
> a production Dockerfile.

## Tech

React 19 + Vite (TanStack Router, TanStack Query, Tailwind CSS v4, Recharts, Leaflet) · Python
FastAPI + SQLModel + Alembic · PostgreSQL 16 · Docker Compose · Strava/Hevy sync · GPX/FIT import.

## Contributing

Issues and PRs welcome! Good first issues: more starter plans, Garmin webhooks integration, GPX map
rendering. **A ⭐ helps more people find it.**

OpenRunning is free and stays free: AGPL, no subscription, no paid tier, nothing held back for
sponsors.

## License

[GNU AGPL v3.0](LICENSE) — free and open source. You can self-host, use, modify and share it; if
you run a modified version as a network service, you must offer that version's source under the
same license. Nobody can turn OpenRunning into a closed, proprietary product.
<div align="center">

# 🏃 openRunning

<br>

**A self-hosted running & cardio tracker you actually own.**

Plan your season, design interval workouts, track your mileage, and sync your activities from Strava —
on your phone, synced across devices, behind your own passkey login.
No account on someone else's server, no subscription, no ads. Just `docker compose up`.

<br>

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-a3e635?style=flat-square)](LICENSE)
![Self-hosted](https://img.shields.io/badge/self--hosted-%F0%9F%8F%A0-60a5fa?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-installable-a78bfa?style=flat-square)
![React](https://img.shields.io/badge/React-19-38bdf8?style=flat-square&logo=react&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![No tracking](https://img.shields.io/badge/telemetry-none-f472b6?style=flat-square)

</div>

<br>

## Why

Most running apps lock your data behind a login on their servers, nag you to upgrade to premium for advanced analytics, or disappear when the startup does. openRunning is the opposite: **it runs on your box, your data stays in a folder you control, and it's yours to fork.** It still feels modern — installable as a home-screen app, passkey sign-in, offline support, sync across your phone and laptop.

## Features

- 📅 **Structured Training Plans** — build your running season with Phases (Base, Build, Peak, Taper), Weeks, and individual Sessions.
- ⏱️ **Advanced Workout Builder** — create complex interval sessions with warm-ups, work intervals, recoveries, and cool-downs. Set pace, heart rate, or RPE targets for each block.
- 👟 **Shoe Mileage Tracker** — register your running shoes, set their lifespan, and track the distance run on each pair to know when it's time to replace them.
- 🏅 **Race Management** — add your upcoming races (5K, 10K, Half Marathon, Marathon) to your calendar, and align your training plans to peak perfectly on race day.
- 🏃 **Pace & VDOT Calculations** — integrated pace calculators and estimated race times based on your current fitness level.
- 🔗 **Strava Integration** — easily fetch your actual running data and match it against your planned workouts to calculate compliance and weekly mileage.
- 🟩 **Activity Heatmap & Analytics** — visualize your running volume over time with beautiful charts and GitHub-style year views.
- 🔔 **Push notifications** — optional reminders on days you have a run planned but haven't logged one.
- 🔑 **Passkeys, not passwords** — Face ID / Touch ID / fingerprint login; each profile keeps its own data, synced across devices.
- 🎨 **Designed, not assembled** — light/dark themes, premium dashboard UI with glassmorphism, and a sleek dark mode.
- 📥 **Bring your history with you** — import your history seamlessly.
- 📦 **Yours to keep** — one-tap JSON export/import, guest mode, **no telemetry**.

## Quick start (self-host)

You need [Docker](https://docs.docker.com/get-docker/) with Compose.

```bash
git clone https://github.com/jmartinez-rs/openrunning
cd openrunning
cp .env.example .env
docker compose up -d --build
```

Open **http://localhost:8080**, tap **Create profile**, and you're in. 

> Want it reachable from your phone over the internet with passkeys? You'll need an HTTPS
> domain — a two-line change in `.env`. See **[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)**.

## How it works

```
┌─────────────┐        ┌──────────────────────────────┐
│  Your phone │──HTTPS─▶│  web  (nginx)                │
│  / laptop   │        │   ├─ serves the built app    │
│             │        │   └─ proxies /api ──────────┐│
└─────────────┘        └──────────────────────────────┘│
                                                        ▼
                                        ┌──────────────────────────┐
                                        │  api  (Node + WebAuthn)  │
                                        │   └─ ./data (JSON files) │
                                        └──────────────────────────┘
```

- **frontend/** — React + Vite (React Router, Tailwind CSS, TanStack Query), built to static files **inside Docker**
- **api/** — Node with no framework, one dependency (`@simplewebauthn/server`), storing everything as plain JSON files under `./data`
- **web/** — a multi-stage image that builds the frontend and serves it with nginx, proxying `/api` to the backend so it's all on **one origin** (passkeys require this)

## Your data

Lives in `./data` on your host: `db.json` (profiles + public passkeys), `state-<user>.json`
(each user's plan, workouts, body weight, settings), and `secret` (the session-cookie key).
**Back up `./data` and you've backed up everything.** Passkey private keys never touch the
server — they stay in your phone's secure hardware / your password manager.

## Configuration

All via `.env` (see `.env.example`):

| Variable      | What it is                                           | Default                 |
|---------------|------------------------------------------------------|-------------------------|
| `RP_ID`       | Hostname passkeys are bound to                       | `localhost`             |
| `ORIGIN`      | Full URL the app is served from                      | `http://localhost:8080` |
| `WEB_PORT`    | Host port for the web UI                             | `8080`                  |
| `RP_NAME`     | Name shown in the passkey prompt                     | `openRunning`           |

Push notification keys are generated on first run and saved to `./data/vapid.json` — nothing to set.

## Tech

React 19 + Vite (React Router, React Query) · Node (no framework) · nginx · Docker Compose ·
WebAuthn.
No database server, no cloud dependencies — the frontend builds inside Docker, so self-hosting
stays a one-command `docker compose up`.

## Contributing

Issues and PRs welcome! Good first issues: more starter plans, Strava/Garmin webhooks integration, GPX map rendering. **A ⭐ helps more people find it.**

openRunning is free and stays free: AGPL, no subscription, no paid tier, nothing held back for
sponsors. 

## License

[GNU AGPL v3.0](LICENSE) — free and open source. You can self-host, use, modify and share it;
if you run a modified version as a network service, you must offer that version's source under
the same license. Nobody can turn openRunning into a closed, proprietary product.
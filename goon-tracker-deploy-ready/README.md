# Goon Tracker — mobile-first web app

Track visits to the local basketball court known as "Goon." Each recorded visit is a goon.

## Prerequisites

1. **Node.js** (v20 LTS or newer)
2. **Docker Desktop** for Windows (needed for the local PostgreSQL service)

## 1. Start the database

```powershell
docker compose up -d
```

This starts a PostgreSQL container on `localhost:5432`. Check it's running:

```powershell
docker ps
```

You should see `goon_tracker_db` listed.

## 2. Configure environment variables

```powershell
Copy-Item .env.example .env
```

Then generate a real JWT secret and a database password, then put both in `.env`.
`DATABASE_URL` and `POSTGRES_PASSWORD` must use the same database password.

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

(Leave the Google/Apple values as placeholders for now — we'll fill those in when we build auth.)

## 3. Install and migrate

```powershell
npm ci
npm run prisma:deploy
```

## 4. Run the server

```powershell
npm run dev
```

Visit http://localhost:3000/health in your browser — you should see:

```json
{"status":"ok","db":"connected"}
```

That confirms Express and Postgres are talking to each other.

## Production

Set `NODE_ENV=production`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, and any OAuth variables in the host's secret manager. Then run:

```powershell
npm ci
npm run build
npm run prisma:deploy
npm start
```

The app serves its own static frontend and uses same-origin relative API paths, so deploy it as one Node service with PostgreSQL and share its HTTPS URL. A local `localhost` address, a ZIP download, or an IP address without HTTPS will not work for a friend on an iPhone or for production OAuth.

## OAuth configuration

- Google: set `GOOGLE_CLIENT_ID` to a Web OAuth client ID and add the public HTTPS deployment domain to its authorized JavaScript origins.
- Apple: set `APPLE_CLIENT_ID` (Service ID) and `APPLE_REDIRECT_URI`; add the exact HTTPS domain and return URL in Apple Developer. The browser never receives an Apple private key.
- With either configuration absent, the browser explains the missing setup and the API returns `503` rather than faking a login.

## Useful commands

- `npm run prisma:studio` — opens a GUI in your browser to browse/edit the database tables directly.
- `docker compose down` — stops the database container (data persists in a Docker volume).
- `docker compose down -v` — stops it **and wipes all data** (use if you want a clean slate).

## API reference

All routes except `/health` and `/auth/*` require `Authorization: Bearer <token>` (the JWT returned from `/auth/google` or `/auth/apple`).

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/health` | — | DB connectivity check |
| POST | `/auth/google` | `{ idToken, displayName? }` | Verifies a Google ID token, upserts the user, returns `{ token, user }` |
| POST | `/auth/apple` | `{ idToken, displayName? }` | Same, for Sign in with Apple |
| POST | `/goons` | — | Records one basketball court visit (one goon) for the current user (rate limited: 10/min) |
| GET | `/goons/me/stats` | — | `{ currentStreak, maxStreak, avgPerDay, maxPerDay, totalGoons }` |
| POST | `/groups` | `{ name }` | Creates a group, current user becomes owner + first member |
| POST | `/groups/join` | `{ inviteCode }` | Joins a group by its invite code |
| GET | `/groups` | — | Lists groups the current user belongs to |
| GET | `/groups/:groupId/leaderboard` | — | Friends-only leaderboard, ranked by current streak (403 if you're not a member) |
| GET | `/leaderboard` | — | Global top 100 by goon count in the last 30 days (`goonCountLast30Days`) |

### Security notes on what's already in place
- `helmet` sets standard protective HTTP headers.
- Global rate limit (300 req/15min/IP), tighter limits on `/auth/*` (20/15min) and `POST /goons` (10/min) — the two endpoints most worth abusing.
- JWTs expire (`JWT_EXPIRES_IN`, default 30 days); auth failures return a generic 401 rather than saying *why* (avoids helping an attacker fingerprint the failure mode).
- Request bodies capped at 10kb and validated with `zod` — malformed input is rejected before it reaches any database query.
- The server refuses to start if `JWT_SECRET`/`DATABASE_URL` are missing, or if the secret is too short.
- Group membership is checked before returning a friends leaderboard, so you can't read a group's data just by guessing its ID.
- Errors never leak stack traces or raw DB messages to the client in production.

## iPhone support

The frontend is vanilla HTML/CSS/JavaScript, has safe-area padding, touch-sized controls, no hover dependency, a web manifest, and a service worker. On iPhone Safari, open the deployed HTTPS address and use Share → Add to Home Screen. It remains a PWA rather than an App Store native application.

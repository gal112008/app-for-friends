# Deploying for free (no Docker, no local PC required)

Your friend can't reach `localhost` on their iPhone, and self-hosting from your
own PC means it's only online while your computer is on and specially
configured. The free path below puts it on a real HTTPS address instead —
no credit card, nothing stays running on your machine.

Stack: **Render** (runs the Node app, free web service) + **Neon** (free
Postgres, doesn't expire like Render's own free database does).

## 1. Push this code to GitHub
Create a free GitHub account if you don't have one, make a new repository,
and upload this folder to it (GitHub's web UI has an "upload files" option
if you don't want to use git commands).

## 2. Create the database (Neon)
1. Sign up free at neon.tech (no card).
2. Create a project. Copy the connection string it gives you — it looks like
   `postgresql://user:password@host/dbname?sslmode=require`. That's your
   `DATABASE_URL`.

## 3. Deploy the app (Render)
1. Sign up free at render.com (no card) and connect your GitHub account.
2. Click **New +** → **Blueprint**, pick this repository. Render reads the
   included `render.yaml` and sets up the web service automatically.
3. When it asks for `DATABASE_URL`, paste the Neon connection string from
   step 2. Leave `GOOGLE_CLIENT_ID` blank for now.
4. Click **Apply/Deploy**. First deploy takes a few minutes.
5. Once it's live, open `https://<your-service-name>.onrender.com/health` —
   you should see `{"status":"ok","db":"connected"}`.

Note: on Render's free tier the service falls asleep after 15 minutes of no
traffic and takes ~30–60 seconds to wake back up on the next visit. That's
normal, not a bug.

## 4. Turn on sign-in (required — no login works without this)
Right now nobody, including you, can log in: Google/Apple sign-in return
"not configured" until you add credentials. Google is the free path
(Apple Sign In needs a paid $99/yr Apple Developer account):

1. Go to console.cloud.google.com → APIs & Services → Credentials.
2. Create an **OAuth client ID**, type **Web application**.
3. Under "Authorized JavaScript origins," add your Render URL from step 3
   (`https://<your-service-name>.onrender.com`).
4. Copy the generated Client ID.
5. In Render, open your service → Environment, add `GOOGLE_CLIENT_ID` with
   that value, save (Render redeploys automatically).

## 5. Send it to your friend
Share the `https://<your-service-name>.onrender.com` link. On their iPhone,
they open it in Safari, sign in with Google, then Share → **Add to Home
Screen** so it behaves like an app icon.

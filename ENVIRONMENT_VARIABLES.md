# CivicStats SA environment keys

This note explains the environment-variable **names** used by CivicStats SA. Put values in Render's Environment page or in a private local `.env` file. Do not paste real secrets into this document, source code, screenshots, chat, or GitHub.

## Required for the production database

```dotenv
# Existing Neon PostgreSQL connection string. Set this privately on BOTH the
# civicstats-sa web service and civicstats-import-worker in Render.
# Example shape only; never copy this placeholder as a working credential.
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
```

The application enables certificate-verified TLS for Neon. Keep the complete connection string private.

## Optional air-quality map

```dotenv
# OpenAQ API key used by the web service to load station-level PM2.5 readings.
# Obtain the value from your OpenAQ account; set it only on civicstats-sa in Render.
OPENAQ_API_KEY=PASTE_YOUR_PRIVATE_OPENAQ_KEY_IN_RENDER
```

This key is optional. Without it, the website still starts, but the air-quality station layer reports that it needs setup.

## Administrator API access

```dotenv
# Secret bearer token for protected data-import administration endpoints.
# Render generates this automatically from render.yaml. Do not replace it with
# a short or guessable value, and never share it with website visitors.
CIVICSTATS_ADMIN_TOKEN=GENERATED_PRIVATE_TOKEN
```

This is not an OpenAQ key and is not needed to view the public website.

## Service settings

```dotenv
# Render deployment mode. The Blueprint sets this to production.
NODE_ENV=production

# Network interface for the web service. Render needs 0.0.0.0.
HOST=0.0.0.0

# Web server port. Render supplies this automatically; local development uses 3000 by default.
# Usually do not add or change this in Render.
PORT=10000

# Optional background-worker polling interval, in milliseconds. The default is 1000.
# Allowed range is 250 through 60000. This is a tuning value, not a password.
IMPORT_WORKER_POLL_INTERVAL_MS=1000
```

`HOST`, `NODE_ENV`, and `DATABASE_URL` are configured by the Render Blueprint. Render supplies `PORT` to web services. `IMPORT_WORKER_POLL_INTERVAL_MS` is optional and can be left unset.

## Add the OpenAQ key in Render

1. Sign in to [Render](https://dashboard.render.com/) and open the **civicstats-sa** web service.
2. Select **Environment** in the left menu, then **Add Environment Variable**.
3. Enter `OPENAQ_API_KEY` as the key and paste your OpenAQ key as the value.
4. Choose **Save, rebuild, and deploy**.
5. After the deploy is live, open the CivicStats SA dashboard, choose **Air quality · PM2.5**, and load station readings.

Never add `OPENAQ_API_KEY`, `DATABASE_URL`, or `CIVICSTATS_ADMIN_TOKEN` to a committed `.env` file. If a secret is exposed, rotate it with its provider and update Render.

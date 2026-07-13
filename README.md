# AI Job Search — Application Assistant (Web App)

A deployable web app that turns the AI job-search assistant into a real product:
**Node.js + Express backend** and a **Vue 3 frontend**, with pluggable AI providers
(**Grok**, **ChatGPT**, **Claude**), a **JSON datastore that swaps to PostgreSQL**
with no feature-code changes, and Docker-first deployment.

> This folder is a superset of the original Claude Code workspace. The workspace
> files (`.claude/`, `.agents/`, `cv/`, `cover_letters/`, `templates/`, the skills
> and slash-commands, `salary_lookup.py`, …) were copied in unchanged and still
> work exactly as before — see [WORKSPACE.md](WORKSPACE.md). The new web app lives
> in [`backend/`](backend/) and [`frontend/`](frontend/) alongside them.

## What it does (v1)

1. **Job-fit evaluation** — paste a posting, get an AI fit score + strengths/gaps.
2. **CV tailoring** and **cover-letter drafting** — generated from your stored profile,
   tailored to the posting.
3. **ATS review gate before download** — see an ATS score + recommendations, then
   choose **Download** (a ZIP of `job_description.txt` + CV PDF + cover-letter PDF) or
   **Discard** (nothing is kept).

**Nothing generated is stored on the server** — job descriptions, CVs, cover letters
and the ZIP are produced per-request and streamed to your browser. Only your account,
profile, settings, and (encrypted) API keys are persisted.

## Multi-provider AI

- The app ships with **Grok** as the default provider slot and the fallback secondary.
- Add an API key for **any** provider in **Settings**; the one you activate becomes the
  **primary**, with Grok as the automatic fallback. Switch the primary any time.
- Providers and default models:
  | Provider | Default model | API |
  |---|---|---|
  | Grok (x.ai) | `grok-2-latest` | OpenAI-compatible |
  | ChatGPT (OpenAI) | `gpt-4o` | OpenAI |
  | Claude (Anthropic) | `claude-opus-4-8` | official `@anthropic-ai/sdk` |
- **The app ships with no keys** — add at least one in Settings for AI features to work
  (Grok's API is not literally free; it just occupies the default slot).
- Keys are **encrypted at rest** (AES-256-GCM via `APP_SECRET`) and never returned to the browser.

## PDF generation (dual pipeline)

- **HTML/CSS → PDF (default)** via headless Chromium (Puppeteer) — works for everyone.
- **LaTeX (optional)** — paste your own `.tex` templates (with a `{{CONTENT}}` placeholder)
  in Settings. When a TeX toolchain is available, the CV compiles with `lualatex` and the
  cover letter with `pdflatex`; otherwise the app falls back to HTML→PDF.

## Run locally

Prereqs: Node 20+.

```bash
# 1) Backend
cd backend
cp .env.example .env          # then edit JWT_SECRET / APP_SECRET
npm install                   # downloads Chromium for Puppeteer
npm run dev                   # http://localhost:4000

# 2) Frontend (second terminal)
cd frontend
cp .env.example .env          # VITE_API_BASE_URL=http://localhost:4000
npm install
npm run dev                   # http://localhost:5173
```

Open http://localhost:5173 → register → **Profile** (fill it in) → **Settings**
(add an API key) → **Generate**.

## Run with Docker

```bash
cp .env.example .env          # set real JWT_SECRET / APP_SECRET
docker compose up --build     # frontend → http://localhost:8080, backend → :4000
```

Bundle a LaTeX toolchain into the backend image (heavy):

```bash
docker compose build --build-arg WITH_LATEX=true backend
```

## Switch the datastore JSON → PostgreSQL

The backend depends only on repository interfaces ([`backend/src/db/repositories.ts`](backend/src/db/repositories.ts)),
so switching the driver requires **no feature-code changes**.

```bash
# Local
cd backend
export DB_DRIVER=postgres
export DATABASE_URL=postgresql://appuser:apppass@localhost:5432/aijobsearch?schema=public
npx prisma migrate dev        # create tables
npm run dev

# Docker
DB_DRIVER=postgres docker compose --profile postgres up --build
```

## Configuration

All variables are documented in [`.env.example`](.env.example) and
[`backend/.env.example`](backend/.env.example): `PORT`, `NODE_ENV`, `DB_DRIVER`
(`json`|`postgres`), `JSON_DB_PATH`, `DATABASE_URL`, `JWT_SECRET`, `APP_SECRET`,
`CORS_ORIGIN`, `PUPPETEER_EXECUTABLE_PATH`, and the frontend's `VITE_API_BASE_URL`.

## Push to your own GitHub repo

This folder is a **fresh git repo** (no history inherited from the workspace). Create an
empty repo on GitHub, then:

```bash
git add -A
git commit -m "Initial commit: AI Job Search web app"
git branch -M main
git remote add origin https://github.com/<your-username>/ai-job-search-app.git
git push -u origin main
```

## Architecture

```
backend/   Express + TypeScript
  src/config      env loading/validation (zod)
  src/db          repository interfaces + json/ and postgres/ (Prisma) implementations
  src/ai          AIProvider interface + grok/openai/claude + registry (primary+fallback)
  src/auth        register/login, JWT, bcrypt, auth middleware
  src/crypto      AES-256-GCM for API keys at rest
  src/prompts     system/user prompts (ported from the workspace skills)
  src/modules     profile · settings · generate (evaluate/cv/cover/ats) · package (ZIP)
  src/pdf         html.ts (Puppeteer) + latex.ts (latexmk) + index.ts (chooser)
frontend/  Vue 3 + Vite + Pinia + Vue Router + Tailwind
  src/views       Login · Register · Generate · Evaluate · Profile · Settings
```

## API reference (all under `/api`, JWT-protected except auth)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | Account + JWT |
| GET/PUT | `/profile` | Candidate profile |
| GET/PUT | `/settings`, `/settings/api-key`, `/settings/model`, `/settings/active-provider`, `/settings/latex-template` | Provider keys, active provider, models, LaTeX templates |
| POST | `/evaluate` | Job-fit score |
| POST | `/generate/cv`, `/generate/cover-letter` | Tailored documents |
| POST | `/ats-review` | ATS score + recommendations (before download) |
| POST | `/package` | Streams the ZIP (JD + CV PDF + cover PDF) |

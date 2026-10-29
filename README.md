# CareerLens AI

CareerLens AI is a local-first resume analysis and career-planning application for students and fresh graduates. It includes a React/TypeScript frontend and a FastAPI/SQLAlchemy backend. Without provider credentials it performs deterministic, transparent rule-based analysis. An optional OpenAI-compatible endpoint can generate a resume summary only after the student explicitly opts in.

## What works

- Student registration, login, short-lived signed bearer sessions, and account deletion.
- Private PDF/DOCX uploads, validated by document signature and parsed into selectable text.
- Resume analysis with categorized keyword evidence, transparent quality components, role matches, skill gaps, improvement suggestions, and heuristic ATS checks.
- Optional AI-only summary with explicit consent and configured provider; provider failures are reported.
- Persisted learning tasks, job-description keyword comparison, resume version comparison API, JSON/PDF exports, and per-user authorization checks.
- Responsive dashboard, resume library, analysis details, learning plan, and job description matcher.

Scores are estimates derived from resume text. They are not ATS scores, guarantees of qualification, or predictions of hiring outcomes. Skills not found in the document may still be possessed by the student. Do not add unsupported achievements or qualifications.

## Local setup

### Backend

Python 3.11+ is required.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `JWT_SECRET` in `backend/.env` to a unique long random value before using real personal data. Without a configured secret, a random process-local key is generated, so sessions expire on restart. Default local settings use SQLite and write uploads beneath `backend/uploads/`. Configure `DATABASE_URL` for PostgreSQL in deployments.

Initialize the database and run the API:

```powershell
alembic upgrade head
uvicorn app.main:app --reload --port 8100
```

Interactive API documentation: <http://127.0.0.1:8000/docs>. Health check: <http://127.0.0.1:8000/health>.

### Frontend

In another terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open <http://127.0.0.1:5173>. `VITE_API_URL` points to the FastAPI origin (port `8100` for the local setup). The browser stores the short-lived access token in `sessionStorage` and removes it on logout; deployments should use HTTPS and consider a hardened HttpOnly-cookie session and CSRF protection.

## AI provider configuration

Set `AI_API_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` in the backend environment to use an OpenAI-compatible `/chat/completions` endpoint. No resume is transmitted to the provider unless the student selects the explicit consent checkbox on the analysis page. Only the summary is provider-generated; skills, scores, recommendations, and gaps remain rule-based. A provider error is surfaced and does not silently convert into a successful AI result. Leave these variables unset to run entirely in rule-based mode.

## Database and migrations

SQLAlchemy models live in `backend/app/models.py`. Use Alembic for schema changes:

```powershell
cd backend
alembic upgrade head
```

SQLite is intended for local development. Set a PostgreSQL `DATABASE_URL` and install the relevant SQLAlchemy PostgreSQL driver for production.

## Docker

Set `JWT_SECRET` in the environment, then from the repository root:

```powershell
docker compose up --build
```

The frontend is served at <http://localhost:8080> and the API at <http://localhost:8000>. Persistent database and upload files are stored in the `careerlens-data` volume. Configure a non-public secret manager, TLS reverse proxy, origin allowlist, backups, and retention policy before production use.

## Tests and checks

```powershell
cd backend
python -m pytest
```

```powershell
cd frontend
npm run build
```

The backend tests cover deterministic skill extraction/scoring, job matching, and malformed PDF handling. OCR is not configured; scanned image-only PDFs produce a clear error. A curated initial role-skill dataset is included in `backend/app/services/analysis.py`; it is a small editable starter set, not a live labor-market database.

## Privacy and security notes

- Uploads are stored under opaque UUID names and each API resource checks the authenticated owner.
- Passwords use Argon2; tokens are signed and expire. Logout removes the token from the browser; it is not a server-side token revocation mechanism.
- Resume contents and analysis data are stored locally in the configured database. Restrict filesystem/database access, configure backups and deletion retention, and do not expose the upload directory through a web server.
- CORS is restricted to `FRONTEND_ORIGINS`. Never use the development JWT secret with real data.
- This starter implementation does not include rate limiting, email verification, refresh-token rotation, OCR, or production cookie/CSRF session handling. Add those controls and have the deployment reviewed before exposing it publicly.

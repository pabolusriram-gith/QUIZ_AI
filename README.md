# QuizVerse AI — Technical Platform Architecture & Codebase

QuizVerse AI is a commercial-grade, real-time AI-powered quiz and interactive learning platform inspired by Slido, Kahoot!, and Mentimeter. It is designed to scale to **10,000+ concurrent live participants** using a stateless backend design, Redis Pub/Sub connection synchronization, and robust AI generation pipelines.

---

## 🏗️ Architecture Overview

The system operates on a containerized, stateless, three-tier architecture:

- **Presentation Layer**: Next.js 14+ (App Router) frontend, compiled statically or running under node, served via an Nginx reverse proxy.
- **Application Layer**: FastAPI (Python 3.11+) backend running under Uvicorn, serving REST APIs and real-time WebSockets.
- **Data & Cache Layer**: PostgreSQL 16 relational database engine and Redis 7 in-memory cache, rate-limiter, and connection Pub/Sub coordinator.

```mermaid
graph TD
    Client[Web Browsers / Clients] -->|HTTPS: 443| Nginx{Nginx Reverse Proxy}
    Nginx -->|Route /| Frontend[Next.js App Server - Port 3000]
    Nginx -->|Route /api/v1| Backend[FastAPI App Server - Port 8000]
    Backend -->|Async SQLAlchemy / Postgresql| PostgreSQL[(PostgreSQL DB)]
    Backend -->|Pub/Sub & Rate Limiting| Redis[(Redis Cache / Broker)]
```

---

## 📁 Repository Structure

```
QuizVersaAI/
├── backend/                  # FastAPI Application
│   ├── alembic/              # Database migration scripts and version history
│   ├── app/
│   │   ├── config/          # Settings & Pydantic config
│   │   ├── core/            # Security, JWT, Argon2, AI providers
│   │   ├── database/        # Async SQLAlchemy engine
│   │   ├── models/          # ORM models (User, Quiz, Question, etc.)
│   │   ├── schemas/         # Pydantic validation schemas
│   │   ├── services/        # Domain business logic (Connection Manager, AI generation)
│   │   ├── repositories/    # Database query layer
│   │   └── main.py          # FastAPI entrypoint
│   ├── Dockerfile
│   ├── Dockerfile.prod       # Production FastAPI Docker configuration
│   ├── requirements.txt      # Python dependencies
│   ├── pytest.ini            # Pytest configuration
│   └── alembic.ini           # Alembic migration configuration
├── frontend/                 # Next.js Application
│   ├── src/
│   │   ├── app/             # Next.js App Router (pages and layouts)
│   │   ├── components/      # Atomic UI components
│   │   ├── features/        # Business feature modules
│   │   ├── styles/          # Design tokens & CSS
│   │   └── types/           # TypeScript contracts
│   ├── Dockerfile
│   ├── Dockerfile.prod       # Production Next.js Docker configuration
│   └── package.json          # Node dependencies
├── nginx/                    # Production Reverse Proxy Configuration
│   ├── Dockerfile            # Nginx Docker build configuration
│   ├── nginx.conf            # Core Nginx router configuration
│   └── quizverse.conf        # SSL and Reverse proxy endpoints configuration
├── scripts/                  # Automation and utility scripts
│   ├── db_backup.sh          # PostgreSQL backup script
│   └── db_restore.sh         # PostgreSQL database recovery script
├── docker-compose.yml        # Local development multi-container orchestration
└── docker-compose.prod.yml   # Production orchestration configurations
```

---

## 🚀 Quick Start Guide

### 1. Prerequisite Environment Setup
Copy the example environment files and update them with your API keys:
- Backend configuration: `backend/.env` (configured using `backend/.env.example`)
- Frontend configuration: `frontend/.env.local`

Ensure the backend `.env` contains the required keys:
```ini
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
GROQ_API_KEY=your_groq_api_key
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/quizverse_db
REDIS_URL=redis://localhost:6379/0
```

### 2. Run with Docker Compose (Recommended)
To spin up all services (Postgres, Redis, FastAPI backend, Next.js frontend, and Nginx proxy) locally:
```bash
docker-compose up --build
```
Once healthy:
- **Frontend Application**: `http://localhost:3000`
- **Backend Swagger Docs**: `http://localhost:8000/api/v1/docs`
- **Backend Health Check**: `http://localhost:8000/health`

### 3. Local Manual Setup (Without Docker)

#### Backend setup:
1. Initialize virtual environment and install packages:
   ```bash
   cd backend
   python -m venv venv
   source venv/Scripts/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```
2. Apply migrations:
   ```bash
   alembic upgrade head
   ```
3. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

#### Frontend setup:
1. Install node dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```

---

## 🔒 Database Design & Security (Row Level Security)

QuizVerse AI implements strict PostgreSQL Row Level Security (RLS) to enforce data boundaries at the database level when accessed via client-direct services (like Supabase API endpoints).

### Protected Tables & Policies

| Table Name | RLS Status | Primary Security Constraint |
| :--- | :---: | :--- |
| `users` | Enabled | Users can read and update only their own profile details (`id = auth.uid()`). |
| `quizzes` | Enabled | Quiz owner has full CRUD; others can only retrieve public, published quizzes (`created_by_id = auth.uid() OR (visibility = 'public' AND status = 'published')`). |
| `questions` | Enabled | Mutation is restricted to the quiz owner. Public users can only read questions belonging to public, published quizzes. |
| `question_options`| Enabled | Mutation is restricted to the quiz owner. Options can only be read if the parent quiz is public and published. |
| `login_history` | Enabled | Users can select or insert only their own login audit history records (`user_id = auth.uid()`). |
| `quiz_attempts` | Enabled | Students can view and write their own attempts; teachers can retrieve attempts for quizzes they created. |
| `document_chunks` | Enabled | Restricted to users authenticated with the role of `teacher` or `admin`. |

### Performance Optimization (Indexes)
To avoid table scans during policy evaluation under heavy concurrent load, the following indices are maintained:
- `ix_quizzes_created_by_id` on `quizzes(created_by_id)`
- `ix_questions_quiz_id` on `questions(quiz_id)`
- `ix_question_options_question_id` on `question_options(question_id)`
- `ix_quiz_attempts_quiz_id` on `quiz_attempts(quiz_id)`
- `ix_quiz_attempts_user_id` on `quiz_attempts(user_id)`
- `ix_login_history_user_id` on `login_history(user_id)`

### Local Dev Database Compatibility Layer
To enable local execution without native Supabase environments, [backend/alembic/env.py](file:///d:/QuizVersaAI/backend/alembic/env.py) dynamically performs compatibility schema updates:
- It checks if the PostgreSQL `auth` schema exists.
- If it is missing (Local Dev PG), it creates a mock `auth` schema, mock `auth.uid()` function, and registers roles `anon`, `authenticated`, and `service_role` dynamically.
- In production, it skips setup completely, ensuring compatibility with the managed Supabase engine.

---

## ⚡ WebSocket Real-Time Synchronization Layer

Real-time synchronization for game state propagation (joining lobbies, starting quizzes, question ticks, locking answers, and updating leaderboards) is driven by WebSockets combined with a Redis Pub/Sub backplane.

### Features
1. **Multi-Instance Support**: When multiple backend instances scale horizontally, messages broadcasted on Instance A are published to the Redis Pub/Sub channel. Other instances subscribing to the channel forward the event to their local connected WebSockets.
2. **State Tracking**: Keeps transient records of live players (`loaded_players`), responses (`answered_players`), and nickname mappings (`nickname_websockets`).
3. **Stale Connection Pruning**: Detects and purges dead or zombie socket threads using periodic heartbeat routines.

---

## 🤖 AI Generation Pipeline

Quizzes can be generated automatically from raw text prompts or uploaded document attachments.

### Pipeline Reliability Mechanisms
1. **Fallback Provider Chain**: Configured dynamically via `AUTO_PROVIDER_ORDER`. If the preferred provider fails (e.g. Rate Limits, Server Error), requests auto-route downstream (typically: `groq` -> `gemini` -> `openai`).
2. **Circuit Breaker Statuses**:
   - `CLOSED`: Normal operation.
   - `OPEN`: Failures exceeded threshold. Incoming calls bypass the provider immediately and fast-fail or cascade.
   - `HALF_OPEN`: Cooldown period elapsed. A single probe request checks if the provider is healthy. If successful, shifts to `CLOSED`; otherwise, returns to `OPEN`.
3. **JSON Self-Healing Parser**: Programmatically repairs common LLM syntax errors, including smart/curly quotes, trailing commas in objects, unclosed braces/brackets, and markdown code block wrappers (e.g. ` ```json `).
4. **Prompt Leakage Security**: Scans output structures and raw generated question stems for configuration/injection keyword attempts and isolates malicious input.

---

## 🌐 Production Deployment Guide

### HTTPS and Reverse Proxy
Configure Nginx as a reverse proxy to terminate TLS connections at port `443`.
1. Provision Let's Encrypt certificates on the host:
   ```bash
   certbot certonly --webroot -w /var/www/certbot -d quizverse.ai
   ```
2. Mount certificates at `/etc/nginx/ssl/quizverse.crt` and `/etc/nginx/ssl/quizverse.key`.
3. Set Nginx configurations to support HTTP/2 and modern TLS protocols (disable SSLv3, TLSv1, TLSv1.1).

### Zero-Downtime Migration Policy
All database schema updates run via `alembic upgrade head` in the release stage of your pipeline.
- Schema changes must be backward-compatible (e.g. add columns as nullable first, migrate data in a backend routine, and apply non-null constraints in a subsequent release).

### Database Backup Strategy
Database backups are executed via cron calling the provided scripts:
- **Backup**: `bash scripts/db_backup.sh` (dumps schema/data to compressed SQL, pushes to secure private S3 buckets).
- **Restore**: `bash scripts/db_restore.sh` (pulls and restores backup).

---

## 🛠️ Operations & Runbooks

### Runbook 1: System Outage (502 / 504 Gateway Timeout)
1. Check Nginx proxy logs to see which container is unreachable:
   ```bash
   docker logs quizverse_nginx_prod --tail 100
   ```
2. Check resource configurations and status of the application layers:
   ```bash
   docker stats
   docker compose -f docker-compose.prod.yml ps
   ```
3. Restart failed container if stopped or crashed:
   ```bash
   docker compose -f docker-compose.prod.yml restart backend
   ```

### Runbook 2: DB Connection Pools Reached (QueuePool overflow)
1. Verify database responsiveness:
   ```bash
   docker exec -it quizverse_postgres_prod pg_isready -U postgres
   ```
2. Check open connection count:
   ```sql
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
   ```
3. If necessary, increase `max_connections` inside `postgresql.conf` (`max_connections = 200`) and restart PostgreSQL. Ensure FastAPI endpoints close connections by double-checking `AsyncSession` closures in backend services.

### Runbook 3: Resetting Tripped AI Circuit Breakers
If an API provider has recovered but the circuit breaker is still cooling down in an `OPEN` state, restart the backend container to reset the in-memory breaker state immediately:
```bash
docker compose -f docker-compose.prod.yml restart backend
```

### Runbook 4: JWT Secret Key Rotation
1. Generate a new cryptographically secure random key:
   ```bash
   openssl rand -hex 32
   ```
2. Update the `SECRET_KEY` environment variable.
3. *Note*: Rotating the key immediately invalidates active user sessions, forcing users to re-authenticate when their access token expires.

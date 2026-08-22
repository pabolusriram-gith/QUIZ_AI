# 🌟 QuizVerse AI — Real-Time AI Assessment & Quiz Platform

<p align="center">
  <img src="https://img.shields.io/badge/Deployment-Vercel%20%26%20Render-blue?style=for-the-badge&logo=vercel" alt="Deployment" />
  <img src="https://img.shields.io/badge/Frontend-Next.js%2014-black?style=for-the-badge&logo=next.js" alt="Next.js 14" />
  <img src="https://img.shields.io/badge/Backend-FastAPI%20%2F%20Python-009688?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL%2016-336791?style=for-the-badge&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Cache%20%26%20PubSub-Redis%207-DC382D?style=for-the-badge&logo=redis" alt="Redis" />
</p>

QuizVerse AI is a commercial-grade, real-time AI-powered assessment and interactive classroom learning platform inspired by Kahoot!, Slido, and Mentimeter. It is engineered to scale to **10,000+ concurrent live participants** using a stateless backend design, Redis Pub/Sub multi-server synchronization, and multi-model AI generation pipelines (Groq, Google Gemini, OpenAI).

---

## 🔗 Live Application Links

| Portal | Live Link | Description |
| :--- | :--- | :--- |
| 🌐 **Production App** | [https://quiz-ai-rust-one.vercel.app](https://quiz-ai-rust-one.vercel.app) | Main landing page & assessment platform |
| 🎮 **Student Join Arena** | [https://quiz-ai-rust-one.vercel.app/join](https://quiz-ai-rust-one.vercel.app/join) | Instant game PIN & nickname entry (No login required) |
| 👨‍🏫 **Teacher / Host Portal** | [https://quiz-ai-rust-one.vercel.app/login](https://quiz-ai-rust-one.vercel.app/login) | Google OAuth & email authentication for educators |
| ⚡ **Backend API (Render)** | [https://quizverse-backend-snf6.onrender.com](https://quizverse-backend-snf6.onrender.com) | FastAPI REST & WebSocket server |
| 📚 **Interactive Swagger API**| [https://quizverse-backend-snf6.onrender.com/api/v1/docs](https://quizverse-backend-snf6.onrender.com/api/v1/docs) | Live OpenAPI documentation |

---

## ✨ Key Features

- 🧠 **AI-Powered Quiz Generation**: Create rich quizzes from text prompts, custom topics, or uploaded PDF/DOCX documents in seconds with automatic distractors and Bloom's taxonomy alignment.
- ⚡ **Real-Time Live Multiplayer Arena**: Low-latency WebSocket multiplayer lobbies with synchronized countdown timers, instantaneous live leaderboards, and streak multiplier scoring.
- 🔐 **Enterprise Security & Google OAuth**: Google OAuth 2.0 and JWT Argon2id authentication, rate-limiting protection, and token versioning.
- 🛡️ **PostgreSQL Row-Level Security (RLS)**: Enforced database-level boundary isolation between teachers, students, and assessments.
- 🔄 **Self-Healing Multi-AI Fallback**: Resilient cascading AI router (`Groq` ➡️ `Gemini` ➡️ `OpenAI`) with JSON self-healing and circuit breaker protections.
- 📊 **Deep Classroom Analytics**: Student accuracy breakdowns, AI-driven improvement insights, and exportable report summaries.

---

## 🏗️ Architecture Overview

The system operates on a containerized, stateless, three-tier architecture:

- **Presentation Layer**: Next.js 14+ (App Router) with Tailwind CSS, Framer Motion, and Lucide icons.
- **Application Layer**: FastAPI (Python 3.11+) asynchronous backend serving REST endpoints and high-concurrency WebSockets.
- **Data & Cache Layer**: PostgreSQL 16 relational database engine and Redis 7 in-memory cache, rate-limiter, and connection Pub/Sub coordinator.

```mermaid
graph TD
    Client[Web Browsers / Clients] -->|HTTPS: 443| Nginx{Nginx Reverse Proxy / Vercel}
    Nginx -->|Route /| Frontend[Next.js App Server]
    Nginx -->|Route /api/v1| Backend[FastAPI App Server]
    Backend -->|Async SQLAlchemy / AsyncPG| PostgreSQL[(PostgreSQL DB)]
    Backend -->|Pub/Sub & Rate Limiting| Redis[(Redis Cache / Broker)]
```

---

## 📁 Repository Structure

```
QuizVersaAI/
├── .github/workflows/        # CI/CD GitHub Actions pipelines
├── backend/                  # FastAPI Application (Python 3.11+)
│   ├── alembic/              # Database migration scripts and version history
│   ├── app/
│   │   ├── api/v1/endpoints/ # API routes (auth, quizzes, sessions, ai, attempts)
│   │   ├── config/           # Pydantic Settings & environment validators
│   │   ├── core/             # Security, JWT, Argon2, AI providers, Rate-limiters
│   │   ├── database/         # Async SQLAlchemy engine & session dependency
│   │   ├── models/           # SQLAlchemy ORM models (User, Quiz, Question, etc.)
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   └── services/         # Domain business logic (Live Manager, AI generator)
│   ├── Dockerfile
│   ├── Dockerfile.prod       # Production FastAPI Docker configuration
│   ├── requirements.txt      # Python dependencies
│   └── alembic.ini           # Alembic migration configuration
├── frontend/                 # Next.js 14 Application (TypeScript)
│   ├── src/
│   │   ├── app/              # Next.js App Router (pages and layouts)
│   │   ├── components/       # Atomic UI components, modals, and dashboard cards
│   │   ├── context/          # React Auth and state contexts
│   │   ├── services/         # Axios API clients & WebSocket managers
│   │   ├── styles/           # Global CSS and Tailwind design tokens
│   │   └── types/            # TypeScript contracts
│   ├── Dockerfile
│   ├── Dockerfile.prod       # Production Next.js Docker configuration
│   └── package.json          # Node dependencies
├── nginx/                    # Production Reverse Proxy Configuration
├── scripts/                  # Automation, database backup & restore scripts
├── docker-compose.yml        # Local development multi-container orchestration
└── docker-compose.prod.yml   # Production orchestration configurations
```

---

## 🚀 Quick Start Guide

### 1. Environment Setup

Copy the example environment files and configure your credentials:
- Backend: `backend/.env` (configured using `backend/.env.example`)
- Frontend: `frontend/.env.local`

Ensure the backend `.env` contains:
```ini
ENVIRONMENT=development
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/quizverse_db
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your_32_character_jwt_secret_key
FRONTEND_URL=http://localhost:3000

# AI Provider Keys
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

---

### 2. Run with Docker Compose (Recommended)

To spin up all services locally (Postgres, Redis, FastAPI backend, Next.js frontend, and Nginx proxy):
```bash
docker-compose up --build
```

Access locally:
- **Frontend App**: `http://localhost:3000`
- **Backend Swagger Docs**: `http://localhost:8000/api/v1/docs`
- **Backend Health Check**: `http://localhost:8000/health`

---

### 3. Local Manual Setup

#### Backend:
```bash
cd backend
python -m venv venv
# On Windows: venv\Scripts\activate
# On Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

#### Frontend:
```bash
cd frontend
npm install
npm run dev
```

---

## 🔒 Database Design & Security (Row Level Security)

QuizVerse AI implements strict PostgreSQL Row Level Security (RLS) to enforce data boundaries at the database level:

| Table Name | RLS Status | Primary Security Constraint |
| :--- | :---: | :--- |
| `users` | Enabled | Users can read and update only their own profile details (`id = auth.uid()`). |
| `quizzes` | Enabled | Quiz owner has full CRUD; others can only retrieve public, published quizzes. |
| `questions` | Enabled | Modification restricted to owner; students only read questions of active quizzes. |
| `question_options`| Enabled | Options can only be read if the parent quiz is public and published. |
| `quiz_attempts` | Enabled | Students view their own submissions; teachers view attempts for their quizzes. |
| `login_history` | Enabled | Users can select or insert only their own login audit records. |

---

## ⚡ WebSocket Real-Time Synchronization Layer

Multiplayer synchronization (joining lobbies, live question ticks, answer locks, and instant leaderboards) is driven by WebSockets combined with a **Redis Pub/Sub backplane**:

1. **Multi-Instance Support**: When multiple backend instances scale horizontally, messages published to Redis Pub/Sub synchronize state across all connected server instances seamlessly.
2. **State Tracking**: Real-time tracking of active players (`loaded_players`), submissions (`answered_players`), and WebSocket handles.
3. **Heartbeat & Pruning**: Detects and purges dead or zombie socket connections automatically.

---

## 📄 License & Attribution

Distributed under the MIT License. Built with ❤️ for modern classrooms and interactive assessment environments.

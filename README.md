# QuizVerse AI - Technical Platform Architecture & Codebase

QuizVerse AI is a commercial-grade, real-time AI-powered quiz and interactive learning platform inspired by Slido, Kahoot!, and Mentimeter, designed to scale to **10,000+ concurrent live participants**.

---

## 🏗️ Architecture Overview

- **Frontend**: Next.js 14+ (App Router), React 18, TypeScript, TailwindCSS, Zustand, TanStack Query, Framer Motion.
- **Backend**: FastAPI (Python 3.11+), Pydantic v2, SQLAlchemy (Async), Alembic, Argon2id, PyJWT.
- **Real-Time Engine**: WebSockets over Redis Pub/Sub backplane.
- **Database & Cache**: PostgreSQL (v16) relational engine & Redis (v7) in-memory store.
- **AI Engines**: Google Gemini API & OpenAI API for instant quiz generation.
- **Containerization**: Docker & Docker Compose setup for localized development and Kubernetes deployment.

---

## 🚀 Quick Start with Docker Compose

To launch the full stack locally (PostgreSQL, Redis, FastAPI, and Next.js):

```bash
docker-compose up --build
```

- **Frontend Application**: `http://localhost:3000`
- **Backend Swagger Docs**: `http://localhost:8000/api/v1/docs`
- **Backend Health Check**: `http://localhost:8000/health`

---

## 📁 Repository Structure

```
QuizVersaAI/
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── config/          # Settings & Pydantic config
│   │   ├── core/            # Security, JWT, Argon2
│   │   ├── database/        # Async SQLAlchemy engine
│   │   ├── models/          # ORM models
│   │   ├── schemas/         # Pydantic validation schemas
│   │   ├── services/        # Domain business logic
│   │   ├── repositories/    # Database query layer
│   │   └── main.py          # FastAPI entrypoint
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                 # Next.js Application
│   ├── src/
│   │   ├── app/             # Next.js App Router
│   │   ├── components/      # Atomic UI components
│   │   ├── features/        # Business feature modules
│   │   ├── styles/          # Design tokens & CSS
│   │   └── types/           # TypeScript contracts
│   ├── Dockerfile
│   └── package.json
└── docker-compose.yml        # Multi-container orchestration
```

---

## 📄 Documentation

- [Software Architecture Specification](file:///C:/Users/pabol/.gemini/antigravity-ide/brain/16ef86fc-16b9-4533-a41d-c4e1c1c8f5cd/quizverse_ai_architecture.md)
- [Row Level Security (RLS) Database Specification](file:///c:/Users/pabol/OneDrive/Desktop/QuizVersaAI/SUPABASE_RLS.md)

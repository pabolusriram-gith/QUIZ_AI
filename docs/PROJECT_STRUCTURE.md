# QuizVerse AI Project Structure

## 📂 Root Directory
- `backend/` - FastAPI backend application and Python dependencies
- `frontend/` - Next.js frontend application and TypeScript dependencies
- `docs/` - Project documentation, architectural decisions, and runbooks
- `scripts/` - Utility scripts for database backup and restore
- `nginx/` - Nginx configuration and Dockerfiles for production deployment
- `docker-compose.yml` - Local development Docker configuration
- `docker-compose.prod.yml` - Production Docker configuration
- `start.bat` - Local development startup script
- `README.md` - Primary entry point documentation

## 📂 Documentation (`docs/`)
- `architecture/` - System architecture, database schema, and security rules (e.g. `SUPABASE_RLS.md`)
- `deployment/` - Deployment runbooks, disaster recovery plans, and production guidelines
- `security/` - Security audits and guidelines
- `testing/` - Walkthroughs, acceptance tests, performance reports, and pipeline verification logs
- `audits/` - License and dependency audits
- `reports/` - General organization and project reports

## 📂 Backend (`backend/`)
- `alembic/` - Database migration scripts and version history
- `app/` - Core FastAPI application code, models, schemas, routers, and services
- `tests/` - Organized testing directory
  - `integration/` - Integration tests across components
  - `acceptance/` - End-to-end acceptance testing scripts
  - `security/` - Security testing scripts
- `requirements.txt` - Python dependencies
- `.env` / `.env.example` - Environment configuration files

## 📂 Frontend (`frontend/`)
- `src/` - Next.js source code (pages, components, styles)
- `public/` - Static assets
- `package.json` - Node.js dependencies
- `tsconfig.json` - TypeScript configuration

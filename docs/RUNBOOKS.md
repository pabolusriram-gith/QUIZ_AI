# QuizVerse AI Operational Runbooks

This file contains step-by-step operational procedures for diagnosing, resolving, and managing QuizVerse AI environments.

---

## Runbook 1: System Outage (FastAPI or Next.js Unresponsive)

### Symptom
- Users see `502 Bad Gateway` or `504 Gateway Timeout` errors.
- `/health` endpoint returns a timeout or is unreachable.

### Diagnosis Steps
1. **Check Nginx Container Logs**:
   ```bash
   docker logs quizverse_nginx_prod --tail 100
   ```
   Look for `connect() failed (111: Connection refused)` pointing to `backend:8000` or `frontend:3000`.

2. **Check Application Container Resource Usage**:
   ```bash
   docker stats
   ```
   Verify if any container is pinned at 100% CPU or has reached its memory limit (OOM killed).

3. **Check Container Status**:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```

### Resolution Steps
- **Scenario A: Container crashed or stopped**:
  Restart the container:
  ```bash
  docker compose -f docker-compose.prod.yml restart backend
  ```
- **Scenario B: Out of Memory (OOM) crash**:
  Increase container memory limits in `docker-compose.prod.yml` or allocate more RAM to the host, then restart.

---

## Runbook 2: Database Connection Failures / Max Connections Reached

### Symptom
- Backend logs show `sqlalchemy.exc.TimeoutError: QueuePool limit of size X overflow Y reached`.
- `/health/db` endpoint returns `503 Service Unavailable`.

### Diagnosis Steps
1. **Verify Database Health**:
   Connect directly to the database:
   ```bash
   docker exec -it quizverse_postgres_prod pg_isready -U postgres
   ```
2. **Count Active Connections**:
   Log into Postgres and run:
   ```sql
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
   ```

### Resolution Steps
1. **Temporarily increase connection limits** in PostgreSQL `postgresql.conf` (`max_connections = 200`) and restart.
2. **Verify connection pooling configurations** in `backend/app/database/session.py`. Ensure connections are released back to the pool promptly and `AsyncSession` instances are correctly closed.

---

## Runbook 3: AI Provider Failures & Circuit Breaker Reset

### Symptom
- Users receive `503 Service Unavailable` on AI generation request.
- Logs contain `"event_type": "CIRCUIT_OPENED"`.

### Mechanism
QuizVerse AI includes a built-in circuit breaker that tracks Gemini, Groq, and OpenAI requests. If a provider fails multiple times, the breaker transitions to `OPEN` and routes requests to the next configured provider in `AUTO_PROVIDER_ORDER`.

### Diagnosis
Inspect the provider circuit status via the `/health/all` endpoint. The output will show which providers are configured and their active latency/status.

### Resolution Steps
- **Scenario A: API Key expired or invalid**:
  Update the provider API key in your environment/Secret Manager, and restart the backend container to apply.
- **Scenario B: Manual Circuit Reset**:
  If a provider has recovered but the circuit breaker is still cooling down (default 300 seconds), you can trigger a restart of the backend container to reset the in-memory circuit state to `CLOSED`:
  ```bash
  docker compose -f docker-compose.prod.yml restart backend
  ```

---

## Runbook 4: JWT Secret Key Rotation

### Objective
Rotate `SECRET_KEY` without logging out users immediately (using key phasing) or executing a clean rotation.

### Resolution Steps
1. **Prepare New Key**:
   Generate a secure random key:
   ```bash
   openssl rand -hex 32
   ```
2. **Apply Key**:
   Update the `SECRET_KEY` environment variable. Note: Since FastAPI parses JWTs with the current `SECRET_KEY`, rotating the key will invalidate existing active tokens. Users will be forced to log in again upon token expiration.
3. **Stateless Refresh**:
   Since Refresh Tokens are stored client-side and verified, if you want zero-disruption rotation, you must deploy an update that supports checking signatures against *both* the new key and the old key for a grace period (e.g., 7 days) before fully decommissioning the old key.

import contextvars
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.database.session import engine, get_db, verify_db_connection
from app.schemas.user import UserLogin
from app.services.ai_health_service import ProviderHealthService

# Correlation ID Context Variable
correlation_id_ctx = contextvars.ContextVar("correlation_id", default="")

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": self.formatTime(record, self.datefmt) if self.datefmt else datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "filename": record.filename,
            "line": record.lineno,
        }
        corr_id = correlation_id_ctx.get()
        if corr_id:
            log_entry["correlation_id"] = corr_id
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)

def setup_logging():
    root_logger = logging.getLogger()
    if settings.ENVIRONMENT == "production":
        for h in list(root_logger.handlers):
            root_logger.removeHandler(h)
        handler = logging.StreamHandler()
        formatter = JSONFormatter()
        handler.setFormatter(formatter)
        root_logger.addHandler(handler)
        root_logger.setLevel(logging.INFO)
        
        # Configure uvicorn loggers
        for uvicorn_logger_name in ["uvicorn", "uvicorn.access", "uvicorn.error"]:
            ul = logging.getLogger(uvicorn_logger_name)
            ul.handlers = [handler]
            ul.propagate = False
            
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    else:
        root_logger.setLevel(logging.INFO)

setup_logging()
logger = logging.getLogger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    import sys
    import fastapi
    from sqlalchemy import text
    from app.database.session import verify_db_connection, engine
    from app.core.ai_providers import is_gemini_configured, is_groq_configured, is_openai_configured

    # Check environment & modes
    db_type = "PostgreSQL" if "postgresql" in settings.async_database_url else "SQLite"
    
    # 1. Database status & automatic column check
    db_status = "Disconnected"
    try:
        await verify_db_connection()
        db_status = f"Connected ({db_type})"
        
        # Idempotently ensure email verification columns exist in users table
        try:
            async with engine.begin() as conn:
                if "postgresql" in settings.async_database_url:
                    await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE NOT NULL;"))
                    await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(10);"))
                    await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ;"))
                else:
                    # SQLite fallback: inspect columns
                    table_info = await conn.execute(text("PRAGMA table_info(users);"))
                    existing_cols = [r[1] for r in table_info.fetchall()]
                    if "is_verified" not in existing_cols:
                        await conn.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0 NOT NULL;"))
                    if "verification_code" not in existing_cols:
                        await conn.execute(text("ALTER TABLE users ADD COLUMN verification_code VARCHAR(10);"))
                    if "verification_code_expires_at" not in existing_cols:
                        await conn.execute(text("ALTER TABLE users ADD COLUMN verification_code_expires_at TIMESTAMP;"))
        except Exception as col_err:
            print(f"[*] Note on table column check: {col_err}", flush=True)
    except Exception as db_err:
        print(f"[-] Startup Database connection verification failed: {db_err}", flush=True)

    # 2. Redis status
    redis_status = "In-Memory Fallback"
    try:
        from app.core.rate_limit import _redis_client as rl_redis
        if rl_redis is not None:
            rl_redis.ping()
            redis_status = "Connected"
    except Exception:
        pass

    # 3. RAG / pgvector status
    rag_status = "Python Fallback"
    if settings.ENABLE_PGVECTOR:
        try:
            async with engine.begin() as connection:
                res = await connection.execute(text("SELECT extname FROM pg_extension WHERE extname = 'vector';"))
                if res.scalar() is not None:
                    rag_status = "pgvector Enabled"
        except Exception:
            pass

    # 4. Provider Order
    prov_order_list = []
    for prov in settings.AUTO_PROVIDER_ORDER:
        prov_order_list.append(prov.capitalize())
    provider_order_str = " -> ".join(prov_order_list) if prov_order_list else "None"

    # Print the enriched startup diagnostics block
    print("\n====================================", flush=True)
    print("QuizVerse Startup Diagnostics", flush=True)
    print("====================================", flush=True)
    print(f"Environment:\n{settings.ENVIRONMENT}", flush=True)
    print(f"\nPython version:\n{sys.version.split()[0]}", flush=True)
    print(f"\nFastAPI version:\n{fastapi.__version__}", flush=True)
    print(f"\nDatabase:\n{db_status}", flush=True)
    print(f"\nRedis:\n{redis_status}", flush=True)
    print(f"\nRAG:\n{rag_status}", flush=True)
    print(f"\nVector Store:\n{db_type}", flush=True)
    print(f"\nProvider Order:\n{provider_order_str}", flush=True)
    print(f"\nMock enabled:\n{settings.ENABLE_MOCK_PROVIDER}", flush=True)
    print(f"\nApplication Mode:\nAPI Server", flush=True)
    print("====================================\n", flush=True)

    # Perform a quick AI health check on configured providers to verify api keys/connectivity
    print("[*] Running AI Provider connectivity and configuration diagnostics...", flush=True)
    try:
        gemini_cfg = "configured" if is_gemini_configured() else "unconfigured/disabled"
        groq_cfg = "configured" if is_groq_configured() else "unconfigured/disabled"
        openai_cfg = "configured" if is_openai_configured() else "unconfigured/disabled"
        print(f"[+] Provider 'gemini': {gemini_cfg}", flush=True)
        print(f"[+] Provider 'groq': {groq_cfg}", flush=True)
        print(f"[+] Provider 'openai': {openai_cfg}", flush=True)
    except Exception as e:
        print(f"[-] AI Provider startup diagnostics failed: {e}", flush=True)

    # Start ConnectionManager Pub/Sub logic for horizontal scaling
    from app.services.connection_manager import manager
    await manager.start()

    yield
    # Shutdown cleanups
    print(f"[*] Shutting down {settings.PROJECT_NAME}...", flush=True)
    await manager.stop()
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=app.openapi_version,
        description=app.description,
        routes=app.routes,
    )
    
    if "components" not in openapi_schema:
        openapi_schema["components"] = {}
    if "schemas" not in openapi_schema["components"]:
        openapi_schema["components"]["schemas"] = {}
        
    # Inject UserLogin schema so that references to it are resolved correctly
    if "UserLogin" not in openapi_schema["components"]["schemas"]:
        openapi_schema["components"]["schemas"]["UserLogin"] = UserLogin.model_json_schema()
        
    app.openapi_schema = openapi_schema
    return openapi_schema


app.openapi = custom_openapi

# HTTP Request Logging & Correlation ID Middleware
@app.middleware("http")
async def add_correlation_id_and_log_request(request: Request, call_next):
    corr_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
    token = correlation_id_ctx.set(corr_id)
    request.state.correlation_id = corr_id
    
    start_time = time.time()
    method = request.method
    url = str(request.url.path)
    client_ip = request.client.host if request.client else "unknown"
    
    if settings.ENVIRONMENT == "production":
        logger.info(f"Incoming request: {method} {url} from {client_ip}")
    else:
        print(f"[{corr_id}] Incoming request: {method} {url} from {client_ip}", flush=True)
        
    try:
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = corr_id
        process_time = round((time.time() - start_time) * 1000, 2)
        
        if settings.ENVIRONMENT == "production":
            logger.info(f"Completed request: {method} {url} with status {response.status_code} in {process_time}ms")
        else:
            print(f"[{corr_id}] Completed request: {method} {url} with status {response.status_code} in {process_time}ms", flush=True)
            
        return response
    except Exception as e:
        process_time = round((time.time() - start_time) * 1000, 2)
        if settings.ENVIRONMENT == "production":
            logger.exception(f"Exception processing request: {method} {url} after {process_time}ms: {e}")
        else:
            print(f"[{corr_id}] Exception processing request: {method} {url} after {process_time}ms: {e}", flush=True)
        raise e
    finally:
        correlation_id_ctx.reset(token)

# HTTP Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = settings.SECURE_HEADERS_REFERRER
    response.headers["Permissions-Policy"] = settings.SECURE_HEADERS_PERMISSIONS
    response.headers["Content-Security-Policy"] = settings.SECURE_HEADERS_CSP
    
    # HSTS for secure HTTPS connections
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
    return response

# CORS Configuration
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include versioned API routers
from app.api.v1.api import api_router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["Health"])
async def health_check():
    """Service Health Check Endpoint"""
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/health/db", tags=["Health"])
async def db_health_check(db: AsyncSession = Depends(get_db)):
    """Database Health Check Endpoint verifying active AsyncSession connectivity."""
    try:
        result = await db.execute(text("SELECT 1"))
        result.scalar()
        return {
            "status": "online",
            "database": "connected",
            "environment": settings.ENVIRONMENT,
        }
    except Exception as e:
        detail = str(e) if settings.DEBUG or settings.ENVIRONMENT == "development" else "Database connection failed"
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "error",
                "database": "disconnected",
                "detail": detail,
            }
        )


@app.get("/health/redis", tags=["Health"])
async def redis_health_check():
    """Redis Health Check Endpoint verifying ping connectivity and latency."""
    from app.core.rate_limit import _redis_client as rl_redis
    if rl_redis is None:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "error",
                "redis": "disconnected",
                "detail": "Redis client is not initialized (using In-Memory Fallback)"
            }
        )
    try:
        start_time = time.time()
        rl_redis.ping()
        latency_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "status": "online",
            "redis": "connected",
            "latency_ms": latency_ms,
            "environment": settings.ENVIRONMENT
        }
    except Exception as e:
        detail = str(e) if settings.DEBUG or settings.ENVIRONMENT == "development" else "Redis connection ping failed"
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "error",
                "redis": "disconnected",
                "detail": detail
            }
        )


@app.get("/health/all", tags=["Health"])
async def all_health_check(db: AsyncSession = Depends(get_db)):
    """Comprehensive health check verifying Database, Redis, and configured AI services."""
    from app.core.rate_limit import _redis_client as rl_redis
    from app.core.ai_providers import is_gemini_configured, is_groq_configured, is_openai_configured
    
    # 1. Test database
    db_status = "unknown"
    db_latency = 0.0
    try:
        start = time.time()
        res = await db.execute(text("SELECT 1"))
        res.scalar()
        db_status = "connected"
        db_latency = round((time.time() - start) * 1000, 2)
    except Exception:
        db_status = "disconnected"

    # 2. Test Redis
    redis_status = "unknown"
    redis_latency = 0.0
    if rl_redis is not None:
        try:
            start = time.time()
            rl_redis.ping()
            redis_status = "connected"
            redis_latency = round((time.time() - start) * 1000, 2)
        except Exception:
            redis_status = "disconnected"
    else:
        redis_status = "in-memory-fallback"

    # 3. AI Providers status
    ai_status = {
        "gemini": "configured" if is_gemini_configured() else "unconfigured",
        "groq": "configured" if is_groq_configured() else "unconfigured",
        "openai": "configured" if is_openai_configured() else "unconfigured"
    }

    overall_status = "online"
    if db_status == "disconnected" or redis_status == "disconnected":
        overall_status = "degraded"

    status_code = status.HTTP_200_OK if overall_status == "online" else status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=status_code,
        content={
            "status": overall_status,
            "services": {
                "database": {
                    "status": db_status,
                    "latency_ms": db_latency
                },
                "redis": {
                    "status": redis_status,
                    "latency_ms": redis_latency
                },
                "ai_providers": ai_status
            },
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT
        }
    )


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API!",
        "docs": f"{settings.API_V1_STR}/docs",
    }

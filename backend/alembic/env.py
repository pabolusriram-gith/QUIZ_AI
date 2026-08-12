import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

from app.config.settings import settings
from app.database.session import Base
from app.models.user import User
from app.models.login_history import LoginHistory
from app.models.quiz import Quiz, Question, QuestionOption
from app.models.document import DocumentChunk



# Alembic Config object, which provides access to values within the alembic.ini file.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name:
    fileConfig(config.config_file_name)

# Model metadata for autogenerate support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    Configures context with just a URL and not an Engine.
    """
    url = settings.async_database_url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    from sqlalchemy import text
    
    # Check if auth schema exists. If not, setup local compatibility structures.
    res = connection.execute(text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'auth';"))
    if not res.scalar():
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS auth;"))
        connection.execute(text("""
            CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
                SELECT coalesce(
                    nullif(current_setting('request.jwt.claim.sub', true), ''),
                    nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')
                )::uuid;
            $$ LANGUAGE sql STABLE;
        """))
        connection.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
                    CREATE ROLE anon;
                END IF;
                IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
                    CREATE ROLE authenticated;
                END IF;
                IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
                    CREATE ROLE service_role;
                END IF;
            END
            $$;
        """))

    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()
    connection.commit()


async def run_async_migrations() -> None:
    """In this scenario we need to create an Engine and associate a connection with the context."""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.async_database_url

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

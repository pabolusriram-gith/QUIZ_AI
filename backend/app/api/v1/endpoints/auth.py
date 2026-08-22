import secrets
import uuid
import urllib.parse
from datetime import datetime, timezone
from typing import Any, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse, HTMLResponse
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_reset_token,
    decode_token,
)
from app.core.rate_limit import rate_limit_login, rate_limit_register, rate_limit_forgot_password
from app.core.blacklist import blacklist_token, is_token_blacklisted
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.login_history import LoginHistory
from app.schemas.user import (
    UserRegister,
    UserLogin,
    UserResponse,
    Token,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    TokenRefreshRequest,
    GuestLoginRequest,
)

router = APIRouter()


def get_oauth_not_configured_html(provider: str) -> str:
    """Returns a beautifully styled HTML developer instructions guide for unconfigured OAuth."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{provider} Sign-In Configuration Required - QuizVerse AI</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {{
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background-color: #fafbfc;
            color: #1f2937;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
            box-sizing: border-box;
            position: relative;
            overflow-x: hidden;
        }}
        .blob-1 {{
            position: absolute;
            top: -100px;
            left: -100px;
            width: 450px;
            height: 450px;
            border-radius: 50%;
            background: rgba(219, 234, 254, 0.5);
            filter: blur(90px);
            z-index: -1;
        }}
        .blob-2 {{
            position: absolute;
            bottom: -100px;
            right: -100px;
            width: 450px;
            height: 450px;
            border-radius: 50%;
            background: rgba(224, 231, 255, 0.4);
            filter: blur(90px);
            z-index: -1;
        }}
        .container {{
            max-width: 600px;
            width: 100%;
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(229, 231, 235, 0.5);
            border-radius: 16px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.06);
            padding: 40px;
            box-sizing: border-box;
        }}
        .header {{
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            margin-bottom: 30px;
        }}
        .icon {{
            display: flex;
            align-items: center;
            justify-content: center;
            width: 56px;
            height: 56px;
            border-radius: 16px;
            background: linear-gradient(135deg, #3b82f6, #4f46e5);
            color: white;
            box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);
            margin-bottom: 20px;
        }}
        h1 {{
            font-size: 22px;
            font-weight: 700;
            margin: 0 0 8px 0;
            color: #111827;
            line-height: 1.3;
        }}
        .subtitle {{
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #2563eb;
            margin: 0 0 4px 0;
        }}
        .error-message {{
            background-color: #fef2f2;
            border: 1px solid rgba(252, 165, 165, 0.6);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }}
        .error-icon {{
            color: #ef4444;
            flex-shrink: 0;
            margin-top: 2px;
        }}
        .error-text {{
            font-size: 14px;
            color: #b91c1c;
            font-weight: 500;
            margin: 0;
            line-height: 1.5;
        }}
        .instructions {{
            border-top: 1px solid #e5e7eb;
            padding-top: 24px;
        }}
        h2 {{
            font-size: 16px;
            font-weight: 600;
            color: #374151;
            margin: 0 0 16px 0;
        }}
        ol {{
            margin: 0;
            padding-left: 20px;
            font-size: 14px;
            color: #4b5563;
            line-height: 1.6;
        }}
        li {{
            margin-bottom: 12px;
        }}
        .code-block {{
            background-color: #f3f4f6;
            border-radius: 8px;
            padding: 12px 16px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 13px;
            color: #1f2937;
            overflow-x: auto;
            margin: 8px 0;
            border: 1px solid #e5e7eb;
        }}
        .highlight {{
            font-weight: 600;
            color: #111827;
        }}
        .footer {{
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
        }}
        .btn-back {{
            display: inline-block;
            margin-top: 20px;
            background: linear-gradient(135deg, #3b82f6, #4f46e5);
            color: white;
            text-decoration: none;
            padding: 10px 22px;
            border-radius: 10px;
            font-weight: 600;
            font-size: 14px;
            transition: all 0.2s;
            box-shadow: 0 4px 10px rgba(59, 130, 246, 0.15);
        }}
        .btn-back:hover {{
            opacity: 0.95;
            transform: translateY(-1px);
        }}
    </style>
</head>
<body>
    <div class="blob-1"></div>
    <div class="blob-2"></div>
    <div class="container">
        <div class="header">
            <div class="icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-3.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2Z"/>
                    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-3.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2Z"/>
                </svg>
            </div>
            <p class="subtitle">QuizVerse AI Assessments</p>
            <h1>{provider} Sign-In Configuration Required</h1>
        </div>

        <div class="error-message">
            <div class="error-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <p class="error-text">{provider} Sign-In has not yet been configured.</p>
        </div>

        <div class="instructions">
            <h2>Instructions for Developers</h2>
            <ol>
                <li>Go to the <span class="highlight">Google Cloud Console</span>.</li>
                <li>Set up the OAuth Consent Screen and configure standard scopes (<code>email</code>, <code>profile</code>, <code>openid</code>).</li>
                <li>Go to the Credentials page, click <strong>Create Credentials</strong> &gt; <strong>OAuth client ID</strong>.</li>
                <li>Set the application type to <strong>Web application</strong>.</li>
                <li>Under <strong>Authorized JavaScript origins</strong>, add:
                    <div class="code-block">http://localhost:3000</div>
                </li>
                <li>Under <strong>Authorized redirect URIs</strong>, add:
                    <div class="code-block">http://localhost:8000/api/v1/auth/google/callback</div>
                </li>
                <li>Copy the Client ID and Client Secret, and update your backend environment configuration (<code>backend/.env</code>):
                    <div class="code-block">
GOOGLE_CLIENT_ID="your_google_client_id"<br>
GOOGLE_CLIENT_SECRET="your_google_client_secret"
                    </div>
                </li>
                <li>Restart the backend FastAPI application to load the settings.</li>
            </ol>
            <div style="text-align: center;">
                <a href="http://localhost:3000/login" class="btn-back">Return to Login Screen</a>
            </div>
        </div>

        <div class="footer">
            &copy; 2026 QuizVerse AI. All rights reserved.
        </div>
    </div>
</body>
</html>"""


def send_reset_email(email: str, reset_url: str) -> bool:
    """Helper to send password reset email via SMTP if configured, else log to console."""
    if not settings.SMTP_HOST or not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        print(f"\n[DEVELOPMENT MODE] Password reset URL for {email}:\n{reset_url}\n")
        return False

    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    try:
        msg = MIMEMultipart()
        msg['From'] = settings.SMTP_USERNAME
        msg['To'] = email
        msg['Subject'] = "QuizVerse AI - Password Reset Request"
        
        body = f"""Hello,

You have requested to reset your password on QuizVerse AI.
Please click the link below to reset your password (valid for 15 minutes):

{reset_url}

If you did not request this, please ignore this email.
"""
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT or 587)
        server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_USERNAME, email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"[-] Failed to send password reset email via SMTP: {e}")
        return False


async def log_login_event(
    db: AsyncSession,
    user_id: uuid.UUID,
    request: Request,
    status_str: str = "success"
):
    """Log a user login event with IP, User-Agent, and status."""
    try:
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        
        history_entry = LoginHistory(
            user_id=user_id,
            ip_address=client_ip,
            user_agent=user_agent[:255],
            status=status_str,
            login_at=datetime.now(timezone.utc)
        )
        db.add(history_entry)
        await db.commit()
    except Exception as e:
        print(f"[-] Failed to log login event: {e}")


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    user_in: UserRegister,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Register a new user, hashing their password with Argon2id and storing details in DB."""
    # Apply rate limiting
    rate_limit_register(request)

    # Check if user already exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
        
    from app.core.security import escape_html
    # Create new user instance
    new_user = User(
        email=user_in.email.lower().strip(),
        hashed_password=hash_password(user_in.password),
        full_name=escape_html(user_in.full_name),
        role=user_in.role.value,
        token_version=1,
        is_active=True
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


async def get_login_credentials(request: Request) -> UserLogin:
    """Helper to dynamically parse credentials from JSON or URL-encoded form data."""
    content_type = request.headers.get("content-type", "")
    
    if "application/json" in content_type:
        try:
            body = await request.json()
            return UserLogin(**body)
        except ValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=e.errors()
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON payload"
            )
            
    elif "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        try:
            form_data = await request.form()
            email = form_data.get("username") or form_data.get("email")
            password = form_data.get("password")
            
            if not email or not password:
                missing_field = "username" if not email else "password"
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=[
                        {
                            "loc": ["body", missing_field],
                            "msg": "field required",
                            "type": "value_error.missing"
                        }
                    ]
                )
            
            return UserLogin(email=email, password=password)
        except ValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=e.errors()
            )
            
    else:
        # Fallback to JSON
        try:
            body = await request.json()
            return UserLogin(**body)
        except ValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=e.errors()
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Unsupported media type. Please send application/json or application/x-www-form-urlencoded"
            )


@router.post(
    "/login",
    response_model=Token,
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "schema": {
                        "$ref": "#/components/schemas/UserLogin"
                    }
                },
                "application/x-www-form-urlencoded": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "username": {"type": "string", "description": "Email address"},
                            "password": {"type": "string", "format": "password"}
                        },
                        "required": ["username", "password"]
                    }
                }
            },
            "required": True
        }
    }
)
async def login(
    request: Request,
    credentials: UserLogin = Depends(get_login_credentials),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Authenticate user with email/password, log history, and return access/refresh tokens."""
    # Apply rate limiting
    rate_limit_login(request)

    result = await db.execute(select(User).where(User.email == credentials.email.lower().strip()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        # Log failure if user exists
        if user:
            await log_login_event(db, user.id, request, "failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )

    # Update last login timestamp
    user.last_login_at = datetime.now(timezone.utc)
    db.add(user)
    await db.commit()

    # Log successful login event
    await log_login_event(db, user.id, request, "success")

    # Generate JWT access and refresh tokens with token versioning
    access_token = create_access_token(
        subject=user.id,
        role=user.role,
        token_version=user.token_version
    )
    refresh_token = create_refresh_token(
        subject=user.id,
        token_version=user.token_version
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/guest-login", response_model=Token)
async def guest_login(
    payload: GuestLoginRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Create a temporary guest student account and issue JWT tokens using just a nickname."""
    guest_uuid = uuid.uuid4().hex
    email = f"guest_{guest_uuid}@quizverse.guest"
    hashed_pwd = hash_password(secrets.token_hex(16))
    
    user = User(
        email=email,
        hashed_password=hashed_pwd,
        full_name=payload.nickname,
        role="student",
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(
        subject=user.id,
        role=user.role,
        token_version=user.token_version
    )
    refresh_token = create_refresh_token(
        subject=user.id,
        token_version=user.token_version
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: Request,
    response: Response,
    payload: TokenRefreshRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Rotate the JWT Access Token using a valid, non-blacklisted JWT Refresh Token (supporting Secure HttpOnly cookie fallback)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    refresh_tok = payload.refresh_token
    # If the payload indicates token is in HttpOnly cookie, extract it
    if refresh_tok == "from_cookie":
        refresh_tok = request.cookies.get("refresh_token")
        
    if not refresh_tok:
        raise credentials_exception
        
    # Check if refresh token is blacklisted
    if is_token_blacklisted(refresh_tok):
        raise credentials_exception
        
    try:
        token_data = decode_token(refresh_tok)
        user_id_str = token_data.get("sub")
        token_type = token_data.get("type")
        token_version = token_data.get("token_version")
        
        if not user_id_str or token_type != "refresh":
            raise credentials_exception
            
        user_id = uuid.UUID(user_id_str)
    except Exception:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active or token_version != user.token_version:
        raise credentials_exception

    # Generate new pair of tokens
    new_access_token = create_access_token(
        subject=user.id,
        role=user.role,
        token_version=user.token_version
    )
    new_refresh_token = create_refresh_token(
        subject=user.id,
        token_version=user.token_version
    )
    
    # Blacklist old refresh token
    blacklist_token(refresh_tok, settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400)

    # Update the refresh token in cookie
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=settings.ENVIRONMENT != "development",
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/"
    )

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Request a password reset link. Rate limited per email."""
    email_clean = payload.email.lower().strip()
    rate_limit_forgot_password(email_clean)

    result = await db.execute(select(User).where(User.email == email_clean))
    user = result.scalar_one_or_none()
    
    # Return success even if email not registered to prevent enumeration attacks
    msg = "If your email is registered, a password reset link has been sent."
    
    if user and user.is_active:
        reset_token = create_reset_token(subject=user.id)
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
        
        sent = send_reset_email(email_clean, reset_url)
        
        # If in development and SMTP is not configured, we also return the token/url directly in response
        if not sent and settings.ENVIRONMENT == "development":
            return {
                "message": msg,
                "dev_reset_url": reset_url,
                "dev_reset_token": reset_token
            }

    return {"message": msg}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Reset user password. Invalidates all active tokens by incrementing token version."""
    try:
        token_data = decode_token(payload.token)
        user_id_str = token_data.get("sub")
        token_type = token_data.get("type")
        
        if not user_id_str or token_type != "reset_password":
            raise HTTPException(status_code=400, detail="Invalid token type")
            
        user_id = uuid.UUID(user_id_str)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="User not found or inactive")

    # Update password and increment token version to logout from all devices
    user.hashed_password = hash_password(payload.new_password)
    user.token_version += 1
    
    db.add(user)
    await db.commit()
    return {"message": "Password has been reset successfully."}


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Logout current session by blacklisting the access token."""
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        # Blacklist access token for its remaining lifetime (default to 24h for safety)
        blacklist_token(token, settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    return {"message": "Logged out successfully"}


@router.post("/logout-all", status_code=status.HTTP_200_OK)
async def logout_all_devices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Logout from all devices by incrementing user's token version in the DB."""
    current_user.token_version += 1
    db.add(current_user)
    await db.commit()
    return {"message": "Successfully logged out from all devices"}


# ----------------------------------------------------
# GOOGLE OAUTH
# ----------------------------------------------------

def is_google_configured() -> bool:
    """Helper to check if Google OAuth is fully configured with actual keys."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        print("[OAUTH DEBUG] Google settings are missing.")
        return False
    g_id = settings.GOOGLE_CLIENT_ID.strip()
    g_secret = settings.GOOGLE_CLIENT_SECRET.strip()
    if not g_id or not g_secret:
        print("[OAUTH DEBUG] Google ID or secret is empty.")
        return False
    if "your_google_client_id" in g_id or "your_google_client_secret" in g_secret:
        print("[OAUTH DEBUG] Google settings contain default template placeholder values.")
        return False
    return True


@router.get("/google/login")
async def google_login(request: Request) -> Any:
    """Initiates Google OAuth redirect to Google consent screen."""
    print("[OAUTH DEBUG] /google/login endpoint called.")
    print(f"[OAUTH DEBUG] settings.GOOGLE_CLIENT_ID loaded: {settings.GOOGLE_CLIENT_ID is not None} (Length: {len(settings.GOOGLE_CLIENT_ID) if settings.GOOGLE_CLIENT_ID else 0})")
    if settings.GOOGLE_CLIENT_ID:
        print(f"[OAUTH DEBUG] settings.GOOGLE_CLIENT_ID prefix: {settings.GOOGLE_CLIENT_ID[:15]}...")
    print(f"[OAUTH DEBUG] settings.GOOGLE_CLIENT_SECRET loaded: {settings.GOOGLE_CLIENT_SECRET is not None} (Length: {len(settings.GOOGLE_CLIENT_SECRET) if settings.GOOGLE_CLIENT_SECRET else 0})")
    print(f"[OAUTH DEBUG] settings.FRONTEND_URL: {settings.FRONTEND_URL}")

    if not is_google_configured():
        print("[OAUTH DEBUG] Google Sign-In check failed: OAuth is not configured.")
        return HTMLResponse(
            content=get_oauth_not_configured_html("Google"),
            status_code=400
        )
        
    redirect_uri = f"{str(request.base_url).rstrip('/')}{settings.API_V1_STR}/auth/google/callback"
    print(f"[OAUTH DEBUG] Calculated redirect_uri sent to Google: {redirect_uri}")
    if redirect_uri != "http://localhost:8000/api/v1/auth/google/callback":
        print(f"[OAUTH DEBUG] WARNING: Redirect URI does NOT match exact Google Console callback string: http://localhost:8000/api/v1/auth/google/callback")
        
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID.strip() if settings.GOOGLE_CLIENT_ID else "",
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account"
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    print(f"[OAUTH DEBUG] Redirect generated: {url}")
    return RedirectResponse(url)


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: Optional[str] = None,
    error: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Processes Google OAuth callback, creating user if necessary, and issuing session JWT."""
    print("[OAUTH DEBUG] /google/callback received request.")
    print(f"[OAUTH DEBUG] Code parameter present: {code is not None} (Length: {len(code) if code else 0})")
    print(f"[OAUTH DEBUG] Error parameter: {error}")
    
    if not is_google_configured():
        print("[OAUTH DEBUG] Google Sign-In callback check failed: OAuth is not configured.")
        return HTMLResponse(
            content=get_oauth_not_configured_html("Google"),
            status_code=400
        )
        
    if error:
        print(f"[OAUTH DEBUG] OAuth flow cancelled or failed at Google. Error: {error}")
        err_msg = urllib.parse.quote(f"Google authentication error: {error}")
        return RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/login?error={err_msg}")
        
    if not code:
        print("[OAUTH DEBUG] Google callback failed: Authorization code was missing.")
        err_msg = urllib.parse.quote("Google authorization code was missing.")
        return RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/login?error={err_msg}")

    redirect_uri = f"{str(request.base_url).rstrip('/')}{settings.API_V1_STR}/auth/google/callback"
    print(f"[OAUTH DEBUG] Redirect URI for token exchange: {redirect_uri}")
    
    try:
        print("[OAUTH DEBUG] Token exchange started with Google...")
        async with httpx.AsyncClient() as client:
            # 1. Exchange auth code for google tokens
            token_res = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID.strip() if settings.GOOGLE_CLIENT_ID else "",
                    "client_secret": settings.GOOGLE_CLIENT_SECRET.strip() if settings.GOOGLE_CLIENT_SECRET else "",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
                headers={"Accept": "application/json"}
            )
            print(f"[OAUTH DEBUG] Token exchange response code: {token_res.status_code}")
            if token_res.status_code != 200:
                print(f"[OAUTH DEBUG] Token exchange failed. Response details: {token_res.text}")
                err_msg = urllib.parse.quote(f"Failed to exchange Google OAuth code: {token_res.text}")
                return RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/login?error={err_msg}")
                
            token_data = token_res.json()
            access_token = token_data.get("access_token")
            print(f"[OAUTH DEBUG] Access token fetched (Length: {len(access_token) if access_token else 0})")
            
            # 2. Retrieve user details
            print("[OAUTH DEBUG] Fetching Google user profile details...")
            user_info_res = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            print(f"[OAUTH DEBUG] User profile response code: {user_info_res.status_code}")
            if user_info_res.status_code != 200:
                print(f"[OAUTH DEBUG] Fetching user profile failed. Response details: {user_info_res.text}")
                err_msg = urllib.parse.quote("Failed to fetch Google user profile information.")
                return RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/login?error={err_msg}")
                
            user_info = user_info_res.json()
            
        email = user_info.get("email")
        full_name = user_info.get("name")
        print(f"[OAUTH DEBUG] User profile successfully fetched. Email: {email}, Name: {full_name}")
        
        if not email:
            print("[OAUTH DEBUG] Google account email address not found in profile.")
            err_msg = urllib.parse.quote("Google account email address not found.")
            return RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/login?error={err_msg}")
            
        email_clean = email.lower().strip()
        
        # 3. Check / Create User in DB
        print("[OAUTH DEBUG] Checking database for existing user record...")
        result = await db.execute(select(User).where(User.email == email_clean))
        user = result.scalar_one_or_none()
        
        if not user:
            print(f"[OAUTH DEBUG] User record not found. Creating user for {email_clean}...")
            user = User(
                email=email_clean,
                full_name=full_name,
                hashed_password=hash_password(secrets.token_urlsafe(32)),
                role="teacher",
                token_version=1,
                is_active=True
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            print(f"[OAUTH DEBUG] User record created successfully. ID: {user.id}")
        else:
            print(f"[OAUTH DEBUG] Existing user loaded. ID: {user.id}, Role: {user.role}, Active: {user.is_active}")
            if not user.is_active:
                print("[OAUTH DEBUG] Google login rejected: User account is inactive.")
                err_msg = urllib.parse.quote("User account is inactive.")
                return RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/login?error={err_msg}")
            
        # Update last login timestamp
        user.last_login_at = datetime.now(timezone.utc)
        db.add(user)
        await db.commit()
        
        # Log successful login event
        await log_login_event(db, user.id, request, "success")
        
        # Generate tokens
        print("[OAUTH DEBUG] Generating application JWT access and refresh tokens...")
        app_access_token = create_access_token(
            subject=user.id,
            role=user.role,
            token_version=user.token_version
        )
        app_refresh_token = create_refresh_token(
            subject=user.id,
            token_version=user.token_version
        )
        print("[OAUTH DEBUG] JWT generated successfully.")
        
        # Redirect back to frontend OAuth callback landing page
        frontend_redirect_url = f"{settings.FRONTEND_URL.rstrip('/')}/auth/callback?token={app_access_token}"
        print(f"[OAUTH DEBUG] Redirecting to frontend callback page: {frontend_redirect_url}")
        response = RedirectResponse(frontend_redirect_url)
        
        # Set the refresh token in a Secure HttpOnly cookie
        response.set_cookie(
            key="refresh_token",
            value=app_refresh_token,
            httponly=True,
            secure=settings.ENVIRONMENT != "development",
            samesite="lax",
            max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
            path="/"
        )
        print("[OAUTH DEBUG] Secure HttpOnly cookie set. Redirection response sent.")
        return response
    except Exception as e:
        print(f"[OAUTH DEBUG] Google callback exception caught: {e}")
        import traceback
        traceback.print_exc()
        err_msg = urllib.parse.quote(f"Google Sign-In failed due to server error: {str(e)}")
        return RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/login?error={err_msg}")


# ----------------------------------------------------
# GITHUB OAUTH
# ----------------------------------------------------

@router.get("/github/login")
async def github_login(request: Request) -> Any:
    """Initiates GitHub OAuth redirect."""
    if not settings.GITHUB_CLIENT_ID:
        raise HTTPException(status_code=400, detail="GitHub client ID is not configured.")
        
    redirect_uri = f"{str(request.base_url).rstrip('/')}{settings.API_V1_STR}/auth/github/callback"
    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope": "read:user user:email",
    }
    url = f"https://github.com/login/oauth/authorize?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url)


@router.get("/github/callback")
async def github_callback(
    code: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Processes GitHub OAuth callback, fetching profile and emails, then creating a session JWT."""
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="GitHub client credentials are not configured.")
        
    redirect_uri = f"{str(request.base_url).rstrip('/')}{settings.API_V1_STR}/auth/github/callback"
    
    async with httpx.AsyncClient() as client:
        # 1. Exchange code for access token
        token_res = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": redirect_uri,
            },
            headers={"Accept": "application/json"}
        )
        if token_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange GitHub OAuth code.")
            
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        
        # 2. Get user profile
        user_res = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"token {access_token}",
                "Accept": "application/json"
            }
        )
        if user_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch GitHub profile information.")
            
        user_info = user_res.json()
        
        # 3. Retrieve user email (fallback to private emails sub-resource if needed)
        email = user_info.get("email")
        if not email:
            email_res = await client.get(
                "https://api.github.com/user/emails",
                headers={
                    "Authorization": f"token {access_token}",
                    "Accept": "application/json"
                }
            )
            if email_res.status_code == 200:
                emails = email_res.json()
                primary_emails = [e for e in emails if e.get("primary") and e.get("verified")]
                if primary_emails:
                    email = primary_emails[0].get("email")
                elif emails:
                    email = emails[0].get("email")
                    
    if not email:
        raise HTTPException(status_code=400, detail="Verified email address not found on GitHub account.")
        
    email_clean = email.lower().strip()
    full_name = user_info.get("name") or user_info.get("login")
    
    # 4. Check / Create User in DB
    result = await db.execute(select(User).where(User.email == email_clean))
    user = result.scalar_one_or_none()
    
    if not user:
        user = User(
            email=email_clean,
            full_name=full_name,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            role="teacher",
            token_version=1,
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    elif not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User account is inactive.")
        
    # Update last login timestamp
    user.last_login_at = datetime.now(timezone.utc)
    db.add(user)
    await db.commit()
    
    # Log successful login event
    await log_login_event(db, user.id, request, "success")
    
    # Generate tokens
    app_access_token = create_access_token(
        subject=user.id,
        role=user.role,
        token_version=user.token_version
    )
    
    # Redirect back to frontend callback landing page
    frontend_redirect_url = f"{settings.FRONTEND_URL}/auth/callback?token={app_access_token}"
    return RedirectResponse(frontend_redirect_url)


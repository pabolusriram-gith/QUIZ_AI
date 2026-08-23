from app.config.settings import settings
import redis

# Optional Redis connection
_redis_client = None
if settings.redis_connection_url:
    try:
        client = redis.from_url(
            settings.redis_connection_url, 
            decode_responses=True,
            socket_connect_timeout=0.2,
            socket_timeout=0.2
        )
        client.ping()
        _redis_client = client
    except Exception as e:
        _redis_client = None
        print(f"[-] Redis blacklist connection skipped ({e}). Using in-memory store.")

# In-memory blacklist store fallback
_in_memory_blacklist = {}

def _cleanup_expired_tokens():
    import time
    now = time.time()
    expired = [t for t, exp in _in_memory_blacklist.items() if now > exp]
    for t in expired:
        _in_memory_blacklist.pop(t, None)

def blacklist_token(token: str, expire_seconds: int = 86400):
    """Blacklist a token by adding it to Redis (with TTL) or memory store."""
    global _redis_client
    if _redis_client:
        try:
            _redis_client.setex(f"blacklist:{token}", expire_seconds, "1")
            return
        except Exception as e:
            print(f"[-] Redis blacklist error: {e}. Falling back to in-memory.")
            
    import time
    _in_memory_blacklist[token] = time.time() + expire_seconds
    _cleanup_expired_tokens()

def is_token_blacklisted(token: str) -> bool:
    """Check if a token is in the blacklist."""
    global _redis_client
    if _redis_client:
        try:
            return _redis_client.exists(f"blacklist:{token}") > 0
        except Exception as e:
            print(f"[-] Redis blacklist query error: {e}. Falling back to in-memory.")
            
    _cleanup_expired_tokens()
    import time
    expiry = _in_memory_blacklist.get(token)
    if expiry is None:
        return False
    if time.time() > expiry:
        _in_memory_blacklist.pop(token, None)
        return False
    return True

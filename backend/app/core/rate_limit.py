import time
from fastapi import Request, HTTPException, status
from app.config.settings import settings
import redis

# Lua script for atomic sliding window rate limiting
# KEYS: [key1, key2, ...]
# ARGV: [limit1, period1, limit2, period2, ..., now]
# Returns: [allowed_status (1 or 0), retry_after, failed_index]
LUA_RATE_LIMIT_SCRIPT = """
local num_keys = #KEYS
local now = tonumber(ARGV[2 * num_keys + 1])

-- 1. Check all windows
for i = 1, num_keys do
    local key = KEYS[i]
    local limit = tonumber(ARGV[2 * i - 1])
    local period = tonumber(ARGV[2 * i])
    local clear_before = now - period
    
    redis.call('zremrangebyscore', key, 0, clear_before)
    local count = redis.call('zcard', key)
    if count >= limit then
        local oldest = redis.call('zrange', key, 0, 0, 'withscores')
        local wait_time = 1
        if #oldest > 0 then
            wait_time = math.max(1, math.ceil(oldest[2] + period - now))
        end
        return {0, wait_time, i}
    end
end

-- 2. Increment all windows if under limit
for i = 1, num_keys do
    local key = KEYS[i]
    local period = tonumber(ARGV[2 * i])
    redis.call('zadd', key, now, tostring(now))
    redis.call('expire', key, period)
end

return {1, 0, 0}
"""

# Optional Redis connection
_redis_client = None
_rate_limit_lua_script = None
try:
    if settings.REDIS_URL or (settings.REDIS_HOST and settings.REDIS_PORT):
        url = settings.redis_connection_url
        client = redis.from_url(
            url, 
            decode_responses=True,
            socket_connect_timeout=0.1,
            socket_timeout=0.1
        )
        client.ping()
        _redis_client = client
        _rate_limit_lua_script = client.register_script(LUA_RATE_LIMIT_SCRIPT)
except Exception as e:
    _redis_client = None
    _rate_limit_lua_script = None
    print(f"[-] Redis rate limiter initialization failed: {e}. Falling back to in-memory.")

# In-memory store fallback
_in_memory_limits = {}
_ai_rate_limits = {}

def check_rate_limit(key: str, limit: int, period: int) -> bool:
    """
    Check rate limit for a generic key using a sliding window.
    limit: max requests allowed
    period: time window in seconds
    """
    global _redis_client, _rate_limit_lua_script
    if _redis_client and _rate_limit_lua_script:
        try:
            current_time = time.time()
            res = _rate_limit_lua_script(keys=[key], args=[limit, period, current_time])
            return res[0] == 1
        except Exception as e:
            # Fallback to memory on Redis connection error
            print(f"[-] Redis rate limiter error: {e}. Falling back to in-memory.")
            
    # In-memory sliding window fallback
    current_time = time.time()
    if key not in _in_memory_limits:
        _in_memory_limits[key] = []
    
    # Filter out timestamps outside the current window
    _in_memory_limits[key] = [t for t in _in_memory_limits[key] if t > current_time - period]
    
    if len(_in_memory_limits[key]) >= limit:
        return False
        
    _in_memory_limits[key].append(current_time)
    return True

def rate_limit_login(request: Request):
    """5 attempts per minute per IP"""
    client_ip = request.client.host if request.client else "unknown"
    key = f"rate_limit:login:{client_ip}"
    if not check_rate_limit(key, 5, 60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again in a minute."
        )

def rate_limit_register(request: Request):
    """3 attempts per minute per IP"""
    client_ip = request.client.host if request.client else "unknown"
    key = f"rate_limit:register:{client_ip}"
    if not check_rate_limit(key, 3, 60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many registration attempts. Please try again in a minute."
        )

def rate_limit_forgot_password(email: str):
    """3 requests per hour per email"""
    key = f"rate_limit:forgot_password:{email.lower().strip()}"
    if not check_rate_limit(key, 3, 3600):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many password reset requests. Please try again in an hour."
        )

def check_ai_rate_limit(key_id: str, limit_type: str) -> tuple[bool, int]:
    """
    Enforce sliding-window rate limit for AI operations.
    Returns (is_allowed, retry_after)
    """
    global _redis_client, _rate_limit_lua_script
    current_time = time.time()
    
    if limit_type == "generate":
        key_min = f"rate_limit:ai_generate:min:{key_id}"
        key_hr = f"rate_limit:ai_generate:hour:{key_id}"
        
        if _redis_client and _rate_limit_lua_script:
            try:
                res = _rate_limit_lua_script(
                    keys=[key_min, key_hr],
                    args=[
                        settings.AI_GENERATE_PER_MINUTE, 60,
                        settings.AI_GENERATE_PER_HOUR, 3600,
                        current_time
                    ]
                )
                return res[0] == 1, res[1]
            except Exception as e:
                print(f"[-] Redis rate limiter error: {e}. Falling back to in-memory.")
                
        # In-memory sliding window fallback for generate
        window_start_min = current_time - 60
        window_start_hr = current_time - 3600
        
        # Initialize lists
        if key_min not in _ai_rate_limits:
            _ai_rate_limits[key_min] = []
        if key_hr not in _ai_rate_limits:
            _ai_rate_limits[key_hr] = []
            
        # Clean expired
        _ai_rate_limits[key_min] = [t for t in _ai_rate_limits[key_min] if t > window_start_min]
        _ai_rate_limits[key_hr] = [t for t in _ai_rate_limits[key_hr] if t > window_start_hr]
        
        # Evaluate limits
        if len(_ai_rate_limits[key_min]) >= settings.AI_GENERATE_PER_MINUTE:
            oldest_time = _ai_rate_limits[key_min][0]
            wait_time = max(1, int(oldest_time + 60 - current_time))
            return False, wait_time
            
        if len(_ai_rate_limits[key_hr]) >= settings.AI_GENERATE_PER_HOUR:
            oldest_time = _ai_rate_limits[key_hr][0]
            wait_time = max(1, int(oldest_time + 3600 - current_time))
            return False, wait_time
            
        # All passed: increment both
        _ai_rate_limits[key_min].append(current_time)
        _ai_rate_limits[key_hr].append(current_time)
        return True, 0
        
    elif limit_type == "regenerate":
        key_reg = f"rate_limit:ai_regenerate:min:{key_id}"
        if _redis_client and _rate_limit_lua_script:
            try:
                res = _rate_limit_lua_script(
                    keys=[key_reg],
                    args=[settings.AI_REGENERATE_PER_MINUTE, 60, current_time]
                )
                return res[0] == 1, res[1]
            except Exception as e:
                print(f"[-] Redis rate limiter error: {e}. Falling back to in-memory.")
                
        # In-memory
        if key_reg not in _ai_rate_limits:
            _ai_rate_limits[key_reg] = []
        _ai_rate_limits[key_reg] = [t for t in _ai_rate_limits[key_reg] if t > current_time - 60]
        if len(_ai_rate_limits[key_reg]) >= settings.AI_REGENERATE_PER_MINUTE:
            oldest_time = _ai_rate_limits[key_reg][0]
            wait_time = max(1, int(oldest_time + 60 - current_time))
            return False, wait_time
        _ai_rate_limits[key_reg].append(current_time)
        return True, 0
        
    elif limit_type == "enhance":
        key_enh = f"rate_limit:ai_enhance:min:{key_id}"
        if _redis_client and _rate_limit_lua_script:
            try:
                res = _rate_limit_lua_script(
                    keys=[key_enh],
                    args=[settings.AI_ENHANCE_PER_MINUTE, 60, current_time]
                )
                return res[0] == 1, res[1]
            except Exception as e:
                print(f"[-] Redis rate limiter error: {e}. Falling back to in-memory.")
                
        # In-memory
        if key_enh not in _ai_rate_limits:
            _ai_rate_limits[key_enh] = []
        _ai_rate_limits[key_enh] = [t for t in _ai_rate_limits[key_enh] if t > current_time - 60]
        if len(_ai_rate_limits[key_enh]) >= settings.AI_ENHANCE_PER_MINUTE:
            oldest_time = _ai_rate_limits[key_enh][0]
            wait_time = max(1, int(oldest_time + 60 - current_time))
            return False, wait_time
        _ai_rate_limits[key_enh].append(current_time)
        return True, 0
        
    return True, 0

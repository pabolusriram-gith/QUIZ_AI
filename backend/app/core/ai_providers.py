import abc
import json
import random
import asyncio
import logging
from typing import List, Dict, Any, Optional
import httpx
from app.config.settings import settings
from app.services.ai_metrics_service import ai_metrics_service
import time
import socket
import uuid
from datetime import datetime, timezone
from app.services.ai_health_service import ai_health_service

from dataclasses import dataclass

logger = logging.getLogger("app.core.ai_providers")


@dataclass
class TokenUsage:
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0

@dataclass
class AIGenerationResult:
    questions: List[Dict[str, Any]]
    token_usage: Optional[TokenUsage] = None
    provider: str = ""
    model: str = ""
    generation_time_ms: int = 0

# Custom Provider Exceptions
class AIProviderError(Exception):
    """Base exception class for all AI provider errors."""
    pass

class AIProviderConfigurationError(AIProviderError):
    """Exception raised when a provider is unconfigured or disabled."""
    pass

class AIProviderUnavailableError(AIProviderError):
    """Exception raised when a provider service fails, times out, or is rate-limited."""
    pass


# Base AI Provider Interface
class BaseAIProvider(abc.ABC):
    @abc.abstractmethod
    async def generate_questions(
        self, 
        prompt: str, 
        system_instruction: str, 
        model_name: str,
        temperature: float = 0.7
    ) -> AIGenerationResult:
        pass


from openai import (
    APIError as OpenAI_APIError,
    RateLimitError as OpenAI_RateLimitError,
    InternalServerError as OpenAI_InternalServerError,
    APITimeoutError as OpenAI_APITimeoutError,
    APIConnectionError as OpenAI_APIConnectionError,
    AuthenticationError as OpenAI_AuthenticationError,
    PermissionDeniedError as OpenAI_PermissionDeniedError,
    NotFoundError as OpenAI_NotFoundError,
    BadRequestError as OpenAI_BadRequestError
)
try:
    import google.api_core.exceptions as google_exceptions
except ImportError:
    google_exceptions = None

def is_transient_failure(e: Exception) -> bool:
    # 1. Timeout / socket / connection reset exceptions
    if isinstance(e, (asyncio.TimeoutError, socket.timeout, ConnectionRefusedError, ConnectionResetError)):
        return True
    # 2. HTTPX exceptions
    if isinstance(e, (httpx.TimeoutException, httpx.NetworkError)):
        return True
    # 3. OpenAI / Groq exceptions
    if isinstance(e, OpenAI_APIError):
        if isinstance(e, (OpenAI_RateLimitError, OpenAI_InternalServerError, OpenAI_APITimeoutError, OpenAI_APIConnectionError)):
            return True
        status_code = getattr(e, "status_code", None)
        if status_code in [429, 500, 502, 503, 504]:
            return True
        if isinstance(e, (OpenAI_AuthenticationError, OpenAI_PermissionDeniedError, OpenAI_NotFoundError, OpenAI_BadRequestError)):
            return False
    # 4. Google exceptions
    if google_exceptions and isinstance(e, google_exceptions.GoogleAPICallError):
        status_code = getattr(e, "code", None)
        if status_code in [429, 500, 502, 503, 504]:
            return True
        if status_code in [400, 401, 403, 404]:
            return False
    # 5. Check string representations if generic
    msg = str(e).lower()
    if "timeout" in msg or "timed out" in msg or "connection" in msg or "rate limit" in msg or "429" in msg or "503" in msg:
        if "api key" in msg or "auth" in msg or "unauthorized" in msg or "bad request" in msg:
            return False
        return True
    return False

def is_rate_limit_or_quota_failure(e: Exception) -> bool:
    if isinstance(e, OpenAI_RateLimitError):
        return True
    if google_exceptions and isinstance(e, google_exceptions.GoogleAPICallError):
        status_code = getattr(e, "code", None)
        if status_code == 429:
            return True
    msg = str(e).lower()
    if "429" in msg or "rate limit" in msg or "quota" in msg or "insufficient credits" in msg or "credits" in msg or "tpm" in msg or "rpm" in msg:
        if "api key" in msg or "auth" in msg or "unauthorized" in msg:
            return False
        return True
    return False

def log_resilience_event(provider: str, request_id: str = "", retry_attempt: int = 0, latency_ms: float = 0.0, timeout: int = 0, circuit_state: str = "CLOSED", event_type: str = "EVENT", reason: str = ""):
    log_data = {
        "event": "AI_RESILIENCE_EVENT",
        "event_type": event_type,
        "provider": provider,
        "request_id": request_id,
        "retry_attempt": retry_attempt,
        "latency_ms": latency_ms,
        "timeout": timeout,
        "circuit_state": circuit_state,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "reason": reason
    }
    logger.warning(json.dumps(log_data))

def execute_resilient_raw_call_sync(provider_name: str, func, *args, **kwargs):
    # Synchronous wrapper helper if needed, but we use async exclusively.
    pass

async def execute_resilient_raw_call(provider_name: str, func, *args, **kwargs):
    # Check if this is the mock provider. MockProvider is fully excluded.
    if provider_name == "mock":
        return await func(*args, **kwargs)

    # Check circuit breaker status
    state = ai_health_service.check_and_update_circuit(provider_name)
    if state == "OPEN":
        raise AIProviderUnavailableError(f"Circuit breaker is OPEN for {provider_name}.")

    # If HALF_OPEN, attempt to acquire trial request slot
    if state == "HALF_OPEN":
        ai_health_service.acquire_trial_slot(provider_name)

    # Determine timeouts
    timeout_seconds = 30
    if provider_name == "gemini":
        timeout_seconds = settings.GEMINI_TIMEOUT_SECONDS
    elif provider_name == "groq":
        timeout_seconds = settings.GROQ_TIMEOUT_SECONDS
    elif provider_name == "openai":
        timeout_seconds = settings.OPENAI_TIMEOUT_SECONDS

    request_id = str(uuid.uuid4().hex[:8])
    max_retries = settings.AI_MAX_RETRIES
    attempt = 0
    
    while True:
        try:
            start_time = time.time()
            # Execute within wait_for to enforce timeout
            result = await asyncio.wait_for(func(*args, **kwargs), timeout=timeout_seconds)
            latency = int((time.time() - start_time) * 1000)
            
            # Success path
            ai_health_service.record_success(provider_name)
            return result
            
        except Exception as e:
            latency = int((time.time() - start_time) * 1000)
            
            # Check for immediate rate limit or quota failover
            if is_rate_limit_or_quota_failure(e):
                ai_health_service.force_open_circuit(provider_name, reason=str(e))
                log_resilience_event(
                    provider=provider_name,
                    request_id=request_id,
                    retry_attempt=attempt,
                    latency_ms=latency,
                    timeout=timeout_seconds,
                    circuit_state="OPEN",
                    event_type="CIRCUIT_OPENED_RATE_LIMIT",
                    reason=f"Immediate circuit opening due to rate limit or quota: {e}"
                )
                raise AIProviderUnavailableError(f"Rate limit or quota exhausted on {provider_name}: {e}")

            is_timeout = isinstance(e, (asyncio.TimeoutError, socket.timeout))
            is_trans = is_transient_failure(e)
            
            # Record failure to health service
            ai_health_service.record_failure(provider_name, is_transient=is_trans)
            
            # Log event
            current_circuit_state = ai_health_service.get_circuit_state(provider_name)
            log_resilience_event(
                provider=provider_name,
                request_id=request_id,
                retry_attempt=attempt,
                latency_ms=latency,
                timeout=timeout_seconds,
                circuit_state=current_circuit_state,
                event_type="TIMEOUT_OCCURRED" if is_timeout else "TRANSIENT_FAILURE",
                reason=f"Transient failure occurred: {e}" if is_trans else f"Non-transient failure: {e}"
            )
            
            if not is_trans:
                # Non-transient failure. Do NOT retry, propagate immediately.
                raise e
                
            attempt += 1
            if attempt <= max_retries:
                # Wait with exponential backoff + random jitter (0-250ms)
                base_delay = settings.AI_RETRY_BASE_DELAY_SECONDS
                backoff = base_delay * (2 ** (attempt - 1))
                jitter = random.uniform(0, 0.25)
                delay = backoff + jitter
                
                log_resilience_event(
                    provider=provider_name,
                    request_id=request_id,
                    retry_attempt=attempt,
                    latency_ms=latency,
                    timeout=timeout_seconds,
                    circuit_state=current_circuit_state,
                    event_type="RETRY_SCHEDULED",
                    reason=f"Scheduling retry {attempt}/{max_retries} in {round(delay, 3)}s (backoff={backoff}s, jitter={round(jitter*1000)}ms)."
                )
                await asyncio.sleep(delay)
                continue
                
            # Max retries exhausted
            raise AIProviderUnavailableError(f"Transient call to {provider_name} failed after {attempt} attempts: {e}")

def make_resilient_provider_call(provider_name: str):
    def decorator(func):
        async def wrapper(self, *args, **kwargs):
            return await execute_resilient_raw_call(provider_name, func, self, *args, **kwargs)
        return wrapper
    return decorator

# Helper to clean model response markdown wrapping
def clean_json_response(text: str) -> List[Dict[str, Any]]:
    import re
    
    def extract_from_parsed(data: Any) -> List[Dict[str, Any]]:
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            # Check if there is a list key, like "questions" or "evaluations"
            for val in data.values():
                if isinstance(val, list):
                    return val
            return [data]
        return []

    def repair_json_string(raw_txt: str) -> str:
        raw_txt = raw_txt.strip()
        
        # 1. Clean markdown code fences & leading/trailing cruft
        code_block_match = re.search(r"```(?:json)?\s*(.*?)\s*```", raw_txt, re.DOTALL | re.IGNORECASE)
        if code_block_match:
            raw_txt = code_block_match.group(1).strip()
        
        first_bracket = raw_txt.find('[')
        first_brace = raw_txt.find('{')
        
        start_pos = -1
        if first_bracket != -1 and first_brace != -1:
            start_pos = min(first_bracket, first_brace)
        elif first_bracket != -1:
            start_pos = first_bracket
        elif first_brace != -1:
            start_pos = first_brace
            
        last_bracket = raw_txt.rfind(']')
        last_brace = raw_txt.rfind('}')
        end_pos = max(last_bracket, last_brace)
        
        if start_pos != -1 and end_pos != -1 and end_pos > start_pos:
            raw_txt = raw_txt[start_pos:end_pos+1]

        # 2. Fix UTF/smart quotes
        smart_quotes = ["“", "”", "„", "‟", "″", "‟", "«", "»"]
        for q in smart_quotes:
            raw_txt = raw_txt.replace(q, '"')
        
        smart_single = ["‘", "’", "‚", "‛", "′"]
        for q in smart_single:
            raw_txt = raw_txt.replace(q, "'")

        # 3. Clean up typical syntax issues
        # Trailing commas: e.g. ",]" -> "]" or ",}" -> "}"
        raw_txt = re.sub(r",\s*\]", "]", raw_txt)
        raw_txt = re.sub(r",\s*\}", "}", raw_txt)

        # 4. Convert single-quoted keys and string values to standard double quotes
        raw_txt = re.sub(r"'\s*(\w+)\s*'\s*:", r'"\1":', raw_txt)
        # Attempt to handle single quoted strings if double quotes are not enclosing them
        raw_txt = re.sub(r":\s*'([^']*)'\s*([,}])", r': "\1"\2', raw_txt)
        raw_txt = re.sub(r"\[\s*'([^']*)'\s*([,\]])", r'[ "\1"\2', raw_txt)
        raw_txt = re.sub(r",\s*'([^']*)'\s*([,\]])", r', "\1"\2', raw_txt)

        # 5. Check brackets balance and close open brackets/braces if they are truncated
        stack = []
        in_string = False
        escape = False
        
        for char in raw_txt:
            if in_string:
                if char == '\\':
                    escape = not escape
                elif char == '"' and not escape:
                    in_string = False
                else:
                    escape = False
            else:
                if char == '"':
                    in_string = True
                elif char in ('{', '['):
                    stack.append(char)
                elif char == '}':
                    if stack and stack[-1] == '{':
                        stack.pop()
                elif char == ']':
                    if stack and stack[-1] == '[':
                        stack.pop()
        
        if in_string:
            raw_txt += '"'
            
        while stack:
            last = stack.pop()
            raw_txt = raw_txt.rstrip()
            if raw_txt.endswith(','):
                raw_txt = raw_txt[:-1]
            if last == '{':
                raw_txt += '}'
            elif last == '[':
                raw_txt += ']'
            
        return raw_txt

    # First attempt: parse directly
    try:
        parsed = json.loads(text.strip())
        return extract_from_parsed(parsed)
    except Exception:
        pass

    # Second attempt: repair string then parse
    repaired_text = text
    try:
        repaired_text = repair_json_string(text)
        parsed = json.loads(repaired_text)
        return extract_from_parsed(parsed)
    except Exception as e:
        # Third attempt: search for array bounds on repaired text
        start = repaired_text.find("[")
        end = repaired_text.rfind("]")
        if start != -1 and end != -1 and end > start:
            try:
                parsed = json.loads(repaired_text[start:end+1])
                return extract_from_parsed(parsed)
            except:
                pass
        
        # Fourth attempt: search for object bounds on repaired text
        start_obj = repaired_text.find("{")
        end_obj = repaired_text.rfind("}")
        if start_obj != -1 and end_obj != -1 and end_obj > start_obj:
            try:
                parsed = json.loads(repaired_text[start_obj:end_obj+1])
                return extract_from_parsed(parsed)
            except:
                pass
                
        raise ValueError(f"Failed to parse JSON response: {e}. Repaired content: {repaired_text[:400]}")

# 1. Google Gemini Provider
class GeminiProvider(BaseAIProvider):
    @make_resilient_provider_call("gemini")
    async def generate_questions(self, prompt: str, system_instruction: str, model_name: str, temperature: float = 0.7) -> AIGenerationResult:
        if not is_gemini_configured():
            raise AIProviderConfigurationError("Gemini provider disabled (API key not configured).")

        import google.generativeai as genai
        import google.api_core.exceptions
        import time
        import socket
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
        # Configure model parameters
        generation_config = {
            "temperature": temperature,
            "response_mime_type": "application/json",
        }
        
        is_gemini_model = model_name and ("gemini" in model_name.lower())
        chosen_model = model_name if is_gemini_model else "gemini-3.5-flash"
        model = genai.GenerativeModel(
            model_name=chosen_model,
            generation_config=generation_config,
            system_instruction=system_instruction
        )
        
        try:
            start_time = time.time()
            # Call gemini
            response = await asyncio.to_thread(model.generate_content, prompt)
            gen_time = int((time.time() - start_time) * 1000)
            ai_metrics_service.increment_success("gemini")
            ai_metrics_service.record_latency("gemini", gen_time)
        except google.api_core.exceptions.GoogleAPICallError as e:
            ai_metrics_service.increment_failure("gemini")
            status_code = getattr(e, "code", None)
            if status_code in [429, 500, 502, 503, 504]:
                raise AIProviderUnavailableError(f"Gemini service unavailable: {e}")
            else:
                raise AIProviderConfigurationError(f"Gemini configuration error: {e}")
        except Exception as e:
            ai_metrics_service.increment_failure("gemini")
            if isinstance(e, (socket.timeout, asyncio.TimeoutError)):
                raise AIProviderUnavailableError(f"Gemini service timed out: {e}")
            raise e
        
        usage = None
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            usage = TokenUsage(
                prompt_tokens=response.usage_metadata.prompt_token_count,
                completion_tokens=response.usage_metadata.candidates_token_count,
                total_tokens=response.usage_metadata.total_token_count
            )
            
        questions = clean_json_response(response.text)
        return AIGenerationResult(
            questions=questions,
            token_usage=usage,
            provider="gemini",
            model=chosen_model,
            generation_time_ms=gen_time
        )


# 2. OpenAI Provider
class OpenAIProvider(BaseAIProvider):
    @make_resilient_provider_call("openai")
    async def generate_questions(self, prompt: str, system_instruction: str, model_name: str, temperature: float = 0.7) -> AIGenerationResult:
        if not is_openai_configured():
            raise AIProviderConfigurationError("OpenAI provider disabled (API key not configured).")

        from openai import AsyncOpenAI, APIError, RateLimitError, InternalServerError, APITimeoutError, APIConnectionError
        import time
        import socket
        
        is_openai_model = model_name and ("gpt" in model_name.lower() or "o1" in model_name.lower())
        chosen_model = model_name if is_openai_model else "gpt-4o-mini"
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        
        try:
            start_time = time.time()
            response = await client.chat.completions.create(
                model=chosen_model,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                response_format={"type": "json_object"}
            )
            gen_time = int((time.time() - start_time) * 1000)
            ai_metrics_service.increment_success("openai")
            ai_metrics_service.record_latency("openai", gen_time)
        except (RateLimitError, InternalServerError, APITimeoutError, APIConnectionError) as e:
            ai_metrics_service.increment_failure("openai")
            raise AIProviderUnavailableError(f"OpenAI service unavailable: {e}")
        except APIError as e:
            ai_metrics_service.increment_failure("openai")
            raise AIProviderConfigurationError(f"OpenAI configuration error: {e}")
        except Exception as e:
            ai_metrics_service.increment_failure("openai")
            if isinstance(e, (socket.timeout, asyncio.TimeoutError)):
                raise AIProviderUnavailableError(f"OpenAI service timed out: {e}")
            raise e
        
        usage = None
        if response.usage:
            usage = TokenUsage(
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                total_tokens=response.usage.total_tokens
            )
            
        content = response.choices[0].message.content or ""
        questions = clean_json_response(content)
        
        return AIGenerationResult(
            questions=questions,
            token_usage=usage,
            provider="openai",
            model=chosen_model,
            generation_time_ms=gen_time
        )


# 3. Groq Provider
class GroqProvider(BaseAIProvider):
    @make_resilient_provider_call("groq")
    async def generate_questions(self, prompt: str, system_instruction: str, model_name: str, temperature: float = 0.7) -> AIGenerationResult:
        if not is_groq_configured():
            raise AIProviderConfigurationError("Groq provider disabled (API key not configured).")

        from openai import AsyncOpenAI, APIError, RateLimitError, InternalServerError, APITimeoutError, APIConnectionError
        import time
        import socket
        
        is_groq_model = model_name and ("llama" in model_name.lower() or "mixtral" in model_name.lower() or "gemma" in model_name.lower())
        chosen_model = model_name if is_groq_model else "llama-3.3-70b-versatile"
        client = AsyncOpenAI(
            api_key=settings.GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1"
        )
        
        try:
            start_time = time.time()
            response = await client.chat.completions.create(
                model=chosen_model,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                response_format={"type": "json_object"}
            )
            gen_time = int((time.time() - start_time) * 1000)
            ai_metrics_service.increment_success("groq")
            ai_metrics_service.record_latency("groq", gen_time)
        except (RateLimitError, InternalServerError, APITimeoutError, APIConnectionError) as e:
            ai_metrics_service.increment_failure("groq")
            raise AIProviderUnavailableError(f"Groq service unavailable: {e}")
        except APIError as e:
            ai_metrics_service.increment_failure("groq")
            raise AIProviderConfigurationError(f"Groq configuration error: {e}")
        except Exception as e:
            ai_metrics_service.increment_failure("groq")
            if isinstance(e, (socket.timeout, asyncio.TimeoutError)):
                raise AIProviderUnavailableError(f"Groq service timed out: {e}")
            raise e
        
        usage = None
        if response.usage:
            usage = TokenUsage(
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                total_tokens=response.usage.total_tokens
            )
            
        content = response.choices[0].message.content or ""
        questions = clean_json_response(content)
        
        return AIGenerationResult(
            questions=questions,
            token_usage=usage,
            provider="groq",
            model=chosen_model,
            generation_time_ms=gen_time
        )


# 4. Auto Provider (Priority: Gemini -> Groq -> OpenAI)
class AutoProvider(BaseAIProvider):
    async def generate_questions(self, prompt: str, system_instruction: str, model_name: str, temperature: float = 0.7) -> AIGenerationResult:
        errors = []
        
        # Build the order list dynamically
        order = []
        for prov in settings.AUTO_PROVIDER_ORDER:
            p_name = prov.lower().strip()
            if p_name == "groq" and is_groq_configured():
                order.append("groq")
            elif p_name == "gemini" and is_gemini_configured():
                order.append("gemini")
            elif p_name == "openai" and is_openai_configured():
                order.append("openai")
            elif p_name == "mock" and settings.ENABLE_MOCK_PROVIDER:
                order.append("mock")
        
        # If mock is explicitly enabled and not in list, we append it as absolute last fallback in dev mode only
        if settings.ENABLE_MOCK_PROVIDER and "mock" not in order:
            order.append("mock")
            
        for prov in order:
            if prov != "mock":
                state = ai_health_service.check_and_update_circuit(prov)
                if state == "OPEN":
                    logger.warning(f"Auto mode fallback: Skipping provider {prov} because its circuit breaker is OPEN.")
                    errors.append(f"{prov} (circuit open): skipped")
                    continue

            if prov == "gemini":
                try:
                    provider = GeminiProvider()
                    return await provider.generate_questions(prompt, system_instruction, model_name, temperature)
                except AIProviderConfigurationError as e:
                    logger.warning(f"Auto mode fallback: Gemini configuration check failed. Error: {e}")
                    errors.append(f"Gemini (config): {e}")
                except AIProviderUnavailableError as e:
                    logger.warning(f"Auto mode fallback: Gemini service is unavailable. Error: {e}")
                    errors.append(f"Gemini (unavailable): {e}")
                except Exception as e:
                    logger.exception(f"Auto mode fallback: Gemini encountered an unexpected internal error: {e}")
                    errors.append(f"Gemini (internal error): {e}")
                    
            elif prov == "groq":
                try:
                    provider = GroqProvider()
                    return await provider.generate_questions(prompt, system_instruction, model_name, temperature)
                except AIProviderConfigurationError as e:
                    logger.warning(f"Auto mode fallback: Groq configuration check failed. Error: {e}")
                    errors.append(f"Groq (config): {e}")
                except AIProviderUnavailableError as e:
                    logger.warning(f"Auto mode fallback: Groq service is unavailable. Error: {e}")
                    errors.append(f"Groq (unavailable): {e}")
                except Exception as e:
                    logger.exception(f"Auto mode fallback: Groq encountered an unexpected internal error: {e}")
                    errors.append(f"Groq (internal error): {e}")
                    
            elif prov == "openai":
                try:
                    provider = OpenAIProvider()
                    return await provider.generate_questions(prompt, system_instruction, model_name, temperature)
                except AIProviderConfigurationError as e:
                    logger.warning(f"Auto mode fallback: OpenAI configuration check failed. Error: {e}")
                    errors.append(f"OpenAI (config): {e}")
                except AIProviderUnavailableError as e:
                    logger.warning(f"Auto mode fallback: OpenAI service is unavailable. Error: {e}")
                    errors.append(f"OpenAI (unavailable): {e}")
                except Exception as e:
                    logger.exception(f"Auto mode fallback: OpenAI encountered an unexpected internal error: {e}")
                    errors.append(f"OpenAI (internal error): {e}")
                    
            elif prov == "mock":
                try:
                    provider = MockProvider()
                    return await provider.generate_questions(prompt, system_instruction, model_name, temperature)
                except AIProviderConfigurationError as e:
                    logger.warning(f"Auto mode fallback: Mock configuration check failed. Error: {e}")
                    errors.append(f"Mock (config): {e}")
                except AIProviderUnavailableError as e:
                    logger.warning(f"Auto mode fallback: Mock service is unavailable. Error: {e}")
                    errors.append(f"Mock (unavailable): {e}")
                except Exception as e:
                    logger.exception(f"Auto mode fallback: Mock encountered an unexpected internal error: {e}")
                    errors.append(f"Mock (internal error): {e}")
        
        raise AIProviderUnavailableError(
            f"All AI providers are currently unavailable or unconfigured. Errors: {'; '.join(errors)}"
        )


# Helper Functions to check key configuration
def is_gemini_configured() -> bool:
    return bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip() and not settings.GEMINI_API_KEY.startswith("your_"))

def is_groq_configured() -> bool:
    return bool(settings.GROQ_API_KEY and settings.GROQ_API_KEY.strip() and not settings.GROQ_API_KEY.startswith("your_"))

def is_openai_configured() -> bool:
    return bool(settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.strip() and not settings.OPENAI_API_KEY.startswith("your_"))


# Provider resolution helper
def resolve_provider(provider_name: str) -> str:
    name = provider_name.strip().lower()
    
    # 1. Handle Explicit Mock Provider
    if name == "mock":
        if not settings.ENABLE_MOCK_PROVIDER:
            raise AIProviderConfigurationError("Mock provider is disabled (ENABLE_MOCK_PROVIDER is false).")
        return "mock"
        
    # 2. Handle Auto Mode
    if name == "auto":
        any_configured = False
        for prov in settings.AUTO_PROVIDER_ORDER:
            if prov == "gemini" and is_gemini_configured():
                any_configured = True
            elif prov == "groq" and is_groq_configured():
                any_configured = True
            elif prov == "openai" and is_openai_configured():
                any_configured = True
            elif prov == "mock" and settings.ENABLE_MOCK_PROVIDER:
                any_configured = True
                
        if any_configured:
            return "auto"
        else:
            raise AIProviderConfigurationError("All AI providers are currently unavailable. Please try again later.")
            
    # 3. Handle Explicit Providers
    if name == "gemini":
        if not is_gemini_configured():
            raise AIProviderConfigurationError("Gemini provider disabled (API key not configured).")
        return "gemini"
        
    if name == "groq":
        if not is_groq_configured():
            raise AIProviderConfigurationError("Groq provider disabled (API key not configured).")
        return "groq"
        
    if name == "openai":
        if not is_openai_configured():
            raise AIProviderConfigurationError("OpenAI provider disabled (API key not configured).")
        return "openai"
        
    # 4. Handle Unsupported Providers
    raise AIProviderConfigurationError(f"Unsupported provider: {provider_name}")


# 5. Mock / Fallback Provider (Kept ONLY for internal testing/development)
class MockProvider(BaseAIProvider):
    @classmethod
    def _create_dynamic_mock_question(
        cls,
        topic: str,
        difficulty: str,
        bloom_level: str,
        question_type: str,
        learning_objective: str,
        idx: int,
        uniqueness_hint: str = ""
    ) -> Dict[str, Any]:
        import random
        # Seed the random number generator using uniqueness_hint and idx
        seed_str = f"{uniqueness_hint}_{idx}_{topic}_{difficulty}_{question_type}_{bloom_level}"
        rng = random.Random(seed_str)

        # Generate a unique scenario or company name to ensure low similarity (Jaccard < 0.80)
        companies = ["TechCorp", "ApexLabs", "ByteSystems", "CloudSphere", "DataFlow", "QuantumSoft", "NovaTech", "ZettaByte", "Solaris", "Helix"]
        company = rng.choice(companies)

        projects = ["Alpha", "Vanguard", "Phoenix", "Titan", "Aegis", "Orion", "Zephyr", "Apex", "Hermes", "Nexus"]
        project = rng.choice(projects)

        verbs = ["optimizing", "refactoring", "debugging", "analyzing", "securing", "scaling", "evaluating", "designing"]
        verb = rng.choice(verbs)

        challenges = [
            "latency bottlenecks",
            "memory fragmentation",
            "race conditions",
            "unauthorized access",
            "throughput degradation",
            "deadlocks",
            "scalability limits",
            "dependency conflicts"
        ]
        challenge = rng.choice(challenges)

        # Vary the text based on difficulty to show difference
        difficulty_prefix = difficulty.capitalize()
        text = ""
        options = []
        
        # Build the question stem (text)
        if question_type == "true_false":
            statements = [
                f"True or False: In project {project} at {company}, when {verb} the {topic} implementation, the team can eliminate {challenge} by default.",
                f"True or False: Under {difficulty_prefix} complexity constraints, the performance of {topic} is independent of {challenge}."
            ]
            text = rng.choice(statements)
            # exactly 2 options: True, False. exactly 1 correct
            correct_idx = rng.choice([0, 1])
            options = [
                {"text": "True", "is_correct": (correct_idx == 0), "display_order": 0},
                {"text": "False", "is_correct": (correct_idx == 1), "display_order": 1}
            ]
        elif question_type == "multiple_choice":
            questions = [
                f"A team at {company} is working on Project {project}. While {verb} {topic}, they encounter severe {challenge}. Which option represents the most appropriate {difficulty_prefix} level solution?",
                f"Under {difficulty_prefix} operational parameters, which approach is optimal for {verb} a {topic} service facing {challenge}?",
                f"Which configuration adjustment is most likely to resolve {challenge} in a {topic} system developed by {company}?"
            ]
            text = rng.choice(questions)
            
            # exactly 4 options, exactly 1 correct
            correct_opt = f"Implement a structured {topic} layer with optimized strategy to resolve {challenge}."
            distractors = [
                f"Disable all security controls to bypass {challenge} overhead.",
                f"Deprecate the entire {topic} abstraction and manage raw memory using pointers.",
                f"Bypass all caching and run operations sequentially on the main thread.",
                f"Deploy a secondary unmonitored {topic} container with manual scaling.",
                f"Increase hardware resources without addressing the root cause of {challenge}."
            ]
            rng.shuffle(distractors)
            selected_distractors = distractors[:3]
            
            options_pool = [{"text": correct_opt, "is_correct": True}] + [{"text": d, "is_correct": False} for d in selected_distractors]
            rng.shuffle(options_pool)
            options = []
            for i, opt in enumerate(options_pool):
                opt["display_order"] = i
                options.append(opt)
                
        elif question_type == "multiple_select":
            questions = [
                f"Select the design characteristics that are essential for {verb} a resilient {topic} architecture at {company} to prevent {challenge}.",
                f"Which configurations are critical when deploying multiple instances of {topic} in Project {project} under {difficulty_prefix} constraints?"
            ]
            text = rng.choice(questions)
            
            # exactly 4 options, 2-3 correct
            num_correct = rng.choice([2, 3])
            correct_pool = [
                "Continuous authentication and access verification",
                "Strict micro-segmentation of critical network nodes",
                "Automated recovery and failure domain containment",
                f"Optimized queue management for {topic} clusters",
                "Distributed consensus tracking across endpoints"
            ]
            distractor_pool = [
                "Disabling all safety controls to maximize payload size",
                "Forcing single-threaded sequential execution on all CPU cores",
                "Using default hardcoded administrative passwords",
                "Replicating unencrypted data to public storage buckets"
            ]
            rng.shuffle(correct_pool)
            rng.shuffle(distractor_pool)
            
            selected_correct = correct_pool[:num_correct]
            selected_distractors = distractor_pool[:(4 - num_correct)]
            
            options_pool = [{"text": c, "is_correct": True} for c in selected_correct] + [{"text": d, "is_correct": False} for d in selected_distractors]
            rng.shuffle(options_pool)
            options = []
            for i, opt in enumerate(options_pool):
                opt["display_order"] = i
                options.append(opt)
                
        elif question_type in ["fill_in_the_blank", "short_answer"]:
            statements = [
                f"The core design goal of {topic} at {company} is to guarantee ________ consistency and avoid {challenge}.",
                f"When {verb} {topic} in Project {project}, the primary bottleneck is memory ________."
            ]
            text = rng.choice(statements)
            # 1-3 options, all correct
            words = ["data", "system", "performance", "isolation", "safety"]
            rng.shuffle(words)
            num_opts = rng.randint(1, 3)
            options = [{"text": w, "is_correct": True, "display_order": i} for i, w in enumerate(words[:num_opts])]
            
        else:
            text = f"Explain the primary benefit of {verb} {topic} within enterprise systems to prevent {challenge}."
            options = [{"text": "Enhanced security and scalability", "is_correct": True, "display_order": 0}]

        # Construct a unique explanation referencing the company, project, and challenge
        explanation = (
            f"**Core Concept**: This question tests the essential properties of {topic} related to {learning_objective} "
            f"within the context of {company}'s Project {project}.\n"
            f"**Incorrect Option Analysis**:\n"
            f"- Option 1: Incorrect because ignoring {challenge} fails {difficulty_prefix} stability requirements.\n"
            f"- Option 2: Incorrect because the selected distractor fails to address the underlying {verb} complexity.\n"
            f"- Option 3: Incorrect because manual or unmonitored tracking does not guarantee resilient behavior.\n"
            f"**Learner Takeaway**: Always design systems around robust, automated boundaries to prevent {challenge}."
        )

        return {
            "text": text,
            "difficulty": difficulty,
            "topic": topic,
            "marks": 1 if difficulty == "easy" else 2,
            "explanation": explanation,
            "question_type": question_type,
            "bloom_level": bloom_level,
            "learning_objective": learning_objective,
            "options": options
        }

    async def generate_questions(self, prompt: str, system_instruction: str, model_name: str, temperature: float = 0.7) -> AIGenerationResult:
        import time
        start_time = time.time()
        try:
            res = await self._generate_questions_impl(prompt, system_instruction, model_name, temperature)
            gen_time = int((time.time() - start_time) * 1000)
            ai_metrics_service.increment_success("mock")
            ai_metrics_service.record_latency("mock", gen_time)
            return res
        except Exception as e:
            ai_metrics_service.increment_failure("mock")
            raise e

    async def _generate_questions_impl(self, prompt: str, system_instruction: str, model_name: str, temperature: float = 0.7) -> AIGenerationResult:
        import re
        import random

        # 1. Check if this is an AI Critic audit request
        if "audit the following" in prompt.lower() or "senior academic auditor" in system_instruction.lower():
            try:
                start_arr = prompt.find("[")
                end_arr = prompt.rfind("]")
                if start_arr != -1 and end_arr != -1:
                    qs = json.loads(prompt[start_arr:end_arr+1])
                    evals = []
                    for idx, q in enumerate(qs):
                        # Make 1 out of 5 fail validation in mock mode to verify replacement loops
                        is_val = idx % 5 != 0 or len(qs) == 1
                        evals.append({
                            "index": idx,
                            "educational_quality": 4.5 if is_val else 2.5,
                            "originality": 4.2 if is_val else 2.8,
                            "reasoning_depth": 4.8 if is_val else 2.5,
                            "clarity": 4.7 if is_val else 2.2,
                            "engagement": 4.4 if is_val else 3.0,
                            "is_valid": is_val,
                            "learning_objective": q.get("learning_objective") or f"Analyze {q.get('topic')}",
                            "rejection_reasons": [] if is_val else ["weak distractors", "insufficient reasoning depth"]
                        })
                    return AIGenerationResult(questions=evals, provider="mock", model="mock-critic")
            except Exception as e:
                logger.warning(f"Mock Critic parse failure: {e}")
            
            # Fallback single audit
            return AIGenerationResult(
                questions=[{
                    "index": 0,
                    "educational_quality": 4.5,
                    "originality": 4.0,
                    "reasoning_depth": 4.0,
                    "clarity": 4.5,
                    "engagement": 4.2,
                    "is_valid": True,
                    "learning_objective": "Mock Objective",
                    "rejection_reasons": []
                }],
                provider="mock",
                model="mock-critic"
            )

        # 2. Extract Topic
        topic_val = "General Knowledge"
        topic_match = re.search(r"Topic/Context Prompt:\s*(.*)", prompt)
        if topic_match:
            topic_val = topic_match.group(1).strip()
        else:
            topic_match = re.search(r"Topic=\s*(.*)", prompt)
            if topic_match:
                topic_val = topic_match.group(1).strip()
            else:
                topic_match = re.search(r"covering\s+([^,]+)", prompt)
                if topic_match:
                    topic_val = topic_match.group(1).strip()

        # Clean topic
        topic_val = re.sub(r"[^\w\s\-\.]", "", topic_val).strip()

        # Extract general metadata
        uniqueness_hint = "none"
        uniq_match = (re.search(r"uniqueness_(?:hint|seed)\s*[:=]\s*([^\s\]\n\r]+)", prompt, re.IGNORECASE) or 
                      re.search(r"uniqueness_(?:hint|seed)\s*[:=]\s*([^\s\]\n\r]+)", system_instruction, re.IGNORECASE))
        if uniq_match:
            uniqueness_hint = uniq_match.group(1).strip()

        # 3. Check if this is a single slot guided regeneration
        slot_match = re.search(r"- Slot index:\s*(\d+)", prompt)
        if slot_match:
            slot_idx = int(slot_match.group(1))
            diff_match = re.search(r"- Target Difficulty:\s*(\w+)", prompt)
            bloom_match = re.search(r"- Target Bloom level:\s*(\w+)", prompt)
            type_match = re.search(r"- Question Type:\s*(\w+)", prompt)
            obj_match = re.search(r"- Target Learning Objective:\s*'(.*)'", prompt)
            
            diff = diff_match.group(1).strip() if diff_match else "medium"
            bloom = bloom_match.group(1).strip() if bloom_match else "Understand"
            q_type = type_match.group(1).strip() if type_match else "multiple_choice"
            obj = obj_match.group(1).strip() if obj_match else f"Explain {topic_val}"
            
            q = self._create_dynamic_mock_question(topic_val, diff, bloom, q_type, obj, slot_idx, uniqueness_hint)
            q["order_index"] = slot_idx
            return AIGenerationResult(questions=[q], provider="mock", model="mock-regenerator")

        # 4. Determine count
        count = 5
        count_match = re.search(r"generate\s+exactly\s+(\d+)", prompt, re.IGNORECASE)
        if count_match:
            count = int(count_match.group(1))
        else:
            count_match = re.search(r"(\d+)\s+candidate", prompt, re.IGNORECASE)
            if count_match:
                count = int(count_match.group(1))

        # 5. Check if it's a candidate replacement request
        if "candidate replacement questions" in prompt.lower() or "original question:" in prompt.lower() or "original question being replaced" in prompt.lower() or "regeneration request" in prompt.lower():
            diff_match = (re.search(r"difficulty\s*[:=]\s*(\w+)", system_instruction, re.IGNORECASE) or 
                          re.search(r"difficulty\s*[:=]\s*(\w+)", prompt, re.IGNORECASE))
            diff = diff_match.group(1).strip().lower() if diff_match else "medium"

            type_match = (re.search(r"(?:question_)?type\s*[:=]\s*(\w+)", system_instruction, re.IGNORECASE) or 
                          re.search(r"(?:question_)?type\s*[:=]\s*(\w+)", prompt, re.IGNORECASE))
            q_type = type_match.group(1).strip().lower() if type_match else "multiple_choice"

            bloom_match = (re.search(r"bloom(?:_level)?\s*[:=]\s*(\w+)", system_instruction, re.IGNORECASE) or 
                           re.search(r"bloom(?:_level)?\s*[:=]\s*(\w+)", prompt, re.IGNORECASE))
            bloom = bloom_match.group(1).strip() if bloom_match else "Understand"

            top = topic_val

            candidates = []
            for idx in range(count):
                obj = f"Apply alternative perspective {idx + 1} of {top}"
                cand = self._create_dynamic_mock_question(top, diff, bloom, q_type, obj, idx, uniqueness_hint)
                cand["order_index"] = idx
                candidates.append(cand)
            return AIGenerationResult(questions=candidates, provider="mock", model="mock-candidates")

        # 6. Parse blueprint slots if present
        blueprint_matches = re.findall(r"- Slot (\d+):\s*Difficulty=(\w+),\s*Bloom Level=(\w+),\s*Type=(\w+),\s*Target Objective='(.*)'", prompt)
        if blueprint_matches:
            results = []
            for slot_idx, diff, bloom, q_type, obj in blueprint_matches:
                q = self._create_dynamic_mock_question(topic_val, diff, bloom, q_type, obj, int(slot_idx), uniqueness_hint)
                q["order_index"] = int(slot_idx)
                results.append(q)
            return AIGenerationResult(questions=results, provider="mock", model="mock-blueprint")

        # 7. Otherwise, fallback to generating generic topic questions
        results = []
        for idx in range(count):
            diff = "easy" if idx % 3 == 0 else ("hard" if idx % 3 == 2 else "medium")
            bloom = "Remember" if diff == "easy" else ("Analyze" if diff == "hard" else "Understand")
            q_type = "true_false" if idx % 2 == 1 else "multiple_choice"
            obj = f"Explain aspect {idx + 1} of {topic_val}"
            q = self._create_dynamic_mock_question(topic_val, diff, bloom, q_type, obj, idx, uniqueness_hint)
            q["order_index"] = idx
            results.append(q)
        return AIGenerationResult(questions=results, provider="mock", model="mock-generic")


# Provider Factory
class AIProviderFactory:
    @staticmethod
    def get_provider(provider_name: str) -> BaseAIProvider:
        resolved = resolve_provider(provider_name)
        if resolved == "gemini":
            return GeminiProvider()
        elif resolved == "groq":
            return GroqProvider()
        elif resolved == "openai":
            return OpenAIProvider()
        elif resolved == "auto":
            return AutoProvider()
        elif resolved == "mock":
            return MockProvider()
        
        raise AIProviderConfigurationError(f"Unsupported provider: {provider_name}")

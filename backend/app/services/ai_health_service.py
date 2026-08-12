import time
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any

logger = logging.getLogger("app.services.ai_health_service")

class ProviderHealthService:
    def __init__(self):
        # We track Gemini, Groq, OpenAI. Mock is fully bypassed.
        self.provider_states = {
            "gemini": {
                "name": "Gemini",
                "status": "Healthy",
                "failure_count": 0,
                "last_success_time": None,
                "last_failure_time": None,
                "circuit_state": "CLOSED",
                "is_trial_in_progress": False
            },
            "groq": {
                "name": "Groq",
                "status": "Healthy",
                "failure_count": 0,
                "last_success_time": None,
                "last_failure_time": None,
                "circuit_state": "CLOSED",
                "is_trial_in_progress": False
            },
            "openai": {
                "name": "OpenAI",
                "status": "Healthy",
                "failure_count": 0,
                "last_success_time": None,
                "last_failure_time": None,
                "circuit_state": "CLOSED",
                "is_trial_in_progress": False
            }
        }

    def check_and_update_circuit(self, provider_name: str) -> str:
        p = provider_name.lower().strip()
        state = self.provider_states.get(p)
        if not state:
            return "CLOSED"

        from app.config.settings import settings
        if state["circuit_state"] == "OPEN":
            cooldown = settings.AI_CIRCUIT_COOLDOWN_SECONDS
            if state["last_failure_time"] and (time.time() - state["last_failure_time"]) >= cooldown:
                # Cooldown expired, transition to HALF_OPEN
                old_state = state["circuit_state"]
                state["circuit_state"] = "HALF_OPEN"
                state["status"] = "Degraded"
                state["is_trial_in_progress"] = False
                
                log_data = {
                    "event": "AI_RESILIENCE_EVENT",
                    "event_type": "CIRCUIT_RECOVERY_HALF_OPEN",
                    "provider": p,
                    "circuit_state": "HALF_OPEN",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "reason": f"Cooldown of {cooldown} seconds expired. Circuit transitioned from {old_state} to HALF_OPEN."
                }
                logger.warning(json.dumps(log_data))

        # Enforce single trial request guard in HALF_OPEN state
        if state["circuit_state"] == "HALF_OPEN":
            if state.get("is_trial_in_progress", False):
                # Another request is already performing a trial! Behave as if circuit is OPEN
                return "OPEN"

        return state["circuit_state"]

    def acquire_trial_slot(self, provider_name: str):
        p = provider_name.lower().strip()
        state = self.provider_states.get(p)
        if state and state["circuit_state"] == "HALF_OPEN":
            state["is_trial_in_progress"] = True

    def record_success(self, provider_name: str):
        p = provider_name.lower().strip()
        state = self.provider_states.get(p)
        if not state:
            return
            
        old_state = state["circuit_state"]
        
        # Check if recovering from HALF_OPEN to CLOSED
        if old_state == "HALF_OPEN":
            downtime_duration = 0.0
            if state["last_failure_time"]:
                downtime_duration = round(time.time() - state["last_failure_time"], 2)
                
            recovery_log = {
                "event": "provider_recovered",
                "provider": p,
                "downtime_duration": downtime_duration,
                "failure_count_before_recovery": state["failure_count"],
                "recovery_timestamp": datetime.now(timezone.utc).isoformat()
            }
            logger.warning(json.dumps(recovery_log))

        state["circuit_state"] = "CLOSED"
        state["status"] = "Healthy"
        state["failure_count"] = 0
        state["last_success_time"] = time.time()
        state["is_trial_in_progress"] = False

    def record_failure(self, provider_name: str, is_transient: bool):
        p = provider_name.lower().strip()
        state = self.provider_states.get(p)
        if not state:
            return
            
        state["last_failure_time"] = time.time()
        state["is_trial_in_progress"] = False # Trial failed and is done
        
        if not is_transient:
            # Non-transient errors (auth, config, invalid requests) do not trigger circuit opening
            return

        state["failure_count"] += 1
        from app.config.settings import settings
        threshold = settings.AI_CIRCUIT_FAILURE_THRESHOLD

        if state["circuit_state"] == "HALF_OPEN" or state["failure_count"] >= threshold:
            old_state = state["circuit_state"]
            state["circuit_state"] = "OPEN"
            state["status"] = "Unavailable"
            
            log_data = {
                "event": "AI_RESILIENCE_EVENT",
                "event_type": "CIRCUIT_OPENED",
                "provider": p,
                "circuit_state": "OPEN",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "reason": f"Circuit breaker entered OPEN state from {old_state}. Failure count: {state['failure_count']}."
            }
            logger.warning(json.dumps(log_data))

    def force_open_circuit(self, provider_name: str, reason: str = ""):
        p = provider_name.lower().strip()
        state = self.provider_states.get(p)
        if not state:
            return
        state["circuit_state"] = "OPEN"
        state["status"] = "Unavailable"
        state["last_failure_time"] = time.time()
        state["is_trial_in_progress"] = False
        
        log_data = {
            "event": "AI_RESILIENCE_EVENT",
            "event_type": "CIRCUIT_OPENED_RATE_LIMIT",
            "provider": p,
            "circuit_state": "OPEN",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "reason": f"Circuit breaker opened due to rate limit or quota exhaustion. Reason: {reason}."
        }
        logger.warning(json.dumps(log_data))

    def get_circuit_state(self, provider_name: str) -> str:
        p = provider_name.lower().strip()
        state = self.provider_states.get(p)
        if not state:
            return "CLOSED"
        return state["circuit_state"]

# Singleton instance
ai_health_service = ProviderHealthService()

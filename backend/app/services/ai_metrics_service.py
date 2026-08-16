import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from collections import deque

class AIMetricsService:
    def __init__(self):
        # general counts
        self.successful_requests = 0
        self.rejected_requests = 0
        
        # provider breakdown metrics
        self.provider_stats = {
            "gemini": {"total": 0, "success": 0, "failed": 0, "total_latency_ms": 0.0},
            "groq": {"total": 0, "success": 0, "failed": 0, "total_latency_ms": 0.0},
            "openai": {"total": 0, "success": 0, "failed": 0, "total_latency_ms": 0.0},
            "mock": {"total": 0, "success": 0, "failed": 0, "total_latency_ms": 0.0},
        }
        
        # Bounded request trace log to prevent memory leaks
        self.request_traces = deque(maxlen=1000)
        
        # daily usage tracking per authenticated user
        # user_id -> date_str -> list of requests metadata
        self.daily_usage = {}
        self._write_count = 0

    def increment_success(self, provider: str):
        self.successful_requests += 1
        p = provider.lower().strip()
        if p in self.provider_stats:
            self.provider_stats[p]["total"] += 1
            self.provider_stats[p]["success"] += 1

    def increment_rejected(self):
        self.rejected_requests += 1

    def increment_failure(self, provider: str):
        p = provider.lower().strip()
        if p in self.provider_stats:
            self.provider_stats[p]["total"] += 1
            self.provider_stats[p]["failed"] += 1

    def record_latency(self, provider: str, milliseconds: float):
        p = provider.lower().strip()
        if p in self.provider_stats:
            self.provider_stats[p]["total_latency_ms"] += milliseconds

    def record_request_trace(
        self,
        request_id: str,
        provider: str,
        request_type: str,
        network_ms: float,
        processing_ms: float,
        total_ms: float,
        success: bool,
        prompt_version: str = "v2",
        model: str = "default",
        selected_provider: str = "auto",
        fallback_provider: str = "none",
        retry_count: int = 0,
        repair_count: int = 0,
        validation_failures: int = 0,
        fallback_reason: str = "none",
        provider_latency_ms: float = 0.0,
        validation_latency_ms: float = 0.0,
        embedding_latency_ms: float = 0.0,
        rag_latency_ms: float = 0.0,
        generation_latency_ms: float = 0.0,
        tokens_input: int = 0,
        tokens_output: int = 0,
        total_questions_generated: int = 0,
        user_id: Optional[str] = None
    ):
        trace_data = {
            "request_id": request_id,
            "prompt_version": prompt_version,
            "provider": provider.lower().strip(),
            "model": model,
            "selected_provider": selected_provider,
            "fallback_provider": fallback_provider,
            "retry_count": retry_count,
            "repair_count": repair_count,
            "validation_failures": validation_failures,
            "fallback_reason": fallback_reason,
            "provider_latency_ms": round(provider_latency_ms, 2),
            "validation_latency_ms": round(validation_latency_ms, 2),
            "embedding_latency_ms": round(embedding_latency_ms, 2),
            "rag_latency_ms": round(rag_latency_ms, 2),
            "generation_latency_ms": round(generation_latency_ms, 2),
            "network_ms": round(network_ms, 2),
            "processing_ms": round(processing_ms, 2),
            "total_ms": round(total_ms, 2),
            "success": success,
            "tokens_input": tokens_input,
            "tokens_output": tokens_output,
            "total_questions_generated": total_questions_generated,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": user_id
        }
        self.request_traces.append(trace_data)
        
        # Emit structured JSON log for production observability
        import logging
        import json
        structured_logger = logging.getLogger("app.ai_metrics_trace")
        structured_logger.info(json.dumps(trace_data))

    def _purge_old_entries(self):
        cutoff_date_str = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
        empty_users = []
        for user_id, dates in list(self.daily_usage.items()):
            old_dates = [d for d in dates if d < cutoff_date_str]
            for d in old_dates:
                del dates[d]
            if not dates:
                empty_users.append(user_id)
        for user_id in empty_users:
            del self.daily_usage[user_id]

    def track_user_usage(self, user_id: str, request_type: str, provider: str):
        """
        Maintain daily AI usage statistics per authenticated user.
        Track: generate requests, regenerate requests, enhance requests, provider used, timestamp.
        """
        self._write_count += 1
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        if user_id not in self.daily_usage:
            self.daily_usage[user_id] = {}
        if date_str not in self.daily_usage[user_id]:
            self.daily_usage[user_id][date_str] = []
            
        self.daily_usage[user_id][date_str].append({
            "request_type": request_type,
            "provider": provider,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Enforce 30-day retention policy
        cutoff_date_str = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
        if self._write_count % 100 == 0:
            self._purge_old_entries()
        else:
            # Clean current user's expired dates
            user_dates = self.daily_usage[user_id]
            old_dates = [d for d in user_dates if d < cutoff_date_str]
            for d in old_dates:
                del user_dates[d]
            if not user_dates:
                del self.daily_usage[user_id]

    def get_internal_snapshot(self, include_traces: bool = False, trace_limit: int = 50, user_id: Optional[str] = None) -> Dict[str, Any]:
        target_traces = list(self.request_traces)
        if user_id:
            target_traces = [t for t in target_traces if t.get("user_id") == user_id]

        # Calculate counts from filtered traces
        total_requests = len(target_traces)
        success_requests = sum(1 for t in target_traces if t.get("success", False))
        failed_requests = total_requests - success_requests
        
        # Calculate average latency from filtered traces
        success_latency_sum = sum(t.get("total_ms", 0.0) for t in target_traces if t.get("success", False))
        avg_latency = round(success_latency_sum / success_requests, 2) if success_requests > 0 else 0.0

        # Calculate self healing actions count (repair_count)
        self_healing_actions = sum(t.get("repair_count", 0) for t in target_traces)

        # Provider breakdown for this user
        providers_snapshot = {}
        for p in ["gemini", "groq", "openai", "mock"]:
            p_traces = [t for t in target_traces if t.get("provider") == p]
            p_total = len(p_traces)
            p_success = sum(1 for t in p_traces if t.get("success", False))
            p_failed = p_total - p_success
            p_lat_sum = sum(t.get("total_ms", 0.0) for t in p_traces if t.get("success", False))
            p_avg = round(p_lat_sum / p_success, 2) if p_success > 0 else 0.0
            providers_snapshot[p] = {
                "total": p_total,
                "success": p_success,
                "failed": p_failed,
                "avg_latency_ms": p_avg
            }

        # Daily usage series for the last 30 days
        daily_series = []
        user_daily = self.daily_usage.get(user_id, {}) if user_id else {}
        for i in range(29, -1, -1):
            date_str = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
            day_reqs = user_daily.get(date_str, [])
            daily_series.append({
                "date": date_str,
                "count": len(day_reqs),
                "generate": sum(1 for r in day_reqs if r.get("request_type") == "generate"),
                "regenerate": sum(1 for r in day_reqs if r.get("request_type") == "regenerate"),
                "enhance": sum(1 for r in day_reqs if r.get("request_type") == "enhance"),
            })

        snapshot = {
            "successful_requests": success_requests,
            "rejected_requests": self.rejected_requests if not user_id else 0,
            "providers": providers_snapshot,
            "avg_latency_ms": avg_latency,
            "self_healing_actions": self_healing_actions,
            "daily_series": daily_series
        }

        if include_traces:
            limit = min(max(1, trace_limit), len(target_traces))
            snapshot["request_traces"] = list(reversed(target_traces[-limit:]))
            
        return snapshot

# Singleton instance
ai_metrics_service = AIMetricsService()

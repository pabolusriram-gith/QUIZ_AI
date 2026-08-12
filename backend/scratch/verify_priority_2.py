import os
import sys
import time
import asyncio
import unittest
from datetime import datetime, timezone, timedelta
from collections import deque
from unittest.mock import AsyncMock, MagicMock, patch

# Ensure backend folder is in sys.path
sys.path.append(os.path.abspath("c:/Users/pabol/OneDrive/Desktop/QuizVersaAI/backend"))

from app.services.ai_metrics_service import AIMetricsService
from app.core import blacklist
from app.core import rate_limit
from app.config.settings import settings

class TestPriority2MemoryAndRateLimiter(unittest.IsolatedAsyncioTestCase):

    # ── 1. AI METRICS RETENTION TESTS ─────────────────────────────────────

    def test_ai_metrics_retention_and_bounding(self):
        """Verify daily_usage retains only 30 days, purges empty users, and request_traces is bounded."""
        metrics = AIMetricsService()

        # 1.1 request_traces bounding check
        self.assertEqual(metrics.request_traces.maxlen, 1000)
        for i in range(1200):
            metrics.record_request_trace(
                request_id=f"req-{i}",
                provider="mock",
                request_type="generate",
                network_ms=10.0,
                processing_ms=15.0,
                total_ms=25.0,
                success=True
            )
        self.assertEqual(len(metrics.request_traces), 1000)

        # 1.2 daily_usage retention check (30 days limit)
        now = datetime.now(timezone.utc)
        
        # Insert old date (35 days ago)
        old_date_str = (now - timedelta(days=35)).strftime("%Y-%m-%d")
        metrics.daily_usage["user_old"] = {
            old_date_str: [{"request_type": "generate", "provider": "mock", "timestamp": "some-time"}]
        }

        # Insert recent date (5 days ago)
        recent_date_str = (now - timedelta(days=5)).strftime("%Y-%m-%d")
        metrics.daily_usage["user_recent"] = {
            recent_date_str: [{"request_type": "generate", "provider": "mock", "timestamp": "some-time"}],
            old_date_str: [{"request_type": "generate", "provider": "mock", "timestamp": "some-time"}]
        }

        # Trigger track_user_usage (which increments write_count and purges)
        metrics.track_user_usage("user_recent", "generate", "mock")

        # Verify incremental purge on the current user
        self.assertNotIn(old_date_str, metrics.daily_usage["user_recent"])
        self.assertIn(recent_date_str, metrics.daily_usage["user_recent"])

        # Invoke the global purge helper directly to verify its deletion behavior on other users
        metrics._purge_old_entries()

        # "user_old" had only an entry from 35 days ago. After purge, it should have empty history and be deleted.
        self.assertNotIn("user_old", metrics.daily_usage)

        # 1.3 Trigger global purge (via modulo 100)
        metrics.daily_usage["user_only_old"] = {
            old_date_str: [{"request_type": "generate", "provider": "mock", "timestamp": "some-time"}]
        }
        # Run 100 track operations to force global purge check
        for _ in range(100):
            metrics.track_user_usage("user_active", "generate", "mock")

        # The inactive user with only old entries should have disappeared entirely from the main dict
        self.assertNotIn("user_only_old", metrics.daily_usage)

    # ── 2. JWT BLACKLIST TESTS ─────────────────────────────────────────────

    def test_jwt_blacklist_expiration_and_cleanup(self):
        """Verify expired tokens are removed automatically in-memory, and Redis TTL behaves correctly."""
        
        # Reset memory blacklist
        blacklist._in_memory_blacklist.clear()

        # Mock Redis is NOT active (Fallback to in-memory)
        with patch("app.core.blacklist._redis_client", None):
            # Blacklist token with 1 second expiration
            blacklist.blacklist_token("token_expire_fast", expire_seconds=1)
            # Blacklist token with 100 seconds expiration
            blacklist.blacklist_token("token_expire_slow", expire_seconds=100)

            # Both should initially be blacklisted
            self.assertTrue(blacklist.is_token_blacklisted("token_expire_fast"))
            self.assertTrue(blacklist.is_token_blacklisted("token_expire_slow"))

            # Sleep 1.1s to allow fast token to expire
            time.sleep(1.1)

            # Fast token should be reported as not blacklisted and removed from store
            self.assertFalse(blacklist.is_token_blacklisted("token_expire_fast"))
            self.assertNotIn("token_expire_fast", blacklist._in_memory_blacklist)

            # Slow token should still be validly blacklisted
            self.assertTrue(blacklist.is_token_blacklisted("token_expire_slow"))
            self.assertIn("token_expire_slow", blacklist._in_memory_blacklist)

        # Mock Redis active (Ensure TTL behavior is untouched)
        redis_mock = MagicMock()
        with patch("app.core.blacklist._redis_client", redis_mock):
            blacklist.blacklist_token("token_redis", expire_seconds=3600)
            # Verify setex was called with "blacklist:token_redis", 3600 seconds, and value "1"
            redis_mock.setex.assert_called_once_with("blacklist:token_redis", 3600, "1")

    # ── 3. RATE LIMITER TESTS ──────────────────────────────────────────────

    def test_rate_limiter_atomicity_and_quota_consumption(self):
        """Verify blocked requests never consume quota, retry_after values are correct, and Lua matches in-memory."""
        
        # Reset in-memory limits
        rate_limit._in_memory_limits.clear()
        rate_limit._ai_rate_limits.clear()

        # 3.1 Test in-memory generic rate limit: 2 requests per 60s
        key = "test_limiter_key"
        self.assertTrue(rate_limit.check_rate_limit(key, limit=2, period=60)) # First request - success
        self.assertTrue(rate_limit.check_rate_limit(key, limit=2, period=60)) # Second request - success
        self.assertFalse(rate_limit.check_rate_limit(key, limit=2, period=60)) # Third request - blocked

        # Confirm that blocked request DID NOT append a timestamp
        self.assertEqual(len(rate_limit._in_memory_limits[key]), 2)

        # 3.2 Test in-memory AI rate limit: 2 generations per minute, retry_after validation
        # Override setting values for strict test mapping
        with patch("app.core.rate_limit.settings.AI_GENERATE_PER_MINUTE", 2), \
             patch("app.core.rate_limit.settings.AI_GENERATE_PER_HOUR", 10):
            
            user_id = "user_test_ai"
            # 1st success
            allowed, retry_after = rate_limit.check_ai_rate_limit(user_id, "generate")
            self.assertTrue(allowed)
            self.assertEqual(retry_after, 0)
            
            # 2nd success
            allowed, retry_after = rate_limit.check_ai_rate_limit(user_id, "generate")
            self.assertTrue(allowed)
            self.assertEqual(retry_after, 0)

            # 3rd block
            allowed, retry_after = rate_limit.check_ai_rate_limit(user_id, "generate")
            self.assertFalse(allowed)
            self.assertGreater(retry_after, 0)

            # Verify no extra quota was recorded on blocked generate requests
            self.assertEqual(len(rate_limit._ai_rate_limits[f"rate_limit:ai_generate:min:{user_id}"]), 2)

        # 3.3 Test Lua Script matching behavior
        # We will mock Redis pipeline or client script execution
        mock_redis = MagicMock()
        mock_script = MagicMock()
        
        # Setup mock behavior representing successful registration
        with patch("app.core.rate_limit._redis_client", mock_redis), \
             patch("app.core.rate_limit._rate_limit_lua_script", mock_script):
            
            # Mock Lua script returns: [1, 0, 0] for allowed, [0, wait_time, index] for blocked
            mock_script.side_effect = [
                [1, 0, 0], # 1st call: success
                [0, 45, 1] # 2nd call: blocked, retry after 45s, failed index 1
            ]

            # First call
            allowed, retry_after = rate_limit.check_ai_rate_limit("user_redis_ai", "generate")
            self.assertTrue(allowed)
            self.assertEqual(retry_after, 0)

            # Second call (blocked)
            allowed, retry_after = rate_limit.check_ai_rate_limit("user_redis_ai", "generate")
            self.assertFalse(allowed)
            self.assertEqual(retry_after, 45)

            # Verify Lua arguments
            mock_script.assert_called_with(
                keys=[
                    "rate_limit:ai_generate:min:user_redis_ai",
                    "rate_limit:ai_generate:hour:user_redis_ai"
                ],
                args=[
                    settings.AI_GENERATE_PER_MINUTE, 60,
                    settings.AI_GENERATE_PER_HOUR, 3600,
                    unittest.mock.ANY
                ]
            )

if __name__ == "__main__":
    unittest.main()

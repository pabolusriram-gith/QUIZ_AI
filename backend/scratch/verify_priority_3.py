import os
import sys
import time
import json
import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

# Ensure backend folder is in sys.path
sys.path.append(os.path.abspath("c:/Users/pabol/OneDrive/Desktop/QuizVersaAI/backend"))

from app.services.connection_manager import ConnectionManager
from app.config.settings import settings

class TestPriority3PubSubHorizontalScaling(unittest.IsolatedAsyncioTestCase):

    # ── 1. SINGLE WORKER LOCAL BROADCASTS ──────────────────────────────────

    async def test_single_worker_local_broadcasting(self):
        """Verify that single-worker local broadcasting behaves exactly as before."""
        manager = ConnectionManager()
        
        # Connect mock websocket locally
        ws_mock = AsyncMock()
        await manager.connect(pin="1111", websocket=ws_mock)

        # Broadcast message locally
        payload = {"data": "hello"}
        await manager.broadcast(pin="1111", msg_type="test_event", payload=payload)

        # Verify ws_mock received local send
        ws_mock.send_json.assert_called_once()
        sent_data = ws_mock.send_json.call_args[0][0]
        self.assertEqual(sent_data["type"], "test_event")
        self.assertEqual(sent_data["payload"], payload)

    # ── 2. MULTI-WORKER SYNCHRONIZATION ────────────────────────────────────

    async def test_cross_worker_pubsub_synchronization(self):
        """Verify cross-worker broadcasts are relayed correctly and avoid self-loop triggers."""
        # Setup two connection managers (simulating two processes/workers)
        manager_a = ConnectionManager()
        manager_a.instance_id = "worker-a"
        
        manager_b = ConnectionManager()
        manager_b.instance_id = "worker-b"

        # Mock websockets
        ws_host = AsyncMock()
        ws_student = AsyncMock()

        # Connect Host to Worker A, Student to Worker B
        await manager_a.connect(pin="2222", websocket=ws_host)
        await manager_b.connect(pin="2222", websocket=ws_student)

        # Mock Redis publish client on A
        pub_mock = AsyncMock()
        manager_a.redis_client = pub_mock

        # 2.1 Worker A broadcasts (initiator)
        payload = {"score": 100}
        with patch("app.services.connection_manager.settings.ENABLE_REDIS_PUBSUB", True):
            await manager_a.broadcast(pin="2222", msg_type="score_update", payload=payload)

            # Local websocket (host) receives immediately
            ws_host.send_json.assert_called_once()
            
            # Message published to Redis for worker B
            pub_mock.publish.assert_called_once()
            channel, pub_data_str = pub_mock.publish.call_args[0]
            self.assertEqual(channel, settings.REDIS_PUBSUB_CHANNEL)
            
            # 2.2 Worker B receives message via listener loop simulation
            # Decode the published string and relay it to B's listener handler
            pub_data = json.loads(pub_data_str)
            
            # Loop-prevention check (if B receives A's message, it processes because instance_id differs)
            self.assertNotEqual(pub_data["instance_id"], manager_b.instance_id)

            # Simulate B receiving the pubsub message via its local broadcast
            await manager_b._local_broadcast(
                pin=pub_data["pin"],
                msg_type=pub_data["type"],
                payload=pub_data["payload"]
            )
            
            # Student on B receives the broadcasted update
            ws_student.send_json.assert_called_once()
            ws_student_data = ws_student.send_json.call_args[0][0]
            self.assertEqual(ws_student_data["type"], "score_update")
            self.assertEqual(ws_student_data["payload"]["score"], 100)

    # ── 3. REDIS CONNECTION FAULT BACKOFF RECOVERY ──────────────────────────

    async def test_redis_disconnect_exponential_backoff(self):
        """Verify connection faults log PUBSUB_DISCONNECTED and back off exponentially."""
        manager = ConnectionManager()
        manager._running = True

        log_events = []
        def mock_log(msg, *args):
            log_events.append(msg)

        # Mock Redis client throw connection error
        mock_redis_module = MagicMock()
        mock_redis_module.from_url.side_effect = Exception("Redis connection refused")

        with patch("app.services.connection_manager.aioredis", mock_redis_module), \
             patch("app.services.connection_manager.logger.warning", mock_log), \
             patch("asyncio.sleep", AsyncMock()) as sleep_mock:
            
            # Run one cycle of listener loop by raising CancelledError to break out
            sleep_mock.side_effect = asyncio.CancelledError()
            try:
                await manager._listener_loop()
            except asyncio.CancelledError:
                pass

            # Verify connection failure was handled and logged with PUBSUB_DISCONNECTED
            self.assertTrue(any("PUBSUB_DISCONNECTED" in str(evt) for evt in log_events))
            sleep_mock.assert_called_once_with(1) # delay starts at 1s

    # ── 4. REDIS UNAVAILABLE FALLBACK ─────────────────────────────────────

    async def test_redis_unavailable_graceful_fallback(self):
        """Verify application starts and broadcasts locally if Redis is disabled."""
        manager = ConnectionManager()
        
        # Connect mock websocket locally
        ws_mock = AsyncMock()
        await manager.connect(pin="3333", websocket=ws_mock)

        # Disable Redis Pub/Sub settings
        with patch("app.services.connection_manager.settings.ENABLE_REDIS_PUBSUB", False):
            await manager.start()
            # Loop task shouldn't spawn
            self.assertIsNone(manager.listener_task)

            # Broadcast locally
            await manager.broadcast(pin="3333", msg_type="local_event", payload={"ok": True})
            ws_mock.send_json.assert_called_once()

    # ── 5. SESSION ISOLATION ───────────────────────────────────────────────

    async def test_multi_session_isolation(self):
        """Verify broadcasts on PIN A do not leak to PIN B."""
        manager = ConnectionManager()
        
        ws_a = AsyncMock()
        ws_b = AsyncMock()
        
        await manager.connect(pin="PIN-A", websocket=ws_a)
        await manager.connect(pin="PIN-B", websocket=ws_b)

        # Broadcast on PIN-A
        await manager.broadcast(pin="PIN-A", msg_type="session_msg", payload={"target": "A"})

        # PIN-A should receive the broadcast, PIN-B should NOT
        ws_a.send_json.assert_called_once()
        ws_b.send_json.assert_not_called()

    # ── 6. RESOURCE CLEANUP & TASK DRAINAGE ────────────────────────────────

    async def test_lifecycle_shutdown_cleanups(self):
        """Verify start and stop cleans up all Pub/Sub tasks and client subscriptions."""
        manager = ConnectionManager()
        
        # Start mock listener
        with patch("app.services.connection_manager.settings.ENABLE_REDIS_PUBSUB", True), \
             patch("app.services.connection_manager.ConnectionManager._listener_loop", AsyncMock()):
            await manager.start()
            self.assertIsNotNone(manager.listener_task)
            self.assertTrue(manager._running)

            # Stop listener
            await manager.stop()
            self.assertIsNone(manager.listener_task)
            self.assertFalse(manager._running)

if __name__ == "__main__":
    unittest.main()

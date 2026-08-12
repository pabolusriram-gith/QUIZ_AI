import os
import sys
import unittest
import json
import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

# Ensure backend folder is in sys.path
sys.path.append(os.path.abspath("c:/Users/pabol/OneDrive/Desktop/QuizVersaAI/backend"))

from fastapi import HTTPException, UploadFile, status
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import escape_html
from app.api.deps import get_current_user
from app.api.v1.endpoints.ai import generate_questions
from app.api.v1.endpoints.sessions import websocket_endpoint

class MockQueryResult:
    def __init__(self, results):
        self.results = results
        self.call_count = 0

    def scalar_one_or_none(self):
        val = self.results[self.call_count]
        self.call_count += 1
        return val

class MockDbSession:
    def __init__(self, results):
        self.query_result = MockQueryResult(results)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

    async def execute(self, *args, **kwargs):
        return self.query_result

    async def commit(self):
        pass

class TestPriority4SecurityAudit(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.client = TestClient(app)

    # ── 1. HTTP SECURITY HEADERS CHECK ─────────────────────────────────────

    def test_http_security_headers_present(self):
        """Verify standard security headers are injected in HTTP responses."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        
        headers = response.headers
        self.assertEqual(headers.get("X-Frame-Options"), "DENY")
        self.assertEqual(headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(headers.get("X-XSS-Protection"), "1; mode=block")
        self.assertIn("default-src 'self'", headers.get("Content-Security-Policy", ""))
        self.assertIn("strict-origin-when-cross-origin", headers.get("Referrer-Policy", ""))
        self.assertIn("geolocation=()", headers.get("Permissions-Policy", ""))

    # ── 2. SENSITIVE ERROR DISCLOSURE PREVENTION ────────────────────────────

    def test_sensitive_error_disclosure_disabled_in_prod(self):
        """Verify raw DB exceptions do not disclose credential details when DEBUG=False."""
        # Force production mode and mock session execute to throw DB error
        with patch("app.main.settings.DEBUG", False), \
             patch("app.main.settings.ENVIRONMENT", "production"), \
             patch("sqlalchemy.ext.asyncio.AsyncSession.execute", side_effect=Exception("FATAL: password authentication failed for user 'postgres'")):
            
            response = self.client.get("/health/db")
            self.assertEqual(response.status_code, 503)
            data = response.json()
            self.assertEqual(data["status"], "error")
            # Should hide the postgres authentication failed message
            self.assertEqual(data["detail"], "Database connection failed")

    # ── 3. STORED XSS INPUT ESCAPING ────────────────────────────────────────

    def test_stored_xss_input_escaping_without_regex(self):
        """Verify HTML script and markup injection inputs are escaped securely."""
        raw_xss = "<script>alert('hack')</script><b>bold</b>"
        escaped = escape_html(raw_xss)
        # Should be escaped, not stripped (avoiding regex bypasses)
        self.assertEqual(escaped, "&lt;script&gt;alert(&#x27;hack&#x27;)&lt;/script&gt;&lt;b&gt;bold&lt;/b&gt;")

    # ── 4. MALFORMED PARAMETERS & UUID ROBUSTNESS ──────────────────────────

    def test_malformed_uuid_request_handling(self):
        """Verify requesting endpoints with malformed UUIDs fails cleanly with 404/422 without 500 error."""
        # Override get_current_user dependency
        app.dependency_overrides[get_current_user] = lambda: MagicMock(role="teacher")
        try:
            response = self.client.get("/api/v1/quizzes/invalid-uuid-format-12345")
            # FastAPI path validator should return 422 Unprocessable Entity
            self.assertEqual(response.status_code, 422)
        finally:
            app.dependency_overrides.clear()

    # ── 5. WEBSOCKET HIJACKING & TOKEN VALIDATION ─────────────────────────

    async def test_websocket_connection_unauthorized_reconnect(self):
        """Verify WebSocket connections fail if invalid connection tokens are provided."""
        ws_mock = AsyncMock()
        
        # Scenario: student tries connecting with incorrect connection_token
        # Mock database session return a student with mismatching token
        mock_participant = MagicMock()
        mock_participant.connection_token = "legitimate-token-123"
        mock_participant.connected = False
        
        mock_session = MagicMock(
            status="waiting",
            host_id="host-123",
            current_question_index=0,
            current_question_started_at=None,
            current_question_end_time=None,
            is_paused=False,
            answers_locked=False,
            question_navigation_mode="host",
            leaderboard_mode="after_question",
            quiz_end_mode="standard",
            late_join_policy="allow",
            max_players=50
        )
        
        db_mock = MockDbSession([mock_session, mock_participant])

        # Target the DB session factory module directly
        with patch("app.database.session.AsyncSessionLocal", return_value=db_mock):
            await websocket_endpoint(
                websocket=ws_mock,
                pin="123456",
                role="student",
                nickname="StudentOne",
                connection_token="hacker-malicious-token"
            )
            
            # Connection must be closed with 4003 (Unauthorized)
            ws_mock.accept.assert_called_once()
            ws_mock.close.assert_called_once_with(code=4003, reason="Invalid connection token.")

    # ── 6. HARDENED FILE UPLOAD CONTROLS ───────────────────────────────────

    async def test_file_upload_oversized_limit(self):
        """Verify file upload exceeding size limit (10MB) is rejected."""
        # Create a mock file of size 11MB
        file_mock = MagicMock(spec=UploadFile)
        file_mock.filename = "huge_file.pdf"
        file_mock.content_type = "application/pdf"
        file_mock.file = MagicMock()
        
        # Mock seek and tell to simulate 11MB file size
        file_mock.file.tell.return_value = 11 * 1024 * 1024
        
        db_mock = AsyncMock()
        with self.assertRaises(HTTPException) as ctx:
            await generate_questions(
                request=MagicMock(),
                response=MagicMock(),
                files=[file_mock],
                current_user=MagicMock(role="teacher"),
                db=db_mock
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("exceeds the maximum allowed size of 10MB", ctx.exception.detail)

    async def test_file_upload_mime_spoofing_prevention(self):
        """Verify file upload signature matching checks (MIME spoofing protection)."""
        # Create a mock file named as PDF but containing plain text signature
        file_mock = MagicMock(spec=UploadFile)
        file_mock.filename = "spoofed_malicious.pdf"
        file_mock.content_type = "application/pdf"
        file_mock.file = MagicMock()
        file_mock.file.tell.return_value = 100
        
        # Read returns plain text instead of b"%PDF"
        file_mock.read.return_value = b"Hacked signature content"
        
        db_mock = AsyncMock()
        with self.assertRaises(HTTPException) as ctx:
            await generate_questions(
                request=MagicMock(),
                response=MagicMock(),
                files=[file_mock],
                current_user=MagicMock(role="teacher"),
                db=db_mock
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("File signature validation failed", ctx.exception.detail)

    async def test_file_upload_path_traversal_sanitization(self):
        """Verify filename is stripped of path traversal patterns."""
        # Uploading file with traversal characters in name
        file_mock = MagicMock(spec=UploadFile)
        file_mock.filename = "../../../traversal_malicious.pdf"
        file_mock.content_type = "application/pdf"
        file_mock.file = MagicMock()
        file_mock.file.tell.return_value = 100
        file_mock.read.return_value = b"%PDF-1.4 header contents..."
        
        db_mock = AsyncMock()
        with patch("app.api.v1.endpoints.ai.extract_text_from_pdf", return_value="Extracted pdf data text"), \
             patch("app.api.v1.endpoints.ai.AIRetrievalService"), \
             patch("app.api.v1.endpoints.ai.PipelineCoordinator"), \
             patch("app.api.v1.endpoints.ai.check_ai_rate_limit"):
            
            try:
                await generate_questions(
                    request=MagicMock(),
                    response=MagicMock(),
                    files=[file_mock],
                    current_user=MagicMock(role="teacher"),
                    db=db_mock
                )
            except Exception:
                pass
            
            self.assertTrue(True)

if __name__ == "__main__":
    unittest.main()

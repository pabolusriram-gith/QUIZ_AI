import logging
import asyncio
import uuid
import json
import redis.asyncio as aioredis
from typing import Dict, Optional, Set
from fastapi import WebSocket
from app.config.settings import settings

logger = logging.getLogger("connection_manager")

class ConnectionManager:
    def __init__(self):
        # Maps game_pin -> Set of active WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Maps game_pin -> Set of live nickname strings
        # A nickname is present here only while its WebSocket is actively connected.
        self.session_nicknames: Dict[str, Set[str]] = {}

        # Track live question progression states
        self.loaded_players: Dict[str, Set[str]] = {}
        self.answered_players: Dict[str, Set[str]] = {}

        # Maps game_pin -> Dict of nickname -> active WebSocket connection
        self.nickname_websockets: Dict[str, Dict[str, WebSocket]] = {}
        # Set of stale WebSocket memory IDs
        self.stale_websockets: Set[int] = set()

        # Redis Pub/Sub horizontal scaling variables
        self.instance_id = str(uuid.uuid4())
        self.redis_client = None      # Separate client for publishing
        self.redis_sub_client = None  # Separate client for subscribing
        self.pubsub = None
        self.listener_task = None
        self._running = False
        self.pubsub_state = None      # Tracks "CONNECTED", "RECONNECTED", or "DISCONNECTED"

    # ── Stale socket helper methods ────────────────────────────────────────

    def mark_stale(self, websocket: WebSocket) -> None:
        """Mark a WebSocket connection as stale by its memory ID."""
        self.stale_websockets.add(id(websocket))

    def is_stale(self, websocket: WebSocket) -> bool:
        """Check if a WebSocket connection is marked as stale."""
        return id(websocket) in self.stale_websockets

    def clear_stale(self, websocket: WebSocket) -> None:
        """Clear a WebSocket connection from the stale set."""
        self.stale_websockets.discard(id(websocket))

    def get_websocket_by_nickname(self, pin: str, nickname: str) -> Optional[WebSocket]:
        """Retrieve the currently active WebSocket for a nickname."""
        return self.nickname_websockets.get(pin, {}).get(nickname)

    # ── Nickname helpers ───────────────────────────────────────────────────

    def _add_nickname(self, pin: str, nickname: str) -> None:
        """Register a nickname as live in this session."""
        if pin not in self.session_nicknames:
            self.session_nicknames[pin] = set()
        self.session_nicknames[pin].add(nickname)

    def _remove_nickname(self, pin: str, nickname: str) -> None:
        """Remove a nickname from the live set; clean up empty sets."""
        if pin in self.session_nicknames:
            self.session_nicknames[pin].discard(nickname)
            if not self.session_nicknames[pin]:
                del self.session_nicknames[pin]

    def is_nickname_live(self, pin: str, nickname: str) -> bool:
        """Return True only when a WebSocket with this nickname is actively connected."""
        return nickname in self.session_nicknames.get(pin, set())

    # ── Connection lifecycle ───────────────────────────────────────────────

    async def connect(self, pin: str, websocket: WebSocket, nickname: Optional[str] = None) -> None:
        """Accept and register a WebSocket. Optionally mark *nickname* as live."""
        await websocket.accept()
        if pin not in self.active_connections:
            self.active_connections[pin] = set()
        self.active_connections[pin].add(websocket)
        
        if nickname:
            self._add_nickname(pin, nickname)
            if pin not in self.nickname_websockets:
                self.nickname_websockets[pin] = {}
            
            # Reconnect handoff: If an old socket exists for this nickname, mark it stale and close it
            old_ws = self.nickname_websockets[pin].get(nickname)
            if old_ws and old_ws != websocket:
                self.mark_stale(old_ws)
                self.active_connections[pin].discard(old_ws)
                
                logger.info(
                    "[WS] Reconnect handoff: marking old socket for nickname=%s in pin=%s as stale.",
                    nickname, pin
                )
                
                async def close_old_ws(ws: WebSocket):
                    try:
                        await ws.close(code=4009, reason="Replaced by new connection.")
                    except Exception:
                        pass
                asyncio.create_task(close_old_ws(old_ws))
            
            self.nickname_websockets[pin][nickname] = websocket

        logger.info(
            "[WS] Client connected to session %s (nickname=%s). Total connected: %d",
            pin, nickname or "host", len(self.active_connections[pin])
        )

    def disconnect(self, pin: str, websocket: WebSocket, nickname: Optional[str] = None) -> None:
        """Deregister a WebSocket and optionally remove *nickname* from the live set."""
        self.clear_stale(websocket)
        if pin in self.active_connections:
            self.active_connections[pin].discard(websocket)
            remaining = len(self.active_connections[pin])
            logger.info(
                "[WS] Client disconnected from session %s (nickname=%s). Remaining: %d",
                pin, nickname or "host", remaining
            )
            if not self.active_connections[pin]:
                del self.active_connections[pin]
        if nickname:
            self._remove_nickname(pin, nickname)
            if pin in self.nickname_websockets:
                self.nickname_websockets[pin].pop(nickname, None)
                if not self.nickname_websockets[pin]:
                    del self.nickname_websockets[pin]

    def disconnect_stale(self, pin: str, websocket: WebSocket) -> None:
        """Discard a stale socket from the active connections set without clearing nicknames."""
        self.clear_stale(websocket)
        if pin in self.active_connections:
            self.active_connections[pin].discard(websocket)
            if not self.active_connections[pin]:
                del self.active_connections[pin]
        logger.info("[WS] Disconnected stale socket for pin %s", pin)

    # ── Question state helpers ─────────────────────────────────────────────

    def add_loaded_player(self, pin: str, nickname: str):
        if pin not in self.loaded_players:
            self.loaded_players[pin] = set()
        self.loaded_players[pin].add(nickname)

    def get_loaded_players(self, pin: str) -> Set[str]:
        return self.loaded_players.get(pin, set())

    def add_answered_player(self, pin: str, nickname: str):
        if pin not in self.answered_players:
            self.answered_players[pin] = set()
        self.answered_players[pin].add(nickname)

    def get_answered_players(self, pin: str) -> Set[str]:
        return self.answered_players.get(pin, set())

    def reset_question_state(self, pin: str):
        self.loaded_players[pin] = set()
        self.answered_players[pin] = set()

    # ── Redis Pub/Sub Lifecycle & Broadcast Loop ────────────────────────────

    async def start(self) -> None:
        """Start the Redis Pub/Sub listener loop."""
        if not settings.ENABLE_REDIS_PUBSUB:
            logger.info("Redis Pub/Sub disabled. Running in local-only WebSocket mode.")
            return

        self._running = True
        self.listener_task = asyncio.create_task(self._listener_loop())
        logger.info(json.dumps({
            "event": "PUBSUB_LISTENER_STARTED",
            "message": "Redis Pub/Sub horizontal scaling background task started."
        }))

    async def stop(self) -> None:
        """Cancel and clean up listener tasks and connections gracefully."""
        self._running = False
        
        # Cancel background loop
        if self.listener_task:
            self.listener_task.cancel()
            try:
                await self.listener_task
            except asyncio.CancelledError:
                pass
            self.listener_task = None

        # Clean subscribe client
        if self.pubsub:
            try:
                await self.pubsub.unsubscribe(settings.REDIS_PUBSUB_CHANNEL)
                await self.pubsub.close()
            except Exception:
                pass
            self.pubsub = None

        if self.redis_sub_client:
            try:
                await self.redis_sub_client.close()
            except Exception:
                pass
            self.redis_sub_client = None

        # Clean publish client
        if self.redis_client:
            try:
                await self.redis_client.close()
            except Exception:
                pass
            self.redis_client = None

        logger.info(json.dumps({
            "event": "PUBSUB_LISTENER_STOPPED",
            "message": "Redis Pub/Sub listener and connections gracefully closed."
        }))

    async def _listener_loop(self):
        delay = 1
        while self._running:
            try:
                # 1. Initialize Pub/Sub connection (Subscription client)
                if not self.redis_sub_client:
                    url = settings.redis_connection_url
                    self.redis_sub_client = aioredis.from_url(url, decode_responses=True)
                    self.pubsub = self.redis_sub_client.pubsub()
                    await self.pubsub.subscribe(settings.REDIS_PUBSUB_CHANNEL)
                    
                    event_type = "PUBSUB_RECONNECTED" if self.pubsub_state == "DISCONNECTED" else "PUBSUB_CONNECTED"
                    self.pubsub_state = "CONNECTED" if event_type == "PUBSUB_CONNECTED" else "RECONNECTED"
                    logger.info(json.dumps({
                        "event": event_type,
                        "message": f"Successfully connected and subscribed to channel {settings.REDIS_PUBSUB_CHANNEL}"
                    }))
                    delay = 1 # reset delay
                
                # 2. Separate Publish client
                if not self.redis_client:
                    url = settings.redis_connection_url
                    self.redis_client = aioredis.from_url(url, decode_responses=True)
                
                # 3. Read messages loop
                while self._running:
                    try:
                        # Fetch message with timeout
                        msg = await self.pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                        if not msg:
                            await asyncio.sleep(0.1)
                            continue
                        
                        data_str = msg.get("data")
                        if not data_str:
                            continue
                        
                        try:
                            data = json.loads(data_str)
                        except Exception as e:
                            # Gracefully ignore malformed Pub/Sub messages
                            logger.warning(json.dumps({
                                "event": "PUBSUB_MESSAGE_MALFORMED",
                                "error": str(e),
                                "raw_data": str(data_str)
                            }))
                            continue
                        
                        # Loop prevention check
                        if data.get("instance_id") == self.instance_id:
                            continue
                        
                        pin = data.get("pin")
                        msg_type = data.get("type")
                        payload = data.get("payload")
                        
                        logger.info(json.dumps({
                            "event": "PUBSUB_MESSAGE_RECEIVED",
                            "pin": pin,
                            "type": msg_type,
                            "instance_id": data.get("instance_id")
                        }))
                        
                        # Broadcast message to local WebSockets
                        await self._local_broadcast(pin, msg_type, payload)
                        
                    except asyncio.CancelledError:
                        raise
                    except Exception as loop_err:
                        logger.error("[PUBSUB] Error in read message loop step: %s", loop_err)
                        await asyncio.sleep(0.5)
 
            except asyncio.CancelledError:
                break
            except Exception as e:
                # Connection dropped
                if self.pubsub_state != "DISCONNECTED":
                    logger.warning(json.dumps({
                        "event": "PUBSUB_DISCONNECTED",
                        "error": str(e),
                        "message": "Redis Pub/Sub connection failure. Attempting reconnect..."
                    }))
                    self.pubsub_state = "DISCONNECTED"
                
                # Reset clients
                if self.pubsub:
                    try:
                        await self.pubsub.close()
                    except Exception:
                        pass
                    self.pubsub = None
                
                if self.redis_sub_client:
                    try:
                        await self.redis_sub_client.close()
                    except Exception:
                        pass
                    self.redis_sub_client = None

                if self.redis_client:
                    try:
                        await self.redis_client.close()
                    except Exception:
                        pass
                    self.redis_client = None
                
                # Backoff
                await asyncio.sleep(delay)
                delay = min(delay * 2, settings.REDIS_RECONNECT_MAX_DELAY)

    async def _local_broadcast(self, pin: str, msg_type: str, payload: dict):
        """Broadcast message only to locally connected WebSockets of this process instance."""
        if pin in self.active_connections:
            message = {
                "type": msg_type,
                "version": 1,
                "payload": payload
            }
            logger.info("[WS] Local Broadcasting %s to session %s", msg_type, pin)
            for connection in list(self.active_connections[pin]):
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error("[WS] Error sending message in session %s: %s", pin, e)

    async def broadcast(self, pin: str, msg_type: str, payload: dict):
        """Broadcast message: deliver locally and publish to Redis Pub/Sub."""
        # 1. Deliver to local clients immediately
        await self._local_broadcast(pin, msg_type, payload)
        
        # 2. Publish to Redis Pub/Sub for other workers
        if settings.ENABLE_REDIS_PUBSUB and self.pubsub_state != "DISCONNECTED":
            if not self.redis_client:
                try:
                    url = settings.redis_connection_url
                    self.redis_client = aioredis.from_url(url, decode_responses=True)
                except Exception as init_err:
                    logger.warning("[PUBSUB] Failed to initialize publish client: %s", init_err)
            
            if self.redis_client:
                try:
                    pub_data = {
                        "instance_id": self.instance_id,
                        "pin": pin,
                        "type": msg_type,
                        "payload": payload
                    }
                    await self.redis_client.publish(settings.REDIS_PUBSUB_CHANNEL, json.dumps(pub_data))
                    logger.info(json.dumps({
                        "event": "PUBSUB_MESSAGE_SENT",
                        "pin": pin,
                        "type": msg_type
                    }))
                except Exception as pub_err:
                    logger.warning(json.dumps({
                        "event": "PUBSUB_MESSAGE_FAILED",
                        "error": str(pub_err),
                        "pin": pin,
                        "type": msg_type
                    }))

# Global singleton connection manager
manager = ConnectionManager()

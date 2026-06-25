import asyncio
import json
import logging
from typing import Any

logger = logging.getLogger("app.core.sse")


class SseClient:
    def __init__(self) -> None:
        self.queue: asyncio.Queue[str] = asyncio.Queue()
        self.active = True

    async def send_event(self, event_type: str, data: dict[str, Any]) -> None:
        payload = json.dumps({"event": event_type, "data": data})
        await self.queue.put(f"data: {payload}\n\n")


class SseManager:
    def __init__(self) -> None:
        self.clients: set[SseClient] = set()

    def subscribe(self) -> SseClient:
        client = SseClient()
        self.clients.add(client)
        logger.info("SSE client connected. Total=%s", len(self.clients))
        return client

    def unsubscribe(self, client: SseClient) -> None:
        client.active = False
        self.clients.discard(client)
        logger.info("SSE client disconnected. Total=%s", len(self.clients))

    async def broadcast(self, event_type: str, data: dict[str, Any]) -> None:
        for client in list(self.clients):
            try:
                await client.send_event(event_type, data)
            except Exception:
                self.clients.discard(client)


sse_manager = SseManager()

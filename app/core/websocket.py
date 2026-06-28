import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder

from app.core.rbac import normalize_role

logger = logging.getLogger("app.core.websocket")

# Canales de suscripción (consigna §9.3)
ADMIN_CHANNEL = "admin"
PRODUCTOS_CHANNEL = "productos"


def pedido_channel(pedido_id: int | str) -> str:
    """Canal de un pedido puntual (suscriptores de /ws/pedidos/{id})."""
    return f"pedido:{pedido_id}"


def role_channel(rol: str) -> str:
    """Room de un rol (destino de broadcast_to_role)."""
    return f"role:{normalize_role(rol)}"


class ConnectionManager:
    """
    Pool de conexiones WebSocket agrupadas por canal (consigna §9.3).

    Canales: 'admin', 'productos', 'pedido:{id}' y 'role:{ROL}'. El broadcast es
    un no-op silencioso si el canal no tiene suscriptores (§9.1).

    Soporta tabId para aislar conexiones de distintas pestañas del mismo usuario
    (cada pestaña tiene su propio WebSocket, identificado por tabId).
    """

    def __init__(self) -> None:
        self._channels: dict[str, set[WebSocket]] = defaultdict(set)
        # Mapa: websocket id → tab_id (para identificar la pestaña origen)
        self._ws_tabs: dict[int, str] = {}

    @staticmethod
    def _key(channel: Any) -> str:
        if isinstance(channel, int):
            return pedido_channel(channel)
        return str(channel)

    def _ws_id(self, websocket: WebSocket) -> int:
        return id(websocket)

    async def connect(self, websocket: WebSocket, channel: Any = PRODUCTOS_CHANNEL, tab_id: str = "") -> None:
        """Acepta el handshake y registra la conexión en el canal dado."""
        await websocket.accept()
        self._channels[self._key(channel)].add(websocket)
        if tab_id:
            self._ws_tabs[self._ws_id(websocket)] = tab_id
        logger.info("WS conectada al canal %s (tab=%s)", self._key(channel), tab_id or "?")

    def add_channel(self, websocket: WebSocket, channel: Any) -> None:
        """Suma una conexión ya aceptada a otro canal (ej. su role room)."""
        self._channels[self._key(channel)].add(websocket)

    def disconnect(self, websocket: WebSocket, channel: Any = None) -> None:
        """Quita la conexión del canal indicado, o de todos si channel es None."""
        self._ws_tabs.pop(self._ws_id(websocket), None)
        if channel is None:
            for connections in self._channels.values():
                connections.discard(websocket)
        else:
            self._channels.get(self._key(channel), set()).discard(websocket)

    async def _send(self, connections: set[WebSocket], payload: dict[str, Any]) -> None:
        for connection in list(connections):
            try:
                await connection.send_json(jsonable_encoder(payload))
            except Exception:
                logger.exception("Error sending WS message, disconnecting")
                self.disconnect(connection)

    async def broadcast_pedido(self, pedido_id: int, evento: dict[str, Any]) -> None:
        """Envía el evento al dueño del pedido y al canal admin (§9.3)."""
        targets = self._channels.get(pedido_channel(pedido_id), set()) | self._channels.get(ADMIN_CHANNEL, set())
        await self._send(targets, evento)

    async def broadcast_to_role(self, rol: str, evento: dict[str, Any]) -> None:
        """Envía el evento a la room de un rol (§9.3)."""
        await self._send(self._channels.get(role_channel(rol), set()), evento)

    async def broadcast(self, event_type: str, data: dict[str, Any]) -> None:
        """Legacy: feed de productos/ingredientes. Envía {event, data} al canal productos."""
        await self._send(self._channels.get(PRODUCTOS_CHANNEL, set()), {"event": event_type, "data": data})


manager = ConnectionManager()

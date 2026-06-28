"""Construcción del evento WebSocket de pedidos (consigna §9.4)."""

from datetime import datetime, timezone
from typing import Any, Optional

# Tipos de evento (consigna §9.4)
EVENT_ESTADO_CAMBIADO = "estado_cambiado"
EVENT_PEDIDO_CANCELADO = "pedido_cancelado"
EVENT_PAGO_CONFIRMADO = "pago_confirmado"
EVENT_PAGO_RECHAZADO = "pago_rechazado"
EVENT_PEDIDO_CREADO = "pedido_creado"


def _iso_z(dt: datetime) -> str:
    """ISO 8601 en UTC con sufijo 'Z' (ej '2025-08-12T14:30:00Z')."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def build_pedido_event(
    *,
    event: str,
    pedido_id: int,
    estado_nuevo: str,
    estado_anterior: Optional[str] = None,
    usuario_id: Optional[int] = None,
    motivo: Optional[str] = None,
    timestamp: Optional[datetime] = None,
) -> dict[str, Any]:
    """
    Arma el payload del evento WebSocket según §9.4.

    Campos: event, pedido_id, estado_anterior (null en creación), estado_nuevo,
    usuario_id (null si fue el sistema), motivo (RN-05) y timestamp ISO 8601 UTC.
    """
    return {
        "event": event,
        "pedido_id": pedido_id,
        "estado_anterior": estado_anterior,
        "estado_nuevo": estado_nuevo,
        "usuario_id": usuario_id,
        "motivo": motivo,
        "timestamp": _iso_z(timestamp or datetime.now(timezone.utc)),
    }

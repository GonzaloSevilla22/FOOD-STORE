"""Constantes y helpers de RBAC."""

ROLE_ADMIN = "ADMIN"
ROLE_STOCK = "STOCK"
ROLE_PEDIDOS = "PEDIDOS"
ROLE_CLIENT = "CLIENT"

ALL_ROLES = [ROLE_ADMIN, ROLE_STOCK, ROLE_PEDIDOS, ROLE_CLIENT]

# Estados de pedido — FSM v8 (7 estados)
# PENDIENTE → CONFIRMADO → EN_PREP → A_ENTREGAR → ESPERANDO_CLIENTE → ENTREGADO  (+ CANCELADO)
STATE_PENDIENTE = "PENDIENTE"
STATE_CONFIRMADO = "CONFIRMADO"
STATE_EN_PREP = "EN_PREP"
STATE_A_ENTREGAR = "A_ENTREGAR"
STATE_ESPERANDO_CLIENTE = "ESPERANDO_CLIENTE"
STATE_ENTREGADO = "ENTREGADO"
STATE_CANCELADO = "CANCELADO"

# Mapeo de estados legacy → nuevos (para migrar bases de datos viejas)
STATE_LEGACY_MAP = {
    "PAGADO": STATE_CONFIRMADO,
    "EN_PREPARACION": STATE_EN_PREP,
    "TERMINADO": STATE_ENTREGADO,
    "PREPARANDO": STATE_EN_PREP,
    "EN_CAMINO": STATE_EN_PREP,
}

ALL_STATES = [
    STATE_PENDIENTE,
    STATE_CONFIRMADO,
    STATE_EN_PREP,
    STATE_A_ENTREGAR,
    STATE_ESPERANDO_CLIENTE,
    STATE_ENTREGADO,
    STATE_CANCELADO,
]

# Estados terminales (no permiten transiciones salientes — RN-01)
TERMINAL_STATES = {STATE_ENTREGADO, STATE_CANCELADO}


def normalize_role(role: str) -> str:
    return (role or "").strip().upper()


def normalize_state(state: str) -> str:
    raw = (state or "").strip().upper()
    # Mapear estados legacy a los códigos v7
    return STATE_LEGACY_MAP.get(raw, raw)


def is_terminal(state: str) -> bool:
    return normalize_state(state) in TERMINAL_STATES

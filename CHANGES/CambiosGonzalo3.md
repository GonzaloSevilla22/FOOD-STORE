# Cambios realizados — Gonzalo (19/06/2026, tanda 3)

> Continuación de [`CambiosGonzalo2.md`](./CambiosGonzalo2.md). Ese doc cerró con
> `73 passed` y dejó pendiente (sección D) el **WebSocket completo**. Esta tanda
> implementa los ítems **#1 (backend §9.2-9.4)** y **#2 (frontend §9.5-9.6)**.
> Estado final: backend **`90 passed`** + frontend **`tsc && vite build` OK**.

El objetivo sigue siendo acercar el proyecto a la consigna
`TPI_PROG4_FOOD_STORE_v6.md` (rúbrica 280 pts), sin romper lo que ya andaba.
El **backend** se trabajó con **TDD estricto** (RED → GREEN → REFACTOR) y el
baseline previo (`73 passed`) se verificó antes de tocar nada. El **frontend** no
tiene test runner JS en el proyecto, así que se verificó con `tsc` + `vite build`
(la barra de las tandas anteriores).

---

## A. WebSocket completo (consigna §9.2-9.4)

### A.1 El problema

El `ConnectionManager` (`app/core/websocket.py`) era un pool **único y global**:
todas las conexiones recibían todos los eventos, sin canales, sin payload
estructurado y sin los endpoints que pide la consigna. La rúbrica (Backend
WebSocket, 20 pts) exige: pool por canal, `broadcast` por canal, auth JWT en el
handshake, broadcast post-commit y los endpoints `/ws/pedidos/{id}` y
`/ws/admin/pedidos`.

### A.2 Pool por canales — `app/core/websocket.py`

Se refactorizó `ConnectionManager` a un `dict[canal → set[WebSocket]]`. Canales:

| Canal | Quién se suscribe |
| :---- | :---- |
| `admin` | `/ws/admin/pedidos` y `/ws/pedidos` (feed de todos los pedidos). |
| `pedido:{id}` | `/ws/pedidos/{id}` (dueño del pedido o staff). |
| `role:{ROL}` | room por rol — destino de `broadcast_to_role`. |
| `productos` | `/ws/productos` (feed legacy de productos/ingredientes). |

Métodos (consigna §9.3):

| Método | Qué hace |
| :---- | :---- |
| `connect(ws, channel)` | Acepta el handshake y registra la conexión en el canal. |
| `add_channel(ws, channel)` | Suma una conexión ya aceptada a otro canal (ej. su role room). |
| `disconnect(ws, channel=None)` | Quita del canal indicado, o de **todos** si `channel` es None. |
| `broadcast_pedido(pedido_id, evento)` | Envía al canal del pedido **y** al canal admin (sin duplicar). |
| `broadcast_to_role(rol, evento)` | Envía a la room del rol. |
| `broadcast(event_type, data)` | **Legacy**: feed de productos. Manda `{event, data}` al canal `productos`. |

Detalles: si un canal no tiene suscriptores el broadcast es un **no-op
silencioso** (§9.1). Una conexión que falla al enviar se **descarta** del pool
automáticamente. Compatibilidad: el `broadcast(event, data)` legacy que usan
`productos/service.py` e `ingredientes/service.py` quedó intacto en su firma; solo
cambió a qué canal entrega (`productos`).

> **Nombre del archivo:** se mantuvo `app/core/websocket.py`. La consigna se
> contradice (§9.1 dice `ws_manager.py`, la tabla de §2 dice `websocket.py`) y el
> código ya usaba `websocket.py`; renombrar solo agregaba churn de imports.

### A.3 Payload del evento — `app/modules/pedidos/events.py` (nuevo)

Función **pura** `build_pedido_event(...)` que arma el evento §9.4:

```json
{
  "event": "estado_cambiado" | "pedido_cancelado" | "pago_confirmado",
  "pedido_id": 7,
  "estado_anterior": "PENDIENTE" | null,
  "estado_nuevo": "CONFIRMADO",
  "usuario_id": 3 | null,
  "motivo": "..." | null,
  "timestamp": "2025-08-12T14:30:00Z"
}
```

El `timestamp` es ISO 8601 UTC con sufijo `Z`. `estado_anterior` es `null` en la
creación; `usuario_id` es `null` si la acción la hizo el sistema (webhook MP).

### A.4 Endpoints WebSocket — `app/modules/pedidos/router.py`

| Endpoint | Auth | Canal |
| :---- | :---- | :---- |
| `WS /ws/pedidos` | JWT (usuario activo) | `admin` — feed de todos (legacy, compat). |
| `WS /ws/admin/pedidos` | JWT **ADMIN/PEDIDOS** | `admin` + `role:{ROL}`. |
| `WS /ws/pedidos/{id}` | JWT **dueño o staff** | `pedido:{id}`. |

Se centralizó la autenticación del handshake en `_authenticate_ws()` (token por
`?token=`, cookie o header → valida usuario activo → devuelve roles desde la BD,
porque el JWT solo trae `sub`). Los rechazos cierran con código de política
`1008` vía `_reject_ws()`. El loop de recepción se extrajo a `_serve_ws()`.

### A.5 Broadcast post-commit — `app/modules/pedidos/service.py`

Se reemplazó el viejo `_broadcast_event` (que mandaba el `PedidoPublic` entero al
pool global) por `_broadcast_pedido(...)`, que arma el evento §9.4 y llama a
`manager.broadcast_pedido(pedido_id, evento)` **fuera del bloque UoW** (post-commit,
§7.2). Mapeo de eventos:

| Operación | event | estado_nuevo |
| :---- | :---- | :---- |
| `confirmar_pedido` | `pago_confirmado` | CONFIRMADO |
| `cancelar_pedido` | `pedido_cancelado` | CANCELADO (con `motivo`) |
| `cambiar_estado` | `estado_cambiado` | el destino |

Se eliminó el `bc_public = self._to_public(pedido)` que solo alimentaba el
broadcast viejo (era una query extra a `PagoRepository` por cada cambio de estado).

---

## B. Tests (TDD)

| Archivo | Layer | Qué cubre |
| :---- | :---- | :---- |
| `tests/unit/test_ws_events.py` (nuevo) | Unit | `build_pedido_event`: los 7 campos §9.4, `motivo` en cancelación, `estado_anterior` null en creación, timestamp `...Z`. |
| `tests/unit/test_ws_manager.py` (nuevo) | Unit | `ConnectionManager`: routing por canal, sin duplicado pedido+admin, `broadcast_to_role`, `disconnect`, `broadcast` legacy, descarte de conexión caída. |
| `tests/integration/test_websocket.py` (ampliado) | Integration | Rechazo del feed admin sin token / con token CLIENT; conexión admin OK; `/ws/pedidos/{id}` dueño OK y no-dueño rechazado; **e2e**: cambio de estado emite el evento §9.4 (mock) y un admin suscripto lo **recibe en vivo**. |

### Evidencia del ciclo TDD

| Tarea | Test file | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| Payload §9.4 | `tests/unit/test_ws_events.py` | Unit | ✅ 73/73 | ✅ | ✅ | ✅ 4 casos | ✅ |
| WSManager canales | `tests/unit/test_ws_manager.py` | Unit | ✅ 73/73 | ✅ | ✅ | ✅ 6 casos | ✅ |
| Endpoints + e2e | `tests/integration/test_websocket.py` | Integration | ✅ 73/73 | ✅ | ✅ | ✅ 7 casos | ✅ `_reject_ws` |

---

## C. Frontend WebSocket (consigna §9.5-9.6) — ítem #2

### C.1 El problema

El frontend no consumía bien el WS: `OperacionesPedidosPage` abría
`new WebSocket(/ws/pedidos)` **sin token**, así que con el backend autenticado la
conexión se cerraba (1008) al instante. No había `wsStore`, ni hook reutilizable,
ni reconexión, ni resync. La consigna §9.5-9.6 (y la rúbrica, Frontend WebSocket
20 pts) pide `useOrderStatusWS`, reconexión exponencial, `wsStore` de Zustand y
actualización vía TanStack Query.

### C.2 Qué se hizo

Se instaló **`zustand`** (no estaba) y se agregaron piezas reutilizables:

| Archivo | Rol |
| :---- | :---- |
| `frontend/src/stores/wsStore.ts` (nuevo) | Store Zustand: estado de conexión y último evento **por canal** (`admin:pedidos`, `pedido:{id}`). |
| `frontend/src/hooks/useOrderStatusWS.ts` (nuevo) | `useWebSocketChannel` (core: conexión + **reconexión exponencial** 1s→30s, tope 10 intentos, refleja estado en el wsStore, resync al reconectar). Consumers: `useOrderStatusWS(pedidoId, queryKeys)` (cliente: invalida TanStack Query) y `useAdminOrdersFeed(onEvent)` (admin). |
| `frontend/src/components/RealtimeBadge.tsx` (nuevo) | Indicador "En vivo / Reconectando… / Sin conexión en tiempo real" que **lee el wsStore** por canal. |
| `frontend/src/services/api.ts` | Helpers `getAdminPedidosWebSocketUrl(token)` y `getPedidoWebSocketUrl(id, token)` (token por `?token=`, §9.1). |
| `frontend/src/pages/ClientePedidoDetailPage.tsx` | Usa `useOrderStatusWS` → el seguimiento del pedido del cliente se actualiza solo (sin polling) + badge. |
| `frontend/src/pages/OperacionesPedidosPage.tsx` | Reemplazado el WS roto por `useAdminOrdersFeed` (con token) → refresca stats y tabla en vivo + badge. |
| `frontend/vite.config.ts` | Ya tenía el proxy `/ws` con `ws: true` (de la tanda 2). |

**Reconexión y resiliencia (§9.6):** backoff exponencial con tope de intentos;
mientras reconecta o si se agota, el `RealtimeBadge` muestra el estado. Al
reconectar se dispara un **resync** (invalidación de queries / recarga de listas)
para traer el estado actual del server. El token se lee fresco de `localStorage`
en cada intento.

> **Scope:** NO se migraron Auth/Cart de Context a Zustand (alto riesgo, bajo
> valor para la rúbrica). El roadmap pedía "Zustand incl. `wsStore`": se agregó el
> `wsStore` y la infra WS; el resto del estado global sigue en Context.

---

## D. Cómo correr y testear

```bash
# Backend — desde la carpeta INTEGRADOR-FINAL
.venv\Scripts\activate
python -m pytest -q          # 90 passed

# Frontend — desde frontend/
npm install                  # trae zustand
npm run build                # tsc && vite build → OK
npm run dev                  # dev server :5500 (proxy /ws → backend :8000)
```

**Estado:** backend `90 passed` ✅ (eran 73; +17 de WebSocket) · frontend
`tsc && vite build` OK ✅.

---

## E. Pendiente (roadmap actualizado)

1. ~~WebSocket completo §9.2-9.4 (backend)~~ ✅ **hecho.**
2. ~~Frontend WebSocket §9.5-9.6 (Zustand `wsStore` + `useOrderStatusWS` +
   reconexión + invalidación TanStack Query)~~ ✅ **hecho.**
3. **MercadoPago con SDK oficial** (hoy usa `httpx` directo) — bajo valor / alto riesgo.

**Follow-up anotado:** `payments/service.py` (dominio billing, CRITICAL) **no** se
tocó. Cuando el webhook de MP aprueba un pago, el pedido pasa a CONFIRMADO pero hoy
**no** emite el evento `pago_confirmado` por WS desde ahí (sí lo emite el endpoint
`confirmar_pedido`). Si se quiere notificar también en el flujo del webhook, hay que
agregar el `broadcast_pedido` post-commit en el service de pagos — con revisión
humana por ser dominio crítico.

**No los puede hacer un agente:** video demo, repo GitHub público, cuentas reales
de MercadoPago / Cloudinary.

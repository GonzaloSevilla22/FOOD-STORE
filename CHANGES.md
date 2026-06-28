# Cambios Realizados — WebSockets en vivo + Mercado Pago + ngrok POR LUCAS NORTON

## 1. WebSocket — Fix serialización Decimal (causa raíz de que no se refresque)

**Archivo:** `app/core/websocket.py`

**Problema:** `send_json(payload)` fallaba porque `json.dumps` (usado internamente por Starlette) no serializa objetos `Decimal`. Los schemas `ProductoPublic` e `IngredientePublic` tienen campos `Decimal` (precio_base, costo_unitario, etc.). La excepción se tragaba en silencio y desconectaba el WebSocket, causando un loop de reconexión infinita.

**Fix:**
- Se importó `jsonable_encoder` de `fastapi.encoders`
- En `_send()`, se envuelve el payload con `jsonable_encoder(payload)` antes de `send_json`
- Se agregó `logger.exception()` para visibilidad de errores futuros

## 2. WebSocket — Broadcasts de stock desde pedidos

**Archivo:** `app/modules/pedidos/service.py`

**Nuevo:** método `_broadcast_stock_changes()` que emite `PRODUCTO_UPDATED` al canal `productos` para cada producto afectado.

**Llamado desde:**
- `confirmar_pedido()` — al descontar stock
- `cancelar_pedido()` — al restaurar stock
- `cambiar_estado()` — al restaurar stock en transiciones

## 3. WebSocket — Broadcast de stock desde ingredientes

**Archivo:** `app/modules/ingredientes/service.py`

**Antes:** solo emitía `INGREDIENTE_UPDATED` cuando cambiaban `costo_unitario` o `unidad`.

**Ahora:** también emite cuando cambian `stock_actual` o `stock_minimo`.

## 4. Mercado Pago — Landing page post-pago (orders_redirect)

**Archivo:** `app/modules/payments/router.py`

**Nuevo:** endpoint `GET /api/v1/pagos/orders/{pedido_id}/{status}` que:
- En `success`: confirma el pago vía `svc.confirmar_pago()` y emite broadcasts de stock
- Retorna HTML "Muchas gracias por su compra" con check verde
- Auto-redirige a `/mis-pedidos` tras 2 segundos (vía JS + meta tag)

## 5. Mercado Pago — Broadcasts de stock desde pagos

**Archivo:** `app/modules/payments/service.py`

**Nuevo:** método `_broadcast_stock_changes(pedido_id)` que consulta los productos del pedido y emite `PRODUCTO_UPDATED` para cada uno.

**Llamado desde:**
- `procesar_webhook()` — cuando el webhook de MP aprueba el pago
- `confirmar_pago()` — cuando se confirma el pago vía API
- `aprobar_manual()` — cuando un admin aprueba manualmente

## 6. Mercado Pago — back_urls con ngrok

**Archivo:** `app/modules/payments/service.py`

**Antes:**
```python
back_urls = {
    "success": f"{frontend_url}/orders/{pedido_id}/approved",
    ...
}
```

**Ahora:**
```python
base_redirect = settings.NGROK_URL or settings.VITE_FRONTEND_URL
back_urls = {
    "success": f"{base_redirect}/api/v1/pagos/orders/{pedido_id}/success",
    ...
}
```

Esto permite que Mercado Pago redirija a través de ngrok al backend, que muestra la landing page y luego redirige al frontend.

## 7. Efectivo — Landing page post-pago

**Archivo:** `frontend/src/pages/PaymentPage.tsx`

**Antes:** después de pagar en efectivo, redirigía directo a `/mis-pedidos`.

**Ahora:** redirige a `/api/v1/pagos/orders/{orderId}/success` (misma landing page que Mercado Pago).

## 8. Seed — Datos de ejemplo habilitados

**Archivo:** `app/core/seed.py`

Se descomentaron `_seed_example_data()` y `_seed_ventas_data()` para que se carguen productos, categorías, ingredientes y 20 pedidos de ejemplo al iniciar la app.

Se corrigieron códigos de estado viejos (`PAGADO` → `CONFIRMADO`, `EN_PREPARACION` → `EN_PREP`) en los datos de `_seed_ventas_data()`.

## 9. Base de datos — Migración PostgreSQL

**Archivo:** `app/core/database.py`

Se agregaron `created_at` y `updated_at` a las inserciones raw SQL en `_migrate_estado_pedido()` para compatibilidad con PostgreSQL (SQLite lo toleraba sin estos campos).

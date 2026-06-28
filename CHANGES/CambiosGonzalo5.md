# Cambios realizados — Gonzalo (19/06/2026, tanda 5)

> Continuación de [`CambiosGonzalo4.md`](./CambiosGonzalo4.md) (los 5 stores
> Zustand, ya mergeado al main). Esta tanda implementa **CE-09**: el pago de
> MercadoPago **notifica vía WebSocket**.
> Estado final: backend **`94 passed`** (eran 90) con TDD estricto.

El objetivo sigue siendo acercar el proyecto a `TPI_PROG4_FOOD_STORE_v6.md`
(rúbrica 280 pts), sin romper lo que ya andaba. **Pagos = dominio CRITICAL**: se
hizo análisis y se pidió aprobación explícita antes de escribir; el cambio NO
toca ninguna lógica de cobro.

---

## A. El pago notifica vía WebSocket (consigna §9.4, §289, §655 — CE-09)

### A.1 El problema

La rúbrica exige que el webhook IPN de MercadoPago *"actualice el estado del pago
y del pedido **y notifique WS**"* (§289), y el ítem **CE-09** pide que el pago
sandbox funcione end-to-end **notificando vía WS**. El cliente debe ver "pago
aprobado" en vivo, sin recargar.

En [`payments/service.py`](../app/modules/payments/service.py) había **3 caminos**
que aprobaban el pago y avanzaban el pedido a `CONFIRMADO` —`procesar_webhook`,
`confirmar_pago`, `aprobar_manual`— y **ninguno emitía el evento WebSocket**. En
contraste, [`pedidos/service.py`](../app/modules/pedidos/service.py) sí emite
(`_broadcast_pedido` post-commit).

### A.2 La solución — calca el patrón de pedidos

| Cambio | Archivo |
| :---- | :---- |
| Nuevo tipo de evento `EVENT_PAGO_RECHAZADO = "pago_rechazado"` | `pedidos/events.py` |
| Import de `manager`, `build_pedido_event`, `EVENT_PAGO_CONFIRMADO`, `EVENT_PAGO_RECHAZADO` | `payments/service.py` |
| Helper `async _broadcast_pago(...)` — arma el evento §9.4 y hace `manager.broadcast_pedido`, **envuelto en try/except** | `payments/service.py` |
| Broadcast **post-commit** en los 3 métodos (webhook, confirm/verify, manual) | `payments/service.py` |

**Eventos emitidos:**
- Pago **aprobado** → `pago_confirmado`, `estado_nuevo = CONFIRMADO` (el pedido avanza).
- Pago **rechazado** → `pago_rechazado`, el pedido **NO** avanza (queda como está).

El payload es el de §9.4 (mismo shape que el resto de eventos de pedido). En el
webhook el `usuario_id` es `null` porque lo dispara **"el sistema"** (§9.4 / §420);
en `confirm` es el usuario que verifica.

### A.3 Cómo se respetó que es CRITICAL (billing)

- ❌ **No se tocó** ninguna lógica de cobro, montos, idempotencia ni el orden
  `UoW → commit`.
- ✅ El broadcast va **fuera de la transacción** (post-commit): las variables de
  estado se capturan dentro del `with PagoUnitOfWork` y se emiten después.
- ✅ El helper es **defensivo** (`try/except` + log): si el WebSocket falla, el
  procesamiento del pago **no se rompe**.
- ✅ **Sin doble notificación**: el guard existente `if pago.estado == "aprobado":
  return already_processed` corta antes del broadcast en reintentos del webhook.

### A.4 Bug encontrado en el test previo

El test `test_webhook_approved_updates_pedido` **no ejercía** el camino de
aprobación: su mock de `_consultar_pago_mp` no incluía `external_reference`, así
que el webhook cortaba en "Pago not found" (por eso asertaba `status == "ignored"`).
Los tests nuevos sí pasan `external_reference` para procesar el pago de verdad.

---

## B. TDD estricto (RED → GREEN → REFACTOR)

- **Safety net:** `.venv/Scripts/python -m pytest` → **90 passed** antes de tocar.
  (⚠️ correr con el **`.venv` del proyecto**: el Python de miniconda no tiene
  `bcrypt` y daba 2 errores de colección.)
- **RED:** 4 tests nuevos en `tests/integration/test_pagos.py`
  (`TestPagosWebSocketCE09`) que patchean `app.modules.payments.service.manager`
  con `AsyncMock` y assertean el broadcast. Fallaban (`service` no tenía `manager`).
- **GREEN + triangulación:** webhook aprobado, webhook rechazado, webhook
  ya-aprobado (no re-emite) y confirm aprobado.
- **Resultado:** **94 passed** (90 → 94).

```bash
.venv/Scripts/python -m pytest -q     # 94 passed
```

## C. Archivos tocados

| Archivo | Cambio |
| :---- | :---- |
| `app/modules/pedidos/events.py` | + `EVENT_PAGO_RECHAZADO`. |
| `app/modules/payments/service.py` | Helper `_broadcast_pago` + broadcast post-commit en los 3 métodos. |
| `tests/integration/test_pagos.py` | + clase `TestPagosWebSocketCE09` (4 tests). |

> **Nota de entrega (humana):** CE-09 también pide la prueba **end-to-end con
> tarjeta sandbox**. Para eso hace falta configurar `MP_ACCESS_TOKEN` y una
> `MP_WEBHOOK_URL` pública (ngrok) — eso queda para la demo, no es de agente.

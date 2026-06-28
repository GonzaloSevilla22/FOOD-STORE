# Eliminación de `app/core/stock_utils.py`

## Problema

`stock_utils.py` era un archivo procedural suelto en `core/` que contenía lógica de negocio de stock (verificación, descuento, restauración) sin pertenecer a ninguna capa arquitectónica clara. Rompía el patrón Service/UoW/Repository al crear sus propios repositorios internos con sesiones raw en vez de usar el Unit of Work.

## Cambio

Se eliminó `app/core/stock_utils.py` (142 líneas, 5 funciones) y se distribuyó su lógica en los lugares arquitectónicamente correctos.

## Mapeo función por función

### 1. `aplicar_stock(session, producto_id, cantidad, multiplicador)`
- **Antes:** función suelta que creaba su propio `ProductoRepository(session)` internamente
- **Ahora:** `PedidoService._aplicar_stock_static(session, producto_id, cantidad, multiplicador)` — mantiene la misma firma para uso estático desde `PaymentService`. La lógica es idéntica.
- **Además:** `PedidoService._aplicar_stock(self, uow, producto_id, cantidad, multiplicador)` — wrapper de instancia que recibe `PedidoUnitOfWork` y delega al estático. **Nuevo:** atrapa `ValueError` y lo convierte en `HTTPException(400)`.
- **Callers:** `confirmar_pedido`, `cancelar_pedido`, `cambiar_estado` (todos en `PedidoService`)

### 2. `verificar_stock_ingredientes(session, producto_id, cantidad)`
- **Antes:** función suelta que hacía `session.get(Producto, producto_id)`
- **Ahora:** `PedidoService._verificar_stock_ingredientes(session, producto_id, cantidad)` — idéntica
- **Uso:** llamada internamente por `PedidoService.descontar_stock_pedido`

### 3. `verificar_stock_pedido(session, pedido_id)`
- **Eliminada.** Su lógica (iterar detalles, llamar a `verificar_stock_ingredientes` por cada uno) se inlineó directamente dentro de `PedidoService.descontar_stock_pedido`

### 4. `descontar_stock_pedido(session, pedido_id, multiplicador)`
- **Antes:** función suelta llamada desde `PaymentService` (`procesar_webhook`, `confirmar_pago`, `aprobar_manual`)
- **Ahora:** `PedidoService.descontar_stock_pedido(session, pedido_id, multiplicador)` — mismo comportamiento. **Nuevo:** atrapa `ValueError` y lo convierte en `HTTPException(400)`.
- **Caller:** `PaymentService` (3 call sites)

### 5. `ejecutar_con_verificacion_stock(session, pedido_id, accion)`
- **Eliminada.** No era llamada por ningún código del proyecto. Contenía lógica `SELECT ... FOR UPDATE` para PostgreSQL que nunca se ejecutaba.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `app/core/stock_utils.py` | **Eliminado** |
| `app/modules/pedidos/service.py` | Se removió `from app.core.stock_utils import aplicar_stock`. Se agregaron `_aplicar_stock_static`, `_aplicar_stock` (con catch HTTPException), `_verificar_stock_ingredientes`, `descontar_stock_pedido` |
| `app/modules/payments/service.py` | Se reemplazó `from app.core.stock_utils import descontar_stock_pedido` por `from app.modules.pedidos.service import PedidoService`. Los 3 llamados a `descontar_stock_pedido(...)` pasaron a `PedidoService.descontar_stock_pedido(...)`. Se eliminó el import lazy redundante dentro de `_schedule_avance_en_prep` |
| `tests/integration/test_stock_deduction.py` | `test_insufficient_ingredient_stock_rejects` corregido de esperar `500` a esperar `400` (porque ahora `ValueError` se convierte en `HTTPException(400)` en vez de propagarse como excepción no manejada) |

## Call stack final

```
confirmar_pedido / cancelar_pedido / cambiar_estado (PedidoService)
  └── self._aplicar_stock(uow, ...)
       └── PedidoService._aplicar_stock_static(session, ...)  ← lógica real
            └── ValueError → HTTPException(400)

procesar_webhook / confirmar_pago / aprobar_manual (PaymentService)
  └── PedidoService.descontar_stock_pedido(session, ...)
       ├── PedidoService._verificar_stock_ingredientes(...)   ← verificación previa
       └── PedidoService._aplicar_stock_static(...)           ← descuento/restauración
            └── ValueError → HTTPException(400)
```

## Tests

88/88 tests pasando, incluyendo los 6 tests de `test_stock_deduction.py` que cubren: flujo completo, múltiples unidades, cancelación con restauración, stock insuficiente, dos ingredientes simultáneos, y actualización de `stock_disponible`.

# Cambios realizados — Gonzalo (19/06/2026)

> Continuación de [`CambiosGonzalo1.md`](./CambiosGonzalo1.md). Ese doc cerró con
> `48 passed`. Acá se documenta todo lo que vino después, en dos tandas:
> **(A)** máquina de estados a 5 estados + tests faltantes, y **(B)** prefijo
> `/api/v1` en toda la API + seed obligatorio. Estado final: **`69 passed`**.

El objetivo de todo esto es acercar el proyecto a la consigna
`TPI_PROG4_FOOD_STORE_v6.md` (rúbrica 280 pts), sin romper lo que ya andaba.

---

## A. Máquina de estados (FSM) a 5 estados + tests

### A.1 De 6 estados a 5 (consigna §3.4)

**El problema:** el código tenía 6 estados (`PAGADO`, `EN_PREPARACION`,
`TERMINADO`, etc.). La consigna pide exactamente **5**:

```
PENDIENTE → CONFIRMADO → EN_PREP → ENTREGADO
                   └──────────────→ CANCELADO
```

**Qué se hizo:** se renombraron los estados y se ajustaron las transiciones
válidas en todas las capas.

| Archivo | Cambio |
| :---- | :---- |
| `app/core/rbac.py` | Constantes de estado, `ALL_STATES`, `STATE_LEGACY_MAP`, `normalize_state` — **fuente de verdad** del FSM. |
| `app/modules/pedidos/service.py` | `TRANSICIONES_VALIDAS`, transiciones de stock y eventos WS; lógica de `confirmar`/`cancelar`. |
| `app/modules/payments/service.py` | Al aprobar el pago el pedido pasa a `CONFIRMADO`. |
| `app/core/database.py` | Migración `_migrate_estado_pedido` + nueva columna `es_terminal`. |
| `app/core/seed.py`, `tests/conftest.py` | Estados v7 al sembrar. |
| Frontend (6 páginas) | Etiquetas/colores de estado actualizados a los 5 estados. |

**Detalle importante:** se agregó la columna **`es_terminal`** a `EstadoPedido`
(faltaba del ERD v7). `ENTREGADO` y `CANCELADO` son terminales; el resto no.

### A.2 Tests nuevos + un bug real

| Archivo | Qué cubre |
| :---- | :---- |
| `tests/integration/test_estadisticas.py` | Endpoints de estadísticas. |
| `tests/integration/test_uploads.py` | Subida/borrado de imágenes (mockea Cloudinary). |
| `tests/integration/test_websocket.py` | Conexión WS de pedidos/productos. |

Para poder **testear el WebSocket** se refactorizó `/ws/pedidos` en
`pedidos/router.py`: antes abría `Session(engine)` global (no testeable), ahora
usa `Depends(get_session)` y acepta el token por query param `?token=`
(consigna §9.1).

**Bug encontrado y arreglado:** el `DELETE` de uploads usaba
`/imagen/{public_id}`, que **no acepta el slash** del `public_id` de Cloudinary
(formato `carpeta/nombre`). Se cambió a `/imagen/{public_id:path}`.

> Estado de tests tras esta tanda: **`63 passed`** (eran 48).

---

## B. Prefijo `/api/v1` en toda la API + seed obligatorio

### B.1 Prefijo `/api/v1` en TODOS los routers (consigna §6)

**El problema:** la consigna dice *"Todos los endpoints usan el prefijo
`/api/v1`"* y la rúbrica lo puntúa explícitamente. Pero solo
`estadisticas`, `pagos` y `uploads` lo tenían; `auth`, `usuarios`,
`categorias`, `productos`, `ingredientes`, `pedidos` y `direcciones` colgaban
de la raíz.

**Qué se hizo:** se centralizó el prefijo en `main.py`. Ahora **todos** los
routers REST se montan bajo `/api/v1/...`, y los routers que traían el
`/api/v1` adentro (`payments`, `uploads`) se dejaron con su prefijo "corto"
(`/pagos`, `/uploads`) para que el patrón sea uniforme.

| Archivo | Cambio |
| :---- | :---- |
| `main.py` | Cada `include_router(...)` ahora lleva `prefix="/api/v1/..."`. |
| `app/modules/payments/router.py` | `prefix="/api/v1/pagos"` → `prefix="/pagos"` (el `/api/v1` lo pone `main`). |
| `app/modules/uploads/router.py` | `prefix="/api/v1/uploads"` → `prefix="/uploads"`. |
| `app/core/rate_limit/rate_limit_middleware.py` | `AUTH_PATHS` apuntaba a `/auth/login` y `/auth/register`; se actualizó a `/api/v1/auth/...` (si no, el rate-limit dejaba de matchear). |

### B.2 Los WebSocket quedan en la raíz `/ws/*` (consigna §9)

La consigna aclara que *"los endpoints WebSocket se documentan por separado"* y
los ubica en la raíz: `/ws/pedidos`, `/ws/pedidos/{id}`, `/ws/admin/pedidos` —
**no** bajo `/api/v1`. Antes el WS colgaba de `/pedidos/ws/pedidos`.

Para que al prefijar el router de pedidos con `/api/v1` el WS no se arrastrara
ahí, se **extrajo** el endpoint WS a un router aparte (`ws_router`) montado en la
raíz:

| Archivo | Cambio |
| :---- | :---- |
| `app/modules/pedidos/router.py` | El WS pasa de `@router.websocket(...)` a `@ws_router.websocket("/ws/pedidos")`. |
| `app/modules/productos/router.py` | Igual: `@ws_router.websocket("/ws/productos")`. |
| `main.py` | Incluye `pedidos_ws_router` y `productos_ws_router` **sin** prefijo. |

> El resto del trabajo de WebSocket (payload completo `event/pedido_id/...`,
> canal admin, `/ws/pedidos/{id}`) queda pendiente como tarea aparte.

### B.3 Frontend alineado al nuevo prefijo

| Archivo | Cambio |
| :---- | :---- |
| `frontend/src/services/api.ts` | `baseURL` pasa de `/api` a `/api/v1`; se quitaron los `/api/v1` "hardcodeados" en las llamadas de pagos/estadísticas (quedan relativas). Los helpers de WS apuntan a `/ws/pedidos` y `/ws/productos`. |
| `frontend/src/components/PaymentButton.tsx` | `/api/v1/pagos/create-preference` → `/pagos/create-preference`. |
| `frontend/vite.config.ts` | El proxy se simplificó: `/api/v1` pasa derecho al backend y se agregó un entry `/ws` (con `ws: true`) para los WebSocket. |

### B.4 Seed obligatorio — `app/db/seed.py` (criterio CE-05)

**El problema:** la consigna §14.2 pide un seed en `app/db/seed.py` ejecutable
con `python -m app.db.seed`, y el criterio **CE-05** exige que cargue los datos
iniciales **incluyendo `UnidadMedida`**. El seed vivía en `app/core/seed.py`, no
sembraba `UnidadMedida`, y el usuario admin era `admin@test.com` (no el de la
consigna).

**Qué se hizo:**

| Archivo | Cambio |
| :---- | :---- |
| `app/core/seed.py` | Nueva `_create_unidades_medida()` (kg, g, L, ml, ud, porciones) — también se llama en el arranque de la app. Nueva `seed_required_data(session)` idempotente con los datos obligatorios de §14.2. Nuevo admin de la consigna `admin@foodstore.com` / `Admin1234!`. |
| `app/db/__init__.py` | Nuevo (paquete). |
| `app/db/seed.py` | Nuevo. Entry point `python -m app.db.seed` → crea tablas + `seed_required_data`. |
| `tests/integration/test_seed.py` | Nuevo. 6 tests: roles, 5 estados con `es_terminal`, 3 formas de pago, 6 unidades de medida, admin de la consigna, e idempotencia. |

Verificado: `python -m app.db.seed` termina con **exit code 0** y deja en la BD
los 4 roles, 5 estados, 3 formas de pago, 6 unidades de medida y el admin.

---

## B.5 ProductoIngrediente: `unidad` (enum) → `unidad_medida_id` (FK) + `cantidad DECIMAL(10,3)`

**El problema:** el ERD v7 (§5) define `ProductoIngrediente.cantidad` como
`DECIMAL(10,3)` y la unidad como FK `unidad_medida_id → UnidadMedida.id` (NN).
El código tenía `cantidad: float` y `unidad: UnidadEnum` (gramos/litros).

**Qué se hizo:**

| Archivo | Cambio |
| :---- | :---- |
| `app/modules/productos/models.py` | `ProductoIngrediente.cantidad` → `Decimal(10,3)`; se reemplazó `unidad: UnidadEnum` por `unidad_medida_id` (FK) + relación `unidad_medida`. |
| `app/modules/productos/schemas.py` | `ProductoIngredienteSchema`: `cantidad: Decimal`, `unidad_medida_id: int` y `unidad_simbolo` (solo lectura, para mostrar). |
| `app/modules/productos/service.py` | `_validate_ingredientes` ahora valida que **exista** la `UnidadMedida` (antes comparaba el enum). `_to_public` expone `unidad_medida_id` + `unidad_simbolo`. **Bug arreglado**: `_compute_metrics` hacía `float / Decimal` → `TypeError`; se castea a `float`. |
| `app/modules/productos/repository.py` | `set_ingredientes` persiste `unidad_medida_id`. |
| `app/modules/ingredientes/{schemas,service}.py` | `IngredienteProductoUso` usa `unidad_medida_id` + `unidad_simbolo`. |
| `app/core/seed.py` | El seed de ejemplo usa `unidad_medida_id` (busca la unidad por símbolo). |
| `app/core/database.py` | Migración: la columna `unidad` (enum) se reemplaza por `unidad_medida_id BIGINT`; `cantidad` pasa a `NUMERIC(10,3)`. |

### B.6 Endpoint de unidades de medida — `GET /api/v1/unidades-medida`

Para que el front pueda elegir la unidad por id, se agregó un endpoint de solo
lectura que lista las `UnidadMedida`. Respeta el patrón **repository** (la query
vive en `IngredienteRepository.list_unidades_medida`, no en el router/service).

| Archivo | Cambio |
| :---- | :---- |
| `app/modules/ingredientes/repository.py` | `list_unidades_medida()`. |
| `app/modules/ingredientes/service.py` | `list_unidades_medida()` → `List[UnidadMedidaPublic]`. |
| `app/modules/ingredientes/router.py` | Nuevo `unidades_router` con `GET ""`. |
| `main.py` | Monta `unidades_router` en `/api/v1/unidades-medida`. |
| `tests/integration/test_productos_ingredientes.py` | Nuevo. 4 tests: crear producto con `unidad_medida_id`+cantidad decimal, símbolo en la respuesta, unidad inexistente → 422, y el endpoint de unidades. |

### B.7 Frontend al nuevo contrato

| Archivo | Cambio |
| :---- | :---- |
| `frontend/src/models/Producto.ts` | `ProductoIngrediente.unidad` → `unidad_medida_id` + `unidad_simbolo?`. |
| `frontend/src/models/Ingrediente.ts` | `IngredienteProductoUso` idem; nuevo tipo `UnidadMedida`. |
| `frontend/src/services/api.ts` | Nueva `getUnidadesMedida()`. |
| `frontend/src/pages/EntityPages.tsx` | El form de producto trae las unidades del endpoint y el selector de unidad guarda `unidad_medida_id`. |
| `frontend/src/pages/{ProductDetailPage,IngredientDetailPage}.tsx` | Muestran `unidad_simbolo`. |

> Tests backend: **`73 passed`**. Frontend: `tsc` + `vite build` OK.

---

## C. Cómo correr y testear

```bash
# Desde la carpeta INTEGRADOR-FINAL
.venv\Scripts\activate

# Backend
uvicorn main:app --reload --port 8000

# Seed obligatorio (consigna §14.2 / CE-05)
python -m app.db.seed

# Tests
python -m pytest -q
```

**Estado final de los tests:** `73 passed` ✅ (eran 63; +6 del seed, +4 de ProductoIngrediente/unidades).

---

## D. Pendiente (roadmap acordado)

1. WebSocket completo §9.2-9.4: payload (`event`, `pedido_id`, `estado_nuevo`,
   `estado_anterior`, `usuario_id`, `timestamp`), canal admin `/ws/admin/pedidos`,
   `broadcast_to_role`.
2. Frontend → Zustand (stores, incl. `wsStore`) + `useOrderStatusWS` con
   reconexión + TanStack Query con invalidación.
3. MercadoPago con SDK oficial (hoy usa `httpx` directo) — bajo valor / alto riesgo.

**No los puede hacer un agente:** video demo, repo GitHub público, cuentas reales
de MercadoPago / Cloudinary.

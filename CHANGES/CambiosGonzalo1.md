# Cambios realizados — Gonzalo (18/06/2026)

> Este documento explica, paso a paso, cómo se atendió la **devolución del recuperatorio**.
> Está pensado para que cualquier compañero entienda **qué se cambió, por qué y dónde**.

---

## 0. La devolución decía 3 cosas

1. **"Consultas a la base de datos fuera del repository."**
2. **"Los modelos deben estar en su respectivo módulo."**
3. **"No se aprecia el funcionamiento de web socket en el video."**

### Qué pasó con cada una

| Punto | Estado | Resumen |
|-------|--------|---------|
| 1. Queries fuera del repository | ✅ Arreglado | Se movió **todo** el acceso a la BD a clases repository. |
| 2. Modelos por módulo | ✅ Arreglado | Cada modelo ahora vive en `app/modules/<módulo>/models.py`. Se borró `app/models/`. |
| 3. WebSocket | ✅ Verificado (no era un bug) | El código del websocket **estaba bien**; solo no se mostró en el video. |

> ⚠️ Importante: los cambios anteriores de Lorenzo (`CambiosLorenzo1.md`) eran limpieza, `requirements.txt` y config. **No tocaban estos dos puntos de fondo.** Por eso seguían pendientes.

---

## 1. Punto 1 — "Consultas a la base de datos fuera del repository"

### El problema (qué es lo que estaba mal)

La arquitectura del proyecto usa el patrón **Repository**: *solo* las clases `*Repository` deben hablar con la base de datos (`session.exec`, `select`, `session.get`, `session.add`, SQL crudo, etc.). Los **services** solo deben tener lógica de negocio y llamar a los repositories.

Había varios services que consultaban la base de datos **directamente**, salteándose el repository. El caso más grave era **estadísticas**, que tenía hasta **SQL crudo** dentro del service.

### Qué se hizo (5 lugares)

#### 1.1 `estadisticas` → nuevo `EstadisticasRepository`

- **Antes:** `app/modules/estadisticas/service.py` tenía todas las consultas: `self._session.exec(select(...))` y SQL crudo `text("SELECT ... FROM pagos ...")`.
- **Ahora:** se creó **`app/modules/estadisticas/repository.py`** con todos esos métodos (`contar_pedidos`, `sumar_pagos_aprobados`, `contar_pedidos_pagados`, `sumar_cantidad_vendida`, `ventas_por_dia`, `productos_mas_vendidos`, `conteo_por_estado`).
- El service ahora solo **orquesta** y arma los DTOs de respuesta; no toca la sesión.
- Bonus: el SQL crudo pasó a usar parámetros (`LIMIT :limit`) en vez de interpolar el número en el string.

#### 1.2 `usuarios` → nuevo `UsuarioRolRepository`

- **Antes:** `app/modules/usuarios/service.py` hacía `uow._session.query(UsuarioRol).filter(...).first()` y `.delete()` directo para asignar/quitar roles.
- **Ahora:** se creó **`app/modules/usuarios/usuario_rol_repository.py`** con `get()`, `add()` y `delete()`. Se registró en el Unit of Work (`uow.usuarios_roles`). El service llama a esos métodos.

#### 1.3 `direcciones` → se rutea por el repository existente

- **Antes:** `app/modules/direcciones/service.py` usaba `uow._session.get(Usuario, ...)` y `uow._session.add(principal)`.
- **Ahora:** el lookup de usuario va por `UsuarioRepository(...).get_by_id(...)` (que ya estaba importado pero no se usaba 😅) y los `add` van por `uow.direcciones.add(...)`.

#### 1.4 `payments` (dominio crítico, se hizo con confirmación) → se rutea por `PedidoRepository`

- **Antes:** `app/modules/payments/service.py` leía/escribía la entidad **Pedido** con `self._session.get(Pedido, ...)` y `self._session.add(pedido)` en 4 métodos (`crear_pago`, `procesar_webhook`, `confirmar_pago`, `aprobar_manual`). (Los **pagos** ya iban por su repository; el problema era solo el acceso directo a *Pedido*.)
- **Ahora:** se agregó `PedidoRepository` al `PagoUnitOfWork` (`uow.pedidos`) y los accesos van por ahí (`uow.pedidos.get_by_id(...)` / `uow.pedidos.add(...)`).

#### 1.5 `auth_service` → se rutea por `UsuarioRolRepository`

- **Antes:** `register()` hacía `uow._session.add(UsuarioRol(...))` para asignar el rol CLIENT.
- **Ahora:** usa `uow.usuarios_roles.add(usuario.id, rol_cliente.codigo)`.

### Resultado verificable

Buscando consultas directas en services/routers/auth **no queda ninguna**:

```bash
# Esto no devuelve nada:
grep -rn "_session\.\(get\|add\|delete\|exec\|query\)\|\.query(\|select(\|text(" \
  app/modules --include=service.py --include=router.py --include=auth_service.py
```

---

## 2. Punto 2 — "Los modelos deben estar en su respectivo módulo"

### El problema

Todos los modelos SQLModel estaban centralizados en una carpeta **`app/models/`** (15 archivos), separados de su módulo. La consigna pide que cada modelo viva dentro de su feature.

### Qué se hizo

Se movió cada modelo a un archivo **`models.py`** dentro de su módulo, siguiendo la convención del resto del proyecto (cada módulo ya tenía `router.py`, `service.py`, `repository.py`, `schemas.py`).

| Modelo(s) | Antes | Ahora |
|-----------|-------|-------|
| `Categoria`, `ProductoCategoria` | `app/models/...` | `app/modules/categorias/models.py` |
| `Producto`, `ProductoIngrediente`, `UnidadEnum` | `app/models/...` | `app/modules/productos/models.py` |
| `Ingrediente`, `UnidadMedida` | `app/models/...` | `app/modules/ingredientes/models.py` |
| `Usuario`, `Rol`, `UsuarioRol` | `app/models/...` | `app/modules/usuarios/models.py` |
| `DireccionEntrega` | `app/models/...` | `app/modules/direcciones/models.py` |
| `Pedido`, `DetallePedido`, `EstadoPedido`, `HistorialEstadoPedido`, `FormaPago` | `app/models/...` | `app/modules/pedidos/models.py` |
| `Pago` | `app/models/...` | `app/modules/payments/models.py` |

Pasos concretos:

1. Se crearon los 7 `models.py` con las clases (mismos campos y relaciones de antes).
2. Se ajustaron los imports entre modelos. Casi todas las relaciones usan **strings** (`back_populates="..."`), así que SQLAlchemy las resuelve por nombre de clase sin importar el módulo. Solo había 2 imports reales entre modelos:
   - `productos/models.py` importa `ProductoCategoria` de `categorias/models.py`.
   - `ingredientes/models.py` importa `UnidadEnum` de `productos/models.py`.
3. Se actualizaron **todos** los `from app.models import ...` del proyecto (services, repositories, schemas, `core/seed.py`, `core/stock_utils.py`, scripts y tests) para que apunten a los nuevos `app/modules/<x>/models.py`.
4. Se **eliminó la carpeta `app/models/`**.
5. **Registro de tablas:** como ya no existe el "barril" de `app/models/__init__.py`, se agregó la función `_register_all_models()` en `app/core/database.py`. Importa todos los `models.py` antes de `create_all`, garantizando que SQLAlchemy conozca todas las tablas.

> ¿Por qué importa el registro? SQLModel registra una tabla cuando se **importa** su archivo. Antes ese import lo hacía `app/models/__init__.py`. Ahora lo hace `_register_all_models()` para que no falte ninguna tabla (ej: `UnidadMedida`, `FormaPago`).

---

## 3. Punto 3 — WebSocket (estaba bien)

No había que arreglar nada: se revisó de punta a punta y funciona.

- **Backend:** `app/core/websocket.py` (`ConnectionManager`) + 2 endpoints:
  - `app/modules/pedidos/router.py` → `/ws/pedidos` (con autenticación por token).
  - `app/modules/productos/router.py` → `/ws/productos`.
- **Emisión de eventos:** `pedidos/service.py`, `productos/service.py` e `ingredientes/service.py` hacen `manager.broadcast(...)`.
- **Frontend:** se conecta desde 4 páginas (`MisPedidos`, `OperacionesPedidos`, `ProductosCliente`, `Ventas`), ver `frontend/src/services/api.ts`.
- **Ruteo:** el proxy de Vite (`frontend/vite.config.ts`) tiene `ws: true` y reescribe `/api/pedidos/ws/pedidos` → `/pedidos/ws/pedidos`, que coincide con el backend.

---

## 4. Arreglos extra (necesarios para dejar el proyecto sano)

| Archivo | Problema | Solución |
|---------|----------|----------|
| `tests/conftest.py` | Importaba constantes de estado que ya no existían (`STATE_CONFIRMADO`, `STATE_EN_PREP`). Esto rompía **todos** los tests de integración. | Se usaron los nombres reales (`STATE_PAGADO`, `STATE_EN_PREPARACION`, `STATE_TERMINADO`). |
| `tests/integration/test_pagos.py` | `test_redirect_after_pago_returns_redirect` esperaba la URL vieja `orders/1/success`. | El endpoint redirige a `/pedido/1?status=success`; se corrigió la aserción del test. |
| `app/modules/productos/repository.py` | Usaba `session.query(...).delete()` (genera *DeprecationWarning* de SQLModel). | Se cambió por `session.exec(delete(...).where(...))`. Está **dentro** del repository, así que no violaba la consigna, pero se modernizó. |

---

## 5. Cómo correr y testear

```bash
# Desde la carpeta INTEGRADOR-FINAL
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Backend
uvicorn main:app --reload --port 8000

# Tests
python -m pytest -q
```

**Estado final de los tests:** `48 passed` ✅ (antes de empezar estaban rotos por el `conftest.py`).

---

## 6. Archivos nuevos / borrados (resumen rápido)

**Nuevos:**
- `app/modules/estadisticas/repository.py`
- `app/modules/usuarios/usuario_rol_repository.py`
- `app/modules/{categorias,productos,ingredientes,usuarios,direcciones,pedidos,payments}/models.py`

**Borrados:**
- `app/models/` (toda la carpeta)

**Modificados (principales):**
- `app/core/database.py` (función `_register_all_models()`)
- `app/modules/estadisticas/service.py`, `app/modules/usuarios/service.py`, `app/modules/usuarios/auth_service.py`, `app/modules/usuarios/unit_of_work.py`
- `app/modules/direcciones/service.py`, `app/modules/payments/service.py`, `app/modules/payments/unit_of_work.py`
- `app/modules/productos/repository.py`
- Todos los archivos que importaban `from app.models ...`
- `tests/conftest.py`, `tests/integration/test_pagos.py`

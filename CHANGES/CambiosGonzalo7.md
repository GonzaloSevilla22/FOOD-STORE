# Cambios realizados — Gonzalo (25/06/2026, tanda 7)

> Continuación de [`CambiosGonzalo6.md`](./CambiosGonzalo6.md) (CE-13, ya
> mergeado). Esta tanda es una **alineación con la rúbrica + corrección de bugs**:
> se arreglan los **7 tests que fallaban** (quedan **100 passed / 0 failed**, antes
> 93/7) y se cierran desvíos puntuales del spec sin romper lo que ya funcionaba
> (auth Bearer y MercadoPago por redirect se mantienen intactos).

---

## A. BUG — el stock no se descontaba al confirmar el pedido

### A.1 El problema

`PedidoService.confirmar_pedido()` devolvía el mensaje `"Pedido confirmado
exitosamente. Stock descontado."` pero **nunca llamaba a `_aplicar_stock()`**:
solo cambiaba el estado a `CONFIRMADO` y armaba el broadcast. El stock de
ingredientes (y `stock_manual`) quedaba intacto. Además, `crear_pedido()` solo
validaba `producto.disponible`, nunca la **suficiencia de stock**, así que se
podían crear pedidos por encima del stock real. Esto rompía los **6 tests** de
`tests/integration/test_stock_deduction.py` (`assert 4 == 2`, etc.).

### A.2 La solución

| Cambio | Archivo |
| :---- | :---- |
| `confirmar_pedido()` ahora llama a `self._aplicar_stock(..., multiplicador=1)` por cada detalle, **dentro** del bloque UoW (si falta stock lanza 400 → rollback atómico) | `app/modules/pedidos/service.py` |
| Nuevo helper `_stock_disponible(producto)` — replica la métrica de `productos/service.py` (`stock_manual` o `min(floor(stock_ingrediente / cantidad_receta))`) | `app/modules/pedidos/service.py` |
| Pre-validación de stock en `crear_pedido()` **y** `actualizar_items_pedido()`: rechaza `400 "Stock insuficiente de {producto}"` sin descontar | `app/modules/pedidos/service.py` |

- La deducción vive **dentro del UoW**: es atómica y hace rollback si algún ítem
  no alcanza (respeta el patrón UoW de la consigna §7).
- `crear_pedido` **valida pero no descuenta** — el descuento real ocurre al
  confirmar. La cancelación ya restauraba el stock (`multiplicador=-1`), así que
  el ciclo confirmar → cancelar queda balanceado.

### A.3 Verificación

```bash
pytest tests/integration/test_stock_deduction.py -q   # 6 passed
```

---

## B. Auth — cookie httpOnly en login + `expires_in` (spec §4.1 y §6.1)

### B.1 El problema

`test_auth.py::test_login_success_returns_token` esperaba `access_token` en
`response.cookies` (la consigna §4.1 pide *"almacena access token en cookies
only http"*), pero el login solo devolvía el token en el **body**. Además, el
`TokenResponse` no incluía `expires_in: int` (spec §6.1).

### B.2 La solución

| Cambio | Archivo |
| :---- | :---- |
| `POST /auth/login` ahora setea la cookie httpOnly `access_token` (`set_cookie` con `httponly`, `samesite`, `secure`, `max_age`) **además** de devolver el token en el body | `app/modules/auth/router.py` |
| `TokenResponse` agrega `expires_in: int` (default 1800 s) | `app/modules/usuarios/schemas.py` |
| `AuthService.login()` y `refresh()` pueblan `expires_in=30*60` | `app/modules/usuarios/auth_service.py` |

- **Aditivo**: el flujo Bearer no cambia. El frontend sigue leyendo el token del
  body; la cookie es información extra que satisface el spec y el test.

### B.3 Verificación

```bash
pytest tests/integration/test_auth.py -q   # 12 passed
```

---

## C. RN-05 — motivo obligatorio al cancelar

### C.1 El problema

`cambiar_estado()` (endpoint `PATCH /pedidos/{id}/estado`, equivalente al
`AvanzarEstadoRequest` del spec) autocompletaba el motivo con un texto por
defecto. La **RN-05** exige que el motivo sea **obligatorio** cuando el nuevo
estado es `CANCELADO`.

### C.2 La solución

| Cambio | Archivo |
| :---- | :---- |
| En `cambiar_estado()`, si `estado_destino == CANCELADO` y no hay `motivo`, lanza `400 "El motivo es obligatorio para cancelar un pedido (RN-05)"` | `app/modules/pedidos/service.py` |

- Se aplica solo al endpoint `/estado` (el que mapea a `AvanzarEstadoRequest`).
  El `/cancelar` del cliente (auto-cancelación) conserva su comportamiento.

---

## D. Uploads — validación de tamaño (5 MB) y MIME estricto (spec §10.1)

### D.1 El problema

`POST /uploads/imagen` solo validaba que el MIME empezara con `image/`. La
consigna §10.1 pide validar **tipo MIME (`image/jpeg`, `image/png`,
`image/webp`) y tamaño (max 5 MB)** antes de subir a Cloudinary.

### D.2 La solución

| Cambio | Archivo |
| :---- | :---- |
| Set `ALLOWED_IMAGE_TYPES = {image/jpeg, image/png, image/webp}` + `MAX_UPLOAD_BYTES = 5 MB`. Se valida MIME estricto y se lee el contenido para rechazar > 5 MB (`400`), rebobinando el stream (`seek(0)`) para que el service lo reenvíe | `app/modules/uploads/router.py` |

### D.3 Verificación

```bash
pytest tests/integration/test_uploads.py -q   # passed
```

---

## E. Docs — puerto de PostgreSQL corregido (5432 → 5433)

El `docker-compose.yml` mapea `5433:5432` (el contenedor expone **5433** en el
host), pero la documentación indicaba `5432`. Corregido para que el setup con
PostgreSQL funcione siguiendo el README (CE-02).

| Archivo | Cambio |
| :---- | :---- |
| `HowToRun.md` | `DATABASE_URL=...localhost:5433/...` |
| `README.md` (§4) | ejemplo de `DATABASE_URL` con 5433 |
| `app/core/config.py` | comentario del ejemplo PostgreSQL con 5433 |

---

## F. Resultado y cruce con la rúbrica

```bash
pytest -q        # 100 passed, 0 failed   (antes: 93 passed, 7 failed)
```

- **Tests con TestClient (20 pts):** suite completa en verde. Corrige los 6 de
  stock + el de login que estaban rojos.
- **Capa de Servicio / FSM (15 pts):** RN-05 ahora se exige (antes se autocompletaba).
- **Cloudinary backend (15 pts):** se agrega la validación de tamaño 5 MB que faltaba.
- **Auth:** alineado con §4.1 (cookie httpOnly) y §6.1 (`expires_in`).

### Nota sobre CE-05 (corrección de auditoría)

`python -m app.db.seed` **ya funcionaba** — el módulo `app/db/seed.py` existe y
envuelve `app/core/seed.py` (`create_db_and_tables()` + `seed_required_data()`).
No requirió cambios.

### Pendientes (decisiones de diseño, NO tocados en esta tanda)

Por pedido explícito, se mantuvieron como están (rompen features que hoy andan):

- Auth sigue siendo **Bearer + body** (la cookie es aditiva); no se migró todo a cookies.
- MercadoPago sigue por **redirect (`init_point`)** con `httpx`, no SDK oficial ni
  `CardPayment` embebido (funciona E2E con credenciales de prueba).
- FSM mantiene los **7 estados** (con `A_ENTREGAR` / `ESPERANDO_CLIENTE` y auto-avance),
  no se redujo a los 5 del spec.

---

## G. RN-02 — fila inicial del historial con `estado_desde = NULL` (hallazgo del QA)

### G.1 El problema

Durante el QA del ciclo de vida se detectó que el historial de un pedido empezaba
en `PENDIENTE → CONFIRMADO`, sin la fila inicial `NULL → PENDIENTE` que pide la
**RN-02**. Causa raíz: el modelo `HistorialEstadoPedido.estado_desde_codigo` estaba
`nullable=False`, así que `crear_pedido()` nunca insertaba esa fila.

### G.2 La solución

| Cambio | Archivo |
| :---- | :---- |
| `estado_desde_codigo` → `Optional[str]`, `nullable=True` (consigna §3.3: FK NULL) | `app/modules/pedidos/models.py` |
| `crear_pedido()` inserta la fila inicial `NULL → PENDIENTE` ("Pedido creado") dentro del UoW | `app/modules/pedidos/service.py` |
| `HistorialEstadoPedidoPublic.estado_desde_codigo` → `Optional[str]` | `app/modules/pedidos/schemas.py` |
| Frontend: las 3 vistas de detalle muestran "Creación" cuando `estado_desde` es null; tipo TS `string \| null` | `ClientePedidoDetailPage.tsx`, `OperacionPedidoDetailPage.tsx`, `VentaDetailPage.tsx`, `services/api.ts` |
| Test de regresión RN-02 (la creación inserta 1 fila con `estado_desde = NULL`) | `tests/integration/test_pedidos.py` |
| Fix de build preexistente: `nuevaFila` de ProductoIngrediente sin `es_opcional` | `frontend/src/pages/EntityPages.tsx` |

- En PostgreSQL en vivo se corrió `ALTER TABLE historiales_estado_pedido ALTER COLUMN estado_desde_codigo DROP NOT NULL` (no destructivo) para alinear el esquema existente.

### G.3 Verificación

```bash
pytest -q                 # 101 passed (100 + regresión RN-02)
cd frontend && npm run build   # tsc && vite build OK
# En vivo: pedido nuevo -> historial = [ NULL -> PENDIENTE | "Pedido creado" ]
```

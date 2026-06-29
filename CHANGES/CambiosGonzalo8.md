# Cambios realizados — Gonzalo (29/06/2026, tanda 8)

> Continuación de [`CambiosGonzalo7.md`](./CambiosGonzalo7.md). Esta tanda se centró
> en **experiencia de usuario del flujo de compra**, una **regla de negocio nueva
> (cascada de ingredientes)** y un set de **quick wins** para acercar el proyecto a la
> rúbrica. Todo verificado con la suite de tests (101/101), QA por API (30/30) y build.

---

## 1. Navegación: la home pasa a ser el catálogo de Productos

**Objetivo:** que cualquiera (incluso sin sesión) entre y vea el catálogo, pero no pueda
agregar al carrito sin registrarse.

**Archivos:** `frontend/src/App.tsx`, `frontend/src/pages/ProductosClientePage.tsx`,
`frontend/src/pages/RegisterPage.tsx`, `frontend/src/components/NavBar.tsx`.

- `/` ahora renderiza la **vista de Productos** (antes la `LandingPage`). La vista por rol
  se extrajo a una const `productosView` reutilizada por `/` y `/productos` (sin duplicar
  lógica). La Landing quedó accesible en `/landing`.
- **Gate de invitado:** en `handleAddToCart`, si el usuario no está autenticado se muestra
  un toast (sonner) con dos acciones — *Iniciar sesión* y *Crear cuenta* — que llevan a
  `/login?redirect=/productos` y `/register?redirect=/productos`. No reserva stock ni agrega.
- **RegisterPage:** tras registrarse hace **auto-login** y redirige a Productos (con fallback
  a `/login?registered=true&redirect=...` si el auto-login fallara).
- **NavBar:** el acceso directo al carrito solo se muestra a clientes autenticados
  (`showCarrito = isClient && !isProductosPage`), para que el invitado no vea un link que rebota.

## 2. Fix del redirect post-login (login por rol)

**Archivo:** `frontend/src/App.tsx`, `frontend/src/pages/LoginPage.tsx`.

- **Bug:** la ruta `/login` tenía `isAuthenticated ? <Navigate to="/home"> : <LoginPage/>`.
  Al loguearse, ese `<Navigate to="/home">` disparaba **antes** que el `useEffect` de
  `LoginPage` que respeta `?redirect=`, así que siempre caía en el dashboard.
- **Fix:** se quitó el `<Navigate>` de la ruta (y los imports/vars que quedaban sin uso) y
  `LoginPage` quedó como único dueño del redirect. Ahora: **cliente → `/productos`**,
  **staff (admin/stock/pedidos) → `/home`**, y un `?redirect=` explícito tiene prioridad.

## 3. Catálogo ampliado (categorías y productos)

**Archivo:** `app/core/seed.py` (función `_seed_extra_catalog`, additiva e idempotente).

- De 3 a **10 categorías** (Pizzas, Bebidas, Adicionales + Empanadas, Hamburguesas, Lomos,
  Pastas, Milanesas, Ensaladas, Postres) y de 5 a **34 productos**.
- Get-or-create por nombre: a los productos originales solo les completa lo que falta; no
  duplica ni borra datos previos. Reproducible también en instalación limpia.

## 4. Ingredientes con precio/stock/alérgenos + recetas

**Archivo:** `app/core/seed.py`.

- Catálogo de **31 ingredientes**, cada uno con `costo_unitario` (precio),
  `stock_actual`/`stock_minimo` (stock), `es_alergeno` y unidad.
- Cada producto quedó **vinculado a sus ingredientes** (`ProductoIngrediente` con cantidad,
  unidad y `es_removible`). Ej.: Hamburguesa Completa = pan + carne + huevo + jamón + lechuga + tomate.

## 5. Imágenes del catálogo

**Archivos:** `app/core/seed.py`, `frontend/src/pages/ProductosClientePage.tsx`,
`frontend/public/categorias/lomo.jpg`.

- Cada producto usa la **imagen de su categoría** (mapeo `getCategoryImage` con emojis e
  imágenes por categoría; `getImageUrl` cae a la de categoría si el producto no tiene imagen propia).
- La categoría **Lomos** usa una imagen **auto-hospedada** (`/categorias/lomo.jpg`) para que
  sea correcta y no se rompa. Se agregó `onError` en las imágenes como red de seguridad.

## 6. Regla nueva: baja/alta de ingrediente **en cascada**

**Archivos:** `app/modules/ingredientes/service.py`, `app/modules/ingredientes/router.py`,
`frontend/src/pages/EntityPages.tsx`, `frontend/src/services/api.ts`.

- **Baja:** en vez de bloquear, marca `disponible=false` los productos activos que usan el
  ingrediente (no los borra → reversible). `DELETE /ingredientes/{id}` devuelve
  `{ productos_desactivados: N }` y la UI lo informa.
- **Alta:** reactiva (`disponible=true`) **solo** los productos cuyos ingredientes vuelven a
  estar **todos activos**. Devuelve `{ productos_reactivados: N }`.
- Ambas emiten `PRODUCTO_UPDATED` por WebSocket para refrescar el catálogo en vivo.

## 7. Fix: el cartel de confirmación no cerraba ante error

**Archivo:** `frontend/src/pages/EntityPages.tsx`.

- `onConfirm` del `ConfirmDialog` usaba `mutateAsync` (que re-lanza). Ante un error de
  negocio, el cartel quedaba abierto y el rechazo quedaba *uncaught*. Se envolvió en
  `try/catch/finally` para cerrar siempre y dejar ver el banner con el motivo.

## 8. Combobox de ingredientes (autocompletar + teclado)

**Archivo:** `frontend/src/pages/EntityPages.tsx`.

- Se reemplazó el doble control (input de búsqueda + `<select>` nativo) por un **único
  combobox**: se escribe y aparece una lista filtrada debajo; se elige con click. Los
  ingredientes ya usados en otra fila no aparecen.
- **Navegación con teclado:** ↑/↓ mueven el resaltado, **Enter** elige (sin enviar el form),
  **Esc** cierra; sincroniza con el mouse y hace auto-scroll.

## 9. Inputs numéricos: "borrar el 0 al escribir"

**Archivo:** `frontend/src/App.tsx`.

- Listener global (`focusin`) que **selecciona el contenido** de cualquier `input[type=number]`
  al enfocarlo. Así, al empezar a escribir se reemplaza el `0` (evita el "0100"). Cubre los
  ~19 campos numéricos de la app y los futuros.

## 10. Quick wins de rúbrica

- **Auto-refresh 401** (`stores/authStore.ts`, `services/api.ts`): el store guarda/persiste
  `refresh_token`; el interceptor, ante un 401, refresca el token (single-flight) y
  **reintenta** el request; solo desloguea si el refresh falla.
- **4º gráfico** (`pages/VentasPage.tsx`): BarChart horizontal de **ingresos por forma de pago**
  (ahora 4 recharts: Line/Bar/Pie/Bar).
- **Eliminar imagen desde UI** (`pages/EntityPages.tsx`): `handleQuitarImagen` llama
  `deleteImagen` (DELETE /uploads) extrayendo el `public_id` de la secure_url de Cloudinary.
- **Sin `any`**: se tiparon los 4 usos (`VentasPage`, `PaymentButton`, `PaymentPage` x2).
- **`costo_envio = 50`** (`app/modules/pedidos/models.py`, `app/modules/pedidos/service.py`):
  default y al crear pedido, según consigna §3.3. El total ahora incluye el envío.

## 11. QA completo

- **Backend:** `pytest` → **101/101** en ~103 s (sin regresiones por la cascada).
- **API funcional:** script propio → **30/30** (salud, auth, RBAC, catálogo público, cascada,
  CRUD producto, pedido + MercadoPago, estadísticas, stock).
- **Frontend:** `vite build` compila OK; `tsc` limpio salvo un error **pre-existente** en
  `src/lib/utils.ts` (config de `tailwind-merge` v3) — no bloquea `npm run dev`.

---

### Notas para la defensa
- La FSM tiene **7 estados** (superset de los 5 de la consigna, con auto-avance por timers).
- MercadoPago se integra con **httpx** (no el SDK oficial) — funciona end-to-end con
  idempotency + webhook.
- El checkout usa **Checkout PRO (redirect `init_point`)**, respaldado por §8 de la consigna.

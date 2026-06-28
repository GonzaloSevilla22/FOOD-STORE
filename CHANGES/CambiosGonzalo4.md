# Cambios realizados — Gonzalo (19/06/2026, tanda 4)

> Continuación de [`CambiosGonzalo3.md`](./CambiosGonzalo3.md). Esa tanda cerró el
> WebSocket completo y dejó como pendiente de nota (sección de scope) el ítem
> **CE-11: los 5 stores de Zustand**. Esta tanda lo implementa.
> Estado final: frontend **`tsc && vite build` OK** (CSS 32.57 kB, sin errores).

El objetivo sigue siendo acercar el proyecto a la consigna
`TPI_PROG4_FOOD_STORE_v6.md` (rúbrica 280 pts), sin romper lo que ya andaba.
El **frontend** no tiene test runner JS, así que se verificó con `tsc` + `vite
build` (la barra de las tandas anteriores).

---

## A. Gestión de estado con Zustand — 5 stores (consigna §12, CE-11)

### A.1 El problema

La rúbrica **Frontend — Zustand (10 pts, CE-11)** exige *"5 stores implementados
y tipados, persist correcto (incluye wsStore), suscripción por slice"*. La
consigna (§12 y §1/§3.2) los enumera: **carrito, sesión, pagos, WS y UI**.

Hasta la tanda 3 sólo existía **`wsStore`**. La sesión (`AuthContext`) y el
carrito (`CartContext`) vivían en **Context API + `useState`**, y no había stores
de **pagos** ni de **UI**. Es decir: 1 de 5 stores → tope del nivel más bajo del
rango de 10 pts.

### A.2 Enfoque — stores reales + hooks adapter (riesgo mínimo)

Se crearon los **4 stores faltantes** como stores Zustand reales y tipados, y se
conservaron los hooks `useAuth()` / `useCart()` como **adaptadores por slice**
sobre los nuevos stores. Así **los ~12 componentes consumidores no cambian** (no
se toca su forma de consumir) y por debajo toda la fuente de verdad pasa a ser
Zustand. Esto preserva exactamente el comportamiento de login y carrito (lo más
delicado) y a la vez cumple la rúbrica.

| Store | Archivo | Estado | Persist |
| :---- | :---- | :---- | :---- |
| `authStore` | `stores/authStore.ts` | `token`, `user`, `roles`, `authLoading` + `login/logout/verifySession` | **Sólo el `token`** (`partialize`) |
| `cartStore` | `stores/cartStore.ts` | `items` + `agregar/remover/modificar/limpiar` + selectors `total()` / `itemCount()` | **`items` completos** |
| `paymentStore` | `stores/paymentStore.ts` | `status` (idle/creating/initiated/confirming_cash/error), `pedidoId`, `initPoint`, `error` | No (efímero) |
| `uiStore` | `stores/uiStore.ts` | `navMenuOpen` + toggle | No (efímero) |
| `wsStore` | `stores/wsStore.ts` *(ya existía)* | estado de conexión + último evento por canal | No |

### A.3 `authStore` (sesión)

- Toda la lógica que estaba en `AuthContext` (token, user, roles, helpers de rol,
  `login` / `logout` / `verifySession`) se movió al store.
- `persist` con `partialize: (s) => ({ token: s.token })` — **sólo el accessToken**,
  como pide §12. Clave de storage `food_store_auth`.
- `authLoading` inicial se calcula leyendo de forma síncrona si hay token
  persistido (`hasPersistedToken()`), para **no introducir el flash** de
  redirección a `/login` en rutas protegidas durante la rehidratación (igual que
  el `AuthContext` previo).
- `context/AuthContext.tsx` quedó como:
  - `useAuth()` → **adapter por slice** que devuelve la misma `AuthContextValue`.
  - `AuthProvider` → host del efecto de **bootstrap**: corre `verifySession()` una
    vez al montar (valida la sesión persistida). El árbol de `main.tsx` no cambia.

### A.4 `cartStore` (carrito)

- Misma lógica que `CartContext` (agregar suma cantidades, modificar a 0 elimina,
  etc.), ahora con `persist` de los **items completos** (clave `food_store_cart`).
- Selectors `total()` e `itemCount()` para suscripción por slice.
- `context/CartContext.tsx` → `useCart()` adapter (misma interfaz, `total` como
  número derivado) y `CartProvider` pasa a ser **passthrough** (Zustand no
  necesita Provider; se mantiene el componente para no tocar `App.tsx`).

### A.5 `paymentStore` (proceso de pago)

Coordina el checkout **entre `PaymentButton` y `PaymentPage`** (caso de uso
clásico de estado global): el botón crea la preferencia de MercadoPago y pasa el
`status` a `initiated`; la página muestra el panel "pago iniciado / ya pagué"
leyendo ese `status`. Reemplazó los `useState` locales `paymentInitiated` y
`cashLoading`. Se reinicia al entrar/salir de la pantalla de pago.

> **Nota (billing):** NO se tocó ninguna llamada ni lógica de pago del backend.
> El store sólo centraliza el **estado de UI** del proceso de pago; las requests
> (`/pagos/create-preference`, `/pedidos/{id}/confirmar`) son idénticas.

### A.6 `uiStore` (UI local)

Estado de interfaz efímero que no es ni del servidor (TanStack Query) ni de un
dominio: hoy la apertura del menú de navegación. `NavBar` migró su
`useState(open)` al `uiStore` y suma un **badge de cantidad del carrito**
consumiendo `useCartStore((s) => s.itemCount())` — demostrando suscripción por
slice directa.

### A.7 Interceptor fuera de React (consigna §12)

`services/api.ts` ahora lee el token con **`useAuthStore.getState().token`** en el
interceptor de request (y en el fallback), tal como recomienda la consigna para
acceso fuera de React. En el 401 llama `useAuthStore.getState().logout()`. Se
eliminó la dependencia de la clave cruda `food_store_token`.

> El ciclo de imports `api.ts ↔ authStore.ts` es seguro: el uso es **en tiempo de
> llamada** (dentro del interceptor / de las actions), no en la inicialización de
> los módulos.

---

## B. Archivos tocados

| Archivo | Cambio |
| :---- | :---- |
| `frontend/src/stores/authStore.ts` | **Nuevo.** Store de sesión, persist sólo token. |
| `frontend/src/stores/cartStore.ts` | **Nuevo.** Store de carrito, persist items. |
| `frontend/src/stores/paymentStore.ts` | **Nuevo.** Store del proceso de pago (efímero). |
| `frontend/src/stores/uiStore.ts` | **Nuevo.** Store de UI local. |
| `frontend/src/context/AuthContext.tsx` | Reescrito: `useAuth` adapter + `AuthProvider` bootstrap. |
| `frontend/src/context/CartContext.tsx` | Reescrito: `useCart` adapter + `CartProvider` passthrough. |
| `frontend/src/services/api.ts` | Interceptor usa `useAuthStore.getState()`. |
| `frontend/src/components/PaymentButton.tsx` | Usa `paymentStore` (sin estado local). |
| `frontend/src/pages/PaymentPage.tsx` | Estado de pago vía `paymentStore`. |
| `frontend/src/components/NavBar.tsx` | Menú vía `uiStore` + badge carrito por slice. |

## C. Verificación

```bash
cd frontend
npm run build      # tsc && vite build → OK, sin errores (CSS 32.57 kB)
```

> **Migración de storage:** las claves de localStorage cambian de formato (ahora
> las gestiona el middleware `persist` de Zustand: `food_store_auth`,
> `food_store_cart`). Una sesión vieja guardada con el formato anterior se ignora
> → hay que **volver a loguear una vez**. Sin impacto para la corrección del TP.

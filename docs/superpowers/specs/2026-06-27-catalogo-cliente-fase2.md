# Fase 2 — Catálogo, Carrito y Pago (Cliente)

**Fecha:** 2026-06-27
**Estado:** Aprobado

---

## Resumen

Mejora visual y de UX de las tres páginas del flujo cliente: catálogo (bento grid + quick-add), carrito (sidebar deslizable + página dedicada), y checkout (pago con tarjetas visuales).

---

## 1. Catálogo (ProductosClientePage)

### Layout
- Bento grid de 3 columnas: primer producto destacado ocupa 2 columnas × 2 filas, resto cards 1×1
- Cards usan `Card variant="interactive"` con hover glow
- Hover: overlay semitransparente + ícono "+" centrado + shadow-neon-sm
- Click en card → agrega al carrito (sin navegación)
- Sin stock: grayscale + overlay "Sin stock"

### Filtros
- Input search con icono lupa (`Input` + `prefixIcon`)
- Select de categorías (`Select`)
- Toggle "Solo disponibles" (`Toggle`)
- Filtros persisten en sessionStorage

---

## 2. Carrito

### SidebarCart (nuevo componente)
- Botón flotante esquinero con badge de cantidad
- Panel deslizable desde la derecha con overlay
- Header: título + total items + botón cerrar
- Lista: imagen miniatura, nombre, precio, input cantidad, eliminar, subtotal
- Footer: total + botón "Ir a Checkout"

### Página /carrito (mejorada)
- Items en lista expandida con más espacio
- Botones "Seguir Comprando" / "Ir a Checkout"
- EmptyState con icono y botón

---

## 3. Página de Pago (PaymentPage)

- Resumen del pedido en `Card variant="neon"`
- Direcciones: cards seleccionables con badge "Principal"
- Opciones de pago: cards visuales con icono grande (MP celeste, efectivo verde)
- Timer se vuelve rojo con pulse ≤30s
- Éxito: card verde con checkmark

---

## Archivos a modificar

- `ProductosClientePage.tsx`
- `CarritoPage.tsx`
- `PaymentPage.tsx`

## Archivos a crear

- `SidebarCart.tsx`

## No incluido

- MisPedidosPage, ClientePedidoDetailPage, PerfilPage (fase futura)
- ClienteDashboard (fase futura)
- Páginas admin (fase 3)

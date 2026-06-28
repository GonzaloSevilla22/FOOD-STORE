# Fase 3A — Dashboards + Ventas + Operaciones

**Fecha:** 2026-06-27
**Estado:** Aprobado

---

## Resumen

Migración visual de 7 páginas admin al nuevo sistema de diseño: dashboards de navegación, página de ventas con KPIs/gráficos/tabla, detalle de venta, operaciones de pedidos con tabla y acciones, y detalle de operación.

---

## 1. Dashboards (AdminDashboard, PedidosDashboard, StockDashboard)

- Links de navegación con `Card variant="interactive"`
- Iconos SVG en círculos de color distintivo
- Box de tips con `Card variant="default"` y badge de rol
- Solo cambio visual, sin lógica nueva

## 2. VentasPage

- KPIs: 4 cards con icono SVG + color + número grande
- Gráficos recharts: tooltips con bordes brand, líneas brand-400, grid surface-border
- Tabla: Badge para estado, Button para acciones, header fijo brand-50
- Filtros: Select/Input del sistema de diseño
- Paginación: Button outline

## 3. VentaDetailPage / OperacionPedidoDetailPage

- Info grid con Card
- Badge para estado de pedido/pago
- Button para acciones
- Timeline de historial con Badge
- Modal para diálogo de cancelación

## 4. OperacionesPedidosPage

- Stats con KPIs pequeños + Badge
- Tabla con Badge/Button, acciones de estado
- Modal con radio buttons para cancelación
- RealtimeBadge + WebSocket feed

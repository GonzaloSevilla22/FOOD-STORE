# Arreglamos manejo de falta de stock

## Problema

1. **Mensaje de error genérico en frontend:** Cuando la API devolvía `{"error": {"message": "..."}}`, el interceptor de Axios solo revisaba `data.detail`, no `data.error.message`. Caía al fallback genérico `"Error 400 en la API"`.

2. **Sin verificación temprana para productos con ingredientes:** En `crear_pedido` y `actualizar_items_pedido` solo se chequeaba `stock_manual`. Para productos con `usa_stock_manual = False`, `stock_manual` es `None`, la condición pasaba de largo, y el pedido se creaba sin verificar stock de ingredientes. Recién fallaba al pagar.

## Cambios

### 1. Interceptor de Axios (`frontend/src/services/api.ts`)

Se agregó detección de `data.error.message` en el response interceptor, además del `data.detail` existente. Si el backend responde con `{"error": {"message": "Stock insuficiente..."}}`, el interceptor crea `new Error("Stock insuficiente...")` en vez del genérico.

```typescript
// Antes: solo revisaba "detail"
if (data && typeof data === "object" && "detail" in data) {
  return Promise.reject(new Error(String(data.detail)));
}
return Promise.reject(new Error(`Error ${error.response.status} en la API`));

// Ahora: también revisa error.message
if (data && typeof data === "object") {
  if ("detail" in data) { ... }
  if (data.error?.message) {
    return Promise.reject(new Error(String(data.error.message)));
  }
}
```

### 2. Verificación de ingredientes en `crear_pedido` (`app/modules/pedidos/service.py`)

Se agregó un `else` al chequeo de `stock_manual`. Si el producto no tiene stock manual, llama a `_verificar_stock_ingredientes` y falla temprano.

```python
# Antes:
if producto.stock_manual is not None and producto.stock_manual < cantidad:
    raise HTTPException(...)

# Ahora:
if producto.stock_manual is not None:
    if producto.stock_manual < cantidad:
        raise HTTPException(...)
else:
    error = PedidoService._verificar_stock_ingredientes(...)
    if error:
        raise HTTPException(400, detail=f"Stock insuficiente de {producto.nombre}")
```

### 3. Verificación de ingredientes en `actualizar_items_pedido`

Mismo cambio que en `crear_pedido`.

### 4. Mensaje simplificado

En vez de mostrar el detalle interno ("Ingrediente 'X' insuficiente: se necesitan Y, hay Z"), se muestra `"Stock insuficiente de {Producto.nombre}"`.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/services/api.ts` | Interceptor ahora extrae `data.error.message` |
| `app/modules/pedidos/service.py` | Dos lugares (`crear_pedido`, `actualizar_items_pedido`) con verificación de ingredientes + mensaje simplificado |

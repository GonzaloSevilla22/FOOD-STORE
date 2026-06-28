# Mejora en carga de ingredientes en producto

## Problema

El formulario de producto permitía seleccionar libremente la unidad de medida de cada ingrediente (kg, L, ud, porciones, g, ml) mediante un dropdown, independientemente de la unidad base del ingrediente (`unidad_medida`: "gramos" / "mililitros").

Esto generaba inconsistencias:

- Se podía cargar `cantidad: 0.5` + `unidad: "kg"` en un ingrediente cuyo stock se trackea en gramos
- `stock_utils.py` restaba `stock_actual -= 0.5` en vez de `-= 500`, dando descuentos de stock incorrectos
- No existía lógica de conversión entre los dos sistemas de unidades

Además, el formulario tenía un checkbox "Opcional" que no se usaba en ninguna lógica de negocio (no hay cálculo de precio, ni filtro, ni comportamiento en el frontend que lo distinga).

## Cambio

Se eliminó el dropdown de unidad de medida y el checkbox "Opcional" del `ProductoIngredientsEditor`.

### Cómo funciona ahora

Cuando se agrega o cambia un ingrediente en el producto:

1. Se lee `ingrediente.unidad_medida` (atributo del ingrediente: "gramos" o "mililitros")
2. Se mapea automáticamente al `UnidadMedida` correspondiente:
   - `"gramos"` → registro con nombre "Gramo" (g)
   - `"mililitros"` → registro con nombre "Mililitro" (ml)
3. El `unidad_medida_id` de `ProductoIngrediente` se setea automáticamente
4. La unidad se muestra como texto debajo del input de cantidad (ej: `"gramos"`)
5. El checkbox "Opcional" se eliminó del formulario
6. Solo queda "Removible" como opción configurable

### Consecuencias

- Ya no hay posibilidad de inconsistencia entre la unidad del ingrediente y la del producto
- El descuento de stock ahora es correcto siempre (se resta en la misma unidad que el stock)
- No se necesita lógica de conversión entre unidades
- La tabla `UnidadMedida` aún contiene kg, L, ud, porciones como datos de referencia, pero nunca se asignan desde el frontend

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/pages/EntityPages.tsx` | Se eliminó el dropdown de unidad, el checkbox "Opcional", y se agregó mapeo automático `enumAUnidadMedidaId` |

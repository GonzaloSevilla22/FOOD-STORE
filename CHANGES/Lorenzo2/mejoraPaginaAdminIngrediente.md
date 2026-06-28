# Mejoras a la página de administración de ingredientes

## 1. Columna "Alérgeno" en el listado

**Antes:** El listado de ingredientes solo mostraba Nombre, Descripción, Estado y Acciones. No había forma de ver rápidamente si un ingrediente es alérgeno sin abrir el detalle o el modal de edición.

**Después:** Se agregó una columna "Alérgeno" entre Estado y Acciones que muestra un badge rojo con la etiqueta "Alérgeno" si `es_alergeno` es `true`, o un guión (`-`) en caso contrario.

**Archivo:** `frontend/src/pages/EntityPages.tsx` — columnas del `EntityPage` y `renderRow`.

## 2. Badges de estado (Activo/Inactivo)

**Antes:** La columna "Estado" mostraba texto plano "Activo" o "Inactivo", difícil de distinguir visualmente de un vistazo.

**Después:** Se reemplazó por badges con colores:
- **Activo:** badge verde (`bg-green-100 text-green-700`)
- **Inactivo:** badge rojo (`bg-red-100 text-red-700`)

Consistente con el estilo del badge de Alérgeno.

**Archivo:** `frontend/src/pages/EntityPages.tsx` — celda de Estado en `renderRow`.

## 3. Botones de acción visibles siempre

**Antes:** Los botones "Ver detalle" y "Editar" estaban condicionados a `isActive`, por lo que no aparecían cuando un ingrediente estaba inactivo. Para editar un ingrediente inactivo, el usuario debía primero darle de alta.

**Después:** Se eliminó la condición `isActive` de los botones "Ver detalle" y "Editar". Ahora aparecen siempre, permitiendo ver y modificar ingredientes activos e inactivos. El botón "Baja" / "Dar de alta" se mantiene condicional según el estado.

**Archivo:** `frontend/src/pages/EntityPages.tsx` — bloque de acciones en `renderRow`.

## 4. Corrección de campo "Costo por Unidad" vacío al editar

**Problema:** Al abrir el modal de edición de un ingrediente, el campo "Costo por Unidad" aparecía vacío, aunque el ingrediente tuviera un valor guardado.

**Causa raíz:** Pydantic v2 serializa los campos `Decimal` como strings en JSON. El backend devolvía `costo_unitario: "1.2000"` (string), pero el frontend esperaba un `number`. El formulario hacía `typeof form.costo_unitario === "number"` que daba `false` y renderizaba `""`.

**Solución:** Se agregó `Number()` en la función `toForm` del `ingredienteConfig` para convertir el valor a número antes de pasarlo al estado del formulario:
```tsx
costo_unitario: Number(item?.costo_unitario ?? 0),
```

**Archivo:** `frontend/src/pages/EntityPages.tsx` — `ingredienteConfig.toForm`.

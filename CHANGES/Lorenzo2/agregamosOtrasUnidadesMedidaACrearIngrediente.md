# Agregamos otras unidades de medida al crear/editar ingrediente

## Problema

El formulario de creación/edición de ingredientes solo permitía seleccionar `"gramos"` o `"mililitros"` como unidad de medida, a pesar de que la tabla `unidades_medida` ya contenía 6 registros (Kilogramo, Gramo, Litro, Mililitro, Unidad, Porción) y el seed los creaba desde el inicio.

Esto limitaba los tipos de ingrediente que se podían modelar: un huevo (`"unidades"`), un chorizo (`"porciones"`), o aceite (`"litros"`) no tenían una opción correcta en el formulario.

Además, el miembro del enum `UnidadEnum.LITROS` tenía el valor `"mililitros"` (herencia de un cambio anterior donde se forzó `litros → mililitros`), lo cual era confuso porque el nombre del miembro no coincidía con su valor.

## Cambio

### Backend — `UnidadEnum`

Se expandió `UnidadEnum` de 2 a 6 miembros. Se renombró el legacy `LITROS = "mililitros"` a `MILILITROS = "mililitros"` para que nombre y valor coincidan.

```python
class UnidadEnum(str, Enum):
    GRAMOS = "gramos"
    MILILITROS = "mililitros"   # antes: LITROS = "mililitros"
    KILOS = "kilos"             # nuevo
    LITROS = "litros"           # nuevo (ahora sí representa litros)
    UNIDADES = "unidades"       # nuevo
    PORCIONES = "porciones"     # nuevo
```

### Backend — migración DB

Se agregó `_drop_unidad_medida_check_constraint` en `database.py` para eliminar el CHECK constraint de la columna `ingredientes.unidad_medida` en PostgreSQL. Esto permite que la columna acepte los nuevos valores del enum. En SQLite (tests) no es necesario porque la tabla se recrea desde cero al iniciar.

### Frontend — tipos TypeScript

Se creó `UnidadMedidaEnum` como union type con los 6 valores, y se usó en todas las interfaces (`Ingrediente`, `IngredienteCreate`, `IngredienteUpdate`).

### Frontend — formulario y mapping

- El `<select>` de unidad de medida ahora muestra 6 opciones en vez de 2
- `enumAUnidadMedidaId` ahora mapea los 6 valores del enum a los IDs de `UnidadMedida`:
  - `"gramos"` → Gramo
  - `"mililitros"` → Mililitro
  - `"kilos"` → Kilogramo
  - `"litros"` → Litro
  - `"unidades"` → Unidad
  - `"porciones"` → Porción

### Referencias a `UnidadEnum.LITROS`

Las referencias existentes a `UnidadEnum.LITROS` (en `seed.py` y `scripts/demo/seed_example_data_fixed.py`) se actualizaron a `UnidadEnum.MILILITROS` para mantener el comportamiento de crear ingredientes con unidad `"mililitros"`.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `app/modules/productos/models.py` | `UnidadEnum` expandido a 6 miembros; `LITROS` renombrado a `MILILITROS` |
| `app/core/database.py` | Nueva función `_drop_unidad_medida_check_constraint` para PostgreSQL; llamada en `_migrate_legacy_schema` |
| `app/core/seed.py` | `UnidadEnum.LITROS` → `UnidadEnum.MILILITROS` |
| `scripts/demo/seed_example_data_fixed.py` | `UnidadEnum.LITROS` → `UnidadEnum.MILILITROS` |
| `frontend/src/models/Ingrediente.ts` | Nuevo type `UnidadMedidaEnum` con 6 valores; interfaces lo usan |
| `frontend/src/pages/EntityPages.tsx` | Dropdown con 6 opciones; `enumAUnidadMedidaId` con 6 entradas; casts actualizados a `UnidadMedidaEnum` |

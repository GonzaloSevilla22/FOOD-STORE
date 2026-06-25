# Cambio: litros → mililitros

**Motivo:** Incoherencia semántica — los ingredientes se cargan en unidades de masa (gramos) o volumen, pero "litros" es una unidad demasiado grande para ingredientes individuales (ej: aceite, esencia, colorante). Usar mililitros es más preciso y consistente.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `app/modules/productos/models.py:18` | `LITROS = "litros"` → `LITROS = "mililitros"` |
| `frontend/src/models/Ingrediente.ts:9,21,31` | Tipo `"gramos" \| "litros"` → `"gramos" \| "mililitros"` |
| `frontend/src/pages/EntityPages.tsx:558` | `<option value="mililitros">mililitros</option>` |
| `frontend/src/pages/EntityPages.tsx:1240,1249` | Type casts `as "gramos" \| "mililitros"` |
| `tests/integration/test_stock_deduction.py:341` | `"unidad_medida": "mililitros"` |

## Migración de DB

En `app/core/database.py` se agregaron dos nuevas operaciones dentro de `_migrate_legacy_schema()`:

1. **`_resize_varchar_if_needed()`** — Amplía la columna `unidad_medida` de `VARCHAR(6)` a `VARCHAR(20)` en PostgreSQL. La columna fue creada originalmente por SQLModel con tamaño 6 (largo de "gramos"/"litros"), pero "mililitros" mide 10 caracteres. En SQLite no es necesario porque no impone largo en VARCHAR.

2. **`UPDATE ingredientes SET unidad_medida = 'mililitros' WHERE unidad_medida = 'litros'`** — Migra los registros existentes en la base de datos.

## Notas

- Las referencias a `UnidadEnum.LITROS` en `seed.py` y `scripts/demo/seed_example_data_fixed.py` no requieren cambios porque usan el miembro del enum, que ahora resuelve automáticamente a `"mililitros"`.
- El único "litros" que queda en el código es una descripción textual de producto (`"Gaseosa Coca Cola 1.5 litros"` en `seed.py`), que no es el campo `unidad_medida` y no debe cambiarse.

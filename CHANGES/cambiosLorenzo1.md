# Cambios realizados — Lorenzo (18/06/2026)

## 1. Archivos basura eliminados

Se borraron del repositorio los siguientes archivos/carpetas que no deberían estar trackeados:

- `__pycache__/` (12 carpetas con 59 archivos `.pyc`)
- `.venv/` (~4015 archivos del entorno virtual)
- `.env` (contenía secrets; se dejó `.env.example` como plantilla)
- `frontend/node_modules/` (~2000 dependencias npm)
- `frontend/dist/` (build output del frontend)

## 2. requirements.txt

| Cambio | Motivo |
|--------|--------|
| Agregado `cloudinary>=1.40.0` | Lo importa `app/modules/uploads/service.py`, faltaba |
| Agregado `pydantic>=2.0.0` | Se importa directamente pero solo estaba como dependencia transitiva |
| Agregado `python-multipart>=0.0.18` | FastAPI lo exige para endpoints que reciben `UploadFile` / form-data |
| Eliminado `mercadopago>=2.6.0` | No se usa; el módulo de pagos usa `httpx` directo a `api.mercadopago.com` |

## 3. .gitignore

Agregada la línea `*.tsbuildinfo` (caché de compilación de TypeScript que se generaba en la raíz).

## 4. app/core/config.py — Corrección crítica

**Problema:** `DATABASE_URL` era un `@computed_field @property` que construía la URL según `ENVIRONMENT`. Cualquier valor seteado en `.env` era ignorado.

**Solución:** Se reemplazó por un campo plano:
```python
DATABASE_URL: str = "sqlite:///./food_store.db"
```
Ahora se puede sobrescribir desde `.env` (ej: `DATABASE_URL=postgresql://...`).

Además se eliminaron los campos `postgres_user`, `postgres_password`, `postgres_db`, `postgres_host`, `postgres_port` porque solo se usaban en el computed field eliminado.

## 5. app/core/database.py — Detección de PostgreSQL

**Problema:** `_is_postgres` se calculaba como `settings.ENVIRONMENT != "development"`, lo cual era incorrecto (asumía que "no development" = PostgreSQL).

**Solución:** Ahora detecta por la URL real:
```python
_is_postgres = settings.DATABASE_URL.startswith("postgresql")
```

## 6. .env.example — Correcciones

| Línea | Antes | Después |
|-------|-------|---------|
| `MP_WEBHOOK_URL` | `MP_NOTIFICATION_URL` | `MP_WEBHOOK_URL` (nombre real que lee el código) |
| `CORS_ORIGINS` | Tenía una línea con `CORS_ORIGINS=...` | Eliminada (es un computed field, ponerlo en `.env` no tiene efecto) |

## 7. README.md — Correcciones

- Tabla de stack: `mercadopago (SDK Python)` → `httpx (hacia API MercadoPago)`
- Comando de seed: `python -m app.db.seed` → `python scripts/seed_test_users.py` (el módulo `app.db.seed` no existe)

---

## Cómo levantar el proyecto desde cero

```bash
# 1. Clonar y entrar
git clone <repo>
cd INTEGRADOR_FOOD_STORE-main

# 2. Backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000

# 3. Frontend (otra terminal)
cd frontend
npm install
npm run dev

# 4. Abrir http://localhost:5500
```

> Para usar PostgreSQL en vez de SQLite: descomentar `DATABASE_URL=postgresql://...` en `.env` y ejecutar `docker-compose up -d`.

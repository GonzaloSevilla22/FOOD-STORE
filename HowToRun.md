# How to Run — Food Store

## Requisitos
- Python 3.12+
- Node.js 18+
- VSCode

## 1. Abrir en VSCode
`File > Open Folder...` → seleccionar `INTEGRADOR_FOOD_STORE-main`

## 2. Backend (Terminal 1)
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

## 3. Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev
```

## 4. Abrir navegador
[http://localhost:5500](http://localhost:5500)

---

> **Usar PostgreSQL (opcional):** Ejecutar `docker-compose up -d` y editar `.env` con `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/food_store_db`. El contenedor expone el puerto **5433** en el host (mapeo `5433:5432` del `docker-compose.yml`).
>
> **Probar:** `pytest -v`

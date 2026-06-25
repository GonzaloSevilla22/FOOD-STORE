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

> **Usar PostgreSQL (opcional):** Editar `.env`, descomentar `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/food_store_db` y ejecutar `docker-compose up -d`.
>
> **Probar:** `pytest -v`

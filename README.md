# 🍔 Food Store

Aplicación web full-stack para la gestión integral de un negocio de comidas. Permite a los clientes explorar el catálogo, gestionar el carrito, realizar pedidos con pago integrado vía MercadoPago y hacer seguimiento en tiempo real del estado del pedido mediante WebSocket. Los administradores gestionan el catálogo, stock, pedidos y usuarios desde un panel centralizado con estadísticas y gráficos.

---

# 🍔 Video
Link: https://drive.google.com/file/d/1xhXvT1gB7uZow2GDkfbOObKJTsFHGE4_/view?usp=sharing

# Integrantes:
Juan Tomás Saez Ferreira, Lucas Norton, Mateo De Martino, Lorenzo Espetxe, Gonzalo Sevilla, Gabriel Kogan.


## Stack Tecnológico

| Capa       | Tecnología                         | Versión |
| ---------- | ---------------------------------- | ------- |
| Frontend   | React + TypeScript                 | 18.x + 5.x |
| Frontend   | Vite                               | 5.x     |
| Frontend   | TanStack Query                     | 5.x     |
| Frontend   | Axios                              | 1.x     |
| Frontend   | recharts                           | 3.x     |
| Frontend   | @mercadopago/sdk-react             | 1.x     |
| Backend    | FastAPI                            | 0.115+  |
| Backend    | SQLModel + SQLAlchemy              | 0.0.22+ |
| Backend    | PostgreSQL 15 / SQLite             | —       |
| Backend    | httpx (hacia API MercadoPago)       | 0.28+   |
| Backend    | cloudinary (SDK Python)            | 1.x     |
| Backend    | python-jose + bcrypt               | —       |
| Tests      | pytest + httpx + TestClient        | —       |

---

## Arquitectura

### Backend — Capas

```
Router → Service → Unit of Work → Repository → Model
                          ↓
                    WebSocket Manager (post-commit)
```

- **Router**: parsea request, valida schemas Pydantic, delega al Service.
- **Service**: lógica de negocio stateless, orquesta repos a través del UoW.
- **Unit of Work**: gestión de transacciones atómicas (commit/rollback automático).
- **Repository**: acceso a BD sin lógica de negocio. `BaseRepository[T]` genérico.
- **WebSocket Manager**: broadcast post-commit a suscriptores por pedido.

### Frontend — Estructura

```
pages/       → Páginas completas (rutas)
components/  → Componentes reutilizables (NavBar, Modal, ProtectedRoute)
context/     → AuthContext, CartContext (gestión de estado)
services/    → api.ts (cliente Axios con interceptors JWT)
models/      → Tipos TypeScript (Categoria, Producto, Ingrediente)
```

---

## Funcionalidades

### Backend API (prefijo `/api/v1`)

| Módulo         | Endpoints clave                                    | Auth     |
| -------------- | -------------------------------------------------- | -------- |
| **Auth**       | `POST /auth/login`, `/register`, `/refresh`, `/logout`, `GET /me` | JWT      |
| **Productos**  | CRUD + disponibilidad + stock + imágenes           | ADMIN/STOCK |
| **Categorías** | CRUD jerárquico con imagen Cloudinary              | ADMIN    |
| **Ingredientes** | CRUD con stock, alergenos, costo                 | ADMIN/STOCK |
| **Pedidos**    | CRUD + FSM (5 estados) + historial append-only     | CLIENT/ADMIN |
| **Pagos**      | Crear preferencia MP, webhook IPN, confirmar       | CLIENT/ADMIN |
| **Direcciones** | CRUD por usuario + dirección principal            | CLIENT   |
| **Usuarios**   | CRUD + asignación de roles RBAC                    | ADMIN    |
| **Estadísticas** | KPIs, ventas por período, top productos, ingresos | ADMIN    |
| **Uploads**    | Subir/eliminar imágenes en Cloudinary              | ADMIN    |

### Frontend — Roles y Vistas

| Rol       | Acceso principal                                             |
| --------- | ------------------------------------------------------------ |
| ADMIN     | Dashboard con KPIs y gráficos, CRUD completo, gestión de pedidos y stock |
| STOCK     | Gestión de stock y disponibilidad de productos e ingredientes |
| PEDIDOS   | Gestión operativa de pedidos con cambios de estado           |
| CLIENT    | Catálogo, carrito, checkout MP, historial de pedidos propio  |

### Máquina de Estados — Pedido

```
PENDIENTE → CONFIRMADO → EN_PREP → ENTREGADO (terminal)
    ↓            ↓           ↓
    └── CANCELADO (terminal) ──┘
```

---

## Instalación y Setup

### 1. Clonar el repositorio

```bash
git clone <repo-url>
cd INTEGRADOR_FOOD_STORE
```

### 2. Backend

```bash
# Crear entorno virtual e instalar dependencias
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # Linux/Mac

pip install -r requirements.txt

# Variables de entorno (copiar y completar)
cp .env.example .env
# Editar .env con tus credenciales de MP, Cloudinary, etc.

# Inicializar base de datos con seed data
python scripts/seed_test_users.py
# O ejecutando la app (seed automático al iniciar):
python -m uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev   # Arranca en http://localhost:5500
```

### 4. PostgreSQL (opcional — por defecto usa SQLite)

```bash
docker-compose up -d
# Configurar DATABASE_URL en .env para PostgreSQL
```


## Seed Data

Al iniciar la app, se cargan automáticamente:

| Entidad       | Datos                                          |
| ------------- | ---------------------------------------------- |
| **Roles**     | `ADMIN`, `STOCK`, `PEDIDOS`, `CLIENT`          |
| **Estados**   | `PENDIENTE`, `CONFIRMADO`, `EN_PREP`, `ENTREGADO`, `CANCELADO` |
| **FormasPago** | `MERCADOPAGO`, `EFECTIVO`, `TRANSFERENCIA`    |
| **Usuarios**  | `admin@test.com` / `admin123` (ADMIN)          |
|               | `cliente@test.com` / `cliente123` (CLIENT)     |
|               | `stock@test.com` / `stock123` (STOCK)          |
|               | `pedidos@test.com` / `pedidos123` (PEDIDOS)    |
| **Catálogo**  | Pizzas, Bebidas, Adicionales con productos     |
| **Ventas**    | 20 pedidos históricos con datos de ejemplo     |

---

## Documentación API

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health**: http://localhost:8000/health

---

## Tests

```bash
pytest -v
```

Los tests usan SQLite in-memory con fixtures reutilizables. Cubren:

- `tests/test_auth.py` — login, register, refresh, logout, rate limit
- `tests/test_pedidos.py` — creación, FSM, historial, cancelación
- `tests/test_pagos.py` — preferencias MP, webhook
- `tests/test_rate_limit.py` — rate limiting en auth
- `tests/test_exception_handlers.py` — manejo de errores

---

## Estructura del Proyecto

```
INTEGRADOR_FOOD_STORE/
├── app/
│   ├── core/               # Configuración, seguridad, UoW, WS Manager, seed, rate limit
│   ├── models/             # SQLModel entities (18 modelos)
│   └── modules/            # Módulos por feature (auth, productos, pedidos, etc.)
├── frontend/
│   └── src/
│       ├── pages/          # 25 páginas (Login, AdminDashboard, Carrito, etc.)
│       ├── components/     # NavBar, Modal, ProtectedRoute, PaymentButton
│       ├── context/        # AuthContext, CartContext
│       ├── services/       # api.ts (cliente Axios)
│       ├── models/         # Tipos TypeScript
│       └── assets/         # Recursos estáticos
├── tests/                  # Tests de integración (pytest)
├── main.py                 # Punto de entrada FastAPI
├── requirements.txt        # Dependencias Python
├── docker-compose.yml      # PostgreSQL container
└── pytest.ini              # Configuración de tests
```

---

## Patrones de Diseño

| Patrón               | Implementación                                         |
| -------------------- | ------------------------------------------------------ |
| Repository Pattern   | `BaseRepository[T]` genérico en `app/core/repository.py` |
| Unit of Work         | `UnitOfWork` context manager en `app/core/unit_of_work.py` |
| Service Layer        | Services stateless en cada módulo                      |
| Snapshot Pattern     | Precios/nombres inmutables en `DetallePedido`          |
| Soft Delete          | `deleted_at TIMESTAMPTZ` en modelos                    |
| Audit Trail          | `HistorialEstadoPedido` append-only                    |
| State Machine (FSM)  | 5 estados de pedido con transiciones validadas         |
| Idempotent Payments  | `idempotency_key` UUID para MercadoPago                |
| Connection Pool (WS) | `ConnectionManager` en `app/core/websocket.py`         |
| CDN Upload           | Cloudinary para imágenes de productos y categorías     |

---


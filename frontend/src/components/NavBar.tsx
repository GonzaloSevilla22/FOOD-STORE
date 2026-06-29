import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUIStore } from "../stores/uiStore";
import { useCartStore } from "../stores/cartStore";
import { ThemeToggle } from "./ThemeToggle";




export function NavBar(): JSX.Element {
  const { logout, isAdmin, isClient, isStock, isPedidos, user } = useAuth();
  const navigate = useNavigate();
  const open = useUIStore((s) => s.navMenuOpen);
  const toggleNavMenu = useUIStore((s) => s.toggleNavMenu);
  const cartCount = useCartStore((s) => s.itemCount());
  const location = useLocation();
  const isProductosPage = location.pathname === "/productos";
  // Solo clientes autenticados ven el acceso directo al carrito (un invitado no
  // debe ver un link que rebota a una ruta protegida).
  const showCarrito = isClient && !isProductosPage;

  return (
    <header className="border-b border-orange-100 bg-white/90 shadow-sm backdrop-blur transition-shadow duration-200 dark:border-gray-800 dark:bg-gray-800/90">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleNavMenu}
              className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-900 transition-all duration-150 hover:bg-orange-100 active:scale-95 dark:border-gray-500 dark:bg-gray-800/50 dark:text-orange-300 dark:hover:bg-gray-700"
            >
              <span className="text-base leading-none">☰</span>
              Menú
            </button>
            <span className="font-display text-lg font-bold tracking-tight text-orange-700 dark:text-orange-400">Food Store</span>
            {user && (
              <span className="hidden text-sm text-slate-500 sm:inline dark:text-gray-300">
                {user.nombre} {user.apellido}
              </span>
            )}
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => { logout(); navigate("/"); }}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-orange-600 active:scale-95"
              >
                Salir
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-orange-600"
            >
              Ingresar
            </NavLink>
          )}
        </div>

        <div className={`grid transition-all duration-200 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="overflow-hidden">
            <nav className="mt-4 flex flex-wrap gap-2">
            <NavLink
              to="/home"
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
              }
            >
              <span className="text-base leading-none">⌂</span>
              Home
            </NavLink>

            <NavLink
              to="/productos"
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
              }
            >
              <span className="text-base leading-none">📦</span>
              Productos
            </NavLink>

            {showCarrito && (
              <NavLink
                to="/carrito"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                }
              >
                <span className="text-base leading-none">🛒</span>
                Carrito
                {cartCount > 0 && (
                  <span className="ml-1 rounded-full bg-orange-600 px-1.5 py-0.5 text-xs font-semibold text-white dark:bg-orange-500">
                    {cartCount}
                  </span>
                )}
              </NavLink>
            )}

            {isClient && (
              <>
                <NavLink
                  to="/mis-pedidos"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                  }
                >
                  <span className="text-base leading-none">📋</span>
                  Mis Pedidos
                </NavLink>
                <NavLink
                  to="/perfil"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                  }
                >
                  <span className="text-base leading-none">👤</span>
                  Perfil
                </NavLink>
              </>
            )}

            {isAdmin && (
              <>
                <NavLink
                  to="/categorias"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                  }
                >
                  <span className="text-base leading-none">📁</span>
                  Categorías
                </NavLink>
                <NavLink
                  to="/ingredientes"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                  }
                >
                  <span className="text-base leading-none">🔬</span>
                  Ingredientes
                </NavLink>
                <NavLink
                  to="/ventas"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                  }
                >
                  <span className="text-base leading-none">💰</span>
                  Ventas
                </NavLink>

                <NavLink
                  to="/usuarios"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                  }
                >
                  <span className="text-base leading-none">👥</span>
                  Usuarios
                </NavLink>
                <NavLink
                  to="/gastos"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                  }
                >
                  <span className="text-base leading-none">📊</span>
                  Gastos
                </NavLink>
              </>
            )}

            {isStock && (
              <>
                <NavLink
                  to="/stock"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                  }
                >
                  <span className="text-base leading-none">📦</span>
                  Stock
                </NavLink>
                <NavLink
                  to="/ingredientes"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                  }
                >
                  <span className="text-base leading-none">🔬</span>
                  Ingredientes
                </NavLink>
              </>
            )}

            {isPedidos && (
              <>
                <NavLink
                  to="/ventas"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                  }
                >
                  <span className="text-base leading-none">💰</span>
                  Ventas
                </NavLink>
                <NavLink
                  to="/operaciones-pedidos"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                  }
                >
                  <span className="text-base leading-none">⏱</span>
                  Pedidos en vivo
                </NavLink>
              </>
            )}
            {isAdmin && (
              <NavLink
                to="/operaciones-pedidos"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                }
              >
                <span className="text-base leading-none">⏱</span>
                Pedidos en vivo
              </NavLink>
            )}
          </nav>
          </div>
        </div>
      </div>
    </header>
  );
}

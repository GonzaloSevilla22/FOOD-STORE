import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUIStore } from "../stores/uiStore";
import { useCartStore } from "../stores/cartStore";


function MenuIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function ProductsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

export function NavBar(): JSX.Element {
  const { logout, isAdmin, isClient, isStock, isPedidos, user } = useAuth();
  const open = useUIStore((s) => s.navMenuOpen);
  const toggleNavMenu = useUIStore((s) => s.toggleNavMenu);
  const cartCount = useCartStore((s) => s.itemCount());
  const showCarrito = !isAdmin && !isPedidos && !isStock;

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
              <MenuIcon />
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
              <button
                type="button"
                onClick={logout}
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
              <HomeIcon />
              Home
            </NavLink>

            <NavLink
              to="/productos"
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
              }
            >
              <ProductsIcon />
              Productos
            </NavLink>

            {showCarrito && (
              <NavLink
                to="/carrito"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                }
              >
                <CartIcon />
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
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Mis Pedidos
                </NavLink>
                <NavLink
                  to="/perfil"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                  }
                >
                  <UserIcon />
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
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Categorías
                </NavLink>
                <NavLink
                  to="/ingredientes"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                  }
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Ingredientes
                </NavLink>
                <NavLink
                  to="/ventas"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                  }
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Ventas
                </NavLink>

                <NavLink
                  to="/usuarios"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                  }
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  Usuarios
                </NavLink>
                <NavLink
                  to="/gastos"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                  }
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
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
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Stock
                </NavLink>
                <NavLink
                  to="/ingredientes"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                  }
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
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
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Ventas
                </NavLink>
                <NavLink
                  to="/operaciones-pedidos"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-orange-500 text-white shadow-sm" : "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"}`
                  }
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
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
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
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

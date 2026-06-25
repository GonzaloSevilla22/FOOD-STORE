import { Link } from "react-router-dom";

export function AdminDashboard(): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-orange-900 dark:text-orange-300">Panel de Administración</h1>
        <p className="mt-2 text-orange-700 dark:text-orange-300">Gestión completa del sistema Food Store</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link
          to="/categorias"
          className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 p-6 shadow-md transition hover:shadow-lg hover:border-blue-200"
        >
          <h2 className="mb-2 text-2xl font-bold text-blue-900 dark:text-blue-300">📂 Categorías</h2>
          <p className="text-blue-800 dark:text-blue-300">Administra categorías. Crea, edita, reordena y elimina.</p>
        </Link>

        <Link
          to="/productos"
          className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 p-6 shadow-md transition hover:shadow-lg hover:border-green-200"
        >
          <h2 className="mb-2 text-2xl font-bold text-green-900 dark:text-green-300">🛍️ Productos</h2>
          <p className="text-green-800 dark:text-green-300">Gestiona productos, precios, ingredientes y disponibilidad.</p>
        </Link>

        <Link
          to="/ingredientes"
          className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-900/20 p-6 shadow-md transition hover:shadow-lg hover:border-purple-200"
        >
          <h2 className="mb-2 text-2xl font-bold text-purple-900 dark:text-purple-300">🧂 Ingredientes</h2>
          <p className="text-purple-800 dark:text-purple-300">Administra ingredientes, alérgenos y stocks.</p>
        </Link>

        <Link
          to="/ventas"
          className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-900/20 p-6 shadow-md transition hover:shadow-lg hover:border-amber-200"
        >
          <h2 className="mb-2 text-2xl font-bold text-amber-900 dark:text-amber-300">💰 Ventas</h2>
          <p className="text-amber-800 dark:text-amber-300">Visualiza todas las ventas, historial de cambios y detalle completo.</p>
        </Link>

        <Link
          to="/operaciones-pedidos"
          className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-900/30 dark:to-rose-900/20 p-6 shadow-md transition hover:shadow-lg hover:border-rose-200"
        >
          <h2 className="mb-2 text-2xl font-bold text-rose-900 dark:text-rose-300">🍳 Pedidos en vivo</h2>
          <p className="text-rose-800 dark:text-rose-300">Gestioná pedidos en tiempo real, cambiá estados y monitoreá órdenes.</p>
        </Link>

        <Link
          to="/usuarios"
          className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/20 p-6 shadow-md transition hover:shadow-lg hover:border-red-200"
        >
          <h2 className="mb-2 text-2xl font-bold text-red-900 dark:text-red-300">👥 Usuarios</h2>
          <p className="text-red-800 dark:text-red-300">Gestiona usuarios, roles y permisos del sistema.</p>
        </Link>

        <Link
          to="/gastos"
          className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/30 dark:to-gray-700/20 p-6 shadow-md transition hover:shadow-lg hover:border-gray-200"
        >
          <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-300">📊 Gastos</h2>
          <p className="text-gray-800 dark:text-gray-300">Seguimiento de costos, proveedores y análisis financiero.</p>
        </Link>
      </div>
    </div>
  );
}

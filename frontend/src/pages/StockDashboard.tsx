import { Link } from "react-router-dom";

export function StockDashboard(): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-orange-900 dark:text-orange-300">Panel de Stock</h1>
        <p className="mt-2 text-orange-700 dark:text-orange-300">Control de inventario y disponibilidad de productos</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link to="/stock" className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 p-6 shadow-md transition hover:shadow-lg hover:border-green-200">
          <h2 className="mb-2 text-2xl font-bold text-green-900 dark:text-green-300">📦 Stock</h2>
          <p className="text-green-800 dark:text-green-300">Gestioná productos e ingredientes, actualizá cantidades y disponibilidad.</p>
        </Link>
        <Link to="/productos" className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 p-6 shadow-md transition hover:shadow-lg hover:border-blue-200">
          <h2 className="mb-2 text-2xl font-bold text-blue-900 dark:text-blue-300">🛍️ Productos</h2>
          <p className="text-blue-800 dark:text-blue-300">Visualizá y editá productos, precios e ingredientes.</p>
        </Link>
        <Link to="/ingredientes" className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-900/20 p-6 shadow-md transition hover:shadow-lg hover:border-purple-200">
          <h2 className="mb-2 text-2xl font-bold text-purple-900 dark:text-purple-300">🧂 Ingredientes</h2>
          <p className="text-purple-800 dark:text-purple-300">Visualizá y editá ingredientes, unidades y costos.</p>
        </Link>
      </div>

      <div className="mt-8 rounded-lg border border-green-100 dark:border-green-800 bg-green-50 dark:bg-green-900/30 p-6">
        <h3 className="mb-3 text-lg font-semibold text-green-900 dark:text-green-300">📋 Tu rol: STOCK</h3>
        <ul className="space-y-2 text-sm text-green-800 dark:text-green-300">
          <li>✓ Podés ver y editar el stock de productos e ingredientes</li>
          <li>✓ Podés cambiar la disponibilidad de productos</li>
          <li>✓ Podés editar productos (nombre, precio, descripción, ingredientes)</li>
          <li>✓ Podés ver y editar ingredientes</li>
          <li>✓ No podés crear ni eliminar productos, categorías o ingredientes</li>
          <li>✓ No podés gestionar usuarios ni roles</li>
        </ul>
      </div>
    </div>
  );
}

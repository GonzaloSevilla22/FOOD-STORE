import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

export function ClienteDashboard(): JSX.Element {
  return (
    <div className="space-y-4">
      <Helmet><title>Inicio | Food Store</title></Helmet>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-orange-900 dark:text-orange-300">Bienvenido a Food Store</h1>
        <p className="mt-2 text-orange-700 dark:text-orange-300">Descubre nuestros productos y realiza tu pedido</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/productos"
          className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/20 p-6 shadow-md transition hover:shadow-lg hover:border-orange-200 dark:hover:border-gray-600"
        >
          <h2 className="mb-2 text-2xl font-bold text-orange-900 dark:text-orange-300">🛍️ Explorar Productos</h2>
          <p className="text-orange-800 dark:text-orange-300">Navega nuestro catálogo completo de productos frescos y deliciosos.</p>
        </Link>

        <Link
          to="/carrito"
          className="rounded-2xl border border-green-100 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 p-6 shadow-md transition hover:shadow-lg hover:border-green-200 dark:hover:border-green-700"
        >
          <h2 className="mb-2 text-2xl font-bold text-green-900 dark:text-green-300">🛒 Mi Carrito</h2>
          <p className="text-green-800 dark:text-green-300">Revisa los productos que has seleccionado y completa tu compra.</p>
        </Link>

        <Link
          to="/mis-pedidos"
          className="rounded-2xl border border-blue-100 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/20 p-6 shadow-md transition hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-700"
        >
          <h2 className="mb-2 text-2xl font-bold text-blue-900 dark:text-blue-300">📦 Mis Pedidos</h2>
          <p className="text-blue-800 dark:text-blue-300">Visualiza el estado de tus pedidos y su historial de cambios.</p>
        </Link>

        <Link
          to="/perfil"
          className="rounded-2xl border border-purple-100 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/20 p-6 shadow-md transition hover:shadow-lg hover:border-purple-200 dark:hover:border-purple-700"
        >
          <h2 className="mb-2 text-2xl font-bold text-purple-900 dark:text-purple-300">👤 Mi Perfil</h2>
          <p className="text-purple-800 dark:text-purple-300">Administra tu información personal y direcciones de acceso.</p>
        </Link>
      </div>

      <div className="mt-8 rounded-lg border border-orange-100 dark:border-gray-500 bg-orange-50 dark:bg-gray-800/50 p-6">
        <h3 className="mb-3 text-lg font-semibold text-orange-900 dark:text-orange-300">💡 Tips</h3>
        <ul className="space-y-2 text-sm text-orange-800 dark:text-orange-300">
          <li>✓ Explora nuestro catálogo de productos desde la sección Productos</li>
          <li>✓ Agrega productos a tu carrito para comprar luego</li>
          <li>✓ Sigue el estado de tus pedidos en tiempo real</li>
          <li>✓ Actualiza tu perfil y direcciones desde Mi Perfil</li>
        </ul>
      </div>
    </div>
  );
}

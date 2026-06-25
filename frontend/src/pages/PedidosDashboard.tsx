import { Link } from "react-router-dom";

export function PedidosDashboard(): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-orange-900 dark:text-orange-300">Panel de Pedidos</h1>
        <p className="mt-2 text-orange-700 dark:text-orange-300">Gestión de pedidos en vivo y operaciones diarias</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link to="/ventas" className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-900/20 p-6 shadow-md transition hover:shadow-lg hover:border-amber-200">
          <h2 className="mb-2 text-2xl font-bold text-amber-900 dark:text-amber-300">💰 Ventas</h2>
          <p className="text-amber-800 dark:text-amber-300">Visualiza todas las ventas, historial de cambios y detalle completo.</p>
        </Link>
        <Link to="/operaciones-pedidos" className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-900/20 p-6 shadow-md transition hover:shadow-lg hover:border-amber-200">
          <h2 className="mb-2 text-2xl font-bold text-amber-900 dark:text-amber-300">🍳 Pedidos en vivo</h2>
          <p className="text-amber-800 dark:text-amber-300">Visualiza y gestiona pedidos entrantes, cambia estados y confirma órdenes.</p>
        </Link>
      </div>

      <div className="mt-8 rounded-lg border border-amber-100 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 p-6">
        <h3 className="mb-3 text-lg font-semibold text-amber-900 dark:text-amber-300">📋 Tu rol: PEDIDOS</h3>
        <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-300">
          <li>✓ Podés ver todos los pedidos del sistema</li>
          <li>✓ Podés avanzar pedidos a través de sus estados</li>
          <li>✓ Podés confirmar pedidos pendientes</li>
          <li>✓ No podés gestionar stock, usuarios ni roles</li>
        </ul>
      </div>
    </div>
  );
}

import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";

export function PedidosDashboard(): JSX.Element {
  return (
    <div className="space-y-6">
      <Helmet><title>Panel Pedidos | Food Store</title></Helmet>
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900 dark:text-brand-300">Panel de Pedidos</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">Gestión de pedidos en vivo y operaciones diarias</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link to="/ventas">
          <Card variant="interactive" padding="lg" className="h-full">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-slate-800 dark:text-gray-100">Ventas</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">Visualiza todas las ventas, historial de cambios y detalle completo.</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/operaciones-pedidos">
          <Card variant="interactive" padding="lg" className="h-full">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500 text-white shadow-md">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-slate-800 dark:text-gray-100">Pedidos en vivo</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">Visualiza y gestiona pedidos entrantes, cambia estados y confirma órdenes.</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      <Card variant="default" padding="lg">
        <div className="flex items-start gap-3">
          <Badge variant="solid" color="amber">PEDIDOS</Badge>
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-800 dark:text-gray-100">Tu rol</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-gray-300">
              <li>✓ Podés ver todos los pedidos del sistema</li>
              <li>✓ Podés avanzar pedidos a través de sus estados</li>
              <li>✓ Podés confirmar pedidos pendientes</li>
              <li>✓ No podés gestionar stock, usuarios ni roles</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

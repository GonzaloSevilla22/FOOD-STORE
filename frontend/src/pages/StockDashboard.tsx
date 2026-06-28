import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";

export function StockDashboard(): JSX.Element {
  return (
    <div className="space-y-6">
      <Helmet><title>Panel Stock | Food Store</title></Helmet>
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900 dark:text-brand-300">Panel de Stock</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">Control de inventario y disponibilidad de productos</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link to="/stock">
          <Card variant="interactive" padding="lg" className="h-full">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-600 text-white shadow-md">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-slate-800 dark:text-gray-100">Stock</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">Gestioná productos e ingredientes, actualizá cantidades y disponibilidad.</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/productos">
          <Card variant="interactive" padding="lg" className="h-full">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-slate-800 dark:text-gray-100">Productos</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">Visualizá y editá productos, precios e ingredientes.</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/ingredientes">
          <Card variant="interactive" padding="lg" className="h-full">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600 text-white shadow-md">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-slate-800 dark:text-gray-100">Ingredientes</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">Visualizá y editá ingredientes, unidades y costos.</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      <Card variant="default" padding="lg">
        <div className="flex items-start gap-3">
          <Badge variant="solid" color="green">STOCK</Badge>
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-800 dark:text-gray-100">Tu rol</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-gray-300">
              <li>✓ Podés ver y editar el stock de productos e ingredientes</li>
              <li>✓ Podés cambiar la disponibilidad de productos</li>
              <li>✓ Podés editar productos (nombre, precio, descripción, ingredientes)</li>
              <li>✓ Podés ver y editar ingredientes</li>
              <li>✗ No podés crear ni eliminar productos, categorías o ingredientes</li>
              <li>✗ No podés gestionar usuarios ni roles</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

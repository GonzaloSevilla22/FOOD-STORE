import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";

const links = [
  { to: "/categorias", label: "Categorías", desc: "Administra categorías. Crea, edita, reordena y elimina.", color: "bg-blue-500", icon: "folder" },
  { to: "/productos", label: "Productos", desc: "Gestiona productos, precios, ingredientes y disponibilidad.", color: "bg-green-600", icon: "box" },
  { to: "/ingredientes", label: "Ingredientes", desc: "Administra ingredientes, alérgenos y stocks.", color: "bg-purple-600", icon: "beaker" },
  { to: "/ventas", label: "Ventas", desc: "Visualiza todas las ventas, historial de cambios y detalle completo.", color: "bg-amber-500", icon: "cash" },
  { to: "/operaciones-pedidos", label: "Pedidos en vivo", desc: "Gestioná pedidos en tiempo real, cambiá estados y monitoreá órdenes.", color: "bg-rose-500", icon: "clock" },
  { to: "/usuarios", label: "Usuarios", desc: "Gestiona usuarios, roles y permisos del sistema.", color: "bg-red-600", icon: "users" },
  { to: "/gastos", label: "Gastos", desc: "Seguimiento de costos, proveedores y análisis financiero.", color: "bg-gray-600", icon: "chart" },
];

function LinkIcon({ icon, color }: { icon: string; color: string }) {
  const paths: Record<string, JSX.Element> = {
    folder: <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />,
    box: <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
    beaker: <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />,
    cash: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
    clock: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
    users: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />,
    chart: <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  };

  return (
    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color} text-white shadow-md`}>
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {paths[icon]}
      </svg>
    </div>
  );
}

export function AdminDashboard(): JSX.Element {
  return (
    <div className="space-y-6">
      <Helmet><title>Panel Admin | Food Store</title></Helmet>
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900 dark:text-brand-300">Panel de Administración</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">Gestión completa del sistema Food Store</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {links.map((link) => (
          <Link key={link.to} to={link.to}>
            <Card variant="interactive" padding="lg" className="h-full">
              <div className="flex items-start gap-4">
                <LinkIcon icon={link.icon} color={link.color} />
                <div>
                  <h2 className="font-display text-xl font-bold text-slate-800 dark:text-gray-100">{link.label}</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">{link.desc}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

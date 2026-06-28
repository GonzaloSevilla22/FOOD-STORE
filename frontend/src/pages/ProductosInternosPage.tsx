import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { productoService } from "../services/api";
import { useProductosWS } from "../hooks/useProductosWS";
import type { Producto } from "../models/Producto";

export function ProductosInternosPage(): JSX.Element {
  useProductosWS();
  const [search, setSearch] = useState("");

  const productosQuery = useQuery({
    queryKey: ["productos"],
    queryFn: () => productoService.getAll(0, 100, false),
  });

  const productos = (productosQuery.data?.data ?? []).filter(
    (p) =>
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (p.descripcion ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Helmet><title>Productos | Food Store</title></Helmet>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-orange-900 dark:text-orange-300">Productos</h1>
        <p className="mt-2 text-orange-700 dark:text-orange-300">Catálogo interno de productos</p>
      </div>

      <input
        type="text"
        placeholder="Buscar producto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md rounded border border-orange-200 dark:border-gray-500 px-4 py-2 text-sm focus:border-orange-400 focus:outline-none dark:bg-gray-800 dark:text-gray-100"
      />

      {productosQuery.isLoading ? (
        <p className="text-sm text-slate-600 dark:text-gray-300">Cargando productos...</p>
      ) : productosQuery.isError ? (
        <p className="text-sm text-red-600">Error al cargar productos.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {productos.length === 0 ? (
            <p className="col-span-full text-center text-slate-500 dark:text-gray-300">No se encontraron productos.</p>
          ) : (
            productos.map((p: Producto) => (
              <Link
                key={p.id}
                to={`/producto/${p.id}`}
                className="rounded-xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-5 shadow-sm transition hover:shadow-md hover:border-orange-200 dark:hover:border-gray-600 dark:border-gray-500"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-100">{p.nombre}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.disponible
                        ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300"
                        : "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300"
                    }`}
                  >
                    {p.disponible ? "Disponible" : "No disponible"}
                  </span>
                </div>
                {p.descripcion && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-gray-300 line-clamp-2">{p.descripcion}</p>
                )}
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="font-mono font-semibold text-orange-900 dark:text-orange-300">
                    ${Number(p.precio_base).toLocaleString("es-AR")}
                  </span>
                  <span className="text-slate-500 dark:text-gray-300">
                    Stock: {p.usa_stock_manual ? (p.stock_manual ?? 0) : (p.stock_disponible ?? "—")}
                  </span>
                </div>
                {p.categoria_nombre && (
                  <p className="mt-2 text-xs text-slate-400 dark:text-gray-300">{p.categoria_nombre}</p>
                )}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

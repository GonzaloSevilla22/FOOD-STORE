import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useCart } from "../context/CartContext";
import { useProductosWS } from "../hooks/useProductosWS";
import type { Categoria } from "../models/Categoria";
import type { Producto } from "../models/Producto";
import { categoriaService, cloudinaryThumb, getProductosPublic, reservarStock } from "../services/api";
import { SkeletonPage } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";

const FILTROS_KEY = "productos_cliente_filtros";

function loadFiltros() {
  try {
    const raw = sessionStorage.getItem(FILTROS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveFiltros(filtros: { search: string; categoriaFilter: string; soloDisponibles: boolean }) {
  sessionStorage.setItem(FILTROS_KEY, JSON.stringify(filtros));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}

function getImageUrl(producto: Producto): string {
  if (producto.imagenes_url && producto.imagenes_url.length > 0 && producto.imagenes_url[0]) {
    // Transformaciones Cloudinary (f_auto, q_auto, c_fill) — no-op si no es Cloudinary.
    return cloudinaryThumb(producto.imagenes_url[0], 600, 400);
  }

  return "https://images.unsplash.com/photo-1543332164-6e82f355badc?auto=format&fit=crop&w=800&q=80";
}

export function ProductosClientePage(): JSX.Element {
  const { agregarProducto, items } = useCart();
  const filtrosIniciales = loadFiltros();
  const [search, setSearch] = useState(filtrosIniciales.search ?? "");
  const [categoriaFilter, setCategoriaFilter] = useState(filtrosIniciales.categoriaFilter ?? "");
  const [soloDisponibles, setSoloDisponibles] = useState(filtrosIniciales.soloDisponibles ?? false);
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();

  const catIdParam = categoriaFilter ? parseInt(categoriaFilter, 10) : undefined;

  const productosQuery = useQuery({
    queryKey: ["productos", "cliente-catalogo", catIdParam],
    queryFn: () => getProductosPublic(0, 100, catIdParam),
    placeholderData: (prev) => prev,
  });

  const categoriasQuery = useQuery({
    queryKey: ["categorias", "cliente"],
    queryFn: () => categoriaService.getAll(0, 100),
  });

  const productos = productosQuery.data?.data ?? [];
  const categorias = categoriasQuery.data?.data ?? [];

  const filtrados = useMemo(() => {
    let items = productos;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((p) => p.nombre.toLowerCase().includes(q));
    }

    if (soloDisponibles) {
      items = items.filter((p) => {
        const stockOk = p.stock_disponible === null || p.stock_disponible > 0;
        return p.disponible && stockOk;
      });
    }
    return items;
  }, [productos, search, categoriaFilter, soloDisponibles]);

  useEffect(() => {
    saveFiltros({ search, categoriaFilter, soloDisponibles });
  }, [search, categoriaFilter, soloDisponibles]);

  useProductosWS({
    onEvent: (data) => {
      if (data && typeof data === "object" && "event" in data && (data.event === "PRODUCTO_UPDATED" || data.event === "INGREDIENTE_UPDATED")) {
        toast.info("Catálogo actualizado");
      }
    },
  });

  if (productosQuery.isLoading) {
    return <SkeletonPage />;
  }

  if (productosQuery.isError) {
    return <p className="text-red-600">No se pudieron cargar los productos.</p>;
  }

  if (productos.length === 0) {
    return <EmptyState icon="🍽️" title="Productos" description="No hay productos disponibles por ahora." />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-orange-900 dark:text-orange-300">Productos</h1>
          <p className="mt-1 text-sm text-slate-700 dark:text-gray-300">Explora el catálogo y agrega productos al carrito.</p>
        </div>
        <Link
          to="/carrito"
          className="relative rounded-lg border border-orange-200 dark:border-gray-500 bg-orange-50 dark:bg-gray-800/50 px-4 py-2 text-sm font-medium text-orange-900 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-gray-700"
        >
          Ver carrito
          {items.length > 0 && (
            <span className="absolute -right-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
              {items.reduce((sum, i) => sum + i.cantidad, 0)}
            </span>
          )}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-orange-200 dark:border-gray-500 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 placeholder-slate-400 focus:border-orange-400 focus:outline-none dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
        />
        <select
          value={categoriaFilter}
          onChange={(e) => setCategoriaFilter(e.target.value)}
          className="rounded-lg border border-orange-200 dark:border-gray-500 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 focus:border-orange-400 focus:outline-none dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">Todas las categorías</option>
          {categorias
            .filter((c: Categoria) => c.activo)
            .map((c: Categoria) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-orange-200 dark:border-gray-500 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-700 dark:text-gray-300 cursor-pointer hover:bg-orange-50 dark:hover:bg-gray-700">
          <input
            type="checkbox"
            checked={soloDisponibles}
            onChange={(e) => setSoloDisponibles(e.target.checked)}
            className="accent-orange-500"
          />
          Solo disponibles
        </label>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-gray-300">No se encontraron productos con esos filtros.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((producto) => {
            const stockDisponible = producto.stock_disponible;
            const tieneStock = stockDisponible === null || stockDisponible > 0;
            const puedeAgregar = producto.disponible && tieneStock;

            const deshabilitado = !puedeAgregar;
            return (
              <article
                key={producto.id}
                className={`flex h-full flex-col overflow-hidden rounded-xl border bg-white dark:bg-gray-800 shadow-sm transition-all duration-200 ${
                  deshabilitado
                    ? "border-slate-200 dark:border-gray-600 opacity-55 grayscale"
                    : "border-orange-100 dark:border-gray-500 hover:-translate-y-0.5 hover:shadow-md"
                }`}
              >
                <div className="relative">
                  <img
                    src={getImageUrl(producto)}
                    alt={producto.nombre}
                    className="h-44 w-full object-cover"
                    loading="lazy"
                  />
                  {deshabilitado && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="rounded-lg bg-red-600 px-3 py-1 text-sm font-bold text-white shadow-lg">Sin stock</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <h2 className="text-lg font-semibold text-orange-950 dark:text-orange-200">{producto.nombre}</h2>
                    <p className="mt-1 text-sm text-slate-700 dark:text-gray-300 line-clamp-2">{producto.descripcion || "Sin descripción"}</p>
                  </div>

                  <div className="space-y-1 text-sm text-slate-700 dark:text-gray-300">
                    <p className="font-semibold text-orange-900 dark:text-orange-300">{formatCurrency(Number(producto.precio_base))}</p>
                    <p>
                      Estado:{" "}
                      <span className={puedeAgregar ? "font-medium text-green-700 dark:text-green-300" : "font-medium text-red-700 dark:text-red-300"}>
                        {puedeAgregar ? "Disponible" : "Sin stock"}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={!puedeAgregar || addingIds.has(producto.id)}
                    onClick={async () => {
                      setAddingIds((prev) => new Set(prev).add(producto.id));
                      try {
                        await reservarStock(producto.id, 1);
                        agregarProducto({
                          producto_id: producto.id,
                          nombre: producto.nombre,
                          precio: Number(producto.precio_base),
                          cantidad: 1,
                          imagen: producto.imagenes_url?.[0] ?? undefined,
                        });
                        toast.success("Producto agregado al carrito");
                      } catch {
                        toast.error("Sin stock disponible");
                      } finally {
                        setAddingIds((prev) => {
                          const next = new Set(prev);
                          next.delete(producto.id);
                          return next;
                        });
                      }
                    }}
                    className="mt-auto rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-gray-600 bg-orange-500 dark:bg-orange-600 hover:bg-orange-600 dark:hover:bg-orange-700"
                  >
                    {addingIds.has(producto.id) ? "Agregando..." : (puedeAgregar ? "Agregar al carrito" : "No disponible")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { categoriaService, ingredienteService, productoService } from "../services/api";
import { SkeletonPage } from "../components/Skeleton";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function ProductDetailPage(): JSX.Element {
  const params = useParams();
  const productoId = Number(params.productoId);
  const { isAdmin, isStock } = useAuth();
  const queryClient = useQueryClient();

  const [imagenUrls, setImagenUrls] = useState<string[]>([]);
  const [nuevaImagenUrl, setNuevaImagenUrl] = useState("");
  const [editandoImagen, setEditandoImagen] = useState(false);
  const [guardandoImagen, setGuardandoImagen] = useState(false);

  const productoQuery = useQuery({
    queryKey: ["productos", productoId],
    queryFn: () => productoService.getById(productoId),
    enabled: Number.isFinite(productoId),
  });

  const ingredientesQuery = useQuery({
    queryKey: ["ingredientes", "detail"],
    queryFn: () => ingredienteService.getAll(0, 100, false),
  });

  const categoriasQuery = useQuery({
    queryKey: ["categorias", "detail"],
    queryFn: () => categoriaService.getAll(0, 100, false),
  });

  const ingredienteMap = useMemo(() => {
    return new Map((ingredientesQuery.data?.data ?? []).map((ingrediente) => [ingrediente.id, ingrediente]));
  }, [ingredientesQuery.data]);

  const categoriaMap = useMemo(() => {
    return new Map((categoriasQuery.data?.data ?? []).map((categoria) => [categoria.id, categoria.nombre]));
  }, [categoriasQuery.data]);

  const producto = productoQuery.data;
  const categoriaNombre = producto?.categoria_nombre ?? (producto?.categoria_id ? categoriaMap.get(producto.categoria_id) : null);
  const cantidadIngredientes = producto?.ingredientes.length ?? 0;
  const margenBase = producto ? producto.margen_estimado : 0;

  const handleGuardarImagen = async (): Promise<void> => {
    if (!producto) return;
    setGuardandoImagen(true);
    try {
      const urls = imagenUrls.filter(Boolean);
      await productoService.update(producto.id, { imagenes_url: urls.length > 0 ? urls : null });
      queryClient.invalidateQueries({ queryKey: ["productos", productoId] });
      setEditandoImagen(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error al guardar la imagen";
      toast.error(msg);
    } finally {
      setGuardandoImagen(false);
    }
  };

  const handleAgregarImagenUrl = (): void => {
    const trimmed = nuevaImagenUrl.trim();
    if (trimmed && !imagenUrls.includes(trimmed)) {
      setImagenUrls([...imagenUrls, trimmed]);
      setNuevaImagenUrl("");
    }
  };

  const handleEliminarImagenUrl = (index: number): void => {
    setImagenUrls(imagenUrls.filter((_, i) => i !== index));
  };

  return (
    <section className="rounded-3xl border border-orange-100 dark:border-gray-500 bg-white/90 dark:bg-gray-800/90 p-5 shadow-sm backdrop-blur">
      <Helmet><title>{`${producto?.nombre ?? "Producto"} | Food Store`}</title></Helmet>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-700 dark:text-orange-300">Detalle de producto</p>
          <h1 className="text-3xl font-semibold text-orange-950 dark:text-orange-200">{producto?.nombre ?? "Producto"}</h1>
        </div>
        <Link
          to="/productos"
          className="rounded-full border border-orange-200 dark:border-gray-500 bg-orange-50 dark:bg-gray-800/50 px-4 py-2 text-sm font-medium text-orange-900 dark:text-orange-300"
        >
          Volver a productos
        </Link>
      </div>

      {productoQuery.isLoading ? <SkeletonPage /> : null}
      {productoQuery.isError ? (
        <p className="rounded-xl bg-red-100 dark:bg-red-900/50 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          No se pudo cargar el producto.
        </p>
      ) : null}

      {producto && producto.imagenes_url && producto.imagenes_url.length > 0 ? (
        <div className="mb-5 grid grid-cols-2 gap-3 overflow-hidden rounded-2xl">
          {producto.imagenes_url.slice(0, 4).map((url, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-orange-100 dark:border-gray-500">
              <img
                src={url}
                alt={`${producto.nombre} ${i + 1}`}
                className="h-40 w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          ))}
        </div>
      ) : null}

      {(isAdmin || isStock) && producto ? (
        <div className="mb-5 rounded-2xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-300">Imágenes del producto</h3>
            {!editandoImagen ? (
              <button
                type="button"
                onClick={() => { setImagenUrls(producto.imagenes_url ?? []); setEditandoImagen(true); }}
                className="rounded bg-orange-500 dark:bg-orange-600 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600"
              >
                Editar imágenes
              </button>
            ) : null}
          </div>
          {editandoImagen ? (
            <div className="mt-3 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevaImagenUrl}
                  onChange={(e) => setNuevaImagenUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAgregarImagenUrl(); } }}
                  placeholder="URL de la imagen..."
                  className="flex-1 rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAgregarImagenUrl}
                  className="rounded bg-orange-500 dark:bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600"
                >
                  Agregar
                </button>
              </div>
              {imagenUrls.length > 0 ? (
                <div className="space-y-2">
                  {imagenUrls.map((url, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-orange-100 dark:border-gray-500 p-2">
                      <img
                        src={url}
                        alt={`Imagen ${i + 1}`}
                        className="h-12 w-12 flex-shrink-0 rounded object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <span className="flex-1 truncate text-xs text-slate-600 dark:text-gray-300">{url}</span>
                      <button
                        type="button"
                        onClick={() => handleEliminarImagenUrl(i)}
                        className="rounded bg-red-100 dark:bg-red-900/50 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-200"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 dark:text-gray-300">Sin imágenes. Agregá URLs arriba.</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGuardarImagen}
                  disabled={guardandoImagen}
                  className="rounded bg-orange-500 dark:bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {guardandoImagen ? "Guardando..." : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditandoImagen(false)}
                  disabled={guardandoImagen}
                  className="rounded border border-orange-200 dark:border-gray-500 bg-orange-50 dark:bg-gray-800/50 px-4 py-2 text-sm font-medium text-orange-900 dark:text-orange-300 hover:bg-orange-100 dark:bg-gray-700 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {producto ? (
        <div className="grid gap-5 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-orange-50/60 dark:bg-gray-800/50 p-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-orange-900 dark:text-orange-300">
                <span className="rounded-full bg-white dark:bg-gray-800 px-3 py-1 font-medium shadow-sm">
                  {producto.activo ? "Activo" : "Inactivo"}
                </span>
                <span className="rounded-full bg-white dark:bg-gray-800 px-3 py-1 font-medium shadow-sm">
                  {producto.disponible ? "Disponible" : "No disponible"}
                </span>
                <span className="rounded-full bg-white dark:bg-gray-800 px-3 py-1 font-medium shadow-sm">
                  {producto.usa_stock_manual ? "Stock manual" : "Stock derivado"}
                </span>
                <span className="rounded-full bg-white dark:bg-gray-800 px-3 py-1 font-medium shadow-sm">
                  {cantidadIngredientes > 0 ? `${cantidadIngredientes} ingredientes` : "Sin ingredientes"}
                </span>
              </div>
              <p className="mt-4 text-sm text-slate-600 dark:text-gray-300">{producto.descripcion || "Sin descripción"}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Precio base" value={formatMoney(producto.precio_base)} />
              <MetricCard label="Costo ingredientes" value={formatMoney(producto.costo_total_ingredientes)} />
              <MetricCard label="Precio sugerido" value={formatMoney(producto.precio_sugerido)} />
              <MetricCard label="Margen estimado" value={formatMoney(margenBase)} />
            </div>

            <div className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-4">
              <h2 className="text-lg font-semibold text-orange-950 dark:text-orange-200">Ingredientes</h2>
              {producto.ingredientes.length > 0 ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-orange-100 dark:border-gray-500">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-orange-100 dark:bg-gray-700 text-left text-orange-900 dark:text-orange-300">
                      <tr>
                        <th className="border px-3 py-2">Ingrediente</th>
                        <th className="border px-3 py-2">Cantidad</th>
                        <th className="border px-3 py-2">Unidad</th>
                        <th className="border px-3 py-2">Opcional</th>
                      </tr>
                    </thead>
                    <tbody>
                      {producto.ingredientes.map((ingrediente) => {
                        const ingredienteNombre = ingredienteMap.get(ingrediente.ingrediente_id)?.nombre ?? `#${ingrediente.ingrediente_id}`;
                        return (
                          <tr key={ingrediente.ingrediente_id} className="bg-white dark:bg-gray-800">
                            <td className="border px-3 py-2">{ingredienteNombre}</td>
                            <td className="border px-3 py-2">{formatQuantity(ingrediente.cantidad)}</td>
                            <td className="border px-3 py-2">{ingrediente.unidad_simbolo ?? ""}</td>
                            <td className="border px-3 py-2">{ingrediente.es_opcional ? "Sí" : "No"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600 dark:text-gray-300">Este producto no usa ingredientes.</p>
              )}
            </div>
          </div>

          <aside className="space-y-4 rounded-2xl border border-orange-100 dark:border-gray-500 bg-gradient-to-b from-orange-50 to-white dark:from-gray-800 dark:to-gray-800 p-4">
            <h2 className="text-lg font-semibold text-orange-950 dark:text-orange-200">Resumen</h2>
            <SummaryLine label="Categoría" value={categoriaNombre ?? "Sin categoría"} />
            <SummaryLine label="Modo stock" value={producto.usa_stock_manual ? "Manual" : "Derivado"} />
            <SummaryLine label="Stock manual" value={producto.stock_manual !== null ? String(producto.stock_manual) : "No definido"} />
            <SummaryLine label="Stock calculado" value={producto.stock_disponible !== null ? String(producto.stock_disponible) : "No definido"} />
            <SummaryLine label="Costo compra manual" value={producto.costo_compra_manual !== null ? formatMoney(producto.costo_compra_manual) : "No definido"} />
            <SummaryLine label="Tiempo preparación" value={producto.tiempo_prep_min !== null ? `${producto.tiempo_prep_min} min` : "No definido"} />
            <SummaryLine label="Estado" value={producto.activo ? "Activo" : "Inactivo"} />
            <SummaryLine label="Disponibilidad" value={producto.disponible ? "Disponible" : "No disponible"} />
            <SummaryLine label="Precio sugerido" value={formatMoney(producto.precio_sugerido)} />
            <SummaryLine label="Costo total" value={formatMoney(producto.costo_total_ingredientes)} />
            <SummaryLine label="Margen estimado" value={formatMoney(producto.margen_estimado)} />
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-orange-700 dark:text-orange-300">{label}</p>
      <p className="mt-2 text-xl font-semibold text-orange-950 dark:text-orange-200">{value}</p>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-orange-700 dark:text-orange-300">{label}</p>
      <p className="mt-1 text-sm font-medium text-orange-950 dark:text-orange-200">{value}</p>
    </div>
  );
}

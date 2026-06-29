import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useCartStore } from "../stores/cartStore";
import { useProductosWS } from "../hooks/useProductosWS";
import type { Categoria } from "../models/Categoria";
import type { Producto } from "../models/Producto";
import { categoriaService, cloudinaryThumb, getProductosPublic } from "../services/api";
import { SkeletonPage } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Toggle } from "../components/ui/Toggle";
import { SidebarCart } from "../components/SidebarCart";

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
    return cloudinaryThumb(producto.imagenes_url[0], 600, 400);
  }
  // Sin imagen propia: usamos una imagen acorde a su categoría (no una pizza genérica).
  return getCategoryImage(producto.categoria_nombre ?? "");
}

function getCategoryEmoji(nombre: string): string {
  const n = nombre.toLowerCase();
  if (n.includes("pizza")) return "🍕";
  if (n.includes("bebida")) return "🥤";
  if (n.includes("adicional")) return "🧀";
  if (n.includes("empanada")) return "🥟";
  if (n.includes("hamburgues")) return "🍔";
  if (n.includes("pasta")) return "🍝";
  if (n.includes("milanesa")) return "🍖";
  if (n.includes("ensalada")) return "🥗";
  if (n.includes("postre")) return "🍰";
  if (n.includes("especial")) return "✨";
  if (n.includes("tradicional")) return "📜";
  if (n.includes("lomo")) return "🥩";
  return "📦";
}

function getCategoryImage(nombre: string): string {
  const n = nombre.toLowerCase();
  if (n.includes("pizza")) return "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80";
  if (n.includes("bebida")) return "https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=800&q=80";
  if (n.includes("adicional")) return "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80";
  if (n.includes("empanada")) return "https://loremflickr.com/800/450/empanadas?lock=11";
  if (n.includes("hamburgues")) return "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80";
  if (n.includes("pasta")) return "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80";
  if (n.includes("milanesa")) return "https://images.unsplash.com/photo-1599921841143-819065a55cc6?auto=format&fit=crop&w=800&q=80";
  if (n.includes("ensalada")) return "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80";
  if (n.includes("postre")) return "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=800&q=80";
  if (n.includes("lomo")) return "/categorias/lomo.jpg";
  if (n.includes("especial")) return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80";
  if (n.includes("tradicional")) return "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80";
  return "https://images.unsplash.com/photo-1543332164-6e82f355badc?auto=format&fit=crop&w=800&q=80";
}

type CategoryGroup = {
  key: string;
  nombre: string;
  productos: Producto[];
};

export function ProductosClientePage(): JSX.Element {
  const { agregarProducto } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const itemCount = useCartStore((s) => s.itemCount());
  const filtrosIniciales = loadFiltros();
  const [search, setSearch] = useState(filtrosIniciales.search ?? "");
  const [categoriaFilter, setCategoriaFilter] = useState(filtrosIniciales.categoriaFilter ?? "");
  const [soloDisponibles, setSoloDisponibles] = useState(filtrosIniciales.soloDisponibles ?? false);
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set());
  const [cartOpen, setCartOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
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

  const grupos = useMemo<CategoryGroup[]>(() => {
    const map = new Map<string, CategoryGroup>();
    for (const p of filtrados) {
      const key = p.categoria_id ? `cat-${p.categoria_id}` : "sin-categoria";
      if (!map.has(key)) {
        map.set(key, {
          key,
          nombre: p.categoria_nombre ?? "Sin categoría",
          productos: [],
        });
      }
      map.get(key)!.productos.push(p);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === "sin-categoria" ? 1 : b === "sin-categoria" ? -1 : a.localeCompare(b)))
      .map(([, g]) => g);
  }, [filtrados]);

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

  const toggleCategory = useCallback((key: string) => {
    setExpandedCategories((prev) => {
      if (prev.has(key)) return new Set();
      return new Set([key]);
    });
  }, []);

  const handleAddToCart = async (producto: Producto) => {
    // Invitados: pueden ver el catálogo pero no agregar al carrito.
    // Se les ofrece iniciar sesión o registrarse, conservando el destino (/productos).
    if (!isAuthenticated) {
      toast.warning("Necesitás una cuenta para agregar al carrito", {
        description: "Iniciá sesión o registrate para continuar con tu pedido.",
        duration: 6000,
        action: {
          label: "Iniciar sesión",
          onClick: () => navigate("/login?redirect=/productos"),
        },
        cancel: {
          label: "Crear cuenta",
          onClick: () => navigate("/register?redirect=/productos"),
        },
      });
      return;
    }
    if (addingIds.has(producto.id)) return;
    const stockOk = producto.stock_disponible === null || producto.stock_disponible > 0;
    if (!producto.disponible || !stockOk) {
      toast.error("Sin stock disponible");
      return;
    }
    setAddingIds((prev) => new Set(prev).add(producto.id));
    try {
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
  };

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
      <Helmet><title>Catálogo | Food Store</title></Helmet>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900 dark:text-brand-300">Productos</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">Explora el catálogo y agrega productos al carrito.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCartOpen(true)}
          className="relative"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
          Ver carrito
          {itemCount > 0 && (
            <span className="absolute -right-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-400 text-xs font-bold text-white">
              {itemCount}
            </span>
          )}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <Input
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefixIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
        <Select
          value={categoriaFilter}
          onChange={(e) => setCategoriaFilter(e.target.value)}
          options={categorias
            .filter((c: Categoria) => c.activo)
            .map((c: Categoria) => ({ value: String(c.id), label: c.nombre }))}
          placeholder="Todas las categorías"
        />
        <Toggle
          label="Solo disponibles"
          checked={soloDisponibles}
          onChange={setSoloDisponibles}
        />
      </div>

      {grupos.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-gray-300">No se encontraron productos con esos filtros.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {grupos.map((grupo) => {
            const isExpanded = expandedCategories.has(grupo.key);
            return (
              <div
                key={grupo.key}
                className={`overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.04)] dark:border-surface-border dark:bg-surface-card transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                  isExpanded ? "col-span-full" : "col-span-1"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleCategory(grupo.key)}
                  className={`group relative w-full overflow-hidden text-left transition-all duration-300 active:scale-[0.98] ${
                    isExpanded ? "aspect-[4/1]" : "aspect-[4/3]"
                  }`}
                >
                  <img
                    src={getCategoryImage(grupo.nombre)}
                    alt={grupo.nombre}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      const fb = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80";
                      if (e.currentTarget.src !== fb) e.currentTarget.src = fb;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
                    <span className="font-display text-lg font-bold text-white drop-shadow-sm">
                      {grupo.nombre}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
                      <span className="text-[13px] leading-none">{getCategoryEmoji(grupo.nombre)}</span>
                      <span className="tabular-nums">{grupo.productos.length}</span>
                    </span>
                  </div>
                  <div className={`absolute right-3 top-3 text-white/80 transition-transform duration-300 ${isExpanded ? "rotate-45" : "rotate-0"}`}>
                    <svg className="h-5 w-5 drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </button>

                <div
                  className="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
                  style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden min-h-0">
                    <div className="border-t border-gray-100 dark:border-surface-border" />
                    <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
                      {grupo.productos.map((producto, index) => {
                        const stockDisponible = producto.stock_disponible;
                        const tieneStock = stockDisponible === null || stockDisponible > 0;
                        const puedeAgregar = producto.disponible && tieneStock;
                        const deshabilitado = !puedeAgregar;
                        const isFeatured = index === 0;

                        const cardDelay = index * 50;
                        const cardStyle = {
                          transitionDelay: isExpanded ? `${cardDelay}ms` : "0ms",
                          transitionProperty: "transform, opacity",
                          transitionDuration: "300ms",
                          transitionTimingFunction: "cubic-bezier(0.4,0,0.2,1)",
                        } as React.CSSProperties;

                        return (
                          <div
                            key={producto.id}
                            className={`${isFeatured ? "sm:col-span-2 sm:row-span-2" : ""} ${
                              isExpanded ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-[0.97] opacity-0"
                            }`}
                            style={cardStyle}
                          >
                            <Card
                              variant={deshabilitado ? "default" : "interactive"}
                              padding="none"
                              className={`flex h-full cursor-pointer flex-col overflow-hidden ${deshabilitado ? "opacity-55 grayscale" : ""}`}
                              onClick={() => handleAddToCart(producto)}
                            >
                              <div className="relative">
                                <img
                                  src={getImageUrl(producto)}
                                  alt={producto.nombre}
                                  className={`w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10 ${isFeatured ? "h-72 sm:h-full" : "h-44"}`}
                                  loading="lazy"
                                  onError={(e) => {
                                    const fallback = getCategoryImage(producto.categoria_nombre ?? "");
                                    if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                                  }}
                                />
                                {deshabilitado ? (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                    <span className="rounded-lg bg-red-600 px-3 py-1 text-sm font-bold text-white shadow-lg">Sin stock</span>
                                  </div>
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center bg-brand-500/60 opacity-0 transition-opacity duration-200 hover:opacity-100">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg">
                                      <svg className="h-7 w-7 text-brand-500 dark:text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                      </svg>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-1 flex-col gap-2 p-4">
                                <div>
                                  <h2 className="font-display text-lg font-semibold text-brand-950 dark:text-brand-200">{producto.nombre}</h2>
                                  <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">{producto.descripcion || "Sin descripción"}</p>
                                </div>

                                <div className="mt-auto flex items-center justify-between">
                                  <span className="font-bold text-brand-600 dark:text-brand-400">{formatCurrency(Number(producto.precio_base))}</span>
                                  <Badge variant="solid" color={puedeAgregar ? "green" : "red"}>{puedeAgregar ? "Disponible" : "Sin stock"}</Badge>
                                </div>
                              </div>
                            </Card>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SidebarCart open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { getPedidosWebSocketUrl, listPedidos, type PedidoPublic } from "../services/api";
import { SkeletonPage } from "../components/Skeleton";
import { Badge } from "../components/Badge";
import { useWebSocketChannel } from "../hooks/useOrderStatusWS";
import { useAuth } from "../context/AuthContext";
import { useAuthStore } from "../stores/authStore";
import { useCart } from "../context/CartContext";
import { ALL_ESTADOS } from "../constants/ui";

export function MisPedidosPage(): JSX.Element {
  const [pedidos, setPedidos] = useState<PedidoPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchId, setSearchId] = useState("");
  const [filterEstado, setFilterEstado] = useState("");

  const { token } = useAuth();
  const tabId = useAuthStore((s) => s.tabId);

  const cargarPedidos = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await listPedidos(0, 50);
      setPedidos(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarPedidos();
  }, [cargarPedidos]);

  const [searchParams, setSearchParams] = useSearchParams();
  const { limpiarCarrito } = useCart();

  useEffect(() => {
    if (searchParams.get("payment") === "success") {
      sessionStorage.removeItem("prev_cart");
      sessionStorage.removeItem("checkout_pedido_id");
      limpiarCarrito();
      searchParams.delete("payment");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, limpiarCarrito]);

  useWebSocketChannel({
    channel: "mis-pedidos",
    enabled: Boolean(token),
    buildUrl: () => (token ? getPedidosWebSocketUrl(token, tabId) : null),
    onEvent: cargarPedidos,
    onReconnect: cargarPedidos,
  });

  const filtrados = useMemo(() => {
    let items = pedidos;
    if (searchId.trim()) {
      const id = parseInt(searchId, 10);
      if (!Number.isNaN(id)) {
        items = items.filter((p) => p.id === id);
      }
    }
    if (filterEstado) {
      items = items.filter((p) => p.estado_codigo === filterEstado);
    }
    return items;
  }, [pedidos, searchId, filterEstado]);

  if (loading) {
    return <SkeletonPage />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-100 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-6">
        <p className="text-red-700 dark:text-red-300">Error: {error}</p>
      </div>
    );
  }

  if (pedidos.length === 0) {
    return (
      <div className="rounded-lg border border-orange-100 dark:border-gray-500 bg-white/90 dark:bg-gray-800/90 p-8 text-center">
        <p className="text-2xl font-bold text-orange-900 dark:text-orange-300">No tienes pedidos aún</p>
        <p className="mt-2 text-orange-700 dark:text-orange-300">Comienza a comprar desde nuestro catálogo</p>
        <a
          href="/productos"
          className="mt-4 inline-block rounded bg-orange-500 dark:bg-orange-600 px-6 py-2 font-medium text-white hover:bg-orange-600"
        >
          Ver Productos
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Helmet><title>Mis Pedidos | Food Store</title></Helmet>
      <h1 className="text-3xl font-bold text-orange-900 dark:text-orange-300">Mis Pedidos</h1>

      <div className="flex flex-wrap gap-3">
        <input
          type="number"
          placeholder="Buscar por # de pedido"
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-orange-200 dark:border-gray-500 bg-white px-3 py-2 text-sm text-slate-800 dark:text-gray-100 placeholder-slate-400 focus:border-orange-400 focus:outline-none dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
        />
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className="rounded-lg border border-orange-200 dark:border-gray-500 bg-white px-3 py-2 text-sm text-slate-800 dark:text-gray-100 focus:border-orange-400 focus:outline-none dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">Todos los estados</option>
          {ALL_ESTADOS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-gray-300">No se encontraron pedidos con esos filtros.</p>
      ) : (
        <div className="space-y-3">
          {filtrados.map((pedido) => {
            return (
            <Link
              key={pedido.id}
              to={`/cliente/pedido/${pedido.id}`}
              className="block rounded-lg border border-orange-100 dark:border-gray-500 bg-white/90 dark:bg-gray-800/90 p-4 shadow-sm transition hover:shadow-md hover:border-orange-200 dark:hover:border-gray-600 dark:border-gray-500"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-orange-900 dark:text-orange-300">Pedido #{pedido.id}</h3>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    {pedido.created_at
                      ? new Date(pedido.created_at).toLocaleDateString("es-AR")
                      : "Sin fecha"}
                  </p>
                  {pedido.estado_codigo === "CANCELADO" && (
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {pedido.motivo?.startsWith("Cancelaste") ? (
                        <p>Cancelaste el pedido</p>
                      ) : (
                        <p>
                          Pedido cancelado por Food Store
                          {pedido.motivo && `: ${pedido.motivo}`}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <Badge estado={pedido.estado_codigo} />
                    <p className="mt-2 font-bold text-orange-900 dark:text-orange-300">${Number(pedido.total).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </Link>
          );})}
        </div>
      )}

      
    </div>
  );
}



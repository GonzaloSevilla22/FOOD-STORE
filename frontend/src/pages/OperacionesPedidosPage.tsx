import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { RealtimeBadge } from "../components/RealtimeBadge";
import { useAdminOrdersFeed } from "../hooks/useOrderStatusWS";
import { toast } from "sonner";
import {
  cambiarEstadoPedido,
  listPedidos,
  type PedidoPublic,
  type PedidosFilter,
} from "../services/api";
import { SkeletonPage } from "../components/Skeleton";
import { actionLabels } from "../constants/ui";
import { Badge } from "../components/Badge";

const FILTROS_KEY = "operaciones_pedidos_filtros";

function loadFiltros() {
  try {
    const raw = sessionStorage.getItem(FILTROS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveFiltros(filtros: Record<string, string>) {
  sessionStorage.setItem(FILTROS_KEY, JSON.stringify(filtros));
}

function asNumber(value: number | string): number {
  return Number(value ?? 0);
}

const FILTER_ESTADOS = ["", "PENDIENTE", "CONFIRMADO", "EN_PREP", "A_ENTREGAR", "ESPERANDO_CLIENTE", "ENTREGADO", "CANCELADO"] as const;
const FORMAS_PAGO = ["", "EFECTIVO", "MERCADOPAGO", "TRANSFERENCIA"] as const;

function puedeCancelar(estado: string, _isAdmin: boolean): boolean {
  return ["PENDIENTE", "CONFIRMADO", "EN_PREP", "A_ENTREGAR"].includes(estado);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function OperacionesPedidosPage(): JSX.Element {
  const { hasRole } = useAuth();
  const canOperate = hasRole("ADMIN") || hasRole("PEDIDOS");
  const isAdmin = hasRole("ADMIN");

  // ---- Stats (all pedidos) ----
  const [allPedidos, setAllPedidos] = useState<PedidoPublic[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const cargarAllPedidos = useCallback(async (): Promise<void> => {
    setStatsLoading(true);
    try {
      const data = await listPedidos(0, 100);
      setAllPedidos(data.data || []);
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : "Error cargando pedidos");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarAllPedidos();
  }, [cargarAllPedidos]);

  const stats = useMemo(() => {
    const pendientes = allPedidos.filter((p) => p.estado_codigo === "PENDIENTE");
    const enPreparacion = allPedidos.filter((p) => p.estado_codigo === "EN_PREP");
    const entregados = allPedidos.filter((p) => p.estado_codigo === "ENTREGADO");
    return {
      total: allPedidos.length,
      pendientes: pendientes.length,
      enPreparacion: enPreparacion.length,
      entregados: entregados.length,
    };
  }, [allPedidos]);

  // ---- Filtered table ----
  const [tablaPedidos, setTablaPedidos] = useState<PedidoPublic[]>([]);
  const [tablaTotal, setTablaTotal] = useState(0);
  const [tablaLoading, setTablaLoading] = useState(false);
  const [tablaError, setTablaError] = useState<string | null>(null);

  const filtrosGuardados = loadFiltros();
  const [filtroEstado, setFiltroEstado] = useState(filtrosGuardados.filtroEstado ?? "");
  const [filtroFormaPago, setFiltroFormaPago] = useState(filtrosGuardados.filtroFormaPago ?? "");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState(filtrosGuardados.filtroFechaDesde ?? "");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState(filtrosGuardados.filtroFechaHasta ?? "");
  const [page, setPage] = useState(0);
  const pageSize = 30;

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<PedidoPublic | null>(null);
  const [cancelReason, setCancelReason] = useState("sin_stock");
  const [cancelOtherText, setCancelOtherText] = useState("");

  const ADMIN_CANCEL_REASONS = [
    { value: "falta_stock", label: "Falta de stock" },
    { value: "no_domicilio", label: "No se encontró el domicilio" },
    { value: "otro", label: "Otro" },
  ];

  const cargarTabla = useCallback(async () => {
    setTablaLoading(true);
    setTablaError(null);
    try {
      const filter: PedidosFilter = {};
      if (filtroEstado) filter.estado = filtroEstado;
      if (filtroFormaPago) filter.forma_pago = filtroFormaPago;
      if (filtroFechaDesde) filter.fecha_desde = new Date(filtroFechaDesde).toISOString();
      if (filtroFechaHasta) {
        const end = new Date(filtroFechaHasta);
        end.setHours(23, 59, 59, 999);
        filter.fecha_hasta = end.toISOString();
      }
      const data = await listPedidos(page * pageSize, pageSize, filter);
      setTablaPedidos(data.data);
      setTablaTotal(data.total);
    } catch (err) {
      setTablaError(err instanceof Error ? err.message : "Error al cargar pedidos");
    } finally {
      setTablaLoading(false);
    }
  }, [filtroEstado, filtroFormaPago, filtroFechaDesde, filtroFechaHasta, page]);

  useEffect(() => {
    cargarTabla();
  }, [cargarTabla]);

  // Feed admin en tiempo real (consigna §9.2/§9.5): cada cambio de estado de
  // cualquier pedido refresca stats y tabla. Reconexión exponencial en el hook.
  useEffect(() => {
    saveFiltros({ filtroEstado, filtroFormaPago, filtroFechaDesde, filtroFechaHasta });
  }, [filtroEstado, filtroFormaPago, filtroFechaDesde, filtroFechaHasta]);

  useAdminOrdersFeed(() => {
    cargarAllPedidos();
    cargarTabla();
  });

  const pedidosAMostrar = tablaPedidos;
  const totalPages = Math.ceil(tablaTotal / pageSize);

  // ---- Actions ----
  const [operating, setOperating] = useState<number | null>(null);

  const avanzarEstado = async (pedido: PedidoPublic, nuevoEstado: string): Promise<void> => {
    setOperating(pedido.id);
    try {
      await cambiarEstadoPedido(pedido.id, nuevoEstado);
      await Promise.all([cargarAllPedidos(), cargarTabla()]);
      if (!isAdmin && nuevoEstado === "ENTREGADO") {
        toast.success("PEDIDO ENTREGADO CON ÉXITO");
      }
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    } finally {
      setOperating(null);
    }
  };

  const ejecutarCancelacion = async (pedido: PedidoPublic, motivo: string): Promise<void> => {
    setOperating(pedido.id);
    try {
      await cambiarEstadoPedido(pedido.id, "CANCELADO", motivo);
      await Promise.all([cargarAllPedidos(), cargarTabla()]);
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : "No se pudo cancelar el pedido");
    } finally {
      setOperating(null);
    }
  };

  const siguienteEstado = (estado: string): string | null => {
    if (estado === "A_ENTREGAR") return "ESPERANDO_CLIENTE";
    return null;
  };

  // ---- Render ----
  if (statsLoading && allPedidos.length === 0) {
    return <SkeletonPage />;
  }

  if (statsError && allPedidos.length === 0) {
    return <p className="text-red-600 dark:text-red-400">{statsError}</p>;
  }

  return (
    <section className="rounded-3xl border border-orange-100 dark:border-gray-500 bg-white/90 dark:bg-gray-800/90 p-5 shadow-sm backdrop-blur">
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-orange-950 dark:text-orange-200">Operaciones de Pedidos</h1>
          <RealtimeBadge channel="admin:pedidos" />
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-gray-300">
          {isAdmin ? `${stats.total} pedidos · ${stats.pendientes} pendientes · ` : ""}
          {stats.enPreparacion} en preparación · {stats.entregados} entregados
        </p>
      </div>

      {/* Filters */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-gray-300">Estado</label>
          <select
            value={filtroEstado}
            onChange={(e) => { setFiltroEstado(e.target.value); setPage(0); }}
            className="w-full rounded-lg border border-orange-200 dark:border-gray-500 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          >
            {FILTER_ESTADOS.map((e) => (
              <option key={e} value={e}>{e || "Todos los estados"}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-gray-300">Forma de pago</label>
          <select
            value={filtroFormaPago}
            onChange={(e) => { setFiltroFormaPago(e.target.value); setPage(0); }}
            className="w-full rounded-lg border border-orange-200 dark:border-gray-500 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          >
            {FORMAS_PAGO.map((f) => (
              <option key={f} value={f}>{f || "Todas"}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-gray-300">Desde</label>
          <input
            type="date"
            value={filtroFechaDesde}
            onChange={(e) => { setFiltroFechaDesde(e.target.value); setPage(0); }}
            className="w-full rounded-lg border border-orange-200 dark:border-gray-500 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-gray-300">Hasta</label>
          <input
            type="date"
            value={filtroFechaHasta}
            onChange={(e) => { setFiltroFechaHasta(e.target.value); setPage(0); }}
            className="w-full rounded-lg border border-orange-200 dark:border-gray-500 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {tablaError && (
        <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-300">{tablaError}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-orange-100 dark:border-gray-500">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-orange-50 dark:bg-gray-800/50 text-left text-xs uppercase text-slate-600 dark:text-gray-300">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Pago</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Detalle</th>
              {canOperate ? <th className="px-4 py-3 font-medium">Operación</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-orange-100">
            {pedidosAMostrar.length === 0 && !tablaLoading && (
              <tr>
                <td colSpan={canOperate ? 8 : 7} className="px-4 py-8 text-center text-slate-500 dark:text-gray-300">
                  No se encontraron pedidos
                </td>
              </tr>
            )}
            {pedidosAMostrar.map((pedido) => (
              <tr key={pedido.id} className="hover:bg-orange-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-gray-300">#{pedido.id}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-gray-300">{pedido.usuario_id}</td>
                <td className="px-4 py-3">
                  <Badge estado={pedido.estado_codigo} variant="solid" className="px-2.5 py-0.5 text-xs font-medium" />
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-gray-300">{pedido.forma_pago_codigo ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-slate-800 dark:text-gray-100 font-medium">${asNumber(pedido.total).toFixed(2)}</td>
                <td className="px-4 py-3 text-xs text-slate-500 dark:text-gray-300">{formatDate(pedido.created_at)}</td>
                <td className="px-4 py-3">
                  <Link
                    to={`/operaciones-pedidos/${pedido.id}`}
                    className="rounded bg-blue-100 dark:bg-blue-900/50 px-2.5 py-1 text-xs font-medium text-blue-800 dark:text-blue-300 hover:bg-blue-200"
                  >
                    Ver
                  </Link>
                </td>
                {canOperate ? (
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {siguienteEstado(pedido.estado_codigo) ? (
                        <button
                          type="button"
                          onClick={() => avanzarEstado(pedido, siguienteEstado(pedido.estado_codigo) as string)}
                          disabled={operating === pedido.id}
                          className="rounded bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {actionLabels[siguienteEstado(pedido.estado_codigo) ?? ""] ?? siguienteEstado(pedido.estado_codigo)}
                        </button>
                      ) : null}
                      {puedeCancelar(pedido.estado_codigo, isAdmin) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCancelTarget(pedido);
                            setCancelReason("sin_stock");
                            setCancelOtherText("");
                            setShowCancelDialog(true);
                          }}
                          disabled={operating === pedido.id}
                          className="rounded bg-red-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      ) : null}
                      {!siguienteEstado(pedido.estado_codigo) && !puedeCancelar(pedido.estado_codigo, isAdmin) ? (
                        <span className="text-xs text-slate-500 dark:text-gray-300">Terminal</span>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
            {tablaLoading && (
              <tr>
                <td colSpan={canOperate ? 8 : 7} className="px-4 py-8 text-center text-slate-500 dark:text-gray-300">Cargando...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600 dark:text-gray-300">
          <span>{tablaTotal} pedidos encontrados</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="rounded bg-orange-100 dark:bg-gray-700 px-3 py-1.5 font-medium text-orange-800 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              ← Anterior
            </button>
            <span>Página {page + 1} de {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="rounded bg-orange-100 dark:bg-gray-700 px-3 py-1.5 font-medium text-orange-800 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {!tablaLoading && totalPages <= 1 && (
        <p className="mt-4 text-sm text-slate-500 dark:text-gray-300">{tablaTotal} pedidos encontrados</p>
      )}

      {showCancelDialog && cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-gray-100">Cancelar pedido #{cancelTarget.id}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">Seleccioná el motivo de cancelación.</p>
            <div className="mt-4 space-y-2">
              {ADMIN_CANCEL_REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-gray-500 px-4 py-3 cursor-pointer hover:bg-orange-50 dark:hover:bg-gray-800 has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50 dark:has-[:checked]:bg-orange-900/30 dark:has-[:checked]:border-orange-500">
                  <input
                    type="radio"
                    name="cancelReason"
                    value={r.value}
                    checked={cancelReason === r.value}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="accent-orange-500"
                  />
                  <span className="text-sm text-slate-800 dark:text-gray-100">{r.label}</span>
                </label>
              ))}
              {cancelReason === "otro" && (
                <textarea
                  value={cancelOtherText}
                  onChange={(e) => setCancelOtherText(e.target.value)}
                  placeholder="Describí el motivo..."
                  className="mt-2 w-full rounded-lg border border-slate-200 dark:border-gray-500 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none dark:bg-gray-800 dark:text-gray-100"
                  rows={3}
                />
              )}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowCancelDialog(false)}
                className="rounded-lg border border-slate-300 dark:border-gray-500 px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700"
              >
                Volver
              </button>
              <button
                onClick={() => {
                  const motivo = cancelReason === "falta_stock" ? "Falta de stock" : cancelReason === "no_domicilio" ? "No se encontró el domicilio" : cancelOtherText.trim() || "Otro motivo";
                  ejecutarCancelacion(cancelTarget, motivo);
                  setShowCancelDialog(false);
                }}
                disabled={operating === cancelTarget.id || (cancelReason === "otro" && !cancelOtherText.trim())}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {operating === cancelTarget.id ? "Cancelando..." : "Confirmar cancelación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

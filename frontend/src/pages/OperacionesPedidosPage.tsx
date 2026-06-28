import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
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
import { EmptyState } from "../components/EmptyState";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";

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

const estadoBadgeColor: Record<string, "brand" | "violet" | "green" | "red" | "amber"> = {
  PENDIENTE: "amber",
  CONFIRMADO: "brand",
  EN_PREP: "violet",
  A_ENTREGAR: "brand",
  ESPERANDO_CLIENTE: "brand",
  TERMINADO: "brand",
  ENTREGADO: "green",
  CANCELADO: "red",
};

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

  useEffect(() => {
    saveFiltros({ filtroEstado, filtroFormaPago, filtroFechaDesde, filtroFechaHasta });
  }, [filtroEstado, filtroFormaPago, filtroFechaDesde, filtroFechaHasta]);

  useAdminOrdersFeed(() => {
    cargarAllPedidos();
    cargarTabla();
  });

  const pedidosAMostrar = tablaPedidos;
  const totalPages = Math.ceil(tablaTotal / pageSize);

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

  if (statsLoading && allPedidos.length === 0) {
    return <SkeletonPage />;
  }

  if (statsError && allPedidos.length === 0) {
    return <p className="text-red-600 dark:text-red-400">{statsError}</p>;
  }

  return (
    <div className="space-y-5">
      <Helmet><title>Operaciones Pedidos | Food Store</title></Helmet>
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">Operaciones</p>
            <h1 className="font-display text-3xl font-bold text-brand-900 dark:text-brand-300">Pedidos</h1>
          </div>
          <RealtimeBadge channel="admin:pedidos" />
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">
          {isAdmin ? `${stats.total} pedidos · ${stats.pendientes} pendientes · ` : ""}
          {stats.enPreparacion} en preparación · {stats.entregados} entregados
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Estado"
          value={filtroEstado}
          onChange={(e) => { setFiltroEstado(e.target.value); setPage(0); }}
          options={FILTER_ESTADOS.map((e) => ({ value: e, label: e || "Todos los estados" }))}
        />
        <Select
          label="Forma de pago"
          value={filtroFormaPago}
          onChange={(e) => { setFiltroFormaPago(e.target.value); setPage(0); }}
          options={FORMAS_PAGO.map((f) => ({ value: f, label: f || "Todas" }))}
        />
        <Input
          label="Desde"
          type="date"
          value={filtroFechaDesde}
          onChange={(e) => { setFiltroFechaDesde(e.target.value); setPage(0); }}
        />
        <Input
          label="Hasta"
          type="date"
          value={filtroFechaHasta}
          onChange={(e) => { setFiltroFechaHasta(e.target.value); setPage(0); }}
        />
      </div>

      {tablaError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">{tablaError}</div>
      )}

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-brand-50 text-left text-xs uppercase text-slate-600 dark:bg-surface-card dark:text-gray-400">
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
            <tbody className="divide-y divide-gray-100 dark:divide-surface-border">
              {pedidosAMostrar.length === 0 && !tablaLoading && (
                <tr>
                  <td colSpan={canOperate ? 8 : 7} className="px-4 py-8 text-center">
                    <EmptyState icon="📋" title="Sin pedidos" description="No se encontraron pedidos para los filtros seleccionados." />
                  </td>
                </tr>
              )}
              {pedidosAMostrar.map((pedido) => (
                <tr key={pedido.id} className="transition-colors hover:bg-brand-50/50 dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-gray-300">#{pedido.id}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-gray-300">{pedido.usuario_id}</td>
                  <td className="px-4 py-3">
                    <Badge variant="solid" color={estadoBadgeColor[pedido.estado_codigo] ?? "amber"}>
                      {pedido.estado_codigo}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-gray-300">{pedido.forma_pago_codigo ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-slate-800 dark:text-gray-100 font-medium">${asNumber(pedido.total).toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-gray-300">{formatDate(pedido.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link to={`/operaciones-pedidos/${pedido.id}`}>
                      <Button variant="ghost" size="sm">Ver</Button>
                    </Link>
                  </td>
                  {canOperate ? (
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {siguienteEstado(pedido.estado_codigo) ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => avanzarEstado(pedido, siguienteEstado(pedido.estado_codigo) as string)}
                            disabled={operating === pedido.id}
                            className="border-green-600 text-green-700 hover:bg-green-50 dark:border-green-500 dark:text-green-400"
                          >
                            {actionLabels[siguienteEstado(pedido.estado_codigo) ?? ""] ?? siguienteEstado(pedido.estado_codigo)}
                          </Button>
                        ) : null}
                        {puedeCancelar(pedido.estado_codigo, isAdmin) ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCancelTarget(pedido);
                              setCancelReason("sin_stock");
                              setCancelOtherText("");
                              setShowCancelDialog(true);
                            }}
                            disabled={operating === pedido.id}
                            className="border-red-500 text-red-700 hover:bg-red-50 dark:border-red-500 dark:text-red-400"
                          >
                            Cancelar
                          </Button>
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
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-gray-300">
          <span>{tablaTotal} pedidos encontrados</span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              ← Anterior
            </Button>
            <span>Página {page + 1} de {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
            >
              Siguiente →
            </Button>
          </div>
        </div>
      )}

      {!tablaLoading && totalPages <= 1 && (
        <p className="text-sm text-slate-500 dark:text-gray-300">{tablaTotal} pedidos encontrados</p>
      )}

      <Modal
        isOpen={showCancelDialog}
        title={`Cancelar pedido #${cancelTarget?.id ?? ""}`}
        onClose={() => setShowCancelDialog(false)}
        size="sm"
      >
        <p className="text-sm text-slate-600 dark:text-gray-300">Seleccioná el motivo de cancelación.</p>
        <div className="mt-4 space-y-2">
          {ADMIN_CANCEL_REASONS.map((r) => (
            <label key={r.value} className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 cursor-pointer hover:bg-brand-50 has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 dark:border-surface-border dark:hover:bg-white/5 dark:has-[:checked]:border-brand-500 dark:has-[:checked]:bg-brand-900/30">
              <input
                type="radio"
                name="cancelReason"
                value={r.value}
                checked={cancelReason === r.value}
                onChange={(e) => setCancelReason(e.target.value)}
                className="accent-brand-500"
              />
              <span className="text-sm text-slate-800 dark:text-gray-100">{r.label}</span>
            </label>
          ))}
          {cancelReason === "otro" && (
            <textarea
              value={cancelOtherText}
              onChange={(e) => setCancelOtherText(e.target.value)}
              placeholder="Describí el motivo..."
              className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none dark:border-surface-border dark:bg-surface-card dark:text-gray-100"
              rows={3}
            />
          )}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={() => setShowCancelDialog(false)}>
            Volver
          </Button>
          <Button
            variant="solid"
            size="sm"
            onClick={() => {
              const motivo = cancelReason === "falta_stock" ? "Falta de stock" : cancelReason === "no_domicilio" ? "No se encontró el domicilio" : cancelOtherText.trim() || "Otro motivo";
              ejecutarCancelacion(cancelTarget!, motivo);
              setShowCancelDialog(false);
            }}
            disabled={operating === cancelTarget?.id || (cancelReason === "otro" && !cancelOtherText.trim())}
          >
            {operating === cancelTarget?.id ? "Cancelando..." : "Confirmar cancelación"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

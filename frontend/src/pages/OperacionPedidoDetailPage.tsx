import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { getPedidoDetail, getHistorialPedido, cambiarEstadoPedido, listPedidos, verifyPayment } from "../services/api";
import type { PedidoDetail, HistorialEstadoPedidoPublic } from "../services/api";
import { estadoColors, estadoLabels, actionLabels } from "../constants/ui";
import { Badge } from "../components/Badge";

function getNextState(estado: string): string | null {
  if (estado === "A_ENTREGAR") return "ESPERANDO_CLIENTE";
  return null;
}

export function OperacionPedidoDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const pedidoId = Number(id);
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = hasRole("ADMIN");
  const cancellableStates = ["PENDIENTE", "CONFIRMADO", "EN_PREP", "A_ENTREGAR"];

  const pedidoQuery = useQuery({
    queryKey: ["pedido", pedidoId],
    queryFn: () => getPedidoDetail(pedidoId),
    enabled: !Number.isNaN(pedidoId),
  });

  const historialQuery = useQuery({
    queryKey: ["pedido-historial", pedidoId],
    queryFn: () => getHistorialPedido(pedidoId),
    enabled: !Number.isNaN(pedidoId),
  });

  const cancelarMutation = useMutation({
    mutationFn: (motivo: string) => cambiarEstadoPedido(pedidoId, "CANCELADO", motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedido", pedidoId] });
      queryClient.invalidateQueries({ queryKey: ["pedido-historial", pedidoId] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      setShowCancelDialog(false);
    },
  });

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("sin_stock");
  const [cancelOtherText, setCancelOtherText] = useState("");

  const ADMIN_CANCEL_REASONS = [
    { value: "falta_stock", label: "Falta de stock" },
    { value: "no_domicilio", label: "No se encontró el domicilio" },
    { value: "otro", label: "Otro" },
  ];

  const avanzarMutation = useMutation({
    mutationFn: (estadoCodigo: string) =>
      cambiarEstadoPedido(pedidoId, estadoCodigo),
    onSuccess: (_data, estadoCodigo) => {
      queryClient.invalidateQueries({ queryKey: ["pedido", pedidoId] });
      queryClient.invalidateQueries({ queryKey: ["pedido-historial", pedidoId] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      if (!isAdmin && estadoCodigo === "ENTREGADO") {
        toast.success("PEDIDO ENTREGADO CON ÉXITO");
      }
    },
  });

  const [verifying, setVerifying] = useState(false);
  const verifiedRef = useRef(false);

  useEffect(() => {
    const pedido = pedidoQuery.data;
    if (!pedido || verifiedRef.current || verifying) return;
    const isMp = pedido.forma_pago_codigo === "MERCADOPAGO" || pedido.forma_pago_codigo === "mercadopago";
    if (pedido.estado_codigo === "PENDIENTE" && isMp) {
      verifiedRef.current = true;
      setVerifying(true);
      verifyPayment(pedido.id)
        .then((res) => {
          if (res.estado === "aprobado" || res.estado === "rechazado") {
            queryClient.invalidateQueries({ queryKey: ["pedido", pedidoId] });
            queryClient.invalidateQueries({ queryKey: ["pedido-historial", pedidoId] });
          }
        })
        .catch(() => {})
        .finally(() => setVerifying(false));
    }
  }, [pedidoQuery.data, pedidoId, queryClient, verifying]);

  if (Number.isNaN(pedidoId)) {
    return <p className="text-red-600 dark:text-red-400">ID de pedido inválido.</p>;
  }

  if (pedidoQuery.isLoading) return <p className="text-slate-600 dark:text-gray-300">Cargando pedido...</p>;
  if (pedidoQuery.isError || !pedidoQuery.data) {
    return <p className="text-red-600 dark:text-red-400">Error al cargar el pedido.</p>;
  }

  if (verifying) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-orange-200 dark:border-gray-500 border-t-orange-600" />
          <p className="text-slate-600 dark:text-gray-300">Verificando estado del pago con MercadoPago...</p>
        </div>
      </div>
    );
  }

  const pedido = pedidoQuery.data;
  const historial = historialQuery.data?.data ?? [];
  const nextEstado = getNextState(pedido.estado_codigo);
  const hasAnyAction = nextEstado !== null || cancellableStates.includes(pedido.estado_codigo);
  const isTerminal = !hasAnyAction;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/operaciones-pedidos" className="text-sm text-orange-600 dark:text-orange-400 hover:underline">&larr; Volver a pedidos</Link>
          <h1 className="mt-1 text-3xl font-bold text-orange-900 dark:text-orange-300">Pedido #{pedido.id}</h1>
        </div>
        <Badge estado={pedido.estado_codigo} className="px-4 py-2 text-sm font-semibold" />
      </div>

      {/* Main info grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-orange-900 dark:text-orange-300">Información del pedido</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Usuario ID</dt><dd className="font-mono text-slate-800 dark:text-gray-100">{pedido.usuario_id}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Fecha</dt><dd className="text-slate-800 dark:text-gray-100">{new Date(pedido.created_at).toLocaleString("es-AR")}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Forma de pago</dt><dd className="text-slate-800 dark:text-gray-100">{pedido.forma_pago_codigo ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Notas</dt><dd className="text-slate-800 dark:text-gray-100">{pedido.notas ?? "—"}</dd></div>
          </dl>
        </div>

        <div className="rounded-xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-orange-900 dark:text-orange-300">Totales</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Subtotal</dt><dd className="font-mono text-slate-800 dark:text-gray-100">${Number(pedido.subtotal).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Descuento</dt><dd className="font-mono text-slate-800 dark:text-gray-100">-${Number(pedido.descuento).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Costo envío</dt><dd className="font-mono text-slate-800 dark:text-gray-100">${Number(pedido.costo_envio).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</dd></div>
            <div className="border-t border-orange-100 dark:border-gray-500 pt-2 flex justify-between"><dt className="font-semibold text-orange-900 dark:text-orange-300">Total</dt><dd className="font-mono font-bold text-orange-900 dark:text-orange-300">${Number(pedido.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</dd></div>
          </dl>
        </div>
      </div>

      {/* Productos */}
      <div className="rounded-xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-orange-900 dark:text-orange-300">Productos</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-orange-100 dark:border-gray-500">
              <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-gray-300">Producto</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-gray-300">Cantidad</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-gray-300">Precio unit.</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-gray-300">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {pedido.detalles.map((d) => (
              <tr key={d.id} className="border-b border-orange-50 dark:border-gray-500 hover:bg-orange-50 dark:hover:bg-gray-800">
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-gray-100">{d.nombre_snapshot}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-gray-300">{d.cantidad}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-gray-300">${Number(d.precio_snapshot).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-gray-300">${Number(d.subtotal_snapshot).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      {!isTerminal && (
        <div className="rounded-xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-orange-900 dark:text-orange-300">Acciones</h2>
          <div className="flex flex-wrap gap-3">
            {nextEstado && (
              <button
                type="button"
                onClick={() => avanzarMutation.mutate(nextEstado)}
                disabled={avanzarMutation.isPending}
                className="rounded bg-orange-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 disabled:opacity-50"
              >
                {avanzarMutation.isPending
                  ? "Procesando..."
                  : (actionLabels[nextEstado] ?? `Avanzar a ${estadoLabels[nextEstado] ?? nextEstado}`)}
              </button>
            )}

            {cancellableStates.includes(pedido.estado_codigo) && (
              <button
                type="button"
                onClick={() => setShowCancelDialog(true)}
                disabled={cancelarMutation.isPending}
                className="rounded bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                {cancelarMutation.isPending ? "Cancelando..." : "Cancelar pedido"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Cancel dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-gray-100">Cancelar pedido #{pedido.id}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">Seleccioná el motivo de cancelación.</p>
            <div className="mt-4 space-y-2">
              {ADMIN_CANCEL_REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-gray-500 px-4 py-3 cursor-pointer hover:bg-orange-50 dark:hover:bg-gray-800 has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50">
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
                  cancelarMutation.mutate(motivo);
                }}
                disabled={cancelarMutation.isPending || (cancelReason === "otro" && !cancelOtherText.trim())}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancelarMutation.isPending ? "Cancelando..." : "Confirmar cancelación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historial */}
      <div className="rounded-xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-orange-900 dark:text-orange-300">Historial de cambios</h2>
        {historial.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-gray-300">Sin cambios registrados.</p>
        ) : (
          <div className="space-y-3">
            {[...historial].reverse().map((h: HistorialEstadoPedidoPublic) => (
              <div key={h.id} className="flex items-start gap-3 rounded-lg border border-orange-50 dark:border-gray-500 bg-orange-50/50 dark:bg-gray-800/50 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-200 dark:bg-gray-700 text-xs font-bold text-orange-800 dark:text-orange-300">
                  {h.id}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${estadoColors[h.estado_desde_codigo ?? ""]?.bg ?? "bg-slate-100 dark:bg-gray-700"} ${estadoColors[h.estado_desde_codigo ?? ""]?.text ?? "text-slate-800 dark:text-gray-100"}`}>
                      {h.estado_desde_codigo ? (estadoLabels[h.estado_desde_codigo] ?? h.estado_desde_codigo) : "Creación"}
                    </span>
                    <span className="text-slate-400 dark:text-gray-300">&rarr;</span>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${estadoColors[h.estado_hacia_codigo]?.bg ?? "bg-slate-100 dark:bg-gray-700"} ${estadoColors[h.estado_hacia_codigo]?.text ?? "text-slate-800 dark:text-gray-100"}`}>
                      {estadoLabels[h.estado_hacia_codigo] ?? h.estado_hacia_codigo}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-gray-300">
                    {new Date(h.fecha).toLocaleString("es-AR")}
                    {h.motivo ? ` — ${h.motivo}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

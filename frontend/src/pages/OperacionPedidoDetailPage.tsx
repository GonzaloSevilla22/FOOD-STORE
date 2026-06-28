import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { getPedidoDetail, getHistorialPedido, cambiarEstadoPedido, verifyPayment } from "../services/api";
import type { HistorialEstadoPedidoPublic } from "../services/api";
import { estadoLabels, actionLabels } from "../constants/ui";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";

const stateBadgeColor: Record<string, "brand" | "violet" | "green" | "red" | "amber"> = {
  PENDIENTE: "amber",
  CONFIRMADO: "brand",
  EN_PREP: "violet",
  A_ENTREGAR: "brand",
  ESPERANDO_CLIENTE: "brand",
  TERMINADO: "brand",
  ENTREGADO: "green",
  CANCELADO: "red",
};

function getNextState(estado: string): string | null {
  if (estado === "A_ENTREGAR") return "ESPERANDO_CLIENTE";
  return null;
}

function formatMoney(value: number | string): string {
  const n = Number(value ?? 0);
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
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
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
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
      <Helmet><title>{`Pedido #${pedido.id} | Food Store`}</title></Helmet>
      <div className="flex items-center justify-between">
        <div>
          <Link to="/operaciones-pedidos" className="text-sm text-brand-600 hover:underline dark:text-brand-400">&larr; Volver a pedidos</Link>
          <h1 className="mt-1 text-3xl font-bold text-brand-900 dark:text-brand-300">Pedido #{pedido.id}</h1>
        </div>
        <Badge variant="solid" color={stateBadgeColor[pedido.estado_codigo] ?? "amber"} className="px-4 py-2 text-sm font-semibold">
          {estadoLabels[pedido.estado_codigo] ?? pedido.estado_codigo}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card padding="lg">
          <h2 className="mb-4 font-display text-lg font-semibold text-slate-800 dark:text-gray-100">Información del pedido</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Usuario ID</dt><dd className="font-mono text-slate-800 dark:text-gray-100">{pedido.usuario_id}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Fecha</dt><dd className="text-slate-800 dark:text-gray-100">{new Date(pedido.created_at).toLocaleString("es-AR")}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Forma de pago</dt><dd className="text-slate-800 dark:text-gray-100">{pedido.forma_pago_codigo ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Notas</dt><dd className="text-slate-800 dark:text-gray-100">{pedido.notas ?? "—"}</dd></div>
          </dl>
        </Card>

        <Card padding="lg">
          <h2 className="mb-4 font-display text-lg font-semibold text-slate-800 dark:text-gray-100">Totales</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Subtotal</dt><dd className="font-mono text-slate-800 dark:text-gray-100">{formatMoney(pedido.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Descuento</dt><dd className="font-mono text-slate-800 dark:text-gray-100">-{formatMoney(pedido.descuento)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Costo envío</dt><dd className="font-mono text-slate-800 dark:text-gray-100">{formatMoney(pedido.costo_envio)}</dd></div>
            <div className="border-t border-gray-200 pt-2 dark:border-surface-border">
              <div className="flex justify-between"><dt className="font-semibold text-brand-700 dark:text-brand-300">Total</dt><dd className="font-mono font-bold text-brand-700 dark:text-brand-300">{formatMoney(pedido.total)}</dd></div>
            </div>
          </dl>
        </Card>
      </div>

      <Card padding="lg">
        <h2 className="mb-4 font-display text-lg font-semibold text-slate-800 dark:text-gray-100">Productos</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-surface-border">
              <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-gray-300">Producto</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-gray-300">Cantidad</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-gray-300">Precio unit.</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-gray-300">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {pedido.detalles.map((d) => (
              <tr key={d.id} className="border-b border-gray-100 hover:bg-brand-50/50 dark:border-surface-border dark:hover:bg-white/5">
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-gray-100">{d.nombre_snapshot}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-gray-300">{d.cantidad}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-gray-300">{formatMoney(d.precio_snapshot)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-gray-300">{formatMoney(d.subtotal_snapshot)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {!isTerminal && (
        <Card padding="lg">
          <h2 className="mb-4 font-display text-lg font-semibold text-slate-800 dark:text-gray-100">Acciones</h2>
          <div className="flex flex-wrap gap-3">
            {nextEstado && (
              <Button
                variant="solid"
                size="md"
                onClick={() => avanzarMutation.mutate(nextEstado)}
                disabled={avanzarMutation.isPending}
              >
                {avanzarMutation.isPending
                  ? "Procesando..."
                  : (actionLabels[nextEstado] ?? `Avanzar a ${estadoLabels[nextEstado] ?? nextEstado}`)}
              </Button>
            )}

            {cancellableStates.includes(pedido.estado_codigo) && (
              <Button
                variant="outline"
                size="md"
                onClick={() => setShowCancelDialog(true)}
                disabled={cancelarMutation.isPending}
                className="border-red-500 text-red-700 hover:bg-red-50 dark:border-red-500 dark:text-red-400"
              >
                {cancelarMutation.isPending ? "Cancelando..." : "Cancelar pedido"}
              </Button>
            )}
          </div>
        </Card>
      )}

      <Modal
        isOpen={showCancelDialog}
        title={`Cancelar pedido #${pedido.id}`}
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
              cancelarMutation.mutate(motivo);
            }}
            disabled={cancelarMutation.isPending || (cancelReason === "otro" && !cancelOtherText.trim())}
          >
            {cancelarMutation.isPending ? "Cancelando..." : "Confirmar cancelación"}
          </Button>
        </div>
      </Modal>

      <Card padding="lg">
        <h2 className="mb-4 font-display text-lg font-semibold text-slate-800 dark:text-gray-100">Historial de cambios</h2>
        {historial.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-gray-300">Sin cambios registrados.</p>
        ) : (
          <div className="space-y-3">
            {[...historial].reverse().map((h: HistorialEstadoPedidoPublic) => (
              <div key={h.id} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3 dark:border-surface-border dark:bg-white/5">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="solid" color={stateBadgeColor[h.estado_desde_codigo ?? ""] ?? "amber"}>
                      {h.estado_desde_codigo ? (estadoLabels[h.estado_desde_codigo] ?? h.estado_desde_codigo) : "Creación"}
                    </Badge>
                    <span className="text-slate-400 dark:text-gray-300">&rarr;</span>
                    <Badge variant="solid" color={stateBadgeColor[h.estado_hacia_codigo] ?? "amber"}>
                      {estadoLabels[h.estado_hacia_codigo] ?? h.estado_hacia_codigo}
                    </Badge>
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
      </Card>
    </div>
  );
}

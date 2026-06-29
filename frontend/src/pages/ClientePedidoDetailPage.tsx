import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { getPedidoDetail, getHistorialPedido, getPagoByPedido, verifyPayment, cancelarPedido, recibirPedido } from "../services/api";
import type { HistorialEstadoPedidoPublic } from "../services/api";
import { PaymentButton } from "../components/PaymentButton";
import { RealtimeBadge } from "../components/RealtimeBadge";
import { useOrderStatusWS } from "../hooks/useOrderStatusWS";
import { useEffect, useRef, useState } from "react";
import { SkeletonPage } from "../components/Skeleton";
import { toast } from "sonner";
import { estadoColors, estadoLabels } from "../constants/ui";
import { Badge } from "../components/Badge";
import { useCart } from "../context/CartContext";

export function ClientePedidoDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const pedidoId = Number(id);

  const pedidoQuery = useQuery({
    queryKey: ["cliente-pedido", pedidoId],
    queryFn: () => getPedidoDetail(pedidoId),
    enabled: !Number.isNaN(pedidoId),
  });

  const historialQuery = useQuery({
    queryKey: ["cliente-historial", pedidoId],
    queryFn: () => getHistorialPedido(pedidoId),
    enabled: !Number.isNaN(pedidoId),
  });

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { limpiarCarrito } = useCart();

  useOrderStatusWS(pedidoId, [
    ["cliente-pedido", pedidoId],
    ["cliente-historial", pedidoId],
    ["cliente-pago", pedidoId],
  ]);

  const [verifying, setVerifying] = useState(false);
  const verifiedRef = useRef(false);
  const [recibiendo, setRecibiendo] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState("");

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
            queryClient.invalidateQueries({ queryKey: ["cliente-pedido", pedidoId] });
            queryClient.invalidateQueries({ queryKey: ["cliente-pago", pedidoId] });
          }
        })
        .catch(() => {})
        .finally(() => setVerifying(false));
    }
  }, [pedidoQuery.data, pedidoId, queryClient, verifying]);

  // Clear cart when order is delivered
  useEffect(() => {
    if (pedidoQuery.data?.estado_codigo === "ENTREGADO") {
      limpiarCarrito()
    }
  }, [pedidoQuery.data?.estado_codigo, limpiarCarrito])

  const handleRecibir = async () => {
    setRecibiendo(true);
    try {
      await recibirPedido(pedidoId);
      sessionStorage.removeItem("prev_cart");
      sessionStorage.removeItem("checkout_pedido_id");
      limpiarCarrito();
      queryClient.invalidateQueries({ queryKey: ["cliente-pedido", pedidoId] });
      queryClient.invalidateQueries({ queryKey: ["cliente-historial", pedidoId] });
      toast.success("Pedido recibido con éxito");
    } catch {
      toast.error("No se pudo marcar como recibido");
    } finally {
      setRecibiendo(false);
    }
  };

  const handleConfirmarDevolver = async () => {
    const motivo = cancelMotivo.trim()
      ? `Cancelaste el pedido: ${cancelMotivo.trim()}`
      : "Cancelaste el pedido";
    setShowCancelDialog(false);
    try {
      await cancelarPedido(pedidoId, motivo);
      sessionStorage.removeItem("prev_cart");
      sessionStorage.removeItem("checkout_pedido_id");
      limpiarCarrito();
      queryClient.invalidateQueries({ queryKey: ["cliente-pedido", pedidoId] });
      queryClient.invalidateQueries({ queryKey: ["cliente-historial", pedidoId] });
      toast.success("Pedido devuelto correctamente");
    } catch {
      toast.error("No se pudo devolver el pedido");
    } finally {
      setCancelMotivo("");
    }
  };

  const esMp = pedidoQuery.data?.forma_pago_codigo?.toLowerCase() === "mercadopago";

  const pagoQuery = useQuery({
    queryKey: ["cliente-pago", pedidoId],
    queryFn: () => getPagoByPedido(pedidoId),
    enabled: !Number.isNaN(pedidoId) && esMp,
    retry: false,
  });

  if (Number.isNaN(pedidoId)) {
    return <p className="text-red-600 dark:text-red-400">ID de pedido inválido.</p>;
  }

  if (pedidoQuery.isLoading) return <SkeletonPage />;
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
  const pago = pagoQuery.isSuccess ? pagoQuery.data : null;

  return (
    <div className="space-y-6">
      <Helmet><title>{`Pedido #${pedido.id} | Food Store`}</title></Helmet>
      <div className="flex items-center justify-between">
        <div>
          <Link to="/mis-pedidos" className="text-sm text-orange-600 dark:text-orange-400 hover:underline">&larr; Mis pedidos</Link>
          <h1 className="mt-1 text-3xl font-bold text-orange-900 dark:text-orange-300">Pedido #{pedido.id}</h1>
          {pedido.estado_codigo === "CANCELADO" && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400">
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
        <div className="flex flex-col items-end gap-1">
          <Badge estado={pedido.estado_codigo} className="px-4 py-2 text-sm font-semibold" />
          <RealtimeBadge channel={`pedido:${pedidoId}`} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-orange-900 dark:text-orange-300">Información</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Pedido</dt><dd className="font-mono text-slate-800 dark:text-gray-100">#{pedido.id}</dd></div>
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
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Envío</dt><dd className="font-mono text-slate-800 dark:text-gray-100">${Number(pedido.costo_envio).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</dd></div>
            <div className="border-t border-orange-100 dark:border-gray-500 pt-2 flex justify-between"><dt className="font-semibold text-orange-900 dark:text-orange-300">Total</dt><dd className="font-mono font-bold text-orange-900 dark:text-orange-300">${Number(pedido.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</dd></div>
          </dl>
        </div>
      </div>

      {pedido.estado_codigo === "ESPERANDO_CLIENTE" && (
        <div className="rounded-xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-orange-900 dark:text-orange-300">Estado del pedido</h2>
          <p className="text-sm text-slate-600 dark:text-gray-300 mb-4">Tu pedido está listo. ¿Querés recibirlo o devolverlo?</p>
          <div className="flex gap-3">
            <button
              onClick={handleRecibir}
              disabled={recibiendo}
              className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {recibiendo ? "Recibiendo..." : "Recibir"}
            </button>
            <button
              onClick={() => setShowCancelDialog(true)}
              className="flex-1 rounded-lg border-2 border-red-500 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300 transition-colors hover:bg-red-100 dark:bg-red-900/50 dark:hover:bg-red-900/70"
            >
              Devolver
            </button>
          </div>
        </div>
      )}

      {(pedido.estado_codigo === "PENDIENTE") && (!pago || pago.estado === "pendiente") && (
        <div className="rounded-xl border border-blue-100 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-300">Pago pendiente</h2>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                Completá el pago con MercadoPago para confirmar tu pedido.
              </p>
            </div>
            <PaymentButton pedidoId={pedido.id} monto={Number(pedido.total)} />
          </div>
        </div>
      )}

      {pago ? (
        <div className="rounded-xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-orange-900 dark:text-orange-300">Pago</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-gray-300">Estado</dt>
              <dd>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                  pago.estado === "aprobado" ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300" :
                  pago.estado === "rechazado" ? "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300" :
                  "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300"
                }`}>
                  {pago.estado === "aprobado" ? "Aprobado" :
                   pago.estado === "rechazado" ? "Rechazado" : "Pendiente"}
                </span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-gray-300">Monto</dt>
              <dd className="font-mono font-medium text-orange-900 dark:text-orange-300">${Number(pago.monto).toFixed(2)}</dd>
            </div>
            {pago.mp_payment_id ? (
              <div className="flex justify-between">
                <dt className="text-slate-600 dark:text-gray-300">ID MercadoPago</dt>
                <dd className="font-mono text-slate-800 dark:text-gray-100">{pago.mp_payment_id}</dd>
              </div>
            ) : null}
            {pago.mp_status ? (
              <div className="flex justify-between">
                <dt className="text-slate-600 dark:text-gray-300">Estado MP</dt>
                <dd>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                    pago.mp_status === "approved" ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300" :
                    pago.mp_status === "rejected" ? "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300" :
                    "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300"
                  }`}>
                    {pago.mp_status}
                  </span>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      <div className="rounded-xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-orange-900 dark:text-orange-300">Productos</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-orange-100 dark:border-gray-500">
              <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-gray-300">Producto</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-gray-300">Cant.</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-gray-300">Precio unit.</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-gray-300">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {pedido.detalles.map((d) => (
              <tr key={d.id} className="border-b border-orange-50 dark:border-gray-500 hover:bg-orange-50 dark:bg-gray-800/50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-gray-100">{d.nombre_snapshot}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-gray-300">{d.cantidad}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-gray-300">${Number(d.precio_snapshot).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-gray-300">${Number(d.subtotal_snapshot).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-orange-900 dark:text-orange-300">Historial</h2>
        {historial.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-gray-300">Sin cambios registrados.</p>
        ) : (
          <div className="space-y-3">
            {[...historial].reverse().map((h: HistorialEstadoPedidoPublic) => (
              <div key={h.id} className="flex items-start gap-3 rounded-lg border border-orange-50 dark:border-gray-500 bg-orange-50 dark:bg-gray-800/50 p-3">
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

      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-gray-100">Devolver pedido #{pedido.id}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">Escribí el motivo de devolución.</p>
            <div className="mt-4">
              <textarea
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                placeholder="Ej: Producto en mal estado, cambié de opinión..."
                className="w-full rounded-lg border border-slate-200 dark:border-gray-500 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none dark:bg-gray-800 dark:text-gray-100"
                rows={3}
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => { setShowCancelDialog(false); setCancelMotivo(""); }}
                className="rounded-lg border border-slate-300 dark:border-gray-500 px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700"
              >
                Volver
              </button>
              <button
                onClick={handleConfirmarDevolver}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Confirmar devolución
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

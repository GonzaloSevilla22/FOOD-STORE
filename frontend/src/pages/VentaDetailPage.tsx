import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { getPedidoDetail, getHistorialPedido, getPagoByPedido, confirmPayment, manualAprobarPago, verifyPayment } from "../services/api";
import type { HistorialEstadoPedidoPublic } from "../services/api";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

const stateLabels: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Pagado",
  EN_PREP: "Preparando",
  TERMINADO: "Terminado",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

const stateBadgeColor: Record<string, "brand" | "violet" | "green" | "red" | "amber"> = {
  PENDIENTE: "amber",
  CONFIRMADO: "brand",
  EN_PREP: "violet",
  TERMINADO: "brand",
  ENTREGADO: "green",
  CANCELADO: "red",
};

const pagoEstadoLabel: Record<string, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

const pagoEstadoBadgeColor: Record<string, "brand" | "green" | "red" | "amber"> = {
  pendiente: "amber",
  aprobado: "green",
  rechazado: "red",
};

const mpStatusBadgeColor: Record<string, "green" | "amber" | "red" | "brand"> = {
  approved: "green",
  in_process: "brand",
  pending: "amber",
  rejected: "red",
  cancelled: "amber",
  refunded: "brand",
  charged_back: "red",
};

const mpStatusLabel: Record<string, string> = {
  approved: "Approved",
  in_process: "In Process",
  pending: "Pending",
  rejected: "Rejected",
  cancelled: "Cancelled",
  refunded: "Refunded",
  charged_back: "Charged Back",
};

function formatMoney(value: number | string): string {
  const n = Number(value ?? 0);
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
}

export function VentaDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const ventaId = Number(id);

  const ventaQuery = useQuery({
    queryKey: ["venta", ventaId],
    queryFn: () => getPedidoDetail(ventaId),
    enabled: !Number.isNaN(ventaId),
  });

  const historialQuery = useQuery({
    queryKey: ["venta-historial", ventaId],
    queryFn: () => getHistorialPedido(ventaId),
    enabled: !Number.isNaN(ventaId),
  });

  const esMp = ventaQuery.data?.forma_pago_codigo?.toLowerCase() === "mercadopago";

  const pagoQuery = useQuery({
    queryKey: ["venta-pago", ventaId],
    queryFn: () => getPagoByPedido(ventaId),
    enabled: !Number.isNaN(ventaId) && esMp,
    retry: false,
    refetchInterval: 10_000,
  });

  const confirmPago = useMutation({
    mutationFn: () => confirmPayment(ventaId),
    onSuccess: () => {
      pagoQuery.refetch();
      ventaQuery.refetch();
    },
  });

  const [manualPaymentId, setManualPaymentId] = useState("");

  const verifyConId = useMutation({
    mutationFn: (paymentId: number) => confirmPayment(ventaId, paymentId),
    onSuccess: () => {
      setManualPaymentId("");
      pagoQuery.refetch();
      ventaQuery.refetch();
    },
  });

  const aprobarManual = useMutation({
    mutationFn: () => manualAprobarPago({ pedido_id: ventaId }),
    onSuccess: () => {
      pagoQuery.refetch();
      ventaQuery.refetch();
    },
  });

  const [verifying, setVerifying] = useState(false);
  const verifiedRef = useRef(false);

  useEffect(() => {
    const venta = ventaQuery.data;
    if (!venta || verifiedRef.current || verifying) return;
    const isMp = venta.forma_pago_codigo === "MERCADOPAGO" || venta.forma_pago_codigo === "mercadopago";
    if (venta.estado_codigo === "PENDIENTE" && isMp) {
      verifiedRef.current = true;
      setVerifying(true);
      verifyPayment(venta.id)
        .then((res) => {
          if (res.estado === "aprobado" || res.estado === "rechazado") {
            ventaQuery.refetch();
            pagoQuery.refetch();
          }
        })
        .catch(() => {})
        .finally(() => setVerifying(false));
    }
  }, [ventaQuery.data, ventaId, ventaQuery, pagoQuery, verifying]);

  if (Number.isNaN(ventaId)) {
    return <p className="text-red-600 dark:text-red-400">ID de venta inválido.</p>;
  }

  if (ventaQuery.isLoading) return <p className="text-slate-600 dark:text-gray-300">Cargando venta...</p>;
  if (ventaQuery.isError || !ventaQuery.data) {
    return <p className="text-red-600 dark:text-red-400">Error al cargar la venta.</p>;
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

  const venta = ventaQuery.data;
  const historial = historialQuery.data?.data ?? [];
  const pago = pagoQuery.isSuccess ? pagoQuery.data : null;

  return (
    <div className="space-y-6">
      <Helmet><title>{`Venta #${venta.id} | Food Store`}</title></Helmet>
      <div className="flex items-center justify-between">
        <div>
          <Link to="/ventas" className="text-sm text-brand-600 hover:underline dark:text-brand-400">&larr; Volver a ventas</Link>
          <h1 className="mt-1 text-3xl font-bold text-brand-900 dark:text-brand-300">Venta #{venta.id}</h1>
        </div>
        <Badge variant="solid" color={stateBadgeColor[venta.estado_codigo] ?? "brand"} className="px-4 py-2 text-sm font-semibold">
          {stateLabels[venta.estado_codigo] ?? venta.estado_codigo}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card padding="lg">
          <h2 className="mb-4 font-display text-lg font-semibold text-slate-800 dark:text-gray-100">Información</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Cliente ID</dt><dd className="font-mono text-slate-800 dark:text-gray-100">{venta.usuario_id}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Fecha</dt><dd className="text-slate-800 dark:text-gray-100">{new Date(venta.created_at).toLocaleString("es-AR")}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Forma de pago</dt><dd className="text-slate-800 dark:text-gray-100">{venta.forma_pago_codigo ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Notas</dt><dd className="text-slate-800 dark:text-gray-100">{venta.notas ?? "—"}</dd></div>
          </dl>
        </Card>

        <Card padding="lg">
          <h2 className="mb-4 font-display text-lg font-semibold text-slate-800 dark:text-gray-100">Totales</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Subtotal</dt><dd className="font-mono text-slate-800 dark:text-gray-100">{formatMoney(venta.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Descuento</dt><dd className="font-mono text-slate-800 dark:text-gray-100">-{formatMoney(venta.descuento)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600 dark:text-gray-300">Envío</dt><dd className="font-mono text-slate-800 dark:text-gray-100">{formatMoney(venta.costo_envio)}</dd></div>
            <div className="border-t border-gray-200 pt-2 dark:border-surface-border">
              <div className="flex justify-between"><dt className="font-semibold text-brand-700 dark:text-brand-300">Total</dt><dd className="font-mono font-bold text-brand-700 dark:text-brand-300">{formatMoney(venta.total)}</dd></div>
            </div>
          </dl>
        </Card>
      </div>

      {pagoQuery.isLoading ? (
        <Card padding="lg">
          <h2 className="mb-4 font-display text-lg font-semibold text-slate-800 dark:text-gray-100">Pago (MercadoPago)</h2>
          <p className="text-sm text-slate-500 dark:text-gray-300">Consultando estado del pago...</p>
        </Card>
      ) : pago ? (
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-gray-100">Pago (MercadoPago)</h2>
            {pago.estado === "pendiente" ? (
              <span className="text-xs text-slate-400 dark:text-gray-300">Se actualiza automáticamente cada 10s</span>
            ) : null}
          </div>

          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-gray-300">Estado del pago</dt>
              <dd>
                <Badge variant="solid" color={pagoEstadoBadgeColor[pago.estado] ?? "amber"}>
                  {pagoEstadoLabel[pago.estado] ?? pago.estado}
                </Badge>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-gray-300">Estado MP</dt>
              <dd>
                {pago.mp_status ? (
                  <Badge variant="solid" color={mpStatusBadgeColor[pago.mp_status] ?? "amber"}>
                    {mpStatusLabel[pago.mp_status] ?? pago.mp_status}
                  </Badge>
                ) : (
                  <span className="text-slate-400 dark:text-gray-300">—</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-gray-300">Detalle MP</dt>
              <dd className="font-mono text-slate-800 dark:text-gray-100">{pago.mp_status_detail ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-gray-300">Payment ID</dt>
              <dd className="font-mono text-slate-800 dark:text-gray-100">{pago.mp_payment_id ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-gray-300">Preference ID</dt>
              <dd className="font-mono text-slate-800 dark:text-gray-100 text-xs">{pago.mp_preference_id ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-gray-300">Monto</dt>
              <dd className="font-mono font-medium text-brand-700 dark:text-brand-300">{formatMoney(pago.monto)}</dd>
            </div>
          </dl>

          {pago.estado === "pendiente" ? (
            <div className="mt-4 space-y-3 border-t border-gray-200 pt-4 dark:border-surface-border">
              {confirmPago.isError ? (
                <p className="text-sm text-red-600 dark:text-red-400">Error: {confirmPago.error.message}</p>
              ) : null}
              {verifyConId.isError ? (
                <p className="text-sm text-red-600 dark:text-red-400">Error: {verifyConId.error.message}</p>
              ) : null}
              {aprobarManual.isError ? (
                <p className="text-sm text-red-600 dark:text-red-400">Error: {aprobarManual.error.message}</p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => confirmPago.mutate()}
                  disabled={confirmPago.isPending}
                >
                  {confirmPago.isPending ? "Verificando..." : "Re-verificar en MP"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => aprobarManual.mutate()}
                  disabled={aprobarManual.isPending}
                  className="border-green-600 text-green-700 hover:bg-green-50 dark:border-green-500 dark:text-green-400"
                >
                  {aprobarManual.isPending ? "Aprobando..." : "Aprobar manualmente (efectivo)"}
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Payment ID de MP"
                  value={manualPaymentId}
                  onChange={(e) => setManualPaymentId(e.target.value)}
                  className="w-40"
                />
        <Button
          variant="solid"
          size="sm"
          onClick={() => {
                    const pid = Number(manualPaymentId);
                    if (pid > 0) verifyConId.mutate(pid);
                  }}
                  disabled={verifyConId.isPending || !manualPaymentId}
                >
                  {verifyConId.isPending ? "Verificando..." : "Verificar con ID"}
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : (
        <Card padding="lg">
          <h2 className="mb-4 font-display text-lg font-semibold text-slate-800 dark:text-gray-100">Pago (MercadoPago)</h2>
          <p className="text-sm text-slate-500 dark:text-gray-300">No se encontró pago registrado con MercadoPago.</p>
        </Card>
      )}

      <Card padding="lg">
        <h2 className="mb-4 font-display text-lg font-semibold text-slate-800 dark:text-gray-100">Productos vendidos</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-surface-border">
              <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-gray-300">Producto</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-gray-300">Cant.</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-gray-300">Precio unit.</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-gray-300">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {venta.detalles.map((d) => (
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

      <Card padding="lg">
        <h2 className="mb-4 font-display text-lg font-semibold text-slate-800 dark:text-gray-100">Historial de estados</h2>
        {historial.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-gray-300">Sin cambios registrados.</p>
        ) : (
          <div className="space-y-3">
            {[...historial].reverse().map((h: HistorialEstadoPedidoPublic) => (
              <div key={h.id} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3 dark:border-surface-border dark:bg-white/5">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="solid" color={stateBadgeColor[h.estado_desde_codigo ?? ""] ?? "amber"}>
                      {h.estado_desde_codigo ? (stateLabels[h.estado_desde_codigo] ?? h.estado_desde_codigo) : "Creación"}
                    </Badge>
                    <span className="text-slate-400 dark:text-gray-300">&rarr;</span>
                    <Badge variant="solid" color={stateBadgeColor[h.estado_hacia_codigo] ?? "amber"}>
                      {stateLabels[h.estado_hacia_codigo] ?? h.estado_hacia_codigo}
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

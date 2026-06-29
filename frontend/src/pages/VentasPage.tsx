import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  getPedidosWebSocketUrl,
  listPedidos,
  getVentas,
  getProductosTop,
  getPedidosPorEstado,
  type PedidoPublic,
  type PedidosFilter,
  type VentaItem,
  type ProductoTopItem,
  type PedidosPorEstadoItem,
} from "../services/api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import { EmptyState } from "../components/EmptyState";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Input } from "../components/ui/Input";

function asNumber(value: number | string): number {
  return Number(value ?? 0);
}

const estadoBadgeColor: Record<string, "brand" | "violet" | "green" | "red" | "amber"> = {
  PENDIENTE: "amber",
  CONFIRMADO: "brand",
  EN_PREP: "violet",
  TERMINADO: "brand",
  ENTREGADO: "green",
  CANCELADO: "red",
};

const ESTADOS = ["PENDIENTE", "CONFIRMADO", "EN_PREP", "ENTREGADO", "CANCELADO"] as const;
const FILTER_ESTADOS = ["", "PENDIENTE", "CONFIRMADO", "EN_PREP", "ENTREGADO", "CANCELADO"] as const;
const FORMAS_PAGO = ["", "EFECTIVO", "MERCADOPAGO", "TRANSFERENCIA"] as const;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatMoney(value: number | string): string {
  const n = Number(value ?? 0);
  return `$${n.toFixed(2)}`;
}

const kpiIcons: Record<string, JSX.Element> = {
  ingresos: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  ticket: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  prep: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
  cancel: <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />,
};

function KpiCard({ title, value, subtitle, icon, color, darkColor }: { title: string; value: string; subtitle: string; icon: string; color: string; darkColor: string }) {
  return (
    <Card padding="md" className={color}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${darkColor} text-white shadow-sm`}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {kpiIcons[icon]}
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-slate-500 dark:text-gray-400">{title}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-gray-100">{value}</p>
          <p className="text-xs text-slate-500 dark:text-gray-400">{subtitle}</p>
        </div>
      </div>
    </Card>
  );
}

export function VentasPage(): JSX.Element {
  const [pedidos, setPedidos] = useState<PedidoPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarVentas = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await listPedidos(0, 100);
      setPedidos(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando ventas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarVentas();
    const ws = new WebSocket(getPedidosWebSocketUrl());
    ws.onmessage = () => cargarVentas();
    const interval = setInterval(cargarVentas, 10_000);
    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, [cargarVentas]);

  const stats = useMemo(() => {
    const porEstado: Record<string, { count: number; total: number }> = {};
    for (const e of ESTADOS) {
      porEstado[e] = { count: 0, total: 0 };
    }
    let pagadosTotal = 0;
    let pagadosCount = 0;
    for (const p of pedidos) {
      const t = asNumber(p.total);
      if (porEstado[p.estado_codigo]) {
        porEstado[p.estado_codigo].count += 1;
        porEstado[p.estado_codigo].total += t;
      }
      const esPagado = p.pago_estado === "aprobado" || ["CONFIRMADO", "EN_PREP", "ENTREGADO"].includes(p.estado_codigo);
      if (esPagado) {
        pagadosTotal += t;
        pagadosCount += 1;
      }
    }
    const totalPedidos = pedidos.length;
    const maxCount = Math.max(...ESTADOS.map((e) => porEstado[e].count), 1);
    return { porEstado, pagadosTotal, pagadosCount, totalPedidos, maxCount };
  }, [pedidos]);

  const promedioTicket = (() => {
    return stats.pagadosCount > 0 ? stats.pagadosTotal / stats.pagadosCount : 0;
  })();

  const [tablaPedidos, setTablaPedidos] = useState<PedidoPublic[]>([]);
  const [tablaTotal, setTablaTotal] = useState(0);
  const [tablaLoading, setTablaLoading] = useState(false);
  const [tablaError, setTablaError] = useState<string | null>(null);

  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroFormaPago, setFiltroFormaPago] = useState("");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

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

  const totalPages = Math.ceil(tablaTotal / pageSize);

  const [ventasDiarias, setVentasDiarias] = useState<VentaItem[]>([]);
  const [productosTop, setProductosTop] = useState<ProductoTopItem[]>([]);
  const [pedidosPorEstado, setPedidosPorEstado] = useState<PedidosPorEstadoItem[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    async function loadCharts() {
      try {
        const [v, pt, pe] = await Promise.all([
          getVentas(),
          getProductosTop(8),
          getPedidosPorEstado(),
        ]);
        setVentasDiarias(v.data.slice().reverse());
        setProductosTop(pt.data);
        setPedidosPorEstado(pe.data);
      } catch {
        // charts are optional, silently fail
      } finally {
        setChartsLoading(false);
      }
    }
    loadCharts();
  }, []);

  const ESTADO_CHART_COLORS: Record<string, string> = {
    PENDIENTE: "#F59E0B",
    CONFIRMADO: "#3B82F6",
    EN_PREP: "#8B5CF6",
    TERMINADO: "#14B8A6",
    ENTREGADO: "#16A34A",
    CANCELADO: "#EF4444",
  };

  const gridColor = isDark ? "#27272A" : "#E5E7EB";
  const tooltipBg = isDark ? "#18181B" : "#FFFFFF";
  const tooltipBorder = isDark ? "#FF6B00" : "#FF6B00";

  if (loading && pedidos.length === 0) {
    return <p className="text-slate-600 dark:text-gray-300">Cargando ventas...</p>;
  }

  if (error) {
    return <p className="text-red-600 dark:text-red-400">No se pudieron cargar las ventas: {error}</p>;
  }

  return (
    <div className="space-y-5">
      <Helmet><title>Ventas | Food Store</title></Helmet>
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">Dashboard</p>
        <h1 className="font-display text-3xl font-bold text-brand-900 dark:text-brand-300">Ventas</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">
          {pedidos.length} pedidos &middot; {stats.pagadosCount} pagados &middot; se actualiza cada 10s
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Ingresos cobrados" value={`$${stats.pagadosTotal.toFixed(2)}`} subtitle={`${stats.pagadosCount} pedidos pagados`} icon="ingresos" color="" darkColor="bg-green-600" />
        <KpiCard title="Ticket promedio" value={`$${promedioTicket.toFixed(2)}`} subtitle="Por pedido pagado" icon="ticket" color="" darkColor="bg-blue-600" />
        <KpiCard title="En preparación" value={String(stats.porEstado["EN_PREP"].count)} subtitle={`${stats.porEstado["EN_PREP"].count} pedidos en preparación`} icon="prep" color="" darkColor="bg-violet-600" />
        <KpiCard title="Cancelados" value={String(stats.porEstado["CANCELADO"].count)} subtitle={`$${stats.porEstado["CANCELADO"].total.toFixed(2)} en cancelados`} icon="cancel" color="" darkColor="bg-red-600" />
      </div>

      <Card padding="lg" className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-gray-100">Distribución de pedidos por estado</h2>
        <div className="flex h-6 overflow-hidden rounded-full bg-slate-100 dark:bg-surface-border">
          {ESTADOS.filter((e) => stats.porEstado[e].count > 0).map((e) => {
            const pct = (stats.porEstado[e].count / Math.max(stats.totalPedidos, 1)) * 100;
            return (
              <div
                key={e}
                style={{ width: `${pct}%` }}
                className={`flex items-center justify-center text-[10px] font-bold text-white transition-all first:rounded-l-full last:rounded-r-full ${
                  e === "PENDIENTE" ? "bg-amber-500" :
                  e === "CONFIRMADO" ? "bg-blue-500" :
                  e === "EN_PREP" ? "bg-violet-500" :
                  e === "ENTREGADO" ? "bg-green-600" :
                  e === "CANCELADO" ? "bg-red-500" : "bg-slate-400"
                }`}
                title={`${e}: ${stats.porEstado[e].count} pedidos`}
              >
                {pct > 8 ? `${Math.round(pct)}%` : null}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-gray-300">
          {ESTADOS.filter((e) => stats.porEstado[e].count > 0).map((e) => (
            <span key={e} className="flex items-center gap-1">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                e === "PENDIENTE" ? "bg-amber-500" :
                e === "CONFIRMADO" ? "bg-blue-500" :
                e === "EN_PREP" ? "bg-violet-500" :
                e === "ENTREGADO" ? "bg-green-600" :
                e === "CANCELADO" ? "bg-red-500" : "bg-slate-400"
              }`} />
              {e}: {stats.porEstado[e].count}
            </span>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card padding="lg">
          <h2 className="mb-3 font-display text-sm font-semibold text-slate-800 dark:text-gray-100">Ingresos por estado</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase text-slate-500 dark:border-surface-border dark:text-gray-400">
                <th className="pb-2 font-medium">Estado</th>
                <th className="pb-2 text-right font-medium">Pedidos</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {ESTADOS.filter((e) => stats.porEstado[e].count > 0).map((e) => (
                <tr key={e} className="border-b border-gray-50 dark:border-surface-border">
                  <td className="py-1.5 font-medium"><Badge variant="solid" color={estadoBadgeColor[e] ?? "brand"}>{e}</Badge></td>
                  <td className="py-1.5 text-right text-slate-700 dark:text-gray-300">{stats.porEstado[e].count}</td>
                  <td className="py-1.5 text-right font-mono text-slate-800 dark:text-gray-100">${stats.porEstado[e].total.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="font-semibold text-brand-900 dark:text-brand-300">
                <td className="pt-2">Total</td>
                <td className="pt-2 text-right">{stats.totalPedidos}</td>
                <td className="pt-2 text-right">${pedidos.reduce((a, p) => a + asNumber(p.total), 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card padding="lg">
          <h2 className="mb-3 font-display text-sm font-semibold text-slate-800 dark:text-gray-100">Resumen rápido</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between rounded bg-slate-50 px-3 py-2 dark:bg-white/5">
              <dt className="text-slate-600 dark:text-gray-300">Tasa de conversión</dt>
              <dd className="font-semibold text-brand-700 dark:text-brand-300">
                {stats.totalPedidos > 0 ? `${((stats.pagadosCount / stats.totalPedidos) * 100).toFixed(1)}%` : "—"}
              </dd>
            </div>
            <div className="flex justify-between rounded bg-slate-50 px-3 py-2 dark:bg-white/5">
              <dt className="text-slate-600 dark:text-gray-300">Tasa de cancelación</dt>
              <dd className="font-semibold text-red-600 dark:text-red-400">
                {stats.totalPedidos > 0 ? `${((stats.porEstado["CANCELADO"].count / stats.totalPedidos) * 100).toFixed(1)}%` : "—"}
              </dd>
            </div>
            <div className="flex justify-between rounded bg-slate-50 px-3 py-2 dark:bg-white/5">
              <dt className="text-slate-600 dark:text-gray-300">Ingreso neto estimado</dt>
              <dd className="font-mono font-semibold text-green-700 dark:text-green-300">
                ${(stats.pagadosTotal - stats.porEstado["CANCELADO"].total).toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between rounded bg-slate-50 px-3 py-2 dark:bg-white/5">
              <dt className="text-slate-600 dark:text-gray-300">Pedido más caro (pagado)</dt>
              <dd className="font-mono font-semibold text-brand-700 dark:text-brand-300">
                ${Math.max(...pedidos.filter((p) => p.pago_estado === "aprobado").map((p) => asNumber(p.total)), 0).toFixed(2)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div>
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">Gráficos</p>
          <h2 className="font-display text-2xl font-bold text-brand-900 dark:text-brand-300">Estadísticas</h2>
        </div>

        {chartsLoading ? (
          <p className="text-sm text-slate-500 dark:text-gray-300">Cargando gráficos...</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <Card padding="lg">
              <h3 className="mb-3 font-display text-sm font-semibold text-slate-800 dark:text-gray-100">Ventas diarias (últimos 30 días)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={ventasDiarias}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: isDark ? "#9CA3AF" : "#6B7280" }} tickFormatter={(v: string) => v.slice(5, 10)} />
                  <YAxis tick={{ fontSize: 11, fill: isDark ? "#9CA3AF" : "#6B7280" }} />
                  <Tooltip
                    contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, color: isDark ? "#F3F4F6" : undefined, borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(v) => typeof v === "string" ? new Date(v).toLocaleDateString("es-AR") : v}
                  />
                  <Line type="monotone" dataKey="total" stroke="#FF6B00" strokeWidth={2.5} name="Total $" dot={false} />
                  <Line type="monotone" dataKey="pedidos" stroke="#FFB380" strokeWidth={2} name="Pedidos" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card padding="lg">
              <h3 className="mb-3 font-display text-sm font-semibold text-slate-800 dark:text-gray-100">Top productos vendidos</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={productosTop} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: isDark ? "#9CA3AF" : "#6B7280" }} />
                  <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10, fill: isDark ? "#9CA3AF" : "#6B7280" }} width={90} />
                  <Tooltip
                    contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, color: isDark ? "#F3F4F6" : undefined, borderRadius: 8, fontSize: 12 }}
                    formatter={(value, name) => [value, name === "cantidad_vendida" ? "Cantidad" : "Total $"]}
                  />
                  <Bar dataKey="cantidad_vendida" fill="#FF6B00" radius={[0, 4, 4, 0]} name="cantidad_vendida" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card padding="lg">
              <h3 className="mb-3 font-display text-sm font-semibold text-slate-800 dark:text-gray-100">Pedidos por estado</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pedidosPorEstado}
                    dataKey="cantidad"
                    nameKey="estado"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, payload }: { name?: string; payload?: { porcentaje: number } }) =>
                      payload ? `${name} ${payload.porcentaje.toFixed(1)}%` : name
                    }
                    labelLine
                  >
                    {pedidosPorEstado.map((entry) => (
                      <Cell key={entry.estado} fill={ESTADO_CHART_COLORS[entry.estado] ?? "#94A3B8"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, color: isDark ? "#F3F4F6" : undefined, borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card padding="lg">
              <h3 className="mb-3 font-display text-sm font-semibold text-slate-800 dark:text-gray-100">Ingresos por forma de pago</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  layout="vertical"
                  data={(() => {
                    const map = new Map<string, number>();
                    for (const p of pedidos.filter((x) => x.pago_estado === "aprobado")) {
                      const forma = p.forma_pago_codigo || "—";
                      map.set(forma, (map.get(forma) ?? 0) + asNumber(p.total));
                    }
                    return [...map.entries()].map(([forma, total]) => ({ forma, total }));
                  })()}
                  margin={{ left: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: isDark ? "#9CA3AF" : "#6B7280" }} />
                  <YAxis type="category" dataKey="forma" tick={{ fontSize: 10, fill: isDark ? "#9CA3AF" : "#6B7280" }} width={75} />
                  <Tooltip
                    contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, color: isDark ? "#F3F4F6" : undefined, borderRadius: 8, fontSize: 12 }}
                    formatter={(value) => [`$${Number(value).toFixed(2)}`, "Ingresos"]}
                  />
                  <Bar dataKey="total" fill="#16A34A" radius={[0, 4, 4, 0]} name="Ingresos $" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card padding="lg" className="flex flex-col justify-center">
              <h3 className="mb-1 font-display text-sm font-semibold text-slate-800 dark:text-gray-100">Comparativa mensual</h3>
              <div className="mt-2 space-y-3 text-sm">
                {(() => {
                  const ingresosData = pedidos
                    .filter((p) => p.pago_estado === "aprobado")
                    .reduce((s, p) => s + Number(p.total), 0);
                  return (
                    <>
                      <div className="flex justify-between rounded bg-slate-50 px-3 py-2 dark:bg-white/5">
                        <span className="text-slate-600 dark:text-gray-300">Total ingresado</span>
                        <span className="font-mono font-semibold text-green-700 dark:text-green-300">${ingresosData.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between rounded bg-slate-50 px-3 py-2 dark:bg-white/5">
                        <span className="text-slate-600 dark:text-gray-300">Ticket promedio</span>
                        <span className="font-mono font-semibold text-brand-700 dark:text-brand-300">
                          ${(stats.pagadosCount > 0 ? ingresosData / stats.pagadosCount : 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between rounded bg-slate-50 px-3 py-2 dark:bg-white/5">
                        <span className="text-slate-600 dark:text-gray-300">Tasa de conversión</span>
                        <span className="font-semibold text-brand-700 dark:text-brand-300">
                          {stats.totalPedidos > 0 ? `${((stats.pagadosCount / stats.totalPedidos) * 100).toFixed(1)}%` : "—"}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </Card>
          </div>
        )}
      </div>

      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900 dark:text-brand-300">Todos los Pedidos</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">{tablaTotal} pedidos encontrados</p>
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

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-surface-border">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs uppercase text-slate-600 dark:bg-surface-card dark:text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Pago</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-surface-border">
            {tablaPedidos.length === 0 && !tablaLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <EmptyState icon="📋" title="Sin pedidos" description="No se encontraron pedidos para los filtros seleccionados." />
                </td>
              </tr>
            )}
            {tablaPedidos.map((p) => (
              <tr key={p.id} className="transition-colors hover:bg-brand-50/50 dark:hover:bg-white/5">
                <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-gray-400">#{p.id}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-gray-300">{p.usuario_id}</td>
                <td className="px-4 py-3">
                  <Badge variant="solid" color={estadoBadgeColor[p.estado_codigo] ?? "brand"}>{p.estado_codigo}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-gray-300">{p.forma_pago_codigo || "-"}</td>
                <td className="px-4 py-3 font-mono text-slate-800 dark:text-gray-100">{formatMoney(p.total)}</td>
                <td className="px-4 py-3 text-xs text-slate-500 dark:text-gray-400">{formatDate(p.created_at)}</td>
                <td className="px-4 py-3">
                  <Link to={`/ventas/${p.id}`}>
                    <Button variant="ghost" size="sm">Ver</Button>
                  </Link>
                </td>
              </tr>
            ))}
            {tablaLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-gray-300">Cargando...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-gray-300">
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
      )}
    </div>
  );
}

import { useState, useEffect } from 'react'
import { useLocation, useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../context/AuthContext'
import { PageTransition } from '../components/PageTransition'
import { api, listDireccionesUsuario, updatePedidoDireccion, cancelarPedido, type DireccionEntregaPublic } from '../services/api'
import { PaymentButton } from '../components/PaymentButton'
import { usePaymentStore } from '../stores/paymentStore'
import { SkeletonPage } from '../components/Skeleton'
import { useOrderStatusWS } from '../hooks/useOrderStatusWS'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useCart } from '../context/CartContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'

interface OrderData {
  id: number
  total: number
  estado_codigo: string
  direccion_entrega_id: number
}

export default function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [direcciones, setDirecciones] = useState<DireccionEntregaPublic[]>([])
  const [selectedDirId, setSelectedDirId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updatingDir, setUpdatingDir] = useState(false)
  const [searchParams] = useSearchParams()
  const paymentSuccess = searchParams.get('payment') === 'success'

  const [timeLeft, setTimeLeft] = useState(() => {
    if (paymentSuccess) return 0
    const saved = sessionStorage.getItem('timer_start')
    if (saved) {
      const elapsed = Math.floor((Date.now() - Number(saved)) / 1000)
      return Math.max(120 - elapsed, 0)
    }
    return 120
  })

  const pedidoQuery = useQuery({
    queryKey: ["cliente-pago-pedido", orderId],
    queryFn: () => api.get(`/pedidos/${orderId}`).then(r => r.data as OrderData),
    enabled: !!orderId && !!user,
  })

  useOrderStatusWS(Number(orderId), [["cliente-pago-pedido", Number(orderId)]])

  const { limpiarCarrito } = useCart()

  useEffect(() => {
    if (pedidoQuery.data?.estado_codigo === "CANCELADO") {
      sessionStorage.removeItem('timer_start')
      sessionStorage.removeItem('prev_cart')
      sessionStorage.removeItem('checkout_pedido_id')
      limpiarCarrito()
      toast.error("Hubo un error, por favor intente nuevamente mas tarde")
      navigate("/home")
    }
  }, [pedidoQuery.data?.estado_codigo, navigate])

  useEffect(() => {
    if (paymentSuccess) {
      sessionStorage.removeItem('timer_start')
      sessionStorage.removeItem('prev_cart')
      sessionStorage.removeItem('checkout_pedido_id')
      limpiarCarrito()
    }
  }, [paymentSuccess, limpiarCarrito])

  useEffect(() => {
    if (!paymentSuccess && !sessionStorage.getItem('timer_start')) {
      sessionStorage.setItem('timer_start', String(Date.now()))
    }
  }, [])

  useEffect(() => {
    const esConfirmado = pedidoQuery.data?.estado_codigo === "CONFIRMADO" || pedidoQuery.data?.estado_codigo === "ENTREGADO"
    if (esConfirmado || paymentSuccess || timeLeft <= 0) return

    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(id)
  }, [pedidoQuery.data?.estado_codigo, timeLeft <= 0, paymentSuccess])

  useEffect(() => {
    if (timeLeft > 0) return
    const esConfirmado = pedidoQuery.data?.estado_codigo === "CONFIRMADO" || pedidoQuery.data?.estado_codigo === "ENTREGADO"
    if (esConfirmado || paymentSuccess) return

    sessionStorage.removeItem('timer_start')
    sessionStorage.removeItem('prev_cart')
    sessionStorage.removeItem('checkout_pedido_id')
    limpiarCarrito()
    cancelarPedido(Number(orderId), "Tiempo de pago agotado").catch(() => {})
    navigate("/tiempo-agotado", { replace: true })
  }, [timeLeft, orderId, navigate, pedidoQuery.data?.estado_codigo, paymentSuccess, limpiarCarrito])

  useEffect(() => {
    const codigo = pedidoQuery.data?.estado_codigo
    if (codigo === "CONFIRMADO" || codigo === "ENTREGADO" || codigo === "CANCELADO") {
      sessionStorage.removeItem('timer_start')
      sessionStorage.removeItem('prev_cart')
      sessionStorage.removeItem('checkout_pedido_id')
      limpiarCarrito()
    }
  }, [pedidoQuery.data?.estado_codigo, limpiarCarrito])

  const paymentStatus = usePaymentStore((s) => s.status)
  const resetPayment = usePaymentStore((s) => s.reset)
  const startCash = usePaymentStore((s) => s.startCash)
  const failPayment = usePaymentStore((s) => s.fail)
  const paymentInitiated = paymentStatus === 'initiated'
  const cashLoading = paymentStatus === 'confirming_cash'

  useEffect(() => {
    resetPayment()
    return () => resetPayment()
  }, [orderId, resetPayment])

  useEffect(() => {
    if (!user || !orderId) return
    listDireccionesUsuario(user.id, 0, 100)
      .then((direccionesRes) => {
        const dirs = (direccionesRes.data ?? [])
          .filter((d) => d.activo)
          .sort((a, b) => Number(b.es_principal) - Number(a.es_principal))
        setDirecciones(dirs)
        if (pedidoQuery.data) {
          setSelectedDirId(pedidoQuery.data.direccion_entrega_id)
        }
      })
      .catch(() => setError('No se pudo cargar la información'))
  }, [orderId, user, pedidoQuery.data])

  const handleCambiarDireccion = async (dirId: number) => {
    if (!pedidoQuery.data || dirId === pedidoQuery.data.direccion_entrega_id) return
    setUpdatingDir(true)
    try {
      const updated = await updatePedidoDireccion(pedidoQuery.data.id, dirId)
      if (pedidoQuery.data) {
        pedidoQuery.data.direccion_entrega_id = updated.direccion_entrega_id
      }
      setSelectedDirId(updated.direccion_entrega_id)
    } catch (err) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string }
      const msg = e.response?.data?.detail || e.message || 'Error al actualizar dirección'
      setError(msg)
    } finally {
      setUpdatingDir(false)
    }
  }

  const pagarEnEfectivo = async () => {
    startCash()
    try {
      await api.patch(`/pedidos/${orderId}/confirmar`, { forma_pago_codigo: "EFECTIVO" })
      resetPayment()
      window.location.href = `/api/v1/pagos/orders/${orderId}/success`
    } catch (err) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string }
      const msg = e.response?.data?.detail || e.message || "Error al confirmar pedido"
      failPayment(msg)
      setError(msg)
    }
  }

  if (pedidoQuery.isLoading) {
    return <SkeletonPage />
  }

  if (error || pedidoQuery.isError || !pedidoQuery.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-stone-100 px-4 text-center dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <h1 className="mb-2 font-display text-2xl font-bold text-brand-900 dark:text-brand-200">No pudimos realizar tu pedido...</h1>
        <p className="mb-6 text-sm text-slate-600 dark:text-gray-300">{error || "No se pudo cargar la información"}</p>
        <Link to="/" className="rounded-lg bg-brand-400 px-6 py-2 text-sm font-medium text-white hover:bg-brand-500">Volver al Catálogo</Link>
      </div>
    )
  }

  const order = pedidoQuery.data
  const selectedDir = direcciones.find(d => d.id === selectedDirId)

  const timerUrgent = timeLeft <= 20 && timeLeft > 0

  return (
    <PageTransition routeKey={location.pathname}>
      <Helmet><title>Finalizar Pedido | Food Store</title></Helmet>
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-stone-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <header className="border-b border-gray-200 bg-white/90 shadow-sm backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Link to="/carrito" className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">&larr; Volver al carrito</Link>
          <h1 className="font-display text-xl font-bold text-brand-900 dark:text-brand-300">Finalizar Pedido</h1>
          {!paymentSuccess && pedidoQuery.data?.estado_codigo !== "CONFIRMADO" && pedidoQuery.data?.estado_codigo !== "ENTREGADO" && timeLeft > 0 && (
            <div className={`rounded-lg px-3 py-1.5 text-sm font-bold tabular-nums transition-all ${
              timerUrgent
                ? "bg-red-100 text-red-700 shadow-neon-sm dark:bg-red-900/50 dark:text-red-300"
                : "bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300"
            }`}>
              <svg className="-mt-0.5 mr-1 inline-block h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <Card variant="neon" padding="lg">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-brand-900 dark:text-brand-300">
              Resumen del Pedido #{order.id}
            </h2>
            <Link to="/productos" className="text-sm text-brand-600 underline hover:text-brand-700 dark:text-brand-400">Volver al catálogo</Link>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-gray-300">Estado</span>
              <Badge variant="solid" color="amber">Pendiente de pago</Badge>
            </div>
            <hr className="border-gray-100 dark:border-surface-border" />
            <div className="flex justify-between">
              <span className="font-display text-lg font-bold text-brand-900 dark:text-brand-300">Total a pagar</span>
              <span className="font-display text-xl font-bold text-brand-600 dark:text-brand-400">
                ${Number(order.total).toFixed(2)}
              </span>
            </div>
          </div>
        </Card>

        <Card variant="default" padding="lg">
          <h2 className="mb-4 font-display text-lg font-semibold text-brand-900 dark:text-brand-300">Dirección de entrega</h2>
          {direcciones.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-gray-300">
              No tenés direcciones cargadas.{' '}
              <Link to="/perfil" className="font-medium text-brand-600 underline dark:text-brand-400">Agregá una desde Mi Perfil</Link>
            </p>
          ) : (
            <div className="space-y-2">
              {direcciones.map((dir) => (
                <label
                  key={dir.id}
                  className={`block cursor-pointer rounded-xl border p-4 transition-all ${
                    selectedDirId === dir.id
                      ? 'border-brand-400 bg-brand-50 shadow-neon-sm dark:border-brand-400 dark:bg-brand-900/20'
                      : 'border-gray-200 hover:border-brand-300 dark:border-surface-border dark:hover:border-brand-400'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="direccion"
                      checked={selectedDirId === dir.id}
                      onChange={() => handleCambiarDireccion(dir.id)}
                      className="mt-1 accent-brand-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800 dark:text-gray-100">{dir.alias}</span>
                        {dir.es_principal && <Badge variant="solid" color="green">Principal</Badge>}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-gray-300">{dir.linea1}{dir.linea2 ? `, ${dir.linea2}` : ''}</p>
                      <p className="text-sm text-slate-600 dark:text-gray-300">{dir.ciudad}, {dir.provincia} ({dir.codigo_postal})</p>
                    </div>
                  </div>
                </label>
              ))}
              {updatingDir && <p className="text-xs text-brand-600">Actualizando dirección...</p>}
            </div>
          )}
        </Card>

        <Card variant="default" padding="lg">
          {paymentSuccess ? (
            <div className="space-y-3">
              <Card variant="neon" padding="lg" className="border-green-500 text-center shadow-neon-sm">
                <div className="mb-2 text-4xl">✅</div>
                <h3 className="font-display text-lg font-semibold text-green-700 dark:text-green-300">¡Pago exitoso!</h3>
                <p className="mt-1 text-sm text-green-600 dark:text-green-400">Tu pedido ya fue confirmado.</p>
              </Card>
              <Button variant="solid" size="lg" className="w-full" onClick={() => navigate(`/cliente/pedido/${order.id}`)}>
                Ver mi pedido
              </Button>
            </div>
          ) : paymentInitiated ? (
            <div className="space-y-3">
              <Card variant="default" padding="md" className="border-brand-300 bg-brand-50 text-center text-sm text-brand-700 dark:border-brand-700 dark:bg-brand-900/20 dark:text-brand-300">
                Pago iniciado. Completalo en MercadoPago y volvé para ver el resultado.
              </Card>
              <Button variant="solid" size="lg" className="w-full" onClick={() => navigate(`/cliente/pedido/${order.id}`)}>
                Ya pagué, ver mi pedido
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50 p-5 dark:border-sky-800 dark:from-sky-900/30 dark:to-cyan-900/20">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-white shadow-md">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sky-900 dark:text-sky-300">MercadoPago</p>
                    <p className="text-sm text-sky-700 dark:text-sky-400">Pagá con tarjeta, débito o transferencia</p>
                  </div>
                </div>
                <PaymentButton pedidoId={order.id} monto={Number(order.total)} />
              </div>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-surface-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs uppercase text-slate-400 dark:bg-surface-card dark:text-gray-500">O</span>
                </div>
              </div>

              <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-5 dark:border-green-800 dark:from-green-900/30 dark:to-emerald-900/20">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-white shadow-md">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-green-900 dark:text-green-300">Efectivo</p>
                    <p className="text-sm text-green-700 dark:text-green-400">Abonás al retirar el pedido</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full border-green-600 text-green-700 hover:bg-green-100 dark:border-green-500 dark:text-green-400 dark:hover:bg-green-900/50"
                  onClick={pagarEnEfectivo}
                  loading={cashLoading}
                >
                  Pagar en efectivo
                </Button>
                <p className="mt-2 text-center text-xs text-slate-400 dark:text-gray-500">El pedido quedará confirmado y lo abonás al retirar.</p>
              </div>
            </>
          )}
        </Card>
      </main>
    </div>
    </PageTransition>
  )
}

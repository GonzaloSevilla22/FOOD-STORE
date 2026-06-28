import { api } from '../services/api'
import { usePaymentStore } from '../stores/paymentStore'

interface PaymentButtonProps {
  pedidoId: number
  monto: number
}

export function PaymentButton({ pedidoId, monto }: PaymentButtonProps) {
  const status = usePaymentStore((s) => s.status)
  const error = usePaymentStore((s) => s.error)
  const startCheckout = usePaymentStore((s) => s.startCheckout)
  const preferenceCreated = usePaymentStore((s) => s.preferenceCreated)
  const fail = usePaymentStore((s) => s.fail)

  const loading = status === 'creating'
  const opened = status === 'initiated'

  const handlePagar = async () => {
    startCheckout(pedidoId)
    try {
      const res = await api.post('/pagos/create-preference', {
        pedido_id: pedidoId,
      })
      const { init_point } = res.data
      if (init_point) {
        window.location.href = init_point
        preferenceCreated(init_point)
      } else {
        fail('No se pudo obtener el link de pago')
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Error al iniciar el pago'
      fail(detail)
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {opened ? (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-center text-sm text-orange-700 dark:border-gray-500 dark:bg-gray-800/50 dark:text-orange-300">
          Redirigiendo a MercadoPago...
        </div>
      ) : (
        <button
          onClick={handlePagar}
          disabled={loading}
          className="w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Iniciando pago...
            </span>
          ) : (
            `Pagar $${monto.toFixed(2)} con MercadoPago`
          )}
        </button>
      )}

      <p className="text-center text-xs text-slate-400 dark:text-gray-300">Pago seguro vía MercadoPago</p>
    </div>
  )
}

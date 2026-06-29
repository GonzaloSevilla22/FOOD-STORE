import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Helmet } from "react-helmet-async"
import { useCart } from "../context/CartContext"
import { PageTransition } from "../components/PageTransition"

export default function TiempoAgotadoPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { limpiarCarrito } = useCart()

  useEffect(() => {
    sessionStorage.removeItem("prev_cart")
    sessionStorage.removeItem("checkout_pedido_id")
    limpiarCarrito()
    const timer = setTimeout(() => navigate("/productos", { replace: true }), 3000)
    return () => clearTimeout(timer)
  }, [navigate, limpiarCarrito])

  return (
    <PageTransition routeKey={location.pathname}>
      <Helmet><title>Tiempo agotado | Food Store</title></Helmet>
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-stone-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex flex-col items-center justify-center text-center px-4">
      <div className="rounded-full bg-red-100 dark:bg-red-900/50 p-6 mb-6">
        <span className="text-5xl">⏰</span>
      </div>
      <h1 className="text-2xl font-bold text-orange-950 dark:text-orange-200 mb-2">Tiempo agotado</h1>
      <p className="text-slate-600 dark:text-gray-300 mb-6 max-w-md">
        El tiempo para completar el pago ha expirado. Los productos han sido devueltos al stock.
      </p>
      <p className="text-sm text-slate-400 dark:text-gray-300">Serás redirigido al catálogo en 3 segundos...</p>
    </div>
    </PageTransition>
  )
}
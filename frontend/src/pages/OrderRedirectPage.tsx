import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { verifyPayment } from "../services/api";
import { useCart } from "../context/CartContext";

export default function OrderRedirectPage() {
  const { pedidoId, status } = useParams<{ pedidoId: string; status: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { limpiarCarrito } = useCart();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const id = Number(pedidoId);

  useEffect(() => {
    if (Number.isNaN(id)) {
      setResult({ ok: false, msg: "ID de pedido inválido." });
      return;
    }

    // Verificar estado real del pago contra MP usando el endpoint de verificación
    verifyPayment(id)
      .then((res) => {
        if (res.estado === "aprobado") {
          sessionStorage.removeItem("prev_cart");
          sessionStorage.removeItem("checkout_pedido_id");
          limpiarCarrito(false);
          setResult({ ok: true, msg: "Pago aprobado correctamente." });
        } else if (res.estado === "rechazado") {
          setResult({ ok: false, msg: "El pago fue rechazado." });
        } else {
          setResult({ ok: true, msg: "Pago registrado. Estado: " + (res.estado ?? "pendiente") });
        }
      })
      .catch((err: Error) => {
        setResult({ ok: false, msg: err.message });
      });
  }, [id]);

  // Auto-redirect a /pedido/{id} después de 3 segundos
  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => {
        navigate(`/cliente/pedido/${id}`, { replace: true });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [result, id, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-stone-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="w-full max-w-md rounded-xl border border-orange-100 dark:border-gray-500 bg-white/90 dark:bg-gray-800/90 p-8 text-center shadow-sm backdrop-blur">
        {!result ? (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-orange-200 dark:border-gray-500 border-t-orange-600" />
            <p className="text-slate-600 dark:text-gray-300">Verificando pago con MercadoPago...</p>
          </>
        ) : result.ok ? (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50 text-3xl text-green-600 dark:text-green-400">
              &#10003;
            </div>
            <h1 className="mb-2 text-xl font-bold text-orange-950 dark:text-orange-200">Pago exitoso</h1>
            <p className="mb-6 text-slate-600 dark:text-gray-300">{result.msg}</p>
            <p className="text-sm text-slate-400 dark:text-gray-300">Redirigiendo al pedido...</p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50 text-3xl text-red-600 dark:text-red-400">
              &#10007;
            </div>
            <h1 className="mb-2 text-xl font-bold text-orange-950 dark:text-orange-200">Error en el pago</h1>
            <p className="mb-6 text-slate-600 dark:text-gray-300">{result.msg}</p>
            <p className="text-sm text-slate-400 dark:text-gray-300">Redirigiendo al pedido...</p>
          </>
        )}
      </div>
    </div>
  );
}

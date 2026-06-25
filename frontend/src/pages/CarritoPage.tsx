import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { actualizarItemsPedido, createPedido, listDireccionesUsuario } from "../services/api";
import { EmptyState } from "../components/EmptyState";
import type { CartItem } from "../stores/cartStore";

export function CarritoPage(): JSX.Element {
  const { items, total, removerProducto, modificarCantidad, limpiarCarrito, agregarProducto } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    if (items.length === 0) {
      const saved = sessionStorage.getItem("prev_cart");
      if (saved) {
        try {
          const restored: CartItem[] = JSON.parse(saved);
          restored.forEach((item) => agregarProducto(item));
        } catch { /* ignore */ }
        sessionStorage.removeItem("prev_cart");
      }
    }
  }, []);

  const handleCheckout = async (): Promise<void> => {
    if (!user) {
      navigate("/login?redirect=/carrito");
      return;
    }

    if (items.length === 0) {
      toast.info("Tu carrito está vacío.");
      return;
    }

    setCheckoutLoading(true);
    try {
      const direcciones = await listDireccionesUsuario(user.id, 0, 50);
      const direccion =
        direcciones.data.find((item) => item.es_principal && item.activo) ??
        direcciones.data.find((item) => item.activo) ??
        null;

      if (!direccion) {
        toast.error("No tienes dirección de entrega cargada. Carga una dirección para finalizar el checkout.");
        return;
      }

      const payload = {
        direccion_entrega_id: direccion.id,
        detalles: items.map((item) => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
        })),
        notas: "Checkout con pago online",
      };

      const savedId = sessionStorage.getItem("checkout_pedido_id");
      let pedidoId: number;

      if (savedId) {
        const oldId = parseInt(savedId, 10);
        if (!isNaN(oldId)) {
          try {
            await actualizarItemsPedido(oldId, payload);
            pedidoId = oldId;
          } catch {
            sessionStorage.removeItem("checkout_pedido_id");
            const pedido = await createPedido(payload);
            pedidoId = pedido.id;
            sessionStorage.setItem("checkout_pedido_id", String(pedidoId));
          }
        } else {
          sessionStorage.removeItem("checkout_pedido_id");
          const pedido = await createPedido(payload);
          pedidoId = pedido.id;
          sessionStorage.setItem("checkout_pedido_id", String(pedidoId));
        }
      } else {
        const pedido = await createPedido(payload);
        pedidoId = pedido.id;
        sessionStorage.setItem("checkout_pedido_id", String(pedidoId));
      }

      sessionStorage.setItem("prev_cart", JSON.stringify(items));
      navigate(`/payment/${pedidoId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo realizar el checkout";
      toast.error(message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (items.length === 0) {
    return <EmptyState icon="🛒" title="Tu carrito está vacío" description="Agrega productos para comenzar" action={{ label: "Ver Productos", to: "/productos" }} />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-orange-900 dark:text-orange-300">Mi Carrito</h1>

      <div className="rounded-lg border border-orange-100 dark:border-gray-500 bg-white/90 dark:bg-gray-800/90 p-6 shadow-sm">
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.producto_id}
              className="flex items-center justify-between border-b border-orange-100 dark:border-gray-500 pb-4 last:border-0"
            >
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 dark:text-orange-300">{item.nombre}</h3>
                <p className="text-sm text-orange-700 dark:text-orange-300">${item.precio.toFixed(2)}</p>
              </div>

              <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={item.cantidad <= 1}
              onClick={() => modificarCantidad(item.producto_id, item.cantidad - 1).catch(() => toast.error("No hay más stock disponible"))}
              className="rounded border border-orange-200 dark:border-gray-500 bg-orange-50 dark:bg-gray-800/50 px-2 py-1 text-sm text-orange-900 dark:text-orange-300 transition-colors hover:bg-orange-100 dark:hover:bg-gray-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              −
            </button>
                <input
                  type="number"
                  min="1"
                  value={item.cantidad}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 1) {
                      modificarCantidad(item.producto_id, val).catch(() => toast.error("No hay más stock disponible"));
                    }
                  }}
                  className="w-12 rounded border border-orange-200 dark:border-gray-500 px-2 py-1 text-center text-sm dark:bg-gray-800 dark:text-gray-100"
                />
            <button
              type="button"
              onClick={() => modificarCantidad(item.producto_id, item.cantidad + 1).catch(() => toast.error("No hay más stock disponible"))}
              className="rounded border border-orange-200 dark:border-gray-500 bg-orange-50 dark:bg-gray-800/50 px-2 py-1 text-sm text-orange-900 dark:text-orange-300 transition-colors hover:bg-orange-100 dark:hover:bg-gray-700 active:scale-95"
            >
              +
            </button>
              </div>

              <div className="w-24 text-right">
                <p className="font-semibold text-orange-900 dark:text-orange-300">
                  ${(item.precio * item.cantidad).toFixed(2)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => removerProducto(item.producto_id)}
                className="ml-4 rounded bg-red-100 dark:bg-red-900/50 px-3 py-1 text-sm text-red-700 dark:text-red-300 hover:bg-red-200"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-4 border-t border-orange-100 dark:border-gray-500 pt-6">
          <div className="flex justify-between text-lg font-bold text-orange-900 dark:text-orange-300">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>

          <div className="flex gap-3">
            <a
              href="/productos"
              className="flex-1 rounded border border-orange-200 dark:border-gray-500 bg-orange-50 dark:bg-gray-800/50 px-4 py-2 text-center font-medium text-orange-900 dark:text-orange-300 transition-colors hover:bg-orange-100 dark:hover:bg-gray-700"
            >
              Seguir Comprando
            </a>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="flex-1 rounded bg-orange-500 px-4 py-2 font-medium text-white transition-all duration-150 hover:bg-orange-600 active:scale-95 disabled:active:scale-100"
            >
              {checkoutLoading ? "Procesando..." : "Ir a Checkout"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}




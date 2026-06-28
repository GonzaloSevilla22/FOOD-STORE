import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { actualizarItemsPedido, createPedido, listDireccionesUsuario } from "../services/api";
import { EmptyState } from "../components/EmptyState";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
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
    <div className="space-y-5">
      <Helmet><title>Mi Carrito | Food Store</title></Helmet>
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900 dark:text-brand-300">Mi Carrito</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">
          {items.length} {items.length === 1 ? "producto" : "productos"} en tu carrito
        </p>
      </div>

      <Card padding="lg" className="space-y-4">
        {items.map((item) => (
          <div
            key={item.producto_id}
            className="flex flex-wrap items-center gap-4 border-b border-gray-100 pb-4 last:border-0 last:pb-0 dark:border-surface-border"
          >
            {item.imagen && (
              <img
                src={item.imagen}
                alt={item.nombre}
                className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-slate-800 dark:text-gray-100">{item.nombre}</h3>
              <p className="text-sm text-slate-500 dark:text-gray-300">${item.precio.toFixed(2)} c/u</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={item.cantidad <= 1}
                onClick={() => modificarCantidad(item.producto_id, item.cantidad - 1).catch(() => toast.error("No hay más stock disponible"))}
              >
                −
              </Button>
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
                className="w-14 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm tabular-nums focus:border-brand-400 focus:outline-none dark:border-surface-border dark:bg-surface-card dark:text-gray-100"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => modificarCantidad(item.producto_id, item.cantidad + 1).catch(() => toast.error("No hay más stock disponible"))}
              >
                +
              </Button>
            </div>

            <div className="w-24 text-right">
              <p className="font-bold tabular-nums text-brand-700 dark:text-brand-300">
                ${(item.precio * item.cantidad).toFixed(2)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => removerProducto(item.producto_id)}
              className="flex h-7 w-7 items-center justify-center rounded text-sm font-bold text-red-500 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
              aria-label="Eliminar"
            >
              ✕
            </button>
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-4 dark:border-surface-border">
          <span className="font-display text-xl font-bold text-brand-900 dark:text-brand-300">
            Total: <span className="text-brand-600 dark:text-brand-400">${total.toFixed(2)}</span>
          </span>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/productos")}>
              Seguir Comprando
            </Button>
            <Button variant="solid" onClick={handleCheckout} loading={checkoutLoading}>
              Ir a Checkout
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { useCartStore } from "../stores/cartStore";
import { useCart } from "../context/CartContext";
import { cn } from "../lib/utils";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

interface SidebarCartProps {
  open: boolean;
  onClose: () => void;
}

export function SidebarCart({ open, onClose }: SidebarCartProps): JSX.Element {
  const { items, total, modificarCantidad, removerProducto } = useCart();
  const itemCount = useCartStore((s) => s.itemCount());
  const navigate = useNavigate();

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      )}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 dark:bg-surface-card",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 dark:border-surface-border">
          <h2 className="font-display text-lg font-semibold text-brand-900 dark:text-brand-300">
            Mi Carrito
            <span className="ml-2 text-sm font-normal text-slate-500 dark:text-gray-300">({itemCount} items)</span>
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar carrito">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-16 text-center">
              <div className="mb-4 text-5xl">🛒</div>
              <p className="font-medium text-slate-700 dark:text-gray-300">Tu carrito está vacío</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-gray-300">Agregá productos para comenzar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <Card key={item.producto_id} padding="sm" className="flex items-center gap-3">
                  {item.imagen && (
                    <img
                      src={item.imagen}
                      alt={item.nombre}
                      className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-gray-100">{item.nombre}</p>
                    <p className="text-xs text-slate-500 dark:text-gray-300">${item.precio.toFixed(2)} c/u</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={item.cantidad <= 1}
                      onClick={(e) => { e.stopPropagation(); modificarCantidad(item.producto_id, item.cantidad - 1); }}
                      className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-sm font-medium text-slate-600 transition-colors hover:bg-gray-100 disabled:opacity-30 dark:border-surface-border dark:text-gray-300 dark:hover:bg-white/10"
                    >
                      −
                    </button>
                    <span className="flex h-7 w-8 items-center justify-center text-sm font-medium tabular-nums text-slate-800 dark:text-gray-100">
                      {item.cantidad}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); modificarCantidad(item.producto_id, item.cantidad + 1); }}
                      className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-sm font-medium text-slate-600 transition-colors hover:bg-gray-100 dark:border-surface-border dark:text-gray-300 dark:hover:bg-white/10"
                    >
                      +
                    </button>
                  </div>
                  <div className="min-w-[4rem] text-right">
                    <p className="text-sm font-semibold tabular-nums text-brand-700 dark:text-brand-300">
                      ${(item.precio * item.cantidad).toFixed(2)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removerProducto(item.producto_id); }}
                    className="flex h-7 w-7 items-center justify-center rounded text-sm font-bold text-red-500 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
                    aria-label="Eliminar"
                  >
                    ✕
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-gray-200 px-4 py-4 dark:border-surface-border">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600 dark:text-gray-300">Total</span>
              <span className="text-lg font-bold tabular-nums text-brand-600 dark:text-brand-400">
                ${total.toFixed(2)}
              </span>
            </div>
            <Button
              variant="solid"
              size="lg"
              className="w-full"
              onClick={() => { onClose(); navigate("/carrito"); }}
            >
              Ir a Checkout
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

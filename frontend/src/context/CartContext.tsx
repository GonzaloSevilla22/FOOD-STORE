import { useCartStore, type CartItem } from "../stores/cartStore";

export type { CartItem };

export interface CartContextValue {
  items: CartItem[];
  total: number;
  agregarProducto: (producto: CartItem) => void;
  removerProducto: (producto_id: number) => void;
  modificarCantidad: (producto_id: number, cantidad: number) => Promise<void>;
  limpiarCarrito: (liberar?: boolean) => void;
}

/**
 * Passthrough. El carrito vive en `useCartStore` (Zustand, persistido), así que
 * no hace falta Context/Provider. Se conserva el componente para no tocar el
 * árbol de App.tsx.
 */
export function CartProvider({ children }: { children: React.ReactNode }): JSX.Element {
  return <>{children}</>;
}

/**
 * Hook adapter sobre `useCartStore` (consigna §12 — suscripción por slice).
 * Mantiene la interfaz del antiguo CartContext (`total` como número derivado).
 */
export function useCart(): CartContextValue {
  const items = useCartStore((s) => s.items);
  const agregarProducto = useCartStore((s) => s.agregarProducto);
  const removerProducto = useCartStore((s) => s.removerProducto);
  const modificarCantidad = useCartStore((s) => s.modificarCantidad);
  const limpiarCarrito = useCartStore((s) => s.limpiarCarrito);

  const total = items.reduce((sum, item) => sum + item.precio * item.cantidad, 0);

  return { items, total, agregarProducto, removerProducto, modificarCantidad, limpiarCarrito };
}

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { liberarStock, reservarStock } from "../services/api";

/** Clave de persistencia del carrito (items completos — consigna §12). */
const CART_STORAGE_KEY = "food_store_cart";

export interface CartItem {
  producto_id: number;
  nombre: string;
  precio: number;
  cantidad: number;
  imagen?: string;
}

interface CartStoreState {
  items: CartItem[];
  agregarProducto: (producto: CartItem) => void;
  removerProducto: (producto_id: number) => void;
  modificarCantidad: (producto_id: number, cantidad: number) => Promise<void>;
  limpiarCarrito: (liberar?: boolean) => void;
  /** Selector: total a pagar. Consumir como `useCartStore((s) => s.total())`. */
  total: () => number;
  /** Selector: cantidad total de unidades en el carrito. */
  itemCount: () => number;
}

/**
 * Store global del carrito (Zustand, consigna §12).
 *
 * Persiste los items completos. Se consume por slice vía el hook adapter
 * `useCart` y directamente (badge de cantidad) con
 * `useCartStore((s) => s.itemCount())`.
 */
export const useCartStore = create<CartStoreState>()(
  persist(
    (set, get) => ({
      items: [],

      agregarProducto: (producto) =>
        set((state) => {
          const existente = state.items.find((item) => item.producto_id === producto.producto_id);
          if (existente) {
            return {
              items: state.items.map((item) =>
                item.producto_id === producto.producto_id
                  ? { ...item, cantidad: item.cantidad + producto.cantidad }
                  : item
              ),
            };
          }
          return { items: [...state.items, producto] };
        }),

      removerProducto: (producto_id) => {
        const item = get().items.find((i) => i.producto_id === producto_id);
        if (item) {
          liberarStock(item.producto_id, item.cantidad).catch(() => {});
        }
        set((state) => ({ items: state.items.filter((item) => item.producto_id !== producto_id) }));
      },

      modificarCantidad: async (producto_id, cantidad) => {
        const item = get().items.find((i) => i.producto_id === producto_id);
        if (!item) return;

        if (cantidad <= 0) {
          await liberarStock(producto_id, item.cantidad);
          set((state) => ({
            items: state.items.filter((i) => i.producto_id !== producto_id),
          }));
          return;
        }

        if (cantidad > item.cantidad) {
          await reservarStock(producto_id, cantidad - item.cantidad);
        } else if (cantidad < item.cantidad) {
          await liberarStock(producto_id, item.cantidad - cantidad);
        }

        set((state) => ({
          items: state.items.map((i) =>
            i.producto_id === producto_id ? { ...i, cantidad } : i
          ),
        }));
      },

      limpiarCarrito: (liberar = true) => {
        if (liberar) {
          const items = get().items;
          items.forEach((item) => {
            liberarStock(item.producto_id, item.cantidad).catch(() => {});
          });
        }
        set({ items: [] });
      },

      total: () => get().items.reduce((sum, item) => sum + item.precio * item.cantidad, 0),

      itemCount: () => get().items.reduce((sum, item) => sum + item.cantidad, 0),
    }),
    {
      name: CART_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Consigna §12: persiste los items completos.
      partialize: (state) => ({ items: state.items }),
    }
  )
);

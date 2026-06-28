import { create } from "zustand";

interface UIStoreState {
  /** Menú de navegación (hamburguesa) abierto/cerrado. */
  navMenuOpen: boolean;
  toggleNavMenu: () => void;
  setNavMenuOpen: (open: boolean) => void;
  closeNavMenu: () => void;
}

/**
 * Store global de UI local (Zustand, consigna §12).
 *
 * Estado de interfaz efímero que no pertenece ni al servidor (TanStack Query)
 * ni a un dominio concreto: por ahora la apertura del menú de navegación.
 */
export const useUIStore = create<UIStoreState>((set) => ({
  navMenuOpen: false,
  toggleNavMenu: () => set((state) => ({ navMenuOpen: !state.navMenuOpen })),
  setNavMenuOpen: (open) => set({ navMenuOpen: open }),
  closeNavMenu: () => set({ navMenuOpen: false }),
}));

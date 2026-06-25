import { create } from "zustand";

/** Estados del proceso de pago (consigna §12 — store de "proceso de pago"). */
export type PaymentStatus =
  | "idle"
  | "creating"
  | "initiated"
  | "confirming_cash"
  | "error";

interface PaymentStoreState {
  status: PaymentStatus;
  pedidoId: number | null;
  initPoint: string | null;
  error: string | null;
  /** Arranca el checkout de MercadoPago (creando la preferencia). */
  startCheckout: (pedidoId: number) => void;
  /** La preferencia se creó y se abrió el init_point de MP. */
  preferenceCreated: (initPoint: string | null) => void;
  /** Arranca la confirmación de pago en efectivo. */
  startCash: () => void;
  /** Falla del proceso de pago con un mensaje. */
  fail: (message: string) => void;
  /** Reinicia el proceso (al entrar/salir de la pantalla de pago). */
  reset: () => void;
}

/**
 * Store global del proceso de pago (Zustand, consigna §12).
 *
 * Coordina el estado del checkout entre `PaymentButton` (inicia la preferencia
 * de MercadoPago) y `PaymentPage` (muestra el panel "pago iniciado" / efectivo).
 * Es efímero: no se persiste.
 */
export const usePaymentStore = create<PaymentStoreState>((set) => ({
  status: "idle",
  pedidoId: null,
  initPoint: null,
  error: null,

  startCheckout: (pedidoId) => set({ status: "creating", pedidoId, error: null }),
  preferenceCreated: (initPoint) => set({ status: "initiated", initPoint }),
  startCash: () => set({ status: "confirming_cash", error: null }),
  fail: (message) => set({ status: "error", error: message }),
  reset: () => set({ status: "idle", pedidoId: null, initPoint: null, error: null }),
}));

import { create } from "zustand";

/** Estados posibles de una conexión WebSocket (consigna §9.6). */
export type WSStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

interface WSStoreState {
  /** Estado por canal (ej. "admin:pedidos", "pedido:42"). */
  connections: Record<string, WSStatus>;
  /** Último evento recibido por canal (payload §9.4). */
  lastEvents: Record<string, unknown>;
  setStatus: (channel: string, status: WSStatus) => void;
  setLastEvent: (channel: string, event: unknown) => void;
  reset: (channel: string) => void;
}

/**
 * Store global de conexiones WebSocket (Zustand, consigna §12).
 *
 * Lo escribe `useWebSocketChannel` y lo lee el `RealtimeBadge` para mostrar el
 * indicador de tiempo real sin polling.
 */
export const useWSStore = create<WSStoreState>((set) => ({
  connections: {},
  lastEvents: {},
  setStatus: (channel, status) =>
    set((state) => ({ connections: { ...state.connections, [channel]: status } })),
  setLastEvent: (channel, event) =>
    set((state) => ({ lastEvents: { ...state.lastEvents, [channel]: event } })),
  reset: (channel) =>
    set((state) => {
      const connections = { ...state.connections };
      const lastEvents = { ...state.lastEvents };
      delete connections[channel];
      delete lastEvents[channel];
      return { connections, lastEvents };
    }),
}));

import { useEffect, useRef } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../context/AuthContext";
import { getAdminPedidosWebSocketUrl, getPedidoWebSocketUrl } from "../services/api";
import { useWSStore, type WSStatus } from "../stores/wsStore";
import { useAuthStore } from "../stores/authStore";

const DEFAULT_MAX_RETRIES = 10;
const MAX_BACKOFF_MS = 30_000;

interface ChannelOptions {
  /** Identificador del canal en el wsStore (ej. "admin:pedidos"). */
  channel: string;
  /** Construye la URL del WS (con token). Devuelve null si no hay token. */
  buildUrl: () => string | null;
  enabled?: boolean;
  maxRetries?: number;
  /** Se llama con el payload §9.4 en cada mensaje. */
  onEvent?: (data: unknown) => void;
  /** Se llama al reconectar tras una caída (resync, §9.6). */
  onReconnect?: () => void;
}

/**
 * Conexión WebSocket resiliente a un canal (consigna §9.6).
 *
 * - Reconexión con backoff exponencial (1s, 2s, 4s… hasta 30s), tope de intentos.
 * - Refleja el estado en el `wsStore` por canal.
 * - Al reconectar dispara `onReconnect` para resincronizar datos.
 */
export function useWebSocketChannel({
  channel,
  buildUrl,
  enabled = true,
  maxRetries = DEFAULT_MAX_RETRIES,
  onEvent,
  onReconnect,
}: ChannelOptions): void {
  const setStatus = useWSStore((s) => s.setStatus);
  const setLastEvent = useWSStore((s) => s.setLastEvent);

  // Callbacks/URL en refs: cambian seguido pero no deben reiniciar la conexión.
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);
  const buildUrlRef = useRef(buildUrl);
  onEventRef.current = onEvent;
  onReconnectRef.current = onReconnect;
  buildUrlRef.current = buildUrl;

  useEffect(() => {
    if (!enabled) {
      setStatus(channel, "disconnected");
      return;
    }

    let ws: WebSocket | null = null;
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let closedByUs = false;
    let hadConnection = false;

    const update = (status: WSStatus) => setStatus(channel, status);

    const connect = () => {
      const url = buildUrlRef.current();
      if (!url) {
        update("disconnected");
        return;
      }
      update(retries > 0 ? "reconnecting" : "connecting");
      ws = new WebSocket(url);

      ws.onopen = () => {
        retries = 0;
        update("connected");
        if (hadConnection) {
          // Reconexión: el estado del server pudo cambiar mientras no había WS.
          onReconnectRef.current?.();
        }
        hadConnection = true;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent(channel, data);
          onEventRef.current?.(data);
        } catch {
          // Mensajes que no son JSON (ej. pings) se ignoran.
        }
      };

      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          /* noop */
        }
      };

      ws.onclose = () => {
        if (closedByUs) return;
        if (retries < maxRetries) {
          const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** retries);
          retries += 1;
          update("reconnecting");
          timer = setTimeout(connect, delay);
        } else {
          // Se agotaron los intentos → badge "Sin conexión en tiempo real".
          update("disconnected");
        }
      };
    };

    connect();

    return () => {
      closedByUs = true;
      if (timer) clearTimeout(timer);
      try {
        ws?.close();
      } catch {
        /* noop */
      }
      setStatus(channel, "disconnected");
    };
  }, [channel, enabled, maxRetries, setStatus, setLastEvent]);
}

/**
 * Sigue el estado de UN pedido en tiempo real (cliente) e invalida sus queries
 * de TanStack Query cuando llega un evento §9.4 (consigna §9.5).
 */
export function useOrderStatusWS(pedidoId: number, queryKeys: QueryKey[]): void {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const keysRef = useRef(queryKeys);
  keysRef.current = queryKeys;

  const resync = () => {
    keysRef.current.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  };

  const tabId = useAuthStore((s) => s.tabId);
  useWebSocketChannel({
    channel: `pedido:${pedidoId}`,
    enabled: Boolean(token) && Number.isFinite(pedidoId),
    buildUrl: () => (token ? getPedidoWebSocketUrl(pedidoId, token, tabId) : null),
    onEvent: resync,
    onReconnect: resync,
  });
}

/**
 * Feed admin de todos los pedidos en tiempo real (consigna §9.2/§9.5).
 * Llama a `onEvent` en cada cambio de estado y al reconectar (resync).
 */
export function useAdminOrdersFeed(onEvent: () => void, enabled = true): void {
  const { token } = useAuth();
  const tabId = useAuthStore((s) => s.tabId);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useWebSocketChannel({
    channel: "admin:pedidos",
    enabled: enabled && Boolean(token),
    buildUrl: () => (token ? getAdminPedidosWebSocketUrl(token, tabId) : null),
    onEvent: () => onEventRef.current(),
    onReconnect: () => onEventRef.current(),
  });
}

import { useQueryClient } from "@tanstack/react-query";
import { useWSStore } from "../stores/wsStore";
import { getProductosWebSocketUrl } from "../services/api";
import { useEffect, useRef } from "react";
import type { WSStatus } from "../stores/wsStore";

const MAX_RETRIES = 10;
const MAX_BACKOFF_MS = 30_000;

interface ProductosWSOptions {
  enabled?: boolean;
  onEvent?: (data: unknown) => void;
}

export function useProductosWS({ enabled = true, onEvent }: ProductosWSOptions = {}): void {
  const queryClient = useQueryClient();
  const setStatus = useWSStore((s) => s.setStatus);
  const setLastEvent = useWSStore((s) => s.setLastEvent);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const channel = "productos";

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
      const url = getProductosWebSocketUrl();
      update(retries > 0 ? "reconnecting" : "connecting");
      ws = new WebSocket(url);

      ws.onopen = () => {
        retries = 0;
        update("connected");
        if (hadConnection) {
          queryClient.invalidateQueries({ queryKey: ["productos"] });
          queryClient.invalidateQueries({ queryKey: ["productos", "cliente-catalogo"] });
          queryClient.invalidateQueries({ queryKey: ["ingredientes"] });
        }
        hadConnection = true;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent(channel, data);
          if (data.event === "PRODUCTO_UPDATED" || data.event === "INGREDIENTE_UPDATED") {
            queryClient.invalidateQueries({ queryKey: ["productos"] });
            queryClient.invalidateQueries({ queryKey: ["productos", "cliente-catalogo"] });
            queryClient.invalidateQueries({ queryKey: ["ingredientes"] });
          }
          onEventRef.current?.(data);
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        try { ws?.close(); } catch { /* noop */ }
      };

      ws.onclose = () => {
        if (closedByUs) return;
        if (retries < MAX_RETRIES) {
          const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** retries);
          retries += 1;
          update("reconnecting");
          timer = setTimeout(connect, delay);
        } else {
          update("disconnected");
        }
      };
    };

    connect();

    return () => {
      closedByUs = true;
      if (timer) clearTimeout(timer);
      try { ws?.close(); } catch { /* noop */ }
      setStatus(channel, "disconnected");
    };
  }, [channel, enabled, queryClient, setStatus, setLastEvent]);
}

import { useWSStore, type WSStatus } from "../stores/wsStore";

const STYLES: Record<WSStatus, { dot: string; text: string; label: string }> = {
  idle: { dot: "bg-slate-300 dark:bg-slate-500", text: "text-slate-500 dark:text-slate-400", label: "Conectando…" },
  connecting: { dot: "bg-amber-400 animate-pulse", text: "text-amber-600 dark:text-amber-400", label: "Conectando…" },
  connected: { dot: "bg-green-500", text: "text-green-700 dark:text-green-400", label: "En vivo" },
  reconnecting: { dot: "bg-amber-400 animate-pulse", text: "text-amber-600 dark:text-amber-400", label: "Reconectando…" },
  disconnected: { dot: "bg-red-500", text: "text-red-600 dark:text-red-400", label: "Sin conexión en tiempo real" },
};

interface RealtimeBadgeProps {
  channel: string;
}

/** Indicador del estado de la conexión WebSocket de un canal (consigna §9.6). */
export function RealtimeBadge({ channel }: RealtimeBadgeProps): JSX.Element {
  const status = useWSStore((s) => s.connections[channel]) ?? "idle";
  const style = STYLES[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${style.text}`}
      title={`Tiempo real: ${style.label}`}
    >
      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

export const estadoColors: Record<string, { bg: string; text: string; solid: string }> = {
  PENDIENTE: { bg: "bg-yellow-100 dark:bg-yellow-900/50", text: "text-yellow-800 dark:text-yellow-300", solid: "bg-yellow-500 dark:bg-yellow-600" },
  CONFIRMADO: { bg: "bg-blue-100 dark:bg-blue-900/50", text: "text-blue-800 dark:text-blue-300", solid: "bg-blue-500 dark:bg-blue-600" },
  EN_PREP: { bg: "bg-purple-100 dark:bg-purple-900/50", text: "text-purple-800 dark:text-purple-300", solid: "bg-purple-500 dark:bg-purple-600" },
  A_ENTREGAR: { bg: "bg-orange-100 dark:bg-orange-900/50", text: "text-orange-800 dark:text-orange-300", solid: "bg-orange-500 dark:bg-orange-600" },
  ESPERANDO_CLIENTE: { bg: "bg-amber-100 dark:bg-amber-900/50", text: "text-amber-800 dark:text-amber-300", solid: "bg-amber-500 dark:bg-amber-600" },
  ENTREGADO: { bg: "bg-green-100 dark:bg-green-900/50", text: "text-green-800 dark:text-green-300", solid: "bg-green-600 dark:bg-green-700" },
  CANCELADO: { bg: "bg-red-100 dark:bg-red-900/50", text: "text-red-800 dark:text-red-300", solid: "bg-red-500 dark:bg-red-600" },
};

export const estadoLabels: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Pagado",
  EN_PREP: "Preparando",
  A_ENTREGAR: "A Entregar",
  ESPERANDO_CLIENTE: "Esperando Cliente",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

export const actionLabels: Record<string, string> = {
  ESPERANDO_CLIENTE: "Entregar",
};

export const ALL_ESTADOS = ["PENDIENTE", "CONFIRMADO", "EN_PREP", "A_ENTREGAR", "ESPERANDO_CLIENTE", "ENTREGADO", "CANCELADO"] as const;

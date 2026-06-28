import { estadoColors } from "../constants/ui";

interface BadgeProps {
  estado: string;
  variant?: "light" | "solid";
  className?: string;
}

export function Badge({ estado, variant = "light", className = "" }: BadgeProps): JSX.Element {
  const colors = estadoColors[estado] ?? { bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-800 dark:text-gray-200", solid: "bg-gray-500 dark:bg-gray-600" };

  if (variant === "solid") {
    return (
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${colors.solid} ${className}`}>
        {estado}
      </span>
    );
  }

  return (
    <span className={`rounded-full px-3 py-1 text-sm font-medium ${colors.bg} ${colors.text} ${className}`}>
      {estado}
    </span>
  );
}

import { cn } from "../../lib/utils";

type BadgeColor = "brand" | "fuchsia" | "violet" | "green" | "red" | "amber";
type BadgeVariant = "solid" | "outline" | "dot";

interface BadgeProps {
  variant?: BadgeVariant;
  color?: BadgeColor;
  children: React.ReactNode;
  className?: string;
}

const colorMap: Record<BadgeColor, { solid: string; outline: string; dot: string }> = {
  brand: {
    solid: "bg-brand-500 text-white",
    outline: "border-brand-500 text-brand-600 dark:text-brand-400",
    dot: "bg-brand-500",
  },
  fuchsia: {
    solid: "bg-neon-fuchsia text-white",
    outline: "border-neon-fuchsia text-neon-fuchsia",
    dot: "bg-neon-fuchsia",
  },
  violet: {
    solid: "bg-neon-violet text-white",
    outline: "border-neon-violet text-neon-violet",
    dot: "bg-neon-violet",
  },
  green: {
    solid: "bg-green-600 text-white",
    outline: "border-green-600 text-green-700 dark:text-green-400",
    dot: "bg-green-600",
  },
  red: {
    solid: "bg-red-600 text-white",
    outline: "border-red-600 text-red-700 dark:text-red-400",
    dot: "bg-red-600",
  },
  amber: {
    solid: "bg-amber-500 text-white",
    outline: "border-amber-500 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
};

export function Badge({
  variant = "solid",
  color = "brand",
  children,
  className,
}: BadgeProps): JSX.Element {
  const colors = colorMap[color];

  if (variant === "dot") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-sm text-slate-700 dark:text-gray-300", className)}>
        <span className={cn("inline-block h-2 w-2 rounded-full", colors.dot)} />
        {children}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide",
        variant === "solid" && colors.solid,
        variant === "outline" && `border ${colors.outline}`,
        className
      )}
    >
      {children}
    </span>
  );
}

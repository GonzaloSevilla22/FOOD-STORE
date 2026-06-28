import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "interactive" | "neon";
  padding?: "none" | "sm" | "md" | "lg";
  children: ReactNode;
}

export function Card({
  variant = "default",
  padding = "md",
  children,
  className,
  ...props
}: CardProps): JSX.Element {
  return (
    <div
      className={cn(
        "rounded-xl border shadow-sm transition-all duration-200",
        // variants
        variant === "default" && "border-gray-200 bg-white dark:border-surface-border dark:bg-surface-card",
        variant === "interactive" && "border-gray-200 bg-white hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-neon-sm dark:border-surface-border dark:bg-surface-card",
        variant === "neon" && "border-brand-400 bg-white shadow-neon-sm dark:bg-surface-card",
        // padding
        padding === "none" && "p-0",
        padding === "sm" && "p-3",
        padding === "md" && "p-4",
        padding === "lg" && "p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

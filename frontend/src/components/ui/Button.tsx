import type { ReactNode, ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "solid",
  size = "md",
  loading,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps): JSX.Element {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-wide transition-all duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-50",
        // variants
        variant === "solid" && "bg-brand-400 text-white shadow-sm hover:bg-brand-500 hover:shadow-neon-sm",
        variant === "outline" && "border border-brand-400 text-brand-400 hover:bg-brand-50 dark:border-brand-400 dark:text-brand-300 dark:hover:bg-white/5",
        variant === "ghost" && "text-brand-400 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-white/5",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        // sizes
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-6 py-3 text-base",
        className
      )}
      {...props}
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeLinecap="round" />
        </svg>
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
}

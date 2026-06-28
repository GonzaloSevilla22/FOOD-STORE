import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  prefixIcon?: ReactNode;
}

export function Input({
  label,
  error,
  helperText,
  prefixIcon,
  className,
  id,
  ...props
}: InputProps): JSX.Element {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-brand-900 dark:text-brand-300">
          {label}
        </label>
      )}
      <div className="relative">
        {prefixIcon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-gray-400">
            {prefixIcon}
          </div>
        )}
        <input
          id={inputId}
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-sm text-slate-800 placeholder-slate-400 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:bg-surface-card dark:text-gray-100 dark:placeholder-gray-500",
            error
              ? "border-red-500 focus:ring-red-400/40"
              : "border-gray-200 dark:border-surface-border",
            prefixIcon && "pl-10",
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {helperText && !error && <p className="text-xs text-slate-500 dark:text-gray-400">{helperText}</p>}
    </div>
  );
}

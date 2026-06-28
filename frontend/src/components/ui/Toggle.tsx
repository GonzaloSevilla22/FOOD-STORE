import { cn } from "../../lib/utils";

interface ToggleProps {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, disabled }: ToggleProps): JSX.Element {
  return (
    <label className={cn("inline-flex items-center gap-3", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-10 flex-shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-brand-400" : "bg-gray-300 dark:bg-surface-border"
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 translate-y-0.5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </button>
      {label && <span className="text-sm font-medium text-slate-700 dark:text-gray-300">{label}</span>}
    </label>
  );
}

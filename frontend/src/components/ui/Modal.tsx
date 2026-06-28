import { useEffect, type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export function Modal({ isOpen, title, onClose, size = "md", children }: ModalProps): JSX.Element | null {
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-16 backdrop-blur-sm sm:p-4 sm:pt-16">
      <div
        className={cn(
          "flex w-full flex-col overflow-x-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-neon-lg transition-all duration-200 dark:border-surface-border dark:bg-surface-card",
          size === "sm" && "max-w-sm",
          size === "md" && "max-w-lg",
          size === "lg" && "max-w-2xl",
        )}
        style={{ maxHeight: "calc(100dvh - 4.5rem)" }}
      >
        <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3 dark:border-surface-border sm:px-6 sm:py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-brand-900 dark:text-brand-300">{title}</h2>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 sm:px-6 sm:py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ isOpen, title, onClose, children }: ModalProps): JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-start justify-center bg-orange-950/30 pt-16 backdrop-blur-sm transition-all duration-200 sm:p-4 sm:pt-16 dark:bg-gray-950/50">
      <div
        className="w-full max-w-3xl scale-100 transform rounded-2xl border border-orange-100 bg-white shadow-2xl flex flex-col overflow-x-hidden transition-all duration-200 dark:border-gray-500 dark:bg-gray-800"
        style={{ maxHeight: "calc(100dvh - 4.5rem)" }}
      >
        <div className="flex-shrink-0 border-b border-orange-100 px-4 py-3 sm:px-6 sm:py-4 dark:border-gray-500">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-orange-900 sm:text-lg dark:text-orange-300">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-orange-100 px-2 py-1 text-sm text-orange-900 transition-colors hover:bg-orange-200 active:scale-95 dark:bg-gray-700 dark:text-orange-300 dark:hover:bg-gray-600"
            >
              X
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 sm:px-6 sm:py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

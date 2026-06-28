import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-stone-100 p-4 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
          <div className="max-w-md rounded-2xl border border-red-100 bg-white/90 p-8 text-center shadow-lg backdrop-blur dark:border-red-800 dark:bg-gray-800/90">
            <div className="mb-4 text-5xl">⚠️</div>
            <h1 className="text-2xl font-bold text-red-900 dark:text-red-300">Algo salió mal</h1>
            <p className="mt-3 text-sm text-red-700 dark:text-red-300">
              Ocurrió un error inesperado. Podés recargar la página para intentar de nuevo.
            </p>
            {this.state.error && (
              <p className="mt-2 rounded bg-red-50 p-2 text-xs font-mono text-red-600 dark:bg-red-900/30 dark:text-red-400">
                {this.state.error.message}
              </p>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-block rounded bg-orange-500 px-6 py-2 font-medium text-white hover:bg-orange-600"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

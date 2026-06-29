import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../context/AuthContext";
import { PageTransition } from "../components/PageTransition";

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, isAdmin, isStock, isPedidos } = useAuth();

  const [email, setEmail] = useState<string>("admin@test.com");
  const [password, setPassword] = useState<string>("admin123");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const explicitRedirect = searchParams.get("redirect");
  const justRegistered = searchParams.get("registered") === "true";

  useEffect(() => {
    if (isAuthenticated) {
      // El staff va a su panel (/home); el cliente va al catálogo (/productos).
      // Un ?redirect= explícito (p. ej. desde el catálogo) tiene prioridad.
      const target = explicitRedirect || (isAdmin || isStock || isPedidos ? "/home" : "/productos");
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, isAdmin, isStock, isPedidos, explicitRedirect, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (submitError) {
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("No se pudo iniciar sesión");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageTransition routeKey={location.pathname}>
      <Helmet><title>Iniciar sesión | Food Store</title></Helmet>
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-stone-100 p-4 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="w-full max-w-md">
        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver a inicio
        </button>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white/90 p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_3px_-1px_rgba(0,0,0,0.06)] backdrop-blur dark:bg-gray-800/90 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
        >
          {/* Header */}
          <div className="mb-6">
            <p className="font-display text-lg font-bold tracking-tight text-brand-500 dark:text-brand-400">
              🍕 Food Store
            </p>
            <h1 className="text-balance mt-1 text-3xl font-bold text-brand-950 dark:text-brand-100">
              Bienvenido de nuevo
            </h1>
            <p className="text-pretty mt-2 text-sm text-slate-600 dark:text-gray-400">
              Usá tu email y contraseña para entrar al panel.
            </p>
          </div>

          {justRegistered && (
            <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Cuenta creada correctamente. Iniciá sesión con tus credenciales.
            </p>
          )}

          {error ? (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </p>
          ) : null}

          {/* Email */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] transition-shadow duration-150 placeholder:text-slate-400 focus:shadow-[inset_0_0_0_2px_rgba(255,107,0,0.4)] focus:outline-none disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] dark:focus:shadow-[inset_0_0_0_2px_rgba(255,107,0,0.4)]"
              placeholder="admin@test.com"
            />
          </div>

          {/* Password */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] transition-shadow duration-150 placeholder:text-slate-400 focus:shadow-[inset_0_0_0_2px_rgba(255,107,0,0.4)] focus:outline-none disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] dark:focus:shadow-[inset_0_0_0_2px_rgba(255,107,0,0.4)]"
            />
          </div>

          {/* Test credentials (collapsible) */}
          <details className="mb-6 rounded-lg bg-orange-50 p-3 dark:bg-gray-800/50">
            <summary className="cursor-pointer text-sm font-medium text-orange-800 dark:text-orange-300">
              Credenciales de prueba
            </summary>
            <div className="mt-3 space-y-2 text-sm text-orange-800 dark:text-orange-300">
              <p>
                <strong>Admin</strong> — admin@test.com / admin123
              </p>
              <p>
                <strong>Stock</strong> — stock@test.com / stock123
              </p>
              <p>
                <strong>Pedidos</strong> — pedidos@test.com / pedidos123
              </p>
              <p>
                <strong>Cliente</strong> — cliente@test.com / cliente123
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setEmail("admin@test.com"); setPassword("admin123"); }}
                  disabled={isLoading}
                  className="rounded-lg bg-orange-200 px-2.5 py-1.5 text-xs font-medium text-orange-900 transition-colors hover:bg-orange-300 disabled:opacity-50 dark:bg-orange-800 dark:text-orange-100 dark:hover:bg-orange-700"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => { setEmail("stock@test.com"); setPassword("stock123"); }}
                  disabled={isLoading}
                  className="rounded-lg bg-orange-200 px-2.5 py-1.5 text-xs font-medium text-orange-900 transition-colors hover:bg-orange-300 disabled:opacity-50 dark:bg-orange-800 dark:text-orange-100 dark:hover:bg-orange-700"
                >
                  Stock
                </button>
                <button
                  type="button"
                  onClick={() => { setEmail("pedidos@test.com"); setPassword("pedidos123"); }}
                  disabled={isLoading}
                  className="rounded-lg bg-orange-200 px-2.5 py-1.5 text-xs font-medium text-orange-900 transition-colors hover:bg-orange-300 disabled:opacity-50 dark:bg-orange-800 dark:text-orange-100 dark:hover:bg-orange-700"
                >
                  Pedidos
                </button>
                <button
                  type="button"
                  onClick={() => { setEmail("cliente@test.com"); setPassword("cliente123"); }}
                  disabled={isLoading}
                  className="rounded-lg bg-orange-200 px-2.5 py-1.5 text-xs font-medium text-orange-900 transition-colors hover:bg-orange-300 disabled:opacity-50 dark:bg-orange-800 dark:text-orange-100 dark:hover:bg-orange-700"
                >
                  Cliente
                </button>
              </div>
            </div>
          </details>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-brand-400 px-4 py-3 text-sm font-semibold tracking-wide text-white shadow-sm transition-all duration-200 ease-out hover:bg-brand-500 hover:shadow-neon-sm active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50"
          >
            {isLoading ? "Ingresando..." : "Ingresar"}
          </button>

          <p className="mt-4 text-center text-sm text-slate-500 dark:text-gray-400">
            ¿No tenés cuenta?{" "}
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="font-medium text-brand-500 underline underline-offset-2 transition-colors hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
            >
              Registrate
            </button>
          </p>
        </form>
      </div>
    </div>
    </PageTransition>
  );
}

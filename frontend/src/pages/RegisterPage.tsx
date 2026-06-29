import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { PageTransition } from "../components/PageTransition";
import { useAuth } from "../context/AuthContext";
import { registerUser } from "../services/api";

export function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  // Tras registrarse, el usuario vuelve a Productos (o al destino que traiga ?redirect=).
  const redirectTo = searchParams.get("redirect") || "/productos";
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!nombre.trim() || !apellido.trim() || !email.trim() || !password) {
      setError("Todos los campos obligatorios deben completarse");
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setIsLoading(true);
    try {
      await registerUser({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.trim(),
        celular: celular.trim() || undefined,
        password,
      });
      toast.success("Cuenta creada correctamente");
      // Auto-login para llevar al cliente directo al catálogo, sin un paso manual extra.
      try {
        await login(email.trim(), password);
        navigate(redirectTo, { replace: true });
      } catch {
        // Si el auto-login fallara, lo derivamos al login conservando el destino.
        navigate(`/login?registered=true&redirect=${encodeURIComponent(redirectTo)}`);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "No se pudo crear la cuenta";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageTransition routeKey={location.pathname}>
      <Helmet><title>Registrarse | Food Store</title></Helmet>
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
              Crear tu cuenta
            </h1>
            <p className="text-pretty mt-2 text-sm text-slate-600 dark:text-gray-400">
              Completá los datos para registrarte como nuevo cliente.
            </p>
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </p>
          )}

          {/* Name row */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
                Nombre
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={isLoading}
                className="w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] transition-shadow duration-150 placeholder:text-slate-400 focus:shadow-[inset_0_0_0_2px_rgba(255,107,0,0.4)] focus:outline-none disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] dark:focus:shadow-[inset_0_0_0_2px_rgba(255,107,0,0.4)]"
                placeholder="Juan"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
                Apellido
              </label>
              <input
                type="text"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                disabled={isLoading}
                className="w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] transition-shadow duration-150 placeholder:text-slate-400 focus:shadow-[inset_0_0_0_2px_rgba(255,107,0,0.4)] focus:outline-none disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] dark:focus:shadow-[inset_0_0_0_2px_rgba(255,107,0,0.4)]"
                placeholder="Pérez"
              />
            </div>
          </div>

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
              placeholder="usuario@ejemplo.com"
            />
          </div>

          {/* Celular */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
              Celular <span className="text-slate-400 dark:text-gray-500">(opcional)</span>
            </label>
            <input
              type="tel"
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] transition-shadow duration-150 placeholder:text-slate-400 focus:shadow-[inset_0_0_0_2px_rgba(255,107,0,0.4)] focus:outline-none disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] dark:focus:shadow-[inset_0_0_0_2px_rgba(255,107,0,0.4)]"
              placeholder="11 1234-5678"
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
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          {/* Confirm password */}
          <div className="mb-6">
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] transition-shadow duration-150 placeholder:text-slate-400 focus:shadow-[inset_0_0_0_2px_rgba(255,107,0,0.4)] focus:outline-none disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] dark:focus:shadow-[inset_0_0_0_2px_rgba(255,107,0,0.4)]"
              placeholder="Repetí la contraseña"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-brand-400 px-4 py-3 text-sm font-semibold tracking-wide text-white shadow-sm transition-all duration-200 ease-out hover:bg-brand-500 hover:shadow-neon-sm active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50"
          >
            {isLoading ? "Creando cuenta..." : "Crear Cuenta"}
          </button>

          <p className="mt-4 text-center text-sm text-slate-500 dark:text-gray-400">
            ¿Ya tenés cuenta?{" "}
            <button
              type="button"
              onClick={() => navigate(`/login?redirect=${encodeURIComponent(redirectTo)}`)}
              className="font-medium text-brand-500 underline underline-offset-2 transition-colors hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
            >
              Iniciar Sesión
            </button>
          </p>
        </form>
      </div>
    </div>
    </PageTransition>
  );
}

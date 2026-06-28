import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../context/AuthContext";
import { PageTransition } from "../components/PageTransition";

const staggerItems = [
  { key: "brand", delay: 0 },
  { key: "title", delay: 100 },
  { key: "subtitle", delay: 200 },
  { key: "cta", delay: 300 },
  { key: "register", delay: 400 },
];

function useAnimatedIn(init = false) {
  const [visible, setVisible] = useState(init);
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);
  return visible;
}

export function LandingPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const visible = useAnimatedIn();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/home", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const animClass = (delay: number) =>
    `transition-all duration-500 ease-out ${
      visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
    }`;

  return (
    <PageTransition routeKey={location.pathname}>
      <Helmet><title>Food Store</title></Helmet>
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      {/* Left — Content */}
      <div className="flex items-center justify-center bg-white px-6 py-12 dark:bg-surface-dark sm:px-10 lg:px-16">
        <div className="flex w-full max-w-lg flex-col gap-6">
          {/* Brand */}
          <div className={animClass(0)} style={{ transitionDelay: "0ms" }}>
            <span className="text-3xl leading-none" role="img" aria-label="pizza">
              🍕
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-brand-500 dark:text-brand-400">
              Food Store
            </h1>
          </div>

          {/* Title */}
          <div className={animClass(100)} style={{ transitionDelay: "100ms" }}>
            <h2 className="text-balance font-display text-4xl font-bold leading-tight text-brand-950 dark:text-brand-100 sm:text-5xl">
              Bienvenidos a Nuestro Food Store
            </h2>
          </div>

          {/* Subtitle */}
          <div className={animClass(200)} style={{ transitionDelay: "200ms" }}>
            <p className="text-pretty max-w-md text-base leading-relaxed text-slate-600 dark:text-gray-400 sm:text-lg">
              Descubrí los mejores sabores de la ciudad. Hacé tu pedido online y
              disfrutá desde casa.
            </p>
          </div>

          {/* CTA */}
          <div
            className={animClass(300)}
            style={{ transitionDelay: "300ms" }}
          >
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="inline-flex items-center justify-center rounded-xl bg-brand-400 px-8 py-3.5 text-sm font-semibold tracking-wide text-white shadow-sm transition-all duration-200 ease-out hover:bg-brand-500 hover:shadow-neon-sm active:scale-[0.96]"
            >
              Iniciar Sesión
            </button>
          </div>

          {/* Register link */}
          <div
            className={animClass(400)}
            style={{ transitionDelay: "400ms" }}
          >
            <p className="text-sm text-slate-500 dark:text-gray-400">
              ¿No tenés cuenta?{" "}
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="font-medium text-brand-500 underline underline-offset-2 transition-colors hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
              >
                Registrate
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Right — Image */}
      <div className="relative h-64 overflow-hidden lg:h-auto">
        <img
          src="https://images.unsplash.com/photo-1543332164-6e82f355badc?auto=format&fit=crop&w=1200&q=80"
          alt="Comida"
          className="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent dark:from-surface-dark dark:via-surface-dark/80 lg:bg-gradient-to-r" />
      </div>
    </div>
    </PageTransition>
  );
}

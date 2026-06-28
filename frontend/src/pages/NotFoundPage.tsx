import { useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { PageTransition } from "../components/PageTransition";

export function NotFoundPage(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <PageTransition routeKey={location.pathname}>
      <Helmet><title>Página no encontrada | Food Store</title></Helmet>
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-stone-100 p-4 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="max-w-md rounded-2xl border border-orange-100 bg-white/90 p-8 text-center shadow-lg backdrop-blur dark:border-gray-500 dark:bg-gray-800/90">
          <div className="mb-4 text-6xl">🔍</div>
          <h1 className="text-3xl font-bold text-orange-900 dark:text-orange-300">Página no encontrada</h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-gray-300">
            La página que buscás no existe o fue movida.
          </p>
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="mt-6 inline-block rounded bg-orange-500 px-6 py-2 font-medium text-white hover:bg-orange-600"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </PageTransition>
  );
}

import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { getIngredienteDetail } from "../services/api";
import { SkeletonPage } from "../components/Skeleton";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}

export function IngredientDetailPage(): JSX.Element {
  const params = useParams();
  const ingredienteId = Number(params.ingredienteId);

  const detailQuery = useQuery({
    queryKey: ["ingredientes", "detail", ingredienteId],
    queryFn: () => getIngredienteDetail(ingredienteId),
    enabled: Number.isFinite(ingredienteId),
  });

  const ingrediente = detailQuery.data;

  return (
    <section className="rounded-3xl border border-orange-100 dark:border-gray-500 bg-white/90 dark:bg-gray-800/90 p-5 shadow-sm backdrop-blur">
      <Helmet><title>{`${ingrediente?.nombre ?? "Ingrediente"} | Food Store`}</title></Helmet>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-700 dark:text-orange-300">Detalle de ingrediente</p>
          <h1 className="text-3xl font-semibold text-orange-950 dark:text-orange-200">{ingrediente?.nombre ?? "Ingrediente"}</h1>
        </div>
        <Link to="/ingredientes" className="rounded-full border border-orange-200 dark:border-gray-500 bg-orange-50 dark:bg-gray-800/50 px-4 py-2 text-sm font-medium text-orange-900 dark:text-orange-300">
          Volver a ingredientes
        </Link>
      </div>

      {detailQuery.isLoading ? <SkeletonPage /> : null}
      {detailQuery.isError ? <p className="rounded-xl bg-red-100 dark:bg-red-900/50 px-4 py-3 text-sm text-red-700 dark:text-red-300">No se pudo cargar el ingrediente.</p> : null}

      {ingrediente ? (
        <div className="grid gap-5 lg:grid-cols-[1fr,1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-orange-50/60 dark:bg-gray-800/50 p-4">
              <p className="text-sm text-slate-700 dark:text-gray-300">{ingrediente.descripcion || "Sin descripción"}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-white dark:bg-gray-800 px-3 py-1 font-medium text-orange-900 dark:text-orange-300">{ingrediente.activo ? "Activo" : "Inactivo"}</span>
                <span className="rounded-full bg-white dark:bg-gray-800 px-3 py-1 font-medium text-orange-900 dark:text-orange-300">{ingrediente.unidad_medida}</span>
                <span className="rounded-full bg-white dark:bg-gray-800 px-3 py-1 font-medium text-orange-900 dark:text-orange-300">{ingrediente.es_alergeno ? "Alérgeno" : "No alérgeno"}</span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="relative">
                <InfoCard label="Stock actual" value={formatNumber(ingrediente.stock_actual)} />
                {ingrediente.stock_actual <= ingrediente.stock_minimo && (
                  <span className="absolute -top-1 -right-1 rounded bg-red-100 dark:bg-red-900/50 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
                    Stock bajo
                  </span>
                )}
              </div>
              <InfoCard label="Stock mínimo" value={formatNumber(ingrediente.stock_minimo)} />
              <InfoCard label="Costo por unidad" value={formatMoney(ingrediente.costo_unitario)} />
              <InfoCard label="Unidad" value={ingrediente.unidad_medida} />
            </div>
          </div>

          <div className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-4">
            <h2 className="text-lg font-semibold text-orange-950 dark:text-orange-200">Productos relacionados</h2>
            {ingrediente.productos_relacionados.length > 0 ? (
              <div className="mt-3 max-h-[22rem] overflow-y-auto rounded border border-orange-100 dark:border-gray-500">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-orange-100 dark:bg-gray-700 text-left text-orange-900 dark:text-orange-300">
                    <tr>
                      <th className="border px-3 py-2">Producto</th>
                      <th className="border px-3 py-2">Cantidad usada</th>
                      <th className="border px-3 py-2">Unidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingrediente.productos_relacionados.map((uso) => (
                      <tr key={`${uso.producto_id}-${uso.cantidad}-${uso.unidad_medida_id}`}>
                        <td className="border px-3 py-2">{uso.producto_nombre}</td>
                        <td className="border px-3 py-2">{formatNumber(uso.cantidad)}</td>
                        <td className="border px-3 py-2">{uso.unidad_simbolo ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600 dark:text-gray-300">Este ingrediente aún no está relacionado con productos.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-orange-700 dark:text-orange-300">{label}</p>
      <p className="mt-2 text-xl font-semibold text-orange-950 dark:text-orange-200">{value}</p>
    </div>
  );
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import type { Ingrediente } from "../models/Ingrediente";
import { ingredienteService } from "../services/api";
import { EmptyState } from "../components/EmptyState";
import { SkeletonPage } from "../components/Skeleton";

interface GastoFormState {
  [ingredienteId: number]: {
    costo_unitario: number;
    stock_minimo: number;
  };
}

export function GastosAdminPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState<number | null>(null);

  const ingredientesQuery = useQuery({
    queryKey: ["gastos", "ingredientes"],
    queryFn: () => ingredienteService.getAll(0, 100, false),
  });

  const [formState, setFormState] = useState<GastoFormState>({});

  const getRowState = (ingrediente: Ingrediente): { costo_unitario: number; stock_minimo: number } => {
    return (
      formState[ingrediente.id] ?? {
        costo_unitario: Number(ingrediente.costo_unitario),
        stock_minimo: Number(ingrediente.stock_minimo),
      }
    );
  };

  const updateRowState = (ingredienteId: number, next: { costo_unitario: number; stock_minimo: number }): void => {
    setFormState((prev) => ({
      ...prev,
      [ingredienteId]: next,
    }));
  };

  const guardarCambios = async (ingrediente: Ingrediente): Promise<void> => {
    const row = getRowState(ingrediente);
    setSavingId(ingrediente.id);
    try {
      await ingredienteService.update(ingrediente.id, {
        costo_unitario: Number(row.costo_unitario),
        stock_minimo: Number(row.stock_minimo),
      });
      await queryClient.invalidateQueries({ queryKey: ["gastos", "ingredientes"] });
      toast.success("Gasto actualizado");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el gasto";
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  };

  if (ingredientesQuery.isLoading) {
    return <SkeletonPage />;
  }

  if (ingredientesQuery.isError) {
    return <p className="text-red-600 dark:text-red-400">No se pudieron cargar los gastos.</p>;
  }

  const ingredientes = ingredientesQuery.data?.data ?? [];

  return (
    <div className="space-y-5">
      <Helmet><title>Gastos | Food Store</title></Helmet>
      <div>
        <h1 className="text-3xl font-bold text-orange-900 dark:text-orange-300">Gastos</h1>
        <p className="mt-1 text-sm text-slate-700 dark:text-gray-300">Ajusta costos unitarios e inventario mínimo de ingredientes.</p>
      </div>

      <div className="space-y-3">
        {ingredientes.length === 0 ? (
          <EmptyState icon="📦" title="Sin ingredientes" description="No hay ingredientes registrados todavía." />
        ) : ingredientes.map((ingrediente) => {
          const row = getRowState(ingrediente);
          return (
            <article
              key={ingrediente.id}
              className="grid gap-3 rounded-xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-4 shadow-sm md:grid-cols-[2fr,1fr,1fr,auto]"
            >
              <div>
                <h2 className="font-semibold text-orange-900 dark:text-orange-300">{ingrediente.nombre}</h2>
                <p className="text-sm text-slate-700 dark:text-gray-300">{ingrediente.descripcion || "Sin descripción"}</p>
              </div>

              <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300">
                Costo unitario
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.costo_unitario}
                  onChange={(event) =>
                    updateRowState(ingrediente.id, {
                      ...row,
                      costo_unitario: Number(event.target.value),
                    })
                  }
                  className="rounded border border-orange-200 dark:border-gray-500 px-3 py-2 dark:bg-gray-800 dark:text-gray-100"
                />
              </label>

              <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300">
                Stock mínimo
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.stock_minimo}
                  onChange={(event) =>
                    updateRowState(ingrediente.id, {
                      ...row,
                      stock_minimo: Number(event.target.value),
                    })
                  }
                  className="rounded border border-orange-200 dark:border-gray-500 px-3 py-2 dark:bg-gray-800 dark:text-gray-100"
                />
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => guardarCambios(ingrediente)}
                  disabled={savingId === ingrediente.id}
                  className="rounded bg-orange-500 dark:bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingId === ingrediente.id ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

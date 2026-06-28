import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { productoService, ingredienteService, updateProductoStock, updateProductoDisponibilidad } from "../services/api";
import { useProductosWS } from "../hooks/useProductosWS";
import type { Producto } from "../models/Producto";
import type { Ingrediente } from "../models/Ingrediente";
import { SkeletonCard } from "../components/Skeleton";

type Tab = "productos" | "ingredientes";

export function GestionStockPage(): JSX.Element {
  useProductosWS();
  const [tab, setTab] = useState<Tab>("productos");
  return (
    <div className="space-y-4">
      <Helmet><title>Gestión Stock | Food Store</title></Helmet>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-orange-900 dark:text-orange-300">Gestión de Stock</h1>
        <p className="mt-2 text-orange-700 dark:text-orange-300">Control de inventario y disponibilidad</p>
      </div>

      <div className="flex gap-2 border-b border-orange-200 dark:border-gray-500">
        <button
          type="button"
          onClick={() => setTab("productos")}
          className={`rounded-t px-4 py-2 text-sm font-medium ${
            tab === "productos"
              ? "border-b-2 border-orange-500 bg-white dark:bg-gray-800 text-orange-900 dark:text-orange-300"
              : "text-slate-600 hover:text-orange-800 dark:text-gray-300 dark:hover:text-orange-400"
          }`}
        >
          Productos
        </button>
        <button
          type="button"
          onClick={() => setTab("ingredientes")}
          className={`rounded-t px-4 py-2 text-sm font-medium ${
            tab === "ingredientes"
              ? "border-b-2 border-orange-500 bg-white dark:bg-gray-800 text-orange-900 dark:text-orange-300"
              : "text-slate-600 hover:text-orange-800 dark:text-gray-300 dark:hover:text-orange-400"
          }`}
        >
          Ingredientes
        </button>
      </div>

      {tab === "productos" ? <ProductosStockTab /> : <IngredientesStockTab />}
    </div>
  );
}

function ProductosStockTab(): JSX.Element {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  const productosQuery = useQuery({
    queryKey: ["productos"],
    queryFn: () => productoService.getAll(0, 100, false),
  });

  const stockMutation = useMutation({
    mutationFn: ({ id, stock }: { id: number; stock: number }) =>
      updateProductoStock(id, stock),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      setEditingId(null);
    },
  });

  const disponibilidadMutation = useMutation({
    mutationFn: ({ id, disponible }: { id: number; disponible: boolean }) =>
      updateProductoDisponibilidad(id, disponible),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos"] });
    },
  });

  const productos = (productosQuery.data?.data ?? []).filter((p) =>
    p.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-4 py-2 text-sm focus:border-orange-400 focus:outline-none"
        />
        <span className="text-sm text-slate-500 dark:text-gray-300">{productos.length} producto(s)</span>
      </div>

      {productosQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"><SkeletonCard /></div>
      ) : productosQuery.isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">Error al cargar productos.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-orange-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-orange-900 dark:text-orange-300">Producto</th>
                <th className="px-4 py-3 text-center font-semibold text-orange-900 dark:text-orange-300">Stock Manual</th>
                <th className="px-4 py-3 text-center font-semibold text-orange-900 dark:text-orange-300">Stock Derivado</th>
                <th className="px-4 py-3 text-center font-semibold text-orange-900 dark:text-orange-300">Disponible</th>
                <th className="px-4 py-3 text-right font-semibold text-orange-900 dark:text-orange-300">Precio</th>
                <th className="px-4 py-3 text-center font-semibold text-orange-900 dark:text-orange-300">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-gray-300">No se encontraron productos.</td></tr>
              ) : (
                productos.map((p: Producto) => (
                  <tr key={p.id} className="border-t border-orange-100 dark:border-gray-500 hover:bg-orange-50/50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-gray-100">{p.nombre}</td>
                    <td className="px-4 py-3 text-center">
                      {editingId === p.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditValue(Math.max(0, editValue - 1))}
                            className="rounded bg-orange-200 dark:bg-gray-700 dark:text-gray-100 px-2 py-1 text-sm font-bold hover:bg-orange-300"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={editValue}
                            onChange={(e) => setEditValue(Math.max(0, Number(e.target.value) || 0))}
                            className="w-20 rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-2 py-1 text-center text-sm focus:border-orange-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setEditValue(editValue + 1)}
                            className="rounded bg-orange-200 dark:bg-gray-700 dark:text-gray-100 px-2 py-1 text-sm font-bold hover:bg-orange-300"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              stockMutation.mutate({ id: p.id, stock: editValue })
                            }
                            disabled={stockMutation.isPending}
                            className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded bg-slate-300 dark:bg-gray-600 dark:text-gray-100 px-2 py-1 text-xs font-medium hover:bg-slate-400"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <span className="font-mono text-slate-700 dark:text-gray-300">
                          {p.usa_stock_manual ? (p.stock_manual ?? 0) : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-700 dark:text-gray-300">
                      {!p.usa_stock_manual ? (p.stock_disponible ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          disponibilidadMutation.mutate({
                            id: p.id,
                            disponible: !p.disponible,
                          })
                        }
                        disabled={disponibilidadMutation.isPending}
                        className={`rounded px-3 py-1 text-xs font-medium ${
                          p.disponible
                            ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 hover:bg-green-200"
                            : "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 hover:bg-red-200"
                        } disabled:opacity-50`}
                      >
                        {p.disponible ? "Disponible" : "No disponible"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-gray-300">
                      ${Number(p.precio_base).toLocaleString("es-AR")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(p.id);
                          setEditValue(p.usa_stock_manual ? (p.stock_manual ?? 0) : 0);
                        }}
                        className="rounded bg-blue-100 dark:bg-blue-900/50 px-3 py-1 text-xs font-medium text-blue-800 dark:text-blue-300 hover:bg-blue-200"
                      >
                        Editar stock
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function IngredientesStockTab(): JSX.Element {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStock, setEditStock] = useState<number>(0);
  const [editMin, setEditMin] = useState<number>(0);
  const [editCost, setEditCost] = useState<number>(0);

  const ingredientesQuery = useQuery({
    queryKey: ["ingredientes"],
    queryFn: () => ingredienteService.getAll(0, 100, false),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Ingrediente> }) =>
      ingredienteService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredientes"] });
      setEditingId(null);
    },
  });

  const ingredientes = (ingredientesQuery.data?.data ?? []).filter((i) =>
    i.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (ing: Ingrediente): void => {
    setEditingId(ing.id);
    setEditStock(ing.stock_actual);
    setEditMin(ing.stock_minimo);
    setEditCost(ing.costo_unitario);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Buscar ingrediente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-4 py-2 text-sm focus:border-orange-400 focus:outline-none"
        />
        <span className="text-sm text-slate-500 dark:text-gray-300">{ingredientes.length} ingrediente(s)</span>
      </div>

      {ingredientesQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"><SkeletonCard /></div>
      ) : ingredientesQuery.isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">Error al cargar ingredientes.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-orange-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-orange-900 dark:text-orange-300">Ingrediente</th>
                <th className="px-4 py-3 text-center font-semibold text-orange-900 dark:text-orange-300">Stock actual</th>
                <th className="px-4 py-3 text-center font-semibold text-orange-900 dark:text-orange-300">Stock mínimo</th>
                <th className="px-4 py-3 text-right font-semibold text-orange-900 dark:text-orange-300">Costo unitario</th>
                <th className="px-4 py-3 text-center font-semibold text-orange-900 dark:text-orange-300">Unidad</th>
                <th className="px-4 py-3 text-center font-semibold text-orange-900 dark:text-orange-300">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ingredientes.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-gray-300">No se encontraron ingredientes.</td></tr>
              ) : (
                ingredientes.map((ing: Ingrediente) => (
                  <tr key={ing.id} className="border-t border-orange-100 dark:border-gray-500 hover:bg-orange-50/50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-gray-100">
                      {ing.nombre}
                      {ing.es_alergeno && <span className="ml-2 rounded bg-red-100 dark:bg-red-900/50 px-1.5 py-0.5 text-xs text-red-700 dark:text-red-300">Alérgeno</span>}
                    </td>
                    {editingId === ing.id ? (
                      <>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            value={editStock}
                            onChange={(e) => setEditStock(Math.max(0, Number(e.target.value) || 0))}
                            className="w-20 rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-2 py-1 text-center text-sm focus:border-orange-400 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            value={editMin}
                            onChange={(e) => setEditMin(Math.max(0, Number(e.target.value) || 0))}
                            className="w-20 rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-2 py-1 text-center text-sm focus:border-orange-400 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={editCost}
                            onChange={(e) => setEditCost(Math.max(0, Number(e.target.value) || 0))}
                            className="w-24 rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-2 py-1 text-right text-sm focus:border-orange-400 focus:outline-none"
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-center font-mono text-slate-700 dark:text-gray-300">
                          {ing.stock_actual}
                          {ing.stock_actual <= ing.stock_minimo && (
                            <span className="ml-1.5 inline-block rounded bg-red-100 dark:bg-red-900/50 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
                              Stock bajo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-700 dark:text-gray-300">{ing.stock_minimo}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-gray-300">${Number(ing.costo_unitario).toFixed(2)}</td>
                      </>
                    )}
                    <td className="px-4 py-3 text-center text-slate-700 dark:text-gray-300">{ing.unidad_medida}</td>
                    <td className="px-4 py-3 text-center">
                      {editingId === ing.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateMutation.mutate({
                                id: ing.id,
                                data: { stock_actual: editStock, stock_minimo: editMin, costo_unitario: editCost },
                              })
                            }
                            disabled={updateMutation.isPending}
                            className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded bg-slate-300 dark:bg-gray-600 dark:text-gray-100 px-2 py-1 text-xs font-medium hover:bg-slate-400"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(ing)}
                          className="rounded bg-blue-100 dark:bg-blue-900/50 px-3 py-1 text-xs font-medium text-blue-800 dark:text-blue-300 hover:bg-blue-200"
                        >
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState, useEffect, type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Modal } from "../components/Modal";
import { useProductosWS } from "../hooks/useProductosWS";
import type { Categoria, CategoriaCreate, CategoriaUpdate } from "../models/Categoria";
import type { Ingrediente, IngredienteCreate, IngredienteUpdate, UnidadMedida, UnidadMedidaEnum } from "../models/Ingrediente";
import type { Producto, ProductoCreate, ProductoIngrediente, ProductoUpdate } from "../models/Producto";
import {
  categoriaService,
  cloudinaryThumb,
  getUnidadesMedida,
  ingredienteService,
  productoService,
  uploadImagen,
  type CrudService,
} from "../services/api";

const PAGE_SIZE = 10;

type EntityFormValue = string | number | boolean | string[] | ProductoIngrediente[] | null;

interface EntityForm {
  nombre: string;
  descripcion: string;
  numberValue: number;
  secondFlag: boolean;
  [key: string]: EntityFormValue;
}

interface BaseEntity {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo?: boolean;
  deleted_at: string | null;
}

function isEntityActive(item: BaseEntity): boolean {
  if (typeof item.activo === "boolean") {
    return item.activo;
  }

  return item.deleted_at === null;
}

interface EntityConfig<T extends BaseEntity, TCreate, TUpdate> {
  key: "categorias" | "productos" | "ingredientes";
  title: string;
  secondFilterLabel: string;
  secondFilterType: "text" | "boolean";
  secondFilterValue: (item: T) => string;
  numberValue: (item: T) => number;
  numberLabel: string;
  showNumberInForm?: boolean;
  showNumberFilter?: boolean;
  service: CrudService<T, TCreate, TUpdate>;
  toForm: (item: T | null) => EntityForm;
  toCreate: (form: EntityForm) => TCreate;
  toUpdate: (form: EntityForm) => TUpdate;
  renderFormExtra?: (args: {
    form: EntityForm;
    setForm: Dispatch<SetStateAction<EntityForm>>;
    items: T[];
    editingItem: T | null;
    allItems: BaseEntity[];
  }) => JSX.Element;
}

function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}

function ProductoFormExtra({
  form,
  setForm,
}: {
  form: EntityForm;
  setForm: Dispatch<SetStateAction<EntityForm>>;
}): JSX.Element {
  const categoriasQuery = useQuery({
    queryKey: ["categorias", "select"],
    queryFn: () => categoriaService.getAll(0, 100, false),
  });

  const activeCategorias = categoriasQuery.data?.data ?? [];
  const usaStockManual = Boolean(form.usa_stock_manual);
  const usaCostoCompraManual = Boolean(form.usa_costo_compra_manual);

  const ingredientesQuery = useQuery({
    queryKey: ["ingredientes", "options"],
    queryFn: () => ingredienteService.getAll(0, 100, false),
  });
  const ingredientesDisponibles = ingredientesQuery.data?.data ?? [];

  const precioSugerido = useMemo(() => {
    let costo = 0;
    if (usaCostoCompraManual && typeof form.costo_compra_manual === "number") {
      costo = form.costo_compra_manual;
    } else if (!usaStockManual) {
      const ingredientesForm = (form.ingredientes as ProductoIngrediente[] | undefined) ?? [];
      const costosMap = new Map(ingredientesDisponibles.map((i) => [i.id, Number(i.costo_unitario)]));
      for (const item of ingredientesForm) {
        costo += (costosMap.get(item.ingrediente_id) ?? 0) * item.cantidad;
      }
    }
    return costo > 0 ? costo * 1.5 : null;
  }, [form, ingredientesDisponibles, usaCostoCompraManual, usaStockManual]);

  const imagenes = (form.imagenes_url as string[] | undefined) ?? [];
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [imagenError, setImagenError] = useState<string | null>(null);

  const handleSubirImagen = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSubiendoImagen(true);
    setImagenError(null);
    try {
      const res = await uploadImagen(file);
      setForm((previous) => ({
        ...previous,
        imagenes_url: [...((previous.imagenes_url as string[] | undefined) ?? []), res.secure_url],
      }));
    } catch (error) {
      setImagenError(error instanceof Error ? error.message : "Error al subir la imagen");
    } finally {
      setSubiendoImagen(false);
      event.target.value = "";
    }
  };

  const handleQuitarImagen = (url: string): void => {
    setForm((previous) => ({
      ...previous,
      imagenes_url: ((previous.imagenes_url as string[] | undefined) ?? []).filter((u) => u !== url),
    }));
  };

  return (
    <>
      <label className="text-sm font-medium text-orange-900 dark:text-orange-300">Precio base</label>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border border-orange-200 dark:border-gray-500 px-3 py-2 focus:border-orange-400 focus:outline-none"
          type="number"
          min={0}
          value={form.numberValue}
          onChange={(event) =>
            setForm((previous) => ({ ...previous, numberValue: Number(event.target.value) }))
          }
        />
        <div className="flex items-center rounded bg-orange-50 dark:bg-gray-800/50 px-3 py-2 text-sm text-orange-700 dark:text-orange-300 whitespace-nowrap">
          Sugerido: {precioSugerido !== null ? formatARS(precioSugerido) : "—"}
        </div>
      </div>

      <label className="flex items-center gap-2 rounded border border-orange-200 dark:border-gray-500 bg-orange-50 dark:bg-gray-800/50 px-3 py-2 text-sm text-orange-900 dark:text-orange-300">
        <input
          type="checkbox"
          checked={usaCostoCompraManual}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              usa_costo_compra_manual: event.target.checked,
              costo_compra_manual: event.target.checked ? previous.costo_compra_manual : null,
            }))
          }
        />
        <span>Usa costo de compra manual</span>
      </label>
      {usaCostoCompraManual && (
        <input
          type="number"
          min={0}
          step="0.0001"
          className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 focus:border-orange-400 focus:outline-none"
          value={typeof form.costo_compra_manual === "number" ? form.costo_compra_manual : ""}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              costo_compra_manual: event.target.value === "" ? null : Number(event.target.value),
            }))
          }
          placeholder="Ej: 3.2500"
        />
      )}

      <label className="text-sm font-medium text-orange-900 dark:text-orange-300">Categoría (opcional)</label>
      <select
        className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 focus:border-orange-400 focus:outline-none"
        value={String(form.categoria_id ?? "")}
        onChange={(event) =>
          setForm((previous) => ({
            ...previous,
            categoria_id: event.target.value ? Number(event.target.value) : null,
          }))
        }
      >
        <option value="">Sin categoría</option>
        {activeCategorias.map((categoria) => (
          <option key={categoria.id} value={categoria.id}>
            {categoria.nombre}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-2 rounded border border-orange-200 dark:border-gray-500 bg-orange-50 dark:bg-gray-800/50 px-3 py-2 text-sm text-orange-900 dark:text-orange-300">
        <input
          type="checkbox"
          checked={usaStockManual}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              usa_stock_manual: event.target.checked,
              ingredientes: event.target.checked ? [] : previous.ingredientes,
            }))
          }
        />
        <span>Usa stock manual</span>
      </label>
      {usaStockManual && (
        <input
          type="number"
          min={0}
          step="1"
          className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 focus:border-orange-400 focus:outline-none"
          value={typeof form.stock_manual === "number" ? form.stock_manual : ""}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              stock_manual: event.target.value === "" ? null : Number(event.target.value),
            }))
          }
          placeholder="Ej: 60"
        />
      )}

      <label className="text-sm font-medium text-orange-900 dark:text-orange-300">Imágenes</label>
      <div className="space-y-2">
        {imagenes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {imagenes.map((url) => (
              <div key={url} className="relative">
                <img
                  src={cloudinaryThumb(url, 96, 96)}
                  alt="Imagen del producto"
                  className="h-16 w-16 rounded border border-orange-200 dark:border-gray-500 object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleQuitarImagen(url)}
                  aria-label="Quitar imagen"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleSubirImagen}
          disabled={subiendoImagen}
          className="block w-full text-sm text-slate-600 dark:text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-orange-100 dark:file:bg-gray-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-orange-900 dark:file:text-orange-300 hover:file:bg-orange-200 dark:file:hover:bg-gray-600 disabled:opacity-50"
        />
        {subiendoImagen && <p className="text-xs text-orange-600 dark:text-orange-400">Subiendo imagen…</p>}
        {imagenError && <p className="text-xs text-red-600 dark:text-red-400">{imagenError}</p>}
      </div>

      <ProductoIngredientsEditor form={form} setForm={setForm} />
    </>
  );
}

function ProductoIngredientsEditor({
  form,
  setForm,
}: {
  form: EntityForm;
  setForm: Dispatch<SetStateAction<EntityForm>>;
}): JSX.Element {
  const usaStockManual = Boolean(form.usa_stock_manual);
  const [ingredienteSearch, setIngredienteSearch] = useState<Record<number, string>>({});
  const ingredientesQuery = useQuery({
    queryKey: ["ingredientes", "options"],
    queryFn: () => ingredienteService.getAll(0, 100, false),
  });

  const unidadesQuery = useQuery({
    queryKey: ["unidades-medida"],
    queryFn: () => getUnidadesMedida(),
  });

  const unidadesDisponibles = useMemo<UnidadMedida[]>(() => unidadesQuery.data ?? [], [unidadesQuery.data]);
  const enumAUnidadMedidaId = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const u of unidadesDisponibles) {
      if (u.nombre === "Gramo") mapa["gramos"] = u.id;
      if (u.nombre === "Mililitro") mapa["mililitros"] = u.id;
      if (u.nombre === "Kilogramo") mapa["kilos"] = u.id;
      if (u.nombre === "Litro") mapa["litros"] = u.id;
      if (u.nombre === "Unidad") mapa["unidades"] = u.id;
      if (u.nombre === "Porción") mapa["porciones"] = u.id;
    }
    return mapa;
  }, [unidadesDisponibles]);

  const ingredientesDisponibles = ingredientesQuery.data?.data ?? [];
  const ingredientesSeleccionados = (form.ingredientes as ProductoIngrediente[] | undefined) ?? [];
  const ingredientesPorId = useMemo(
    () => new Map(ingredientesDisponibles.map((ingrediente) => [ingrediente.id, ingrediente])),
    [ingredientesDisponibles]
  );

  const updateRow = (index: number, partial: Partial<ProductoIngrediente>): void => {
    setForm((previous) => {
      const current = ((previous.ingredientes as ProductoIngrediente[] | undefined) ?? []).map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...partial } : row
      );
      return { ...previous, ingredientes: current };
    });
  };

  const agregarFila = (): void => {
    if (usaStockManual) {
      toast.error("Desactiva 'Usa stock manual' para agregar ingredientes.");
      return;
    }

    const usedIds = new Set(ingredientesSeleccionados.map((ingrediente) => ingrediente.ingrediente_id));
    const nextIngrediente = ingredientesDisponibles.find((ingrediente) => !usedIds.has(ingrediente.id));

    if (!nextIngrediente) {
      toast.error("No hay más ingredientes activos disponibles para agregar.");
      return;
    }

    const nuevaFila: ProductoIngrediente = {
      ingrediente_id: nextIngrediente.id,
      cantidad: 1,
      unidad_medida_id: enumAUnidadMedidaId[nextIngrediente.unidad_medida] ?? 0,
      es_removible: true,
      es_opcional: false,
    };

    setForm((previous) => ({
      ...previous,
      ingredientes: [...ingredientesSeleccionados, nuevaFila],
    }));
  };

  const eliminarFila = (index: number): void => {
    setForm((previous) => ({
      ...previous,
      ingredientes: ((previous.ingredientes as ProductoIngrediente[] | undefined) ?? []).filter(
        (_, rowIndex) => rowIndex !== index
      ),
    }));
  };

  return (
    <div className="space-y-3 rounded-xl border border-orange-100 dark:border-gray-500 bg-orange-50/70 dark:bg-gray-800/50 p-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-orange-900 dark:text-orange-300">Ingredientes del producto</label>
        {ingredientesQuery.isLoading ? <span className="text-xs text-orange-700 dark:text-orange-300">Cargando ingredientes...</span> : null}
      </div>

      {ingredientesQuery.isError ? <p className="text-sm text-red-600 dark:text-red-400">No se pudieron cargar los ingredientes.</p> : null}

      {usaStockManual ? (
        <p className="text-xs text-orange-800 dark:text-orange-300">Modo stock manual activo: no se usan ingredientes para calcular stock.</p>
      ) : ingredientesSeleccionados.length > 0 ? (
        <div className="space-y-3 rounded border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-2">
          {ingredientesSeleccionados.map((ingrediente, index) => {
            return (
              <div key={`${ingrediente.ingrediente_id}-${index}`} className="grid gap-2 rounded bg-orange-50 dark:bg-gray-800/50 p-3 md:grid-cols-2 lg:grid-cols-[2fr,1fr,auto,auto]">
                <div className="min-w-0">
                  <input
                    type="text"
                    placeholder="Buscar ingrediente..."
                    className="mb-1 w-full rounded border border-orange-200 dark:border-gray-500 px-3 py-1.5 text-xs focus:border-orange-400 focus:outline-none"
                    value={ingredienteSearch[index] ?? ""}
                    onChange={(e) => setIngredienteSearch((prev) => ({ ...prev, [index]: e.target.value }))}
                  />
                  <select
                    className="w-full rounded border border-orange-200 dark:border-gray-500 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                    value={ingrediente.ingrediente_id}
                    onChange={(event) => {
                      const nextId = Number(event.target.value);
                      if (
                        ingredientesSeleccionados.some(
                          (row, rowIndex) => rowIndex !== index && row.ingrediente_id === nextId
                        )
                      ) {
                        toast.error("Este ingrediente ya está agregado en otra fila.");
                        return;
                      }

                      const ingSel = ingredientesPorId.get(nextId);
                      updateRow(index, {
                        ingrediente_id: nextId,
                        unidad_medida_id: ingSel ? (enumAUnidadMedidaId[ingSel.unidad_medida] ?? 0) : 0,
                      });
                      setIngredienteSearch((prev) => ({ ...prev, [index]: "" }));
                    }}
                  >
                    {ingredientesDisponibles
                      .filter((opcion) =>
                        opcion.id === ingrediente.ingrediente_id ||
                        (ingredienteSearch[index] ?? "").trim() === "" ||
                        opcion.nombre.toLowerCase().includes((ingredienteSearch[index] ?? "").toLowerCase())
                      )
                      .map((opcion) => (
                        <option key={opcion.id} value={opcion.id}>
                          {opcion.nombre} ({opcion.unidad_medida})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    className="min-w-0 rounded border border-orange-200 dark:border-gray-500 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                    value={ingrediente.cantidad}
                    onChange={(event) => updateRow(index, { cantidad: Number(event.target.value) || 0 })}
                  />
                  <span className="text-xs text-orange-400">
                    {(() => {
                      const ingSel = ingredientesPorId.get(ingrediente.ingrediente_id);
                      return ingSel ? ingSel.unidad_medida : "";
                    })()}
                  </span>
                </div>

                <label className="min-w-0 flex items-center gap-2 rounded border border-orange-200 dark:border-gray-500 bg-white dark:bg-gray-800 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ingrediente.es_removible}
                    onChange={(event) => updateRow(index, { es_removible: event.target.checked })}
                  />
                  <span>Removible</span>
                </label>

                <button
                  type="button"
                  onClick={() => eliminarFila(index)}
                  className="min-w-0 rounded bg-orange-700 px-3 py-2 text-sm font-medium text-white shadow-sm"
                >
                  Quitar
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-orange-800 dark:text-orange-300">Todavía no agregaste ingredientes.</p>
      )}

      <button type="button" onClick={agregarFila} disabled={usaStockManual} className="rounded bg-green-600 px-3 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50">
        Agregar fila
      </button>
    </div>
  );
}

function IngredienteFormExtra({
  form,
  setForm,
}: {
  form: EntityForm;
  setForm: Dispatch<SetStateAction<EntityForm>>;
}): JSX.Element {
  return (
    <div className="grid gap-3 rounded-xl border border-orange-100 dark:border-gray-500 bg-orange-50/70 dark:bg-gray-800/50 p-3 md:grid-cols-2">
      <label className="grid gap-1 text-sm font-medium text-orange-900 dark:text-orange-300">
        Stock actual
        <input
          type="number"
          min={0}
          step="0.01"
          className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 focus:border-orange-400 focus:outline-none"
          value={typeof form.stock_actual === "number" ? form.stock_actual : ""}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              stock_actual: event.target.value === "" ? 0 : Number(event.target.value),
            }))
          }
        />
      </label>

      <label className="grid gap-1 text-sm font-medium text-orange-900 dark:text-orange-300">
        Stock mínimo
        <input
          type="number"
          min={0}
          step="0.01"
          className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 focus:border-orange-400 focus:outline-none"
          value={typeof form.stock_minimo === "number" ? form.stock_minimo : ""}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              stock_minimo: event.target.value === "" ? 0 : Number(event.target.value),
            }))
          }
        />
      </label>

      <label className="grid gap-1 text-sm font-medium text-orange-900 dark:text-orange-300">
        Costo por unidad
        <input
          type="number"
          min={0}
          step="0.0001"
          className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 focus:border-orange-400 focus:outline-none"
          value={typeof form.costo_unitario === "number" ? form.costo_unitario : ""}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              costo_unitario: event.target.value === "" ? 0 : Number(event.target.value),
            }))
          }
        />
      </label>

      <label className="grid gap-1 text-sm font-medium text-orange-900 dark:text-orange-300">
        Unidad de medida
        <select
          className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 focus:border-orange-400 focus:outline-none"
          value={typeof form.unidad_medida === "string" ? form.unidad_medida : "gramos"}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              unidad_medida: event.target.value,
            }))
          }
        >
          <option value="gramos">gramos</option>
          <option value="mililitros">mililitros</option>
          <option value="kilos">kilos</option>
          <option value="litros">litros</option>
          <option value="unidades">unidades</option>
          <option value="porciones">porciones</option>
        </select>
      </label>
    </div>
  );
}

function EntityPage<T extends BaseEntity, TCreate, TUpdate>({
  config,
}: {
  config: EntityConfig<T, TCreate, TUpdate>;
}): JSX.Element {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useProductosWS();

  const [textFilter, setTextFilter] = useState<string>("");
  const [secondFilter, setSecondFilter] = useState<string>("");
  const [minNumber, setMinNumber] = useState<number>(0);
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [form, setForm] = useState<EntityForm>(config.toForm(null));
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const listQuery = useQuery({
    queryKey: [config.key, showDeleted],
    queryFn: () => config.service.getAll(0, 100, showDeleted),
  });

  const createMutation = useMutation({
    mutationFn: (payload: TCreate) => config.service.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [config.key] });
      setFeedback({ type: "success", message: "Registro creado correctamente." });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "No se pudo crear el registro.";
      setFeedback({ type: "error", message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TUpdate }) => config.service.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [config.key] });
      setFeedback({ type: "success", message: "Registro actualizado correctamente." });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el registro.";
      setFeedback({ type: "error", message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => config.service.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [config.key] });
      setFeedback({ type: "success", message: "Baja lógica aplicada correctamente." });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "No se pudo aplicar la baja lógica.";
      setFeedback({ type: "error", message });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => config.service.restore(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [config.key] });
      setFeedback({ type: "success", message: "Registro dado de alta nuevamente." });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "No se pudo restaurar el registro.";
      setFeedback({ type: "error", message });
    },
  });

  const allRows = listQuery.data?.data ?? [];
  const filteredRows = useMemo(() => {
    const normalizedText = textFilter.toLowerCase().trim();
    const normalizedSecond = secondFilter.toLowerCase().trim();

    return allRows.filter((item) => {
      if (!showDeleted && !isEntityActive(item)) {
        return false;
      }

      const textMatches =
        item.nombre.toLowerCase().includes(normalizedText) ||
        (item.descripcion ?? "").toLowerCase().includes(normalizedText);

      const secondMatches = config.secondFilterValue(item).toLowerCase().includes(normalizedSecond);
      const numberMatches = config.numberValue(item) >= minNumber;

      return textMatches && secondMatches && numberMatches;
    });
  }, [allRows, config, minNumber, secondFilter, showDeleted, textFilter]);

  const isCategoryPage = config.key === "categorias";
  const totalPages = isCategoryPage ? 1 : Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const start = (currentPage - 1) * PAGE_SIZE;
  const rows = isCategoryPage ? filteredRows : filteredRows.slice(start, start + PAGE_SIZE);

  const resetModal = (): void => {
    setEditingItem(null);
    setForm(config.toForm(null));
    setIsModalOpen(false);
  };

  const openCreate = (): void => {
    setEditingItem(null);
    setForm(config.toForm(null));
    setIsModalOpen(true);
  };

  const openEdit = (item: T): void => {
    setEditingItem(item);
    setForm(config.toForm(item));
    setIsModalOpen(true);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (config.key === "productos") {
      const usaStockManual = Boolean(form.usa_stock_manual);
      const ingredientes = (form.ingredientes as ProductoIngrediente[] | undefined) ?? [];
      if (usaStockManual && (form.stock_manual === null || form.stock_manual === undefined || form.stock_manual === "")) {
        setFeedback({ type: "error", message: "Si usas stock manual debes informar el stock manual." });
        return;
      }
      if (usaStockManual && ingredientes.length > 0) {
        setFeedback({ type: "error", message: "Un producto con stock manual no debe tener ingredientes." });
        return;
      }
    }

    if (editingItem) {
      await updateMutation.mutateAsync({ id: editingItem.id, payload: config.toUpdate(form) });
    } else {
      await createMutation.mutateAsync(config.toCreate(form));
    }

    resetModal();
  };

  const onDelete = async (id: number): Promise<void> => {
    if (confirm("¿Está seguro de dar de baja este registro?")) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const onRestore = async (id: number): Promise<void> => {
    if (confirm("¿Está seguro de dar de alta nuevamente este registro?")) {
      await restoreMutation.mutateAsync(id);
    }
  };

  const clearFilters = (): void => {
    setTextFilter("");
    setSecondFilter("");
    setMinNumber(0);
    setCurrentPage(1);
  };

  const isBooleanSecond = config.secondFilterType === "boolean";

  const isProductPage = config.key === "productos";
  const isIngredientePage = config.key === "ingredientes";

  const renderRow = (item: T, depth = 0): JSX.Element => {
    const isActive = isEntityActive(item);
    const hasChildren =
      isCategoryPage &&
      allRows.some((child) => {
        const category = child as unknown as Categoria;
        const current = item as unknown as Categoria;
        return category.parent_id === current.id;
      });
    const isExpanded = expandedIds[item.id] ?? false;
    const producto = item as unknown as Producto;
    const categoriaNombre = isProductPage ? producto.categoria_nombre ?? "-" : null;

    return (
      <tr key={item.id} className={isActive ? "bg-white dark:bg-gray-800" : "bg-red-50 dark:bg-red-900/30 text-slate-500 dark:text-gray-300"}>
        <td className="border px-3 py-2 align-top">
          {isCategoryPage ? (
            <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 1.25}rem` }}>
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedIds((previous) => ({
                      ...previous,
                      [item.id]: !previous[item.id],
                    }))
                  }
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-orange-200 dark:border-gray-500 bg-orange-50 dark:bg-gray-800/50 text-xs text-orange-900 dark:text-orange-300"
                >
                  {isExpanded ? "▾" : "▸"}
                </button>
              ) : (
                <span className="inline-block h-6 w-6" />
              )}
              <span className={depth > 0 ? "font-medium text-orange-950 dark:text-orange-200" : "font-semibold text-orange-950 dark:text-orange-200"}>
                {item.nombre}
              </span>
            </div>
          ) : (
            <span className="font-medium text-orange-950 dark:text-orange-200">{item.nombre}</span>
          )}
        </td>
        <td className="border px-3 py-2 align-top">
          {isProductPage ? categoriaNombre : item.descripcion ?? "-"}
        </td>
        <td className="border px-3 py-2 align-top">
          {isProductPage
            ? (() => {
                const p = item as unknown as Producto;
                const activo = p.disponible && (p.usa_stock_manual
                  ? (p.stock_manual ?? 0) > 0
                  : p.stock_disponible === null || p.stock_disponible > 0);
                return activo ? (
                  <span className="inline-block rounded-full bg-green-100 dark:bg-green-900/50 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:text-green-300">Activo</span>
                ) : (
                  <span className="inline-block rounded-full bg-red-100 dark:bg-red-900/50 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">Inactivo</span>
                );
              })()
            : isActive ? (
              <span className="inline-block rounded-full bg-green-100 dark:bg-green-900/50 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:text-green-300">Activo</span>
            ) : (
              <span className="inline-block rounded-full bg-red-100 dark:bg-red-900/50 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">Inactivo</span>
            )}
        </td>
        {isProductPage && (
          <td className="border px-3 py-2 align-top text-center font-mono text-sm">
            {(() => {
              const p = item as unknown as Producto;
              const valor = p.usa_stock_manual ? p.stock_manual : p.stock_disponible;
              const zero = valor === 0 || valor === null || valor === undefined;
              return (
                <span className={zero ? "text-red-600 dark:text-red-400 font-semibold" : "text-slate-800 dark:text-gray-100"}>
                  {valor ?? "—"}
                </span>
              );
            })()}
          </td>
        )}
        {isIngredientePage && (
          <td className="border px-3 py-2 align-top">
            {(item as unknown as Ingrediente).es_alergeno ? (
              <span className="inline-block rounded-full bg-red-100 dark:bg-red-900/50 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
                Alérgeno
              </span>
            ) : (
              "-"
            )}
          </td>
        )}
        <td className="border px-3 py-2 align-top">
          <div className="flex flex-wrap gap-2">
            {isProductPage ? (
              <button
                type="button"
                onClick={() => navigate(`/producto/${item.id}`)}
                className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white shadow-sm"
              >
                Ver detalle
              </button>
            ) : null}
            {config.key === "ingredientes" ? (
              <button
                type="button"
                onClick={() => navigate(`/ingrediente/${item.id}`)}
                className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white shadow-sm"
              >
                Ver detalle
              </button>
            ) : null}
            {config.key === "categorias" ? (
              <button
                type="button"
                onClick={() => navigate(`/categoria/${item.id}`)}
                className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white shadow-sm"
              >
                Ver detalle
              </button>
            ) : null}
              <button
                type="button"
                onClick={() => openEdit(item)}
                className="rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white shadow-sm"
              >
                Editar
              </button>
              {isActive ? (
                <button
                  type="button"
                  onClick={() => void onDelete(item.id)}
                  className="rounded bg-orange-700 px-2 py-1 text-xs font-medium text-white shadow-sm"
                >
                  Baja
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void onRestore(item.id)}
                  className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white shadow-sm"
                >
                  Dar de alta
                </button>
              )}
          </div>
        </td>
      </tr>
    );
  };

  const renderCategoryRows = (): JSX.Element[] => {
    if (!isCategoryPage) {
      return rows.map((item) => renderRow(item));
    }

    const byParent = new Map<number | null, Categoria[]>();
    for (const item of filteredRows) {
      const category = item as unknown as Categoria;
      const parentId = category.parent_id ?? null;
      const current = byParent.get(parentId) ?? [];
      current.push(category);
      byParent.set(parentId, current);
    }

    const sortCategories = (items: Categoria[]): Categoria[] => {
      return [...items].sort((left, right) => {
        if (left.orden_display !== right.orden_display) {
          return left.orden_display - right.orden_display;
        }
        return left.nombre.localeCompare(right.nombre);
      });
    };

    const renderNodes = (parentId: number | null, depth = 0): JSX.Element[] => {
      const nodes = sortCategories(byParent.get(parentId) ?? []);
      const output: JSX.Element[] = [];

      for (const node of nodes) {
        output.push(renderRow(node as unknown as T, depth));
        if (expandedIds[node.id]) {
          output.push(...renderNodes(node.id, depth + 1));
        }
      }

      return output;
    };

    return renderNodes(null);
  };

  return (
    <section className="rounded-2xl border border-orange-100 dark:border-gray-500 bg-white/90 dark:bg-gray-800/90 p-4 shadow-sm backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-orange-900 dark:text-orange-300">{config.title}</h2>
        <button
          onClick={openCreate}
          className="rounded bg-orange-500 dark:bg-orange-600 px-3 py-2 text-sm font-medium text-white shadow-sm"
          type="button"
        >
          Crear
        </button>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <input
          className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 focus:border-orange-400 focus:outline-none"
          placeholder="Texto (nombre/descripcion)"
          value={textFilter}
          onChange={(event) => {
            setTextFilter(event.target.value);
            setCurrentPage(1);
          }}
        />

        {isBooleanSecond ? (
          <select
            className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 focus:border-orange-400 focus:outline-none"
            value={secondFilter}
            onChange={(event) => {
              setSecondFilter(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">{config.secondFilterLabel}</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        ) : (
          <input
            className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 focus:border-orange-400 focus:outline-none"
            placeholder={config.secondFilterLabel}
            value={secondFilter}
            onChange={(event) => {
              setSecondFilter(event.target.value);
              setCurrentPage(1);
            }}
          />
        )}

        {config.showNumberFilter !== false && (
          <input
            className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 focus:border-orange-400 focus:outline-none"
            type="number"
            min={0}
            value={minNumber}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              setMinNumber(Number.isNaN(parsed) ? 0 : parsed);
              setCurrentPage(1);
            }}
            placeholder={config.numberLabel}
          />
        )}

        <button
          type="button"
          onClick={clearFilters}
          className="rounded border border-orange-200 dark:border-gray-500 bg-orange-50 dark:bg-gray-800/50 px-3 py-2 text-sm text-orange-900 dark:text-orange-300"
        >
          Limpiar
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <input
          id={`show-deleted-${config.key}`}
          type="checkbox"
          checked={showDeleted}
          onChange={(event) => setShowDeleted(event.target.checked)}
          className="cursor-pointer"
        />
        <label htmlFor={`show-deleted-${config.key}`} className="cursor-pointer text-sm text-orange-900 dark:text-orange-300">
          Mostrar inactivos
        </label>
      </div>

      {feedback ? (
        <p
          className={`mb-3 rounded px-3 py-2 text-sm ${
            feedback.type === "success" ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300" : "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      {listQuery.isLoading ? <p className="text-sm text-orange-800 dark:text-orange-300">Cargando...</p> : null}
      {listQuery.isError ? <p className="text-sm text-red-600 dark:text-red-400">Error: {(listQuery.error as Error).message}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-orange-100 dark:bg-gray-700 text-left text-orange-900 dark:text-orange-300">
              <th className="border px-3 py-2">Nombre</th>
              <th className="border px-3 py-2">{isProductPage ? "Categoría" : "Descripción"}</th>
              <th className="border px-3 py-2">Estado</th>
              {isProductPage && <th className="border px-3 py-2">Stock</th>}
              {isIngredientePage && <th className="border px-3 py-2">Alérgeno</th>}
              <th className="border px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isCategoryPage ? renderCategoryRows() : rows.map((item) => renderRow(item))}
            {!rows.length && !listQuery.isLoading ? (
              <tr>
                <td className="border px-3 py-2 text-center text-orange-700 dark:text-orange-300" colSpan={isIngredientePage ? 5 : isProductPage ? 5 : 4}>
                  Sin datos
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <p>
          Página {currentPage} de {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={currentPage <= 1 || isCategoryPage}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            className="rounded border border-slate-300 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-1 disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={currentPage >= totalPages || isCategoryPage}
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            className="rounded border border-slate-300 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-1 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>

      <Modal isOpen={isModalOpen} title={editingItem ? `Editar ${config.title}` : `Crear ${config.title}`} onClose={resetModal}>
        <form onSubmit={(event) => void onSubmit(event)} className="grid gap-3">
          <input
            className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 focus:border-orange-400 focus:outline-none"
            placeholder="Nombre"
            value={form.nombre}
            onChange={(event) => setForm((previous) => ({ ...previous, nombre: event.target.value }))}
            required
          />
          <textarea
            className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 focus:border-orange-400 focus:outline-none"
            placeholder="Descripción"
            value={form.descripcion}
            onChange={(event) => setForm((previous) => ({ ...previous, descripcion: event.target.value }))}
          />

          {config.renderFormExtra ? config.renderFormExtra({ form, setForm, items: allRows, editingItem, allItems: allRows }) : null}

          {config.showNumberInForm !== false && config.numberLabel ? (
            <>
              <label className="text-sm font-medium text-orange-900 dark:text-orange-300">{config.numberLabel}</label>
              <input
                className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 focus:border-orange-400 focus:outline-none"
                type="number"
                min={0}
                value={form.numberValue}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, numberValue: Number(event.target.value) }))
                }
              />
            </>
          ) : null}

          {isBooleanSecond ? (
            <label className="flex items-center gap-2 text-orange-900 dark:text-orange-300">
              <input
                type="checkbox"
                checked={form.secondFlag}
                onChange={(event) => setForm((previous) => ({ ...previous, secondFlag: event.target.checked }))}
              />
              <span>{config.secondFilterLabel}</span>
            </label>
          ) : null}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={resetModal}
              className="rounded border border-orange-200 dark:border-gray-500 bg-orange-50 dark:bg-gray-800/50 px-3 py-2 text-orange-900 dark:text-orange-300"
            >
              Cancelar
            </button>
            <button type="submit" className="rounded bg-orange-500 dark:bg-orange-600 px-3 py-2 font-medium text-white shadow-sm">
              Guardar
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

const categoriaConfig: EntityConfig<Categoria, CategoriaCreate, CategoriaUpdate> = {
  key: "categorias",
  title: "Categorías",
  secondFilterLabel: "Descripción",
  secondFilterType: "text",
  secondFilterValue: (item) => item.descripcion ?? "",
  numberValue: (item) => item.orden_display,
  numberLabel: "Orden mínimo",
  showNumberInForm: false,
  showNumberFilter: false,
  service: categoriaService,
  toForm: (item) => ({
    nombre: item?.nombre ?? "",
    descripcion: item?.descripcion ?? "",
    numberValue: 0,
    secondFlag: false,
    parent_id: item?.parent_id ?? null,
  }),
  toCreate: (form) => ({
    nombre: form.nombre,
    descripcion: form.descripcion || null,
    orden_display: undefined as unknown as number,
    parent_id: (form.parent_id as number | null) ?? null,
  }),
  toUpdate: (form) => ({
    nombre: form.nombre,
    descripcion: form.descripcion || null,
    orden_display: undefined as unknown as number,
    parent_id: (form.parent_id as number | null) ?? null,
  }),
  renderFormExtra: ({ form, setForm, items, editingItem, allItems }) => {
    const currentId = editingItem?.id ?? null;
    const activeCategorias = (allItems as unknown as Categoria[]).filter(
      (categoria) => isEntityActive(categoria) && categoria.id !== currentId
    );

    return (
      <>
        <label className="text-sm font-medium text-orange-900 dark:text-orange-300">Categoría padre (opcional)</label>
        <select
          className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 focus:border-orange-400 focus:outline-none"
          value={String(form.parent_id ?? "")}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              parent_id: event.target.value ? Number(event.target.value) : null,
            }))
          }
        >
          <option value="">Sin padre (raíz)</option>
          {activeCategorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
        </select>
      </>
    );
  },
};

const productoConfig: EntityConfig<Producto, ProductoCreate, ProductoUpdate> = {
  key: "productos",
  title: "Productos",
  secondFilterLabel: "Disponible",
  secondFilterType: "boolean",
  secondFilterValue: (item) => (item.disponible ? "si" : "no"),
  numberValue: (item) => Number(item.precio_base),
  numberLabel: "Precio base",
  showNumberInForm: false,
  showNumberFilter: false,
  service: productoService,
  toForm: (item) => ({
    nombre: item?.nombre ?? "",
    descripcion: item?.descripcion ?? "",
    numberValue: item ? Number(item.precio_base) : 0,
    secondFlag: item?.disponible ?? true,
    usa_stock_manual: item?.usa_stock_manual ?? false,
    ingredientes: item?.ingredientes ?? [],
    categoria_id: item?.categoria_id ?? null,
    stock_manual: item?.stock_manual ?? null,
    costo_compra_manual: item?.costo_compra_manual ?? null,
    imagenes_url: item?.imagenes_url ?? [],
  }),
  toCreate: (form) => ({
    nombre: form.nombre,
    descripcion: form.descripcion || null,
    precio_base: form.numberValue,
    imagenes_url: ((form.imagenes_url as string[] | undefined) ?? []).length > 0
      ? (form.imagenes_url as string[])
      : null,
    tiempo_prep_min: null,
    disponible: form.secondFlag,
    usa_stock_manual: Boolean(form.usa_stock_manual),
    stock_manual: (form.stock_manual as number | null) ?? null,
    costo_compra_manual: (form.costo_compra_manual as number | null) ?? null,
    categoria_id: (form.categoria_id as number | null) ?? null,
    ingredientes: (form.ingredientes as ProductoIngrediente[] | undefined) ?? [],
  }),
  toUpdate: (form) => ({
    nombre: form.nombre,
    descripcion: form.descripcion || null,
    precio_base: form.numberValue,
    imagenes_url: ((form.imagenes_url as string[] | undefined) ?? []).length > 0
      ? (form.imagenes_url as string[])
      : null,
    disponible: form.secondFlag,
    usa_stock_manual: Boolean(form.usa_stock_manual),
    stock_manual: (form.stock_manual as number | null) ?? null,
    costo_compra_manual: (form.costo_compra_manual as number | null) ?? null,
    categoria_id: (form.categoria_id as number | null) ?? null,
    ingredientes: (form.ingredientes as ProductoIngrediente[] | undefined) ?? [],
  }),
  renderFormExtra: ({ form, setForm }) => (
    <ProductoFormExtra form={form} setForm={setForm} />
  ),
};

const ingredienteConfig: EntityConfig<Ingrediente, IngredienteCreate, IngredienteUpdate> = {
  key: "ingredientes",
  title: "Ingredientes",
  secondFilterLabel: "Es alérgeno",
  secondFilterType: "boolean",
  secondFilterValue: (item) => (item.es_alergeno ? "si" : "no"),
  numberValue: (item) => 0,
  numberLabel: "Filtro",
  showNumberInForm: false,
  showNumberFilter: false,
  service: ingredienteService,
  toForm: (item) => ({
    nombre: item?.nombre ?? "",
    descripcion: item?.descripcion ?? "",
    numberValue: 0,
    secondFlag: item?.es_alergeno ?? false,
    stock_actual: item?.stock_actual ?? 0,
    stock_minimo: item?.stock_minimo ?? 0,
    costo_unitario: Number(item?.costo_unitario ?? 0),
    unidad_medida: item?.unidad_medida ?? "gramos",
  }),
  toCreate: (form) => ({
    nombre: form.nombre,
    descripcion: form.descripcion || null,
    es_alergeno: form.secondFlag,
    stock_actual: Number(form.stock_actual ?? 0),
    stock_minimo: Number(form.stock_minimo ?? 0),
    costo_unitario: Number(form.costo_unitario ?? 0),
    unidad_medida: (form.unidad_medida as UnidadMedidaEnum) ?? "gramos",
  }),
  toUpdate: (form) => ({
    nombre: form.nombre,
    descripcion: form.descripcion || null,
    es_alergeno: form.secondFlag,
    stock_actual: Number(form.stock_actual ?? 0),
    stock_minimo: Number(form.stock_minimo ?? 0),
    costo_unitario: Number(form.costo_unitario ?? 0),
    unidad_medida: (form.unidad_medida as UnidadMedidaEnum) ?? "gramos",
  }),
  renderFormExtra: ({ form, setForm }) => <IngredienteFormExtra form={form} setForm={setForm} />,
};

export function CategoriasPage(): JSX.Element {
  return <EntityPage config={categoriaConfig} />;
}

export function ProductosPage(): JSX.Element {
  return <EntityPage config={productoConfig} />;
}

export function IngredientesPage(): JSX.Element {
  return <EntityPage config={ingredienteConfig} />;
}

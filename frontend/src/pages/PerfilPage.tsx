import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import {
  createDireccionUsuario,
  deleteDireccionUsuario,
  getUsuario,
  listDireccionesUsuario,
  updateDireccionUsuario,
  updateUsuario,
  type DireccionEntregaPublic,
} from "../services/api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SkeletonPage, SkeletonText } from "../components/Skeleton";

interface PerfilForm {
  nombre: string;
  apellido: string;
  celular: string;
}

interface DireccionForm {
  alias: string;
  linea1: string;
  linea2: string;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
  es_principal: boolean;
}

const emptyDireccion: DireccionForm = {
  alias: "",
  linea1: "",
  linea2: "",
  ciudad: "",
  provincia: "",
  codigo_postal: "",
  es_principal: false,
};

export function PerfilPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [perfilForm, setPerfilForm] = useState<PerfilForm | null>(null);
  const [direccionForm, setDireccionForm] = useState<DireccionForm>(emptyDireccion);
  const [editingDireccion, setEditingDireccion] = useState<DireccionEntregaPublic | null>(null);
  const [confirmDeleteDir, setConfirmDeleteDir] = useState<{ isOpen: boolean; id: number; alias: string }>({ isOpen: false, id: 0, alias: "" });
  const formRef = useRef<HTMLDivElement>(null);

  const perfilQuery = useQuery({
    queryKey: ["perfil", user?.id],
    queryFn: async () => {
      if (!user) {
        throw new Error("Usuario no autenticado");
      }
      return getUsuario(user.id);
    },
    enabled: Boolean(user),
  });

  const direccionesQuery = useQuery({
    queryKey: ["perfil-direcciones", user?.id],
    queryFn: async () => {
      if (!user) {
        throw new Error("Usuario no autenticado");
      }
      return listDireccionesUsuario(user.id, 0, 100);
    },
    enabled: Boolean(user),
  });

  const perfilInicial = useMemo(() => {
    const detail = perfilQuery.data;
    if (!detail) {
      return null;
    }
    return {
      nombre: detail.nombre,
      apellido: detail.apellido,
      celular: detail.celular ?? "",
    };
  }, [perfilQuery.data]);

  const perfilActual = perfilForm ?? perfilInicial;
  const direcciones = (direccionesQuery.data?.data ?? [])
    .filter((item) => item.activo)
    .sort((a, b) => Number(b.es_principal) - Number(a.es_principal));

  useEffect(() => {
    if (editingDireccion) {
      return;
    }

    if (direcciones.length === 0 && !direccionForm.es_principal) {
      setDireccionForm((prev) => ({ ...prev, es_principal: true }));
    }
  }, [direcciones.length, direccionForm.es_principal, editingDireccion]);

  useEffect(() => {
    if (editingDireccion && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [editingDireccion]);

  const savePerfilMutation = useMutation({
    mutationFn: async () => {
      if (!user || !perfilActual) {
        throw new Error("No hay datos de perfil");
      }

      const updated = await updateUsuario(user.id, {
        nombre: perfilActual.nombre,
        apellido: perfilActual.apellido,
        celular: perfilActual.celular.trim() ? perfilActual.celular.trim() : null,
      });

      localStorage.setItem(
        "food_store_user",
        JSON.stringify({
          id: updated.id,
          nombre: updated.nombre,
          apellido: updated.apellido,
          email: updated.email,
          celular: updated.celular ?? undefined,
          activo: updated.activo,
        })
      );

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["perfil", user?.id] });
      toast.success("Perfil actualizado. Si no ves cambios en el encabezado, recarga la página.");
    },
  });

  const saveDireccionMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("Usuario no autenticado");
      }

      if (!direccionForm.alias.trim() || !direccionForm.linea1.trim() || !direccionForm.ciudad.trim() || !direccionForm.provincia.trim() || !direccionForm.codigo_postal.trim()) {
        throw new Error("Completa los campos obligatorios de dirección");
      }

      if (editingDireccion) {
        return updateDireccionUsuario(user.id, editingDireccion.id, {
          alias: direccionForm.alias,
          linea1: direccionForm.linea1,
          linea2: direccionForm.linea2.trim() ? direccionForm.linea2.trim() : null,
          ciudad: direccionForm.ciudad,
          provincia: direccionForm.provincia,
          codigo_postal: direccionForm.codigo_postal,
          es_principal: direccionForm.es_principal,
        });
      }

      return createDireccionUsuario(user.id, {
        alias: direccionForm.alias,
        linea1: direccionForm.linea1,
        linea2: direccionForm.linea2.trim() ? direccionForm.linea2.trim() : null,
        ciudad: direccionForm.ciudad,
        provincia: direccionForm.provincia,
        codigo_postal: direccionForm.codigo_postal,
        es_principal: direccionForm.es_principal,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["perfil", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["perfil-direcciones", user?.id] });
      setEditingDireccion(null);
      setDireccionForm(emptyDireccion);
      toast.success("Dirección guardada");
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "No se pudo guardar la dirección";
      toast.error(message);
    },
  });

  const deleteDireccionMutation = useMutation({
    mutationFn: async (direccionId: number) => {
      if (!user) throw new Error("Usuario no autenticado");
      return deleteDireccionUsuario(user.id, direccionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["perfil-direcciones", user?.id] });
    },
  });

  const openDireccionEditor = (direccion: DireccionEntregaPublic): void => {
    setEditingDireccion(direccion);
    setDireccionForm({
      alias: direccion.alias,
      linea1: direccion.linea1,
      linea2: direccion.linea2 ?? "",
      ciudad: direccion.ciudad,
      provincia: direccion.provincia,
      codigo_postal: direccion.codigo_postal,
      es_principal: direccion.es_principal,
    });
  };

  if (perfilQuery.isLoading) {
    return <SkeletonPage />;
  }

  if (perfilQuery.isError || !perfilQuery.data || !perfilActual) {
    return <p className="text-red-600 dark:text-red-400">No se pudo cargar el perfil.</p>;
  }

  if (direccionesQuery.isLoading) {
    return <SkeletonText lines={3} />;
  }

  if (direccionesQuery.isError) {
    return <p className="text-red-600 dark:text-red-400">No se pudieron cargar las direcciones.</p>;
  }

  return (
    <div className="space-y-6">
      <Helmet><title>Mi Perfil | Food Store</title></Helmet>
      <div>
        <h1 className="text-3xl font-bold text-orange-900 dark:text-orange-300">Mi Perfil</h1>
        <p className="mt-1 text-sm text-slate-700 dark:text-gray-300">Actualiza tus datos y administra tus direcciones de entrega.</p>
      </div>

      <section className="space-y-3 rounded-xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-orange-900 dark:text-orange-300">Datos personales</h2>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300">
            Nombre
            <input
              type="text"
              value={perfilActual.nombre}
              onChange={(event) =>
                setPerfilForm((prev) => ({
                  nombre: event.target.value,
                  apellido: prev?.apellido ?? perfilInicial?.apellido ?? "",
                  celular: prev?.celular ?? perfilInicial?.celular ?? "",
                }))
              }
              className="rounded border border-orange-200 dark:border-gray-500 px-3 py-2 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300">
            Apellido
            <input
              type="text"
              value={perfilActual.apellido}
              onChange={(event) =>
                setPerfilForm((prev) => ({
                  nombre: prev?.nombre ?? perfilInicial?.nombre ?? "",
                  apellido: event.target.value,
                  celular: prev?.celular ?? perfilInicial?.celular ?? "",
                }))
              }
              className="rounded border border-orange-200 dark:border-gray-500 px-3 py-2 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300 md:col-span-2">
            Celular
            <input
              type="text"
              value={perfilActual.celular}
              onChange={(event) =>
                setPerfilForm((prev) => ({
                  nombre: prev?.nombre ?? perfilInicial?.nombre ?? "",
                  apellido: prev?.apellido ?? perfilInicial?.apellido ?? "",
                  celular: event.target.value,
                }))
              }
              className="rounded border border-orange-200 dark:border-gray-500 px-3 py-2 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => savePerfilMutation.mutate()}
          disabled={savePerfilMutation.isPending}
          className="rounded bg-orange-500 dark:bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savePerfilMutation.isPending ? "Guardando..." : "Guardar perfil"}
        </button>
      </section>

      <section className={`space-y-3 rounded-xl border bg-white dark:bg-gray-800 p-4 shadow-sm ${
          editingDireccion
            ? "border-blue-400 dark:border-blue-500"
            : "border-orange-100 dark:border-gray-500"
        }`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={`font-semibold ${
          editingDireccion
            ? "text-xl text-blue-900 dark:text-blue-300"
            : "text-lg text-orange-900 dark:text-orange-300"
        }`}>
            {editingDireccion ? `Editando: ${editingDireccion.alias}` : "Direcciones de entrega"}
          </h2>
          {editingDireccion ? (
            <button
              type="button"
              onClick={() => {
                setEditingDireccion(null);
                setDireccionForm(emptyDireccion);
              }}
              className={`rounded border px-3 py-1.5 text-sm hover:bg-opacity-80 ${
                editingDireccion
                  ? "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/50"
                  : "border-orange-200 dark:border-gray-500 bg-orange-50 dark:bg-gray-800/50 text-orange-900 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-gray-700"
              }`}
            >
              Nueva dirección
            </button>
          ) : null}
        </div>

        <div ref={formRef} className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300">
            Alias
            <input
              type="text"
              value={direccionForm.alias}
              onChange={(event) => setDireccionForm((prev) => ({ ...prev, alias: event.target.value }))}
              className={`rounded border px-3 py-2 dark:bg-gray-800 dark:text-gray-100 ${
                editingDireccion
                  ? "border-blue-400 dark:border-gray-500"
                  : "border-orange-200 dark:border-gray-500"
              }`}
              placeholder="Casa"
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300">
            Dirección
            <input
              type="text"
              value={direccionForm.linea1}
              onChange={(event) => setDireccionForm((prev) => ({ ...prev, linea1: event.target.value }))}
              className={`rounded border px-3 py-2 dark:bg-gray-800 dark:text-gray-100 ${
                editingDireccion
                  ? "border-blue-400 dark:border-gray-500"
                  : "border-orange-200 dark:border-gray-500"
              }`}
              placeholder="Av. Corrientes 1234"
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300 md:col-span-2">
            Departamento / Piso
            <input
              type="text"
              value={direccionForm.linea2}
              onChange={(event) => setDireccionForm((prev) => ({ ...prev, linea2: event.target.value }))}
              className={`rounded border px-3 py-2 dark:bg-gray-800 dark:text-gray-100 ${
                editingDireccion
                  ? "border-blue-400 dark:border-gray-500"
                  : "border-orange-200 dark:border-gray-500"
              }`}
              placeholder="Dpto 3B, Piso 5"
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300">
            Ciudad
            <input
              type="text"
              value={direccionForm.ciudad}
              onChange={(event) => setDireccionForm((prev) => ({ ...prev, ciudad: event.target.value }))}
              className={`rounded border px-3 py-2 dark:bg-gray-800 dark:text-gray-100 ${
                editingDireccion
                  ? "border-blue-400 dark:border-gray-500"
                  : "border-orange-200 dark:border-gray-500"
              }`}
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300">
            Provincia
            <input
              type="text"
              value={direccionForm.provincia}
              onChange={(event) => setDireccionForm((prev) => ({ ...prev, provincia: event.target.value }))}
              className={`rounded border px-3 py-2 dark:bg-gray-800 dark:text-gray-100 ${
                editingDireccion
                  ? "border-blue-400 dark:border-gray-500"
                  : "border-orange-200 dark:border-gray-500"
              }`}
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300">
            Código postal
            <input
              type="text"
              value={direccionForm.codigo_postal}
              onChange={(event) => setDireccionForm((prev) => ({ ...prev, codigo_postal: event.target.value }))}
              className={`rounded border px-3 py-2 dark:bg-gray-800 dark:text-gray-100 ${
                editingDireccion
                  ? "border-blue-400 dark:border-gray-500"
                  : "border-orange-200 dark:border-gray-500"
              }`}
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={direccionForm.es_principal}
              disabled={!editingDireccion && direcciones.length === 0}
              onChange={(event) => setDireccionForm((prev) => ({ ...prev, es_principal: event.target.checked }))}
            />
            Marcar como principal {!editingDireccion && direcciones.length === 0 ? "(obligatoria para la primera dirección)" : ""}
          </label>
        </div>

        <button
          type="button"
          onClick={() => saveDireccionMutation.mutate()}
          disabled={saveDireccionMutation.isPending}
          className={`rounded px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${
            editingDireccion
              ? "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
              : "bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700"
          }`}
        >
          {saveDireccionMutation.isPending ? "Guardando..." : editingDireccion ? "Guardar dirección" : "Agregar dirección"}
        </button>

        <div className="space-y-2 pt-2">
          <h3 className={`text-sm font-semibold ${
            editingDireccion
              ? "text-blue-900 dark:text-blue-300"
              : "text-orange-900 dark:text-orange-300"
          }`}>Direcciones guardadas</h3>
          {direcciones.length > 0 ? (
            direcciones.map((direccion) => (
              <article key={direccion.id} className={`rounded-lg border p-3 ${
                editingDireccion
                  ? "border-blue-100 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20"
                  : "border-orange-100 dark:border-gray-500 bg-orange-50 dark:bg-gray-800/50"
              }`}>
                <p className={`font-medium ${
                  editingDireccion
                    ? "text-blue-900 dark:text-blue-300"
                    : "text-orange-900 dark:text-orange-300"
                }`}>{direccion.alias}</p>
                <p className="text-sm text-slate-700 dark:text-gray-300">{direccion.linea1}{direccion.linea2 ? `, ${direccion.linea2}` : ""}</p>
                <p className="text-sm text-slate-700 dark:text-gray-300">{direccion.ciudad}, {direccion.provincia} ({direccion.codigo_postal})</p>
                <div className="mt-2 flex items-center gap-2">
                  {direccion.es_principal ? (
                    <span className="rounded-full bg-green-100 dark:bg-green-900/50 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-300">Predeterminada</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openDireccionEditor(direccion)}
                    className={`rounded px-3 py-1.5 text-xs font-medium text-white ${
                      editingDireccion
                        ? "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                        : "bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700"
                    }`}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteDir({ isOpen: true, id: direccion.id, alias: direccion.alias })}
                    className="rounded bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-700 dark:text-gray-300">No tienes direcciones cargadas.</p>
          )}
        </div>
      </section>

      <ConfirmDialog
        isOpen={confirmDeleteDir.isOpen}
        title="Eliminar dirección"
        message={`¿Estás seguro de eliminar "${confirmDeleteDir.alias}"?`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => {
          deleteDireccionMutation.mutate(confirmDeleteDir.id);
          setConfirmDeleteDir({ isOpen: false, id: 0, alias: "" });
        }}
        onCancel={() => setConfirmDeleteDir({ isOpen: false, id: 0, alias: "" })}
      />
    </div>
  );
}

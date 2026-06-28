import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import type { UsuarioPublic } from "../services/api";
import { listUsuarios, updateUsuario, registerUser, assignRol, removeRol, getUsuario } from "../services/api";
import { Modal } from "../components/Modal";
import { SkeletonPage } from "../components/Skeleton";

const ROLES_DISPONIBLES = ["ADMIN", "STOCK", "PEDIDOS", "CLIENT"];

interface UserFormState {
  nombre: string;
  apellido: string;
  celular: string;
  activo: boolean;
}

function buildFormState(user: UsuarioPublic): UserFormState {
  return {
    nombre: user.nombre,
    apellido: user.apellido,
    celular: user.celular ?? "",
    activo: user.activo,
  };
}

export function UsuariosAdminPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<UsuarioPublic | null>(null);
  const [form, setForm] = useState<UserFormState | null>(null);
  const [includeInactive, setIncludeInactive] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ nombre: "", apellido: "", email: "", celular: "", password: "" });
  const [rolUser, setRolUser] = useState<{ id: number; roles: string[] } | null>(null);

  const usuariosQuery = useQuery({
    queryKey: ["usuarios", "admin", includeInactive],
    queryFn: () => listUsuarios(0, 100, includeInactive),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editingUser || !form) throw new Error("No hay usuario seleccionado");
      return updateUsuario(editingUser.id, {
        nombre: form.nombre,
        apellido: form.apellido,
        celular: form.celular.trim() ? form.celular.trim() : null,
        activo: form.activo,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios", "admin"] });
      setEditingUser(null);
      setForm(null);
      toast.success("Usuario actualizado correctamente");
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (user: UsuarioPublic) => updateUsuario(user.id, { activo: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios", "admin"] });
      toast.success("Usuario reactivado correctamente");
    },
  });

  const createUserMutation = useMutation({
    mutationFn: () => registerUser({
      nombre: createForm.nombre,
      apellido: createForm.apellido,
      email: createForm.email,
      celular: createForm.celular.trim() || undefined,
      password: createForm.password,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios", "admin"] });
      setShowCreateModal(false);
      setCreateForm({ nombre: "", apellido: "", email: "", celular: "", password: "" });
      toast.success("Usuario creado correctamente");
    },
  });

  const assignRolMutation = useMutation({
    mutationFn: ({ usuarioId, rol }: { usuarioId: number; rol: string }) => assignRol(usuarioId, rol),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios", "admin"] });
      toast.success("Rol asignado");
    },
  });

  const removeRolMutation = useMutation({
    mutationFn: ({ usuarioId, rol }: { usuarioId: number; rol: string }) => removeRol(usuarioId, rol),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios", "admin"] });
      toast.success("Rol removido");
    },
  });

  const openEditor = (user: UsuarioPublic): void => {
    setEditingUser(user);
    setForm(buildFormState(user));
  };

  const openRolEditor = async (user: UsuarioPublic): Promise<void> => {
    const detail = await getUsuario(user.id);
    setRolUser({ id: detail.id, roles: detail.roles.map((r) => r.codigo) });
  };

  if (usuariosQuery.isLoading) {
    return <SkeletonPage />;
  }

  if (usuariosQuery.isError) {
    return <p className="text-red-600 dark:text-red-400">No se pudieron cargar los usuarios.</p>;
  }

  const usuarios = usuariosQuery.data?.data ?? [];

  return (
    <div className="space-y-5">
      <Helmet><title>Usuarios | Food Store</title></Helmet>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-orange-900 dark:text-orange-300">Usuarios</h1>
          <p className="mt-1 text-sm text-slate-700 dark:text-gray-300">Gestión de usuarios y roles.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="rounded bg-orange-500 dark:bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          + Crear usuario
        </button>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={includeInactive}
          onChange={(event) => setIncludeInactive(event.target.checked)}
        />
        Mostrar usuarios inactivos
      </label>

      <div className="overflow-x-auto rounded-xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800">
        <table className="min-w-full divide-y divide-orange-100 text-sm">
          <thead className="bg-orange-50 dark:bg-gray-800/50 text-left text-orange-900 dark:text-orange-300">
            <tr>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-orange-50">
            {usuarios.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 text-slate-800 dark:text-gray-100">{user.nombre} {user.apellido}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-gray-300">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${user.activo ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300" : "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"}`}>
                    {user.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEditor(user)}
                      className="rounded bg-orange-500 dark:bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => openRolEditor(user)}
                      className="rounded bg-blue-500 dark:bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600"
                    >
                      Roles
                    </button>
                    {!user.activo ? (
                      <button
                        type="button"
                        onClick={() => reactivateMutation.mutate(user)}
                        disabled={reactivateMutation.isPending}
                        className="rounded bg-green-600 dark:bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {reactivateMutation.isPending ? "Reactivando..." : "Dar de alta"}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser && form ? (
        <div className="space-y-3 rounded-xl border border-orange-100 dark:border-gray-500 bg-white dark:bg-gray-800 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-orange-900 dark:text-orange-300">Editar usuario: {editingUser.email}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300">
              Nombre
              <input type="text" value={form.nombre} onChange={(event) => setForm((prev) => (prev ? { ...prev, nombre: event.target.value } : prev))} className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300">
              Apellido
              <input type="text" value={form.apellido} onChange={(event) => setForm((prev) => (prev ? { ...prev, apellido: event.target.value } : prev))} className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300 md:col-span-2">
              Celular
              <input type="text" value={form.celular} onChange={(event) => setForm((prev) => (prev ? { ...prev, celular: event.target.value } : prev))} className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-gray-300 md:col-span-2">
              <input type="checkbox" checked={form.activo} onChange={(event) => setForm((prev) => (prev ? { ...prev, activo: event.target.checked } : prev))} />
              Usuario activo
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="rounded bg-orange-500 dark:bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60">
              {saveMutation.isPending ? "Guardando..." : "Guardar cambios"}
            </button>
            <button type="button" onClick={() => { setEditingUser(null); setForm(null); }} className="rounded border border-orange-200 dark:border-gray-500 bg-orange-50 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-orange-900 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-gray-600">
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {/* Create user modal */}
      <Modal isOpen={showCreateModal} title="Crear usuario" onClose={() => setShowCreateModal(false)}>
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300">
            Nombre
            <input type="text" value={createForm.nombre} onChange={(e) => setCreateForm((p) => ({ ...p, nombre: e.target.value }))} className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300">
            Apellido
            <input type="text" value={createForm.apellido} onChange={(e) => setCreateForm((p) => ({ ...p, apellido: e.target.value }))} className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300">
            Email
            <input type="email" value={createForm.email} onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))} className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300">
            Celular (opcional)
            <input type="text" value={createForm.celular} onChange={(e) => setCreateForm((p) => ({ ...p, celular: e.target.value }))} className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm text-slate-700 dark:text-gray-300">
            Contraseña
            <input type="password" value={createForm.password} onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))} className="rounded border border-orange-200 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 px-3 py-2" />
          </label>
          <button
            type="button"
            onClick={() => createUserMutation.mutate()}
            disabled={createUserMutation.isPending || !createForm.nombre || !createForm.apellido || !createForm.email || !createForm.password}
            className="rounded bg-orange-500 dark:bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {createUserMutation.isPending ? "Creando..." : "Crear usuario"}
          </button>
        </div>
      </Modal>

      {/* Role editor modal */}
      <Modal isOpen={!!rolUser} title="Editar roles" onClose={() => setRolUser(null)}>
        {rolUser ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700 dark:text-gray-300">Roles actuales:</p>
            <div className="flex flex-wrap gap-2">
              {rolUser.roles.map((r) => (
                <span key={r} className="flex items-center gap-1 rounded bg-orange-100 dark:bg-gray-700 px-3 py-1 text-sm font-medium text-orange-800 dark:text-orange-300">
                  {r}
                  <button
                    type="button"
                    onClick={() => {
                      removeRolMutation.mutate({ usuarioId: rolUser.id, rol: r });
                      setRolUser((prev) => prev ? { ...prev, roles: prev.roles.filter((x) => x !== r) } : prev);
                    }}
                    className="ml-1 text-orange-600 hover:text-red-600"
                  >
                    ✕
                  </button>
                </span>
              ))}
              {rolUser.roles.length === 0 && (
                <span className="text-sm text-slate-400 dark:text-gray-300">Sin roles asignados</span>
              )}
            </div>
            <p className="text-sm text-slate-700 dark:text-gray-300">Agregar rol:</p>
            <div className="flex flex-wrap gap-2">
              {ROLES_DISPONIBLES.filter((r) => !rolUser.roles.includes(r)).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    assignRolMutation.mutate({ usuarioId: rolUser.id, rol: r });
                    setRolUser((prev) => prev ? { ...prev, roles: [...prev.roles, r] } : prev);
                  }}
                  disabled={assignRolMutation.isPending}
                  className="rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 disabled:opacity-50"
                >
                  + {r}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

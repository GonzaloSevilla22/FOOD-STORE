import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { loginRequest, api } from "../services/api";
import { useCartStore } from "./cartStore";

/** Clave de persistencia del authStore (solo el accessToken — consigna §12). */
const AUTH_STORAGE_KEY = "food_store_auth";

/**
 * Genera (o recupera) un identificador único por pestaña.
 * Se almacena en sessionStorage para que persista al refrescar la página
 * pero sea diferente en cada pestaña.
 */
function getOrCreateTabId(): string {
  const KEY = "food_store_tab_id";
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export interface User {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  celular?: string;
  activo: boolean;
}

interface AuthStoreState {
  token: string | null;
  user: User | null;
  roles: string[];
  tabId: string;
  authLoading: boolean;
  setAuthLoading: (loading: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  verifySession: () => Promise<void>;
}

export function normalizeRole(role: string): string {
  return (role || "").trim().toUpperCase();
}

export function hasAnyRole(roles: string[], target: string): boolean {
  const normalized = normalizeRole(target);
  if (normalized === "CLIENT") {
    return roles.some((r) => ["CLIENT", "CLIENTE"].includes(normalizeRole(r)));
  }
  return roles.some((r) => normalizeRole(r) === normalized);
}

/**
 * Lee de forma síncrona si hay un token persistido, para decidir el estado
 * inicial de `authLoading` (igual que el AuthContext previo: solo arranca en
 * "verificando" cuando hay token que validar). Evita el flash de redirección
 * a /login en rutas protegidas durante la rehidratación.
 */
function hasPersistedToken(): boolean {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
    return Boolean(parsed?.state?.token);
  } catch {
    return false;
  }
}

/**
 * Store global de sesión (Zustand, consigna §12).
 *
 * Gestiona accessToken, usuario, roles y el flag de carga inicial. Persiste
 * **solo el accessToken** (`partialize`). Es accedido por componentes a través
 * del hook adapter `useAuth`, y fuera de React (interceptor de axios) vía
 * `useAuthStore.getState().token`.
 */
export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      roles: [],
      tabId: getOrCreateTabId(),
      authLoading: hasPersistedToken(),

      setAuthLoading: (loading) => set({ authLoading: loading }),

      login: async (email, password) => {
        if (!email.trim() || !password.trim()) {
          throw new Error("Email y clave son obligatorios.");
        }
        const response = await loginRequest({ email, password });
        const roles = (response.roles || []).map(normalizeRole);
        set({
          token: response.access_token,
          user: response.usuario,
          roles,
        });
      },

      logout: () => {
        useCartStore.getState().limpiarCarrito();
        set({ token: null, user: null, roles: [] });
      },

      verifySession: async () => {
        if (!get().token) {
          set({ authLoading: false });
          return;
        }
        try {
          const { data } = await api.get("/auth/me");
          set({
            user: {
              id: data.id,
              nombre: data.nombre,
              apellido: data.apellido,
              email: data.email,
              celular: data.celular,
              activo: data.activo,
            },
            roles: (data.roles || []).map((r: string) => normalizeRole(r)),
          });
        } catch {
          set({ token: null, user: null, roles: [] });
        } finally {
          set({ authLoading: false });
        }
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      // Consigna §12: persiste accessToken + tabId (aislamiento multi-pestaña).
      partialize: (state) => ({ token: state.token, tabId: state.tabId }),
    }
  )
);

import { useEffect } from "react";
import { useAuthStore, hasAnyRole, type User } from "../stores/authStore";

export type { User };

export interface AuthContextValue {
  token: string | null;
  user: User | null;
  roles: string[];
  isAuthenticated: boolean;
  authLoading: boolean;
  isAdmin: boolean;
  isClient: boolean;
  isStock: boolean;
  isPedidos: boolean;
  hasRole: (role: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  verifySession: () => Promise<void>;
}

/**
 * Bootstrap de sesión. Zustand no necesita Provider para el estado, pero
 * mantenemos `AuthProvider` como host del efecto de arranque: valida la sesión
 * persistida (token) una sola vez al montar. La forma del árbol en main.tsx no
 * cambia.
 */
export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const verifySession = useAuthStore((s) => s.verifySession);

  useEffect(() => {
    void verifySession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // solo al montar

  return <>{children}</>;
}

/**
 * Hook adapter sobre `useAuthStore` (consigna §12 — suscripción por slice).
 * Conserva la interfaz del antiguo AuthContext para que los componentes
 * consumidores no cambien; por debajo todo el estado vive en el store Zustand.
 */
export function useAuth(): AuthContextValue {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
  const authLoading = useAuthStore((s) => s.authLoading);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const verifySession = useAuthStore((s) => s.verifySession);

  return {
    token,
    user,
    roles,
    isAuthenticated: Boolean(token) && Boolean(user),
    authLoading,
    isAdmin: hasAnyRole(roles, "ADMIN"),
    isClient: hasAnyRole(roles, "CLIENT"),
    isStock: hasAnyRole(roles, "STOCK"),
    isPedidos: hasAnyRole(roles, "PEDIDOS"),
    hasRole: (role: string) => hasAnyRole(roles, role),
    login,
    logout,
    verifySession,
  };
}

import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";


import { ProtectedRoute } from "./components/ProtectedRoute";
import { NavBar } from "./components/NavBar";
import { setLogoutHandler } from "./services/api";
import { CategoriasPage, IngredientesPage, ProductosPage } from "./pages/EntityPages";
import { CategoryDetailPage } from "./pages/CategoryDetailPage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { StockDashboard } from "./pages/StockDashboard";
import { PedidosDashboard } from "./pages/PedidosDashboard";
import { ClienteDashboard } from "./pages/ClienteDashboard";
import { IngredientDetailPage } from "./pages/IngredientDetailPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { VentasPage } from "./pages/VentasPage";
import { LoginPage } from "./pages/LoginPage";
import { CarritoPage } from "./pages/CarritoPage";
import PaymentPage from "./pages/PaymentPage";
import TiempoAgotadoPage from "./pages/TiempoAgotadoPage";
import OrderRedirectPage from "./pages/OrderRedirectPage";
import { MisPedidosPage } from "./pages/MisPedidosPage";
import { AccessDeniedPage } from "./pages/AccessDeniedPage";
import { ProductosClientePage } from "./pages/ProductosClientePage";
import { UsuariosAdminPage } from "./pages/UsuariosAdminPage";
import { GastosAdminPage } from "./pages/GastosAdminPage";
import { PerfilPage } from "./pages/PerfilPage";
import { GestionStockPage } from "./pages/GestionStockPage";
import { OperacionPedidoDetailPage } from "./pages/OperacionPedidoDetailPage";
import { OperacionesPedidosPage } from "./pages/OperacionesPedidosPage";
import { ProductosInternosPage } from "./pages/ProductosInternosPage";
import { VentaDetailPage } from "./pages/VentaDetailPage";

import { ClientePedidoDetailPage } from "./pages/ClientePedidoDetailPage";
import { ThemeToggle } from "./components/ThemeToggle";

interface DashboardLayoutProps {
  children: JSX.Element;
}

function DashboardLayout({ children }: DashboardLayoutProps): JSX.Element {
  return (
    <div
      className="flex min-h-screen flex-col bg-gradient-to-br from-orange-50 via-amber-50 to-stone-100 font-body text-slate-800 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 dark:text-gray-100"
      style={{ minHeight: "100dvh" }}
    >
      <NavBar />
      <div className="flex-1 p-3 sm:p-4">
        <div className="mx-auto max-w-6xl">{children}</div>
      </div>
    </div>
  );
}

export function App(): JSX.Element {
  const { isAuthenticated, isAdmin, isStock, isPedidos, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setLogoutHandler(() => {
      logout();
      navigate("/login");
    });
  }, [logout, navigate]);

  return (
    <CartProvider>
      <Routes>
        {/* Login */}
        <Route path="/login" element={isAuthenticated ? <Navigate to="/home" replace /> : <LoginPage />} />

        {/* Access Denied */}
        <Route path="/access-denied" element={<AccessDeniedPage />} />

        {/* Home - Redirige según rol */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                {isAdmin ? <AdminDashboard /> : isStock ? <StockDashboard /> : isPedidos ? <PedidosDashboard /> : <ClienteDashboard />}
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* RUTAS ADMIN */}
        <Route
          path="/categorias"
          element={
            <ProtectedRoute requiredRoles={["ADMIN"]}>
              <DashboardLayout>
                <CategoriasPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/categoria/:categoriaId"
          element={
            <ProtectedRoute requiredRoles={["ADMIN"]}>
              <DashboardLayout>
                <CategoryDetailPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/ingredientes"
          element={
            <ProtectedRoute requiredRoles={["ADMIN", "STOCK"]}>
              <DashboardLayout>
                <IngredientesPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/ingrediente/:ingredienteId"
          element={
            <ProtectedRoute requiredRoles={["ADMIN", "STOCK"]}>
              <DashboardLayout>
                <IngredientDetailPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* RUTAS ADMIN + PEDIDOS */}
        <Route
          path="/ventas"
          element={
            <ProtectedRoute requiredRoles={["ADMIN", "PEDIDOS"]}>
              <DashboardLayout>
                <VentasPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/ventas/:id"
          element={
            <ProtectedRoute requiredRoles={["ADMIN", "PEDIDOS"]}>
              <DashboardLayout>
                <VentaDetailPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/operaciones-pedidos"
          element={
            <ProtectedRoute requiredRoles={["ADMIN", "PEDIDOS"]}>
              <DashboardLayout>
                <OperacionesPedidosPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/operaciones-pedidos/:id"
          element={
            <ProtectedRoute requiredRoles={["ADMIN", "PEDIDOS"]}>
              <DashboardLayout>
                <OperacionPedidoDetailPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/stock"
          element={
            <ProtectedRoute requiredRoles={["ADMIN", "STOCK"]}>
              <DashboardLayout>
                <GestionStockPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/usuarios"
          element={
            <ProtectedRoute requiredRoles={["ADMIN"]}>
              <DashboardLayout>
                <UsuariosAdminPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/gastos"
          element={
            <ProtectedRoute requiredRoles={["ADMIN"]}>
              <DashboardLayout>
                <GastosAdminPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* RUTAS COMUNES (públicas y autenticadas) */}
        <Route
          path="/productos"
          element={
            <DashboardLayout>
              {isAdmin || isStock ? <ProductosPage /> : isPedidos ? <ProductosInternosPage /> : <ProductosClientePage />}
            </DashboardLayout>
          }
        />

        <Route
          path="/productos/:productoId"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <ProductDetailPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/producto/:productoId"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <ProductDetailPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* RUTAS CLIENTE / CARRITO */}
        <Route
          path="/carrito"
          element={
            <DashboardLayout>
              <CarritoPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/payment/:orderId"
          element={
            <ProtectedRoute requiredRoles={["CLIENT"]}>
              <PaymentPage />
            </ProtectedRoute>
          }
        />

        {/* Tiempo agotado */}
        <Route path="/tiempo-agotado" element={<TiempoAgotadoPage />} />

        {/* MP redirect handler */}
        <Route
          path="/orders/:pedidoId/:status"
          element={<OrderRedirectPage />}
        />

        {/* Post-payment redirect target (MP back_urls) */}
        <Route
          path="/pedido/:id"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                {isAdmin || isPedidos ? <VentaDetailPage /> : <ClientePedidoDetailPage />}
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/mis-pedidos"
          element={
            <ProtectedRoute requiredRoles={["CLIENT"]}>
              <DashboardLayout>
                <MisPedidosPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/perfil"
          element={
            <ProtectedRoute requiredRoles={["CLIENT"]}>
              <DashboardLayout>
                <PerfilPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/cliente/pedido/:id"
          element={
            <ProtectedRoute requiredRoles={["CLIENT"]}>
              <DashboardLayout>
                <ClientePedidoDetailPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="/" element={isAuthenticated ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      <ThemeToggle />
    </CartProvider>
  );
}

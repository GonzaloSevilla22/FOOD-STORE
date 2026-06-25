import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import type { Categoria, CategoriaCreate, CategoriaDetail, CategoriaUpdate } from "../models/Categoria";
import type { Ingrediente, IngredienteCreate, IngredienteDetail, IngredienteUpdate, UnidadMedida } from "../models/Ingrediente";
import type { Producto, ProductoCreate, ProductoUpdate } from "../models/Producto";
import { useAuthStore } from "../stores/authStore";

const API_BASE_URLS = ["/api/v1"];

let _logoutHandler: (() => void) | null = null;

export function setLogoutHandler(handler: () => void): void {
  _logoutHandler = handler;
}

export const api = axios.create({
  baseURL: API_BASE_URLS[0],
  withCredentials: true,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  // Acceso al token fuera de React vía el store Zustand (consigna §12).
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      if (_logoutHandler) {
        _logoutHandler();
      }
    }

    if (!error.response) {
      return Promise.reject(new Error("No se puede conectar al servidor backend."));
    }

    const data = error.response.data;
    if (typeof data === "string" && data.trim()) {
      return Promise.reject(new Error(data));
    }
    if (data && typeof data === "object") {
      if ("detail" in data) {
        return Promise.reject(new Error(String((data as { detail: unknown }).detail)));
      }
      const errData = data as Record<string, unknown>;
      if (errData.error && typeof errData.error === "object" && "message" in (errData.error as Record<string, unknown>)) {
        return Promise.reject(new Error(String((errData.error as Record<string, unknown>).message)));
      }
    }

    return Promise.reject(new Error(`Error ${error.response.status} en la API`));
  }
);

interface ListResponse<T> {
  data: T[];
  total: number;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  usuario: {
    id: number;
    nombre: string;
    apellido: string;
    email: string;
    celular?: string;
    activo: boolean;
  };
  roles?: string[];
}

export async function refreshTokenRequest(refresh_token: string): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/refresh", {
    method: "POST",
    data: { refresh_token },
  });
}

export interface UsuarioPublic {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  celular?: string | null;
  activo: boolean;
}

export interface UsuarioUpdatePayload {
  nombre?: string;
  apellido?: string;
  celular?: string | null;
  activo?: boolean;
}

export interface CrudService<T, TCreate, TUpdate> {
  getAll: (offset: number, limit: number, includeDeleted?: boolean) => Promise<ListResponse<T>>;
  getById: (id: number) => Promise<T>;
  create: (payload: TCreate) => Promise<T>;
  update: (id: number, payload: TUpdate) => Promise<T>;
  delete: (id: number) => Promise<void>;
  restore: (id: number) => Promise<T>;
}

export interface DireccionEntregaPublic {
  id: number;
  alias: string;
  linea1: string;
  linea2: string | null;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
  es_principal: boolean;
  activo: boolean;
}

export interface DireccionEntregaCreatePayload {
  alias: string;
  linea1: string;
  linea2?: string | null;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
  es_principal: boolean;
}

export interface DireccionEntregaUpdatePayload {
  alias?: string;
  linea1?: string;
  linea2?: string | null;
  ciudad?: string;
  provincia?: string;
  codigo_postal?: string;
  es_principal?: boolean;
}

export interface UsuarioDetail extends UsuarioPublic {
  roles: Array<{ codigo: string; nombre: string; descripcion?: string | null }>;
  direcciones: DireccionEntregaPublic[];
}

export interface DetallePedidoCreatePayload {
  producto_id: number;
  cantidad: number;
}

export interface PedidoCreatePayload {
  direccion_entrega_id: number;
  detalles: DetallePedidoCreatePayload[];
  notas?: string;
}

export interface ConfirmarPedidoResponse {
  id: number;
  estado_codigo: string;
  total: number;
  mensaje: string;
}

export interface PedidoPublic {
  id: number;
  usuario_id: number;
  direccion_entrega_id: number;
  forma_pago_codigo?: string | null;
  estado_codigo: string;
  subtotal: number | string;
  descuento: number | string;
  costo_envio: number | string;
  total: number | string;
  notas?: string | null;
  created_at?: string | null;
  pago_estado?: string | null;
  pago_mp_status?: string | null;
  motivo?: string | null;
}

export async function loginRequest(payload: LoginPayload): Promise<LoginResponse> {
  try {
    const result = await request<LoginResponse>("/auth/login", {
      method: "POST",
      data: payload,
    });
    return result;
  } catch (error) {
    throw error;
  }
}

async function request<T>(
  path: string,
  options: AxiosRequestConfig = {}
): Promise<T> {
  try {
    const response = await api.request<T>({
      url: path,
      method: options.method,
      data: options.data,
      params: options.params,
      headers: options.headers,
    });
    return response.data;
  } catch (firstError) {
    for (const fallbackBaseUrl of API_BASE_URLS.slice(1)) {
      try {
        const fallback = await axios.request<T>({
          baseURL: fallbackBaseUrl,
          url: path,
          method: options.method,
          data: options.data,
          params: options.params,
          headers: {
            ...(options.headers ?? {}),
            Authorization: useAuthStore.getState().token
              ? `Bearer ${useAuthStore.getState().token}`
              : undefined,
          },
          withCredentials: true,
          timeout: 10000,
        });
        return fallback.data;
      } catch {
        continue;
      }
    }

    throw firstError;
  }
}

function buildCrudService<T, TCreate, TUpdate>(resourcePath: string): CrudService<T, TCreate, TUpdate> {
  return {
    getAll: (offset: number, limit: number, includeDeleted?: boolean) => {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(limit),
      });
      if (includeDeleted) {
        params.append("include_deleted", "true");
      }
      return request<ListResponse<T>>(`${resourcePath}?${params.toString()}`);
    },
    getById: (id: number) => request<T>(`${resourcePath}/${id}`),
    create: (payload: TCreate) =>
      request<T>(resourcePath, {
        method: "POST",
        data: payload,
      }),
    update: (id: number, payload: TUpdate) =>
      request<T>(`${resourcePath}/${id}`, {
        method: "PATCH",
        data: payload,
      }),
    delete: (id: number) =>
      request<void>(`${resourcePath}/${id}`, {
        method: "DELETE",
      }),
    restore: (id: number) =>
      request<T>(`${resourcePath}/${id}/restore`, {
        method: "PATCH",
      }),
  };
}

export const categoriaService = buildCrudService<Categoria, CategoriaCreate, CategoriaUpdate>("/categorias");
export const productoService = buildCrudService<Producto, ProductoCreate, ProductoUpdate>("/productos");
export const ingredienteService = buildCrudService<Ingrediente, IngredienteCreate, IngredienteUpdate>("/ingredientes");

export function getProductosPublic(
  offset = 0,
  limit = 50,
  categoria_id?: number,
  q?: string
): Promise<ListResponse<Producto>> {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (categoria_id !== undefined) params.append("categoria_id", String(categoria_id));
  if (q) params.append("q", q);
  return request<ListResponse<Producto>>(`/productos/public?${params.toString()}`);
}

export function getProductoPublic(id: number): Promise<Producto> {
  return request<Producto>(`/productos/public/${id}`);
}

export interface RegisterPayload {
  nombre: string;
  apellido: string;
  email: string;
  celular?: string;
  password: string;
}

export function registerUser(payload: RegisterPayload): Promise<UsuarioPublic> {
  return request<UsuarioPublic>("/auth/register", {
    method: "POST",
    data: payload,
  });
}

export function assignRol(usuarioId: number, rolCodigo: string): Promise<UsuarioDetail> {
  return request<UsuarioDetail>(`/usuarios/${usuarioId}/roles/${rolCodigo}`, {
    method: "POST",
  });
}

export function removeRol(usuarioId: number, rolCodigo: string): Promise<UsuarioDetail> {
  return request<UsuarioDetail>(`/usuarios/${usuarioId}/roles/${rolCodigo}`, {
    method: "DELETE",
  });
}

export function listUsuarios(
  offset = 0,
  limit = 50,
  includeInactive = false
): Promise<ListResponse<UsuarioPublic>> {
  return request<ListResponse<UsuarioPublic>>(
    `/usuarios?offset=${offset}&limit=${limit}&include_inactive=${includeInactive}`
  );
}

export function getUsuario(usuarioId: number): Promise<UsuarioDetail> {
  return request<UsuarioDetail>(`/usuarios/${usuarioId}`);
}

export function updateUsuario(usuarioId: number, payload: UsuarioUpdatePayload): Promise<UsuarioDetail> {
  return request<UsuarioDetail>(`/usuarios/${usuarioId}`, {
    method: "PUT",
    data: payload,
  });
}

export function listDireccionesUsuario(
  usuarioId: number,
  offset = 0,
  limit = 20
): Promise<ListResponse<DireccionEntregaPublic>> {
  return request<ListResponse<DireccionEntregaPublic>>(
    `/usuarios/${usuarioId}/direcciones?offset=${offset}&limit=${limit}`
  );
}

export function createDireccionUsuario(
  usuarioId: number,
  payload: DireccionEntregaCreatePayload
): Promise<DireccionEntregaPublic> {
  return request<DireccionEntregaPublic>(`/usuarios/${usuarioId}/direcciones`, {
    method: "POST",
    data: payload,
  });
}

export function updateDireccionUsuario(
  usuarioId: number,
  direccionId: number,
  payload: DireccionEntregaUpdatePayload
): Promise<DireccionEntregaPublic> {
  return request<DireccionEntregaPublic>(`/usuarios/${usuarioId}/direcciones/${direccionId}`, {
    method: "PUT",
    data: payload,
  });
}

export function setDireccionPrincipalUsuario(
  usuarioId: number,
  direccionId: number
): Promise<DireccionEntregaPublic> {
  return request<DireccionEntregaPublic>(`/usuarios/${usuarioId}/direcciones/${direccionId}/principal`, {
    method: "PATCH",
  });
}

export function deleteDireccionUsuario(
  usuarioId: number,
  direccionId: number
): Promise<void> {
  return request<void>(`/usuarios/${usuarioId}/direcciones/${direccionId}`, {
    method: "DELETE",
  });
}

export function updatePedidoDireccion(
  pedidoId: number,
  direccionEntregaId: number
): Promise<PedidoDetail> {
  return request<PedidoDetail>(`/pedidos/${pedidoId}/direccion`, {
    method: "PATCH",
    data: { direccion_entrega_id: direccionEntregaId },
  });
}

export function createPedido(payload: PedidoCreatePayload): Promise<ConfirmarPedidoResponse> {
  return request<ConfirmarPedidoResponse>("/pedidos", {
    method: "POST",
    data: payload,
  });
}

export function actualizarItemsPedido(pedidoId: number, payload: PedidoCreatePayload): Promise<PedidoDetail> {
  return request<PedidoDetail>(`/pedidos/${pedidoId}/items`, {
    method: "PATCH",
    data: payload,
  });
}

export function confirmPedido(pedidoId: number): Promise<ConfirmarPedidoResponse> {
  return request<ConfirmarPedidoResponse>(`/pedidos/${pedidoId}/confirmar`, {
    method: "PATCH",
  });
}

export function cancelarPedido(pedidoId: number, motivo?: string): Promise<PedidoPublic> {
  const suffix = motivo ? `?motivo=${encodeURIComponent(motivo)}` : "";
  return request<PedidoPublic>(`/pedidos/${pedidoId}/cancelar${suffix}`, {
    method: "PATCH",
  });
}

export function recibirPedido(pedidoId: number): Promise<PedidoPublic> {
  return request<PedidoPublic>(`/pedidos/${pedidoId}/recibir`, {
    method: "PATCH",
  });
}

export function cambiarEstadoPedido(pedidoId: number, estado_codigo: string, motivo?: string): Promise<PedidoPublic> {
  return request<PedidoPublic>(`/pedidos/${pedidoId}/estado`, {
    method: "PATCH",
    data: { estado_codigo, motivo },
  });
}

export interface PedidosFilter {
  offset?: number;
  limit?: number;
  estado?: string;
  forma_pago?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}

export function listPedidos(offset = 0, limit = 50, filter?: PedidosFilter): Promise<ListResponse<PedidoPublic>> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  if (filter?.estado) params.append("estado", filter.estado);
  if (filter?.forma_pago) params.append("forma_pago", filter.forma_pago);
  if (filter?.fecha_desde) params.append("fecha_desde", filter.fecha_desde);
  if (filter?.fecha_hasta) params.append("fecha_hasta", filter.fecha_hasta);
  return request<ListResponse<PedidoPublic>>(`/pedidos?${params.toString()}`);
}

function wsBase(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

export function getPedidosWebSocketUrl(token?: string, tabId?: string): string {
  let url = `${wsBase()}/ws/pedidos`;
  if (token) {
    url += `?token=${encodeURIComponent(token)}`;
    if (tabId) url += `&tab_id=${encodeURIComponent(tabId)}`;
  }
  return url;
}

export function getProductosWebSocketUrl(): string {
  return `${wsBase()}/ws/productos`;
}

/** Feed admin de todos los pedidos (consigna §9.2). Requiere JWT ADMIN/PEDIDOS. */
export function getAdminPedidosWebSocketUrl(token: string, tabId?: string): string {
  let url = `${wsBase()}/ws/admin/pedidos?token=${encodeURIComponent(token)}`;
  if (tabId) url += `&tab_id=${encodeURIComponent(tabId)}`;
  return url;
}

/** Feed de un pedido puntual (consigna §9.2). El token va por query param (§9.1). */
export function getPedidoWebSocketUrl(pedidoId: number, token: string, tabId?: string): string {
  let url = `${wsBase()}/ws/pedidos/${pedidoId}?token=${encodeURIComponent(token)}`;
  if (tabId) url += `&tab_id=${encodeURIComponent(tabId)}`;
  return url;
}

export function getIngredienteDetail(ingredienteId: number): Promise<IngredienteDetail> {
  return request<IngredienteDetail>(`/ingredientes/${ingredienteId}/detail`);
}

export function getUnidadesMedida(): Promise<UnidadMedida[]> {
  return request<UnidadMedida[]>("/unidades-medida");
}

export function getCategoriaDetail(categoriaId: number): Promise<CategoriaDetail> {
  return request<CategoriaDetail>(`/categorias/${categoriaId}/detail`);
}

// ============================================================================
// UPLOADS (Cloudinary)
// ============================================================================

export interface UploadImagenResponse {
  secure_url: string;
  public_id: string;
  width?: number;
  height?: number;
  format?: string;
}

/** Sube una imagen al backend (módulo /uploads → Cloudinary). Requiere ADMIN. */
export async function uploadImagen(file: File): Promise<UploadImagenResponse> {
  const formData = new FormData();
  formData.append("file", file);
  // Content-Type undefined: que axios fije el multipart/form-data con boundary.
  const response = await api.post<UploadImagenResponse>("/uploads/imagen", formData, {
    headers: { "Content-Type": undefined as unknown as string },
  });
  return response.data;
}

/** Elimina una imagen de Cloudinary por su public_id (puede contener '/'). */
export function deleteImagen(publicId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/uploads/imagen/${publicId}`, { method: "DELETE" });
}

/**
 * Inserta transformaciones de Cloudinary (f_auto, q_auto, c_fill) en una
 * secure_url. Si no es una URL de Cloudinary, la devuelve sin cambios.
 */
export function cloudinaryThumb(url: string | null | undefined, w = 400, h = 400): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,c_fill,w_${w},h_${h}/`);
}

// ============================================================================
// STOCK OPERATIONS
// ============================================================================

export function updateProductoStock(productoId: number, stockCantidad: number): Promise<Producto> {
  return request<Producto>(`/productos/${productoId}/stock`, {
    method: "PATCH",
    data: { stock_cantidad: stockCantidad },
  });
}

export function updateProductoDisponibilidad(productoId: number, disponible: boolean): Promise<Producto> {
  return request<Producto>(`/productos/${productoId}/disponibilidad`, {
    method: "PATCH",
    data: { disponible },
  });
}

export function reservarStock(productoId: number, cantidad: number = 1): Promise<Producto> {
  return request<Producto>(`/productos/${productoId}/reservar-stock`, {
    method: "POST",
    data: { cantidad },
  });
}

export function liberarStock(productoId: number, cantidad: number = 1): Promise<Producto> {
  return request<Producto>(`/productos/${productoId}/liberar-stock`, {
    method: "POST",
    data: { cantidad },
  });
}

// ============================================================================
// PEDIDO OPERATIONS
// ============================================================================

export interface DetallePedidoPublic {
  id: number;
  producto_id: number;
  cantidad: number;
  nombre_snapshot: string;
  precio_snapshot: number;
  subtotal_snapshot: number;
}

export interface EstadoPedidoPublic {
  codigo: string;
  nombre: string;
  descripcion: string | null;
}

export interface PedidoDetail {
  id: number;
  usuario_id: number;
  direccion_entrega_id: number;
  forma_pago_codigo: string | null;
  estado_codigo: string;
  subtotal: number;
  descuento: number;
  costo_envio: number;
  total: number;
  notas: string | null;
  motivo?: string | null;
  created_at: string;
  updated_at: string;
  estado: EstadoPedidoPublic;
  detalles: DetallePedidoPublic[];
  pago_estado?: string | null;
  pago_mp_status?: string | null;
  pago_mp_payment_id?: number | null;
}

export interface HistorialEstadoPedidoPublic {
  id: number;
  pedido_id: number;
  estado_desde_codigo: string;
  estado_hacia_codigo: string;
  usuario_id: number | null;
  motivo: string | null;
  fecha: string;
}

export function getPedidoDetail(pedidoId: number): Promise<PedidoDetail> {
  return request<PedidoDetail>(`/pedidos/${pedidoId}`);
}

export function getHistorialPedido(pedidoId: number): Promise<{ data: HistorialEstadoPedidoPublic[] }> {
  return request<{ data: HistorialEstadoPedidoPublic[] }>(`/pedidos/${pedidoId}/historial`);
}

// ============================================================================
// PAYMENT OPERATIONS (MercadoPago)
// ============================================================================

export interface CreatePreferenceResponse {
  pago_id: number
  preference_id: string
  init_point: string | null
  public_key: string | null
}

export interface ConfirmPaymentResponse {
  estado: string | null
  pedido_id: number
}

export function createPreference(pedidoId: number): Promise<CreatePreferenceResponse> {
  return request<CreatePreferenceResponse>("/pagos/create-preference", {
    method: "POST",
    data: { pedido_id: pedidoId },
  });
}

export function confirmPayment(pedidoId: number, paymentId?: number): Promise<ConfirmPaymentResponse> {
  return request<ConfirmPaymentResponse>("/pagos/confirm", {
    method: "POST",
    data: { pedido_id: pedidoId, payment_id: paymentId },
  });
}

export function verifyPayment(pedidoId: number): Promise<ConfirmPaymentResponse> {
  return request<ConfirmPaymentResponse>(`/pagos/verify/${pedidoId}`, {
    method: "GET",
  });
}

export interface PagoPublic {
  id: number
  pedido_id: number
  monto: number
  estado: string
  mp_preference_id: string | null
  mp_init_point: string | null
  mp_payment_id: number | null
  mp_merchant_order_id: number | null
  mp_status: string | null
  mp_status_detail: string | null
  created_at: string | null
}

export function getPagoByPedido(pedidoId: number): Promise<PagoPublic> {
  return request<PagoPublic>(`/pagos/${pedidoId}`);
}

export interface ManualAprobarPayload {
  pedido_id: number
  mp_payment_id?: number
}

export function manualAprobarPago(payload: ManualAprobarPayload): Promise<ConfirmPaymentResponse> {
  return request<ConfirmPaymentResponse>("/pagos/manual-aprobar", {
    method: "POST",
    data: payload,
  });
}

// ============================================================================
// ESTADISTICAS (Charts / Dashboard)
// ============================================================================

export interface ResumenResponse {
  total_pedidos: number
  pedidos_hoy: number
  ingresos_totales: number
  ingresos_hoy: number
  ticket_promedio: number
  productos_vendidos: number
}

export interface VentaItem {
  fecha: string
  total: number
  pedidos: number
}

export interface VentasResponse {
  data: VentaItem[]
}

export interface ProductoTopItem {
  producto_id: number
  nombre: string
  cantidad_vendida: number
  total_generado: number
}

export interface ProductosTopResponse {
  data: ProductoTopItem[]
}

export interface PedidosPorEstadoItem {
  estado: string
  cantidad: number
  porcentaje: number
}

export interface PedidosPorEstadoResponse {
  data: PedidosPorEstadoItem[]
}

export interface IngresosResponse {
  total_ingresos: number
  ingresos_mes_actual: number
  ingresos_mes_anterior: number
  variacion_porcentual: number | null
}

export function getResumen(): Promise<ResumenResponse> {
  return request<ResumenResponse>("/estadisticas/resumen");
}

export function getVentas(): Promise<VentasResponse> {
  return request<VentasResponse>("/estadisticas/ventas");
}

export function getProductosTop(limit = 10): Promise<ProductosTopResponse> {
  return request<ProductosTopResponse>(`/estadisticas/productos-top?limit=${limit}`);
}

export function getPedidosPorEstado(): Promise<PedidosPorEstadoResponse> {
  return request<PedidosPorEstadoResponse>("/estadisticas/pedidos-por-estado");
}

export function getIngresos(): Promise<IngresosResponse> {
  return request<IngresosResponse>("/estadisticas/ingresos");
}

export type { ListResponse };


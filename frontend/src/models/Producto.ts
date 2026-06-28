export interface ProductoIngrediente {
  ingrediente_id: number;
  cantidad: number;
  unidad_medida_id: number;
  unidad_simbolo?: string | null;
  es_removible: boolean;
  es_opcional: boolean;
}

export interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio_base: number;
  imagenes_url: string[] | null;
  tiempo_prep_min: number | null;
  disponible: boolean;
  usa_stock_manual: boolean;
  stock_manual: number | null;
  costo_compra_manual: number | null;
  categoria_id: number | null;
  categoria_nombre: string | null;
  ingredientes: ProductoIngrediente[];
  stock_disponible: number | null;
  costo_total_ingredientes: number;
  precio_sugerido: number;
  margen_estimado: number;
  activo: boolean;
  deleted_at: string | null;
}

export interface ProductoCreate {
  nombre: string;
  descripcion: string | null;
  precio_base: number;
  imagenes_url: string[] | null;
  tiempo_prep_min: number | null;
  disponible: boolean;
  usa_stock_manual: boolean;
  stock_manual: number | null;
  costo_compra_manual: number | null;
  categoria_id: number | null;
  ingredientes: ProductoIngrediente[];
}

export interface ProductoUpdate {
  nombre?: string;
  descripcion?: string | null;
  precio_base?: number;
  imagenes_url?: string[] | null;
  tiempo_prep_min?: number | null;
  disponible?: boolean;
  usa_stock_manual?: boolean;
  stock_manual?: number | null;
  costo_compra_manual?: number | null;
  categoria_id?: number | null;
  ingredientes?: ProductoIngrediente[];
}

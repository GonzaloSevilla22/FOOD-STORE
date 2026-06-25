export type UnidadMedidaEnum = "gramos" | "mililitros" | "kilos" | "litros" | "unidades" | "porciones";

export interface Ingrediente {
  id: number;
  nombre: string;
  descripcion: string | null;
  es_alergeno: boolean;
  stock_actual: number;
  stock_minimo: number;
  costo_unitario: number;
  unidad_medida: UnidadMedidaEnum;
  activo: boolean;
  deleted_at: string | null;
}

export interface IngredienteCreate {
  nombre: string;
  descripcion: string | null;
  es_alergeno: boolean;
  stock_actual: number;
  stock_minimo: number;
  costo_unitario: number;
  unidad_medida: UnidadMedidaEnum;
}

export interface IngredienteUpdate {
  nombre?: string;
  descripcion?: string | null;
  es_alergeno?: boolean;
  stock_actual?: number;
  stock_minimo?: number;
  costo_unitario?: number;
  unidad_medida?: UnidadMedidaEnum;
}

export interface IngredienteProductoUso {
  producto_id: number;
  producto_nombre: string;
  cantidad: number;
  unidad_medida_id: number;
  unidad_simbolo?: string | null;
}

export interface IngredienteDetail extends Ingrediente {
  productos_relacionados: IngredienteProductoUso[];
}

export interface UnidadMedida {
  id: number;
  nombre: string;
  simbolo: string;
  tipo: string;
}

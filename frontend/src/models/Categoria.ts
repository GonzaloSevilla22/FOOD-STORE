export interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
  orden_display: number;
  parent_id: number | null;
  activo: boolean;
  deleted_at: string | null;
}

export interface CategoriaCreate {
  nombre: string;
  descripcion: string | null;
  orden_display: number;
  parent_id?: number | null;
}

export interface CategoriaUpdate {
  nombre?: string;
  descripcion?: string | null;
  orden_display?: number;
  parent_id?: number | null;
}

export interface CategoriaMini {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface CategoriaProductoInfo {
  producto_id: number;
  producto_nombre: string;
  activo: boolean;
}

export interface CategoriaDetail extends Categoria {
  parent: CategoriaMini | null;
  subcategorias: CategoriaMini[];
  productos_asociados: CategoriaProductoInfo[];
}

$ErrorActionPreference = 'Stop'

$baseUrl = 'http://127.0.0.1:8000'

Write-Host "== DEMO API: creación de datos ==" -ForegroundColor Cyan

# 1) Categoria
$categoriaBody = @{
    nombre = "Pizzas"
    descripcion = "Categoria principal de pizzas"
    orden_display = 1
} | ConvertTo-Json

$categoria = Invoke-RestMethod -Method Post -Uri "$baseUrl/categorias/" -ContentType "application/json" -Body $categoriaBody
Write-Host "Categoria creada -> ID: $($categoria.id), nombre: $($categoria.nombre)" -ForegroundColor Green

# 2) Ingredientes
$ing1Body = @{
    nombre = "Queso Mozzarella"
    descripcion = "Queso base"
    es_alergeno = $false
} | ConvertTo-Json
$ing2Body = @{
    nombre = "Jamon Cocido"
    descripcion = "Jamon tradicional"
    es_alergeno = $false
} | ConvertTo-Json

$ing1 = Invoke-RestMethod -Method Post -Uri "$baseUrl/ingredientes/" -ContentType "application/json" -Body $ing1Body
$ing2 = Invoke-RestMethod -Method Post -Uri "$baseUrl/ingredientes/" -ContentType "application/json" -Body $ing2Body
Write-Host "Ingredientes creados -> IDs: $($ing1.id), $($ing2.id)" -ForegroundColor Green

# 3) Producto (incluye categoria_id + ingredientes con cantidad y unidad)
$productoBody = @{
    nombre = "Pizza Muzzarella"
    descripcion = "Muzzarella clasica"
    precio_base = 7500
    imagenes_url = "https://picsum.photos/600/400"
    tiempo_prep_min = 15
    disponible = $true
    categoria_id = $categoria.id
    ingredientes = @(
        @{
            ingrediente_id = $ing1.id
            cantidad = 500
            unidad = "gramos"
            es_removible = $true
            es_opcional = $false
        },
        @{
            ingrediente_id = $ing2.id
            cantidad = 100
            unidad = "gramos"
            es_removible = $true
            es_opcional = $false
        }
    )
} | ConvertTo-Json

$producto = Invoke-RestMethod -Method Post -Uri "$baseUrl/productos/" -ContentType "application/json" -Body $productoBody
Write-Host "Producto creado -> ID: $($producto.id), nombre: $($producto.nombre)" -ForegroundColor Green

# 4) Listado con paginacion (Query params)
$listado = Invoke-RestMethod -Method Get -Uri "$baseUrl/productos/?offset=0&limit=10"
Write-Host "Listado productos total: $($listado.total)" -ForegroundColor Yellow
$listado | ConvertTo-Json -Depth 6

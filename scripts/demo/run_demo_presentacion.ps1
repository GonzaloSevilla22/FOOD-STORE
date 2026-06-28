<#
.SYNOPSIS
Guión de prueba para la presentación del Back End.
Muestra en acción:
  - Exception Handler (código personalizado)
  - Logs, Rate Limit y Timing (por consola)

INSTRUCCIONES:
1. Abrí UNA terminal y ejecutá:   uvicorn main:app --reload
2. Abrí OTRA terminal, ubicate en la raíz del proyecto y ejecutá:
   .\scripts\demo\run_demo_presentacion.ps1
3. Observá los mensajes en la consola del servidor (logs + timing).
#>

$API = "http://localhost:8000"

function Write-Step($Title) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
}

function Call-Api($Method, $Url, $Body, $ContentType) {
    $params = @{Uri = "$API$Url"; Method = $Method; UseBasicParsing = $true}
    if ($Body) { $params.Body = $Body; $params.ContentType = $ContentType }
    try {
        $r = Invoke-WebRequest @params -ErrorAction Stop
        Write-Host "   Status: $($r.StatusCode)" -ForegroundColor Green
        try { Write-Host "   Body:   $($r.Content)" -ForegroundColor Gray } catch {}
        return $r
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status: $code" -ForegroundColor Yellow
        try {
            $bodyObj = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "   Body:   $($bodyObj | ConvertTo-Json -Compress)" -ForegroundColor Yellow
        } catch {
            Write-Host "   Body:   $($_.ErrorDetails.Message)" -ForegroundColor Yellow
        }
        return $null
    }
}

Write-Host ""
Write-Host "  FOOD STORE API - Demo de Back End" -ForegroundColor White
Write-Host "  Exception Handler | Logs | Rate Limit | Timing" -ForegroundColor White
Write-Host "  (Mirá la consola del servidor para ver los logs)" -ForegroundColor DarkGray

# =============================================
# 1. HEALTH - Log + Timing
# =============================================
Write-Step "1) HEALTH CHECK - Muestra log + timing en consola"
Write-Host "   GET /health"
Call-Api GET "/health"
Write-Host "   -> En la consola del servidor aparece:"
Write-Host '      GET /health -> 200 [2.5ms] client=127.0.0.1'
Write-Host "   (Método, path, status, duración en ms, IP)"

# =============================================
# 2. EXCEPTION HANDLER - 404
# =============================================
Write-Step "2) EXCEPTION HANDLER - 404 Not Found"
Write-Host "   GET /api/inexistente"
Call-Api GET "/api/inexistente"
Write-Host "   -> En consola: log WARNING con el 404"
Write-Host "   -> El error tiene formato: {""error"": {""code"": ""not_found"", ""message"": ""Not Found""}}"

# =============================================
# 3. EXCEPTION HANDLER - 422 Validation
# =============================================
Write-Step "3) EXCEPTION HANDLER - 422 Validation Error"
Write-Host "   POST /auth/register (falta password y nombre)"
Call-Api POST "/auth/register" '{"email":"invalido"}' "application/json"
Write-Host "   -> En consola: logs WARNING detallando cada campo inválido"
Write-Host "   -> El error incluye details[] con field + message"

# =============================================
# 4. EXCEPTION HANDLER - 401 Unauthorized
# =============================================
Write-Step "4) EXCEPTION HANDLER - 401 Unauthorized"
Write-Host "   GET /auth/me (sin token)"
Call-Api GET "/auth/me"
Write-Host "   -> code: unauthorized, message: No autenticado"

# =============================================
# 5. RATE LIMIT - 429 (usa auth/login, burst=5)
# =============================================
Write-Step "5) RATE LIMIT - Forzar 429 Too Many Requests"
Write-Host "   El endpoint /auth/login tiene burst=5. Enviando 10 requests..."
Write-Host "   (Mirá la consola del servidor para los warnings)" -ForegroundColor DarkGray

$bodyLogin = '{"email":"admin@test.com","password":"admin123"}'
for ($i = 1; $i -le 10; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "$API/auth/login" -Method POST `
            -Body $bodyLogin -ContentType "application/json" `
            -UseBasicParsing -ErrorAction Stop
        Write-Host "   #$i -> $($r.StatusCode)" -ForegroundColor Green
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Write-Host "   #$i -> $code (Rate Limit!)" -ForegroundColor Red
    }
}
Write-Host "   -> En consola: warnings de rate limit con client=ip:..."
Write-Host "   -> El response 429 incluye retry_after_seconds, headers X-RateLimit-*"

# =============================================
# 6. RESUMEN
# =============================================
Write-Step "RESUMEN - Archivos creados / modificados"
Write-Host "  EXCEPTION HANDLER:" -ForegroundColor White
Write-Host "    app/core/exception_handlers.py" -ForegroundColor Gray
Write-Host "    - http_exception_handler()     (401, 403, 404, 429...)" -ForegroundColor Gray
Write-Host "    - validation_exception_handler() (422)" -ForegroundColor Gray
Write-Host "    - general_exception_handler()    (500)" -ForegroundColor Gray
Write-Host "    main.py -> register_exception_handlers(app)" -ForegroundColor Gray
Write-Host ""
Write-Host "  LOGS + TIMING:" -ForegroundColor White
Write-Host "    app/core/logging_middleware.py (nuevo)" -ForegroundColor Gray
Write-Host "    main.py -> app.add_middleware(LoggingMiddleware)" -ForegroundColor Gray
Write-Host ""
Write-Host "  RATE LIMIT:" -ForegroundColor White
Write-Host "    app/core/rate_limit/ (ya existente)" -ForegroundColor Gray
Write-Host "    - TokenBucket en memoria" -ForegroundColor Gray
Write-Host "    - Burst=30, refill=120/min (default)" -ForegroundColor Gray
Write-Host "    - Auth paths: burst=5, refill=5/min" -ForegroundColor Gray
Write-Host ""
Write-Host "  GUION DE PRUEBA:" -ForegroundColor White
Write-Host "    scripts/demo/run_demo_presentacion.ps1 (nuevo)" -ForegroundColor Gray
Write-Host ""
Write-Host "  TESTS (48 pasan):" -ForegroundColor White
Write-Host "    tests/integration/test_exception_handlers.py (actualizado)" -ForegroundColor Gray
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  FIN" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

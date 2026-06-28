import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlmodel import Session

from app.core.config import settings
from app.core.database import get_session
from app.core.deps import get_current_active_user, require_roles
from app.modules.usuarios.schemas import CurrentUser
from app.modules.payments.schemas import (
    CrearPagoRequest,
    ConfirmarPagoRequest,
    PagoCrearResponse,
    PagoEstadoResponse,
    PagoPublic,
    ManualAprobarRequest,
)
from app.modules.payments.service import PaymentService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pagos", tags=["pagos"])


def get_payment_service(session: Session = Depends(get_session)) -> PaymentService:
    return PaymentService(session)


@router.post("/crear", response_model=PagoCrearResponse)
@router.post("/create-preference", response_model=PagoCrearResponse)
async def create_preference(
    data: CrearPagoRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    svc: PaymentService = Depends(get_payment_service),
):
    return await svc.crear_pago(data.pedido_id, current_user.id)


@router.get("/{pedido_id}", response_model=PagoPublic)
def get_pago_by_pedido(
    pedido_id: int,
    svc: PaymentService = Depends(get_payment_service),
):
    return svc.obtener_pago_por_pedido(pedido_id)


@router.post("/manual-aprobar", response_model=PagoEstadoResponse)
async def manual_aprobar(
    data: ManualAprobarRequest,
    _: CurrentUser = Depends(require_roles(["ADMIN", "PEDIDOS"])),
    svc: PaymentService = Depends(get_payment_service),
):
    return await svc.aprobar_manual(data)


@router.post("/webhook")
async def webhook(
    request: Request,
    svc: PaymentService = Depends(get_payment_service),
):
    try:
        query_params = dict(request.query_params)
        if request.headers.get("content-type", "").startswith("application/json"):
            data = await request.json()
        else:
            data = dict(await request.form())
        return await svc.procesar_webhook(data, query_params=query_params)
    except Exception as e:
        logger.exception("Error en webhook MP")
        return {"status": "error", "reason": str(e)}


@router.post("/confirm", response_model=PagoEstadoResponse)
async def confirm_payment(
    data: ConfirmarPagoRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    svc: PaymentService = Depends(get_payment_service),
):
    """Confirmar/verificar pago. Puede ser llamado por el dueño del pedido o admin/pedidos."""
    return await svc.confirmar_pago(data.pedido_id, data.payment_id, current_user)


@router.get("/verify/{pedido_id}", response_model=PagoEstadoResponse)
async def verify_payment(
    pedido_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    svc: PaymentService = Depends(get_payment_service),
):
    """Verificar el estado real del pago contra MercadoPago. Puede ser llamado por el cliente."""
    return await svc.confirmar_pago(pedido_id, payment_id=None, current_user=current_user)


@router.get("/redirect/{pedido_id}/{status}")
async def redirect_after_pago(pedido_id: int, status: str, request: Request):
    frontend_url = settings.VITE_FRONTEND_URL or "http://localhost:5500"
    url = f"{frontend_url}/pedido/{pedido_id}?status={status}"
    qs = request.url.query
    if qs and "status=" not in qs:
        url += f"&{qs}"
    return RedirectResponse(url=url)


@router.get("/orders/{pedido_id}/{status}")
async def orders_redirect(
    pedido_id: int,
    status: str,
    request: Request,
    svc: PaymentService = Depends(get_payment_service),
):
    frontend_url = settings.VITE_FRONTEND_URL or "http://localhost:5500"

    if status == "success":
        payment_id = request.query_params.get("collection_id") or request.query_params.get("payment_id")
        payment_id_int = int(payment_id) if payment_id else None
        try:
            await svc.confirmar_pago(pedido_id, payment_id=payment_id_int)
        except Exception:
            logger.warning("No se pudo verificar pago en redirect para pedido %s", pedido_id)

        await svc._broadcast_stock_changes(pedido_id)

        pedidos_url = f"{frontend_url}/payment/{pedido_id}?payment=success"
        html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Muchas gracias por su compra</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f9fafb; }}
  .card {{ background: white; border-radius: 12px; padding: 2rem; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 400px; width: 90%; }}
  .icon {{ width: 64px; height: 64px; border-radius: 50%; background: #d1fae5; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 2rem; color: #059669; }}
  h1 {{ font-size: 1.25rem; color: #111827; margin-bottom: 0.5rem; }}
  p {{ color: #6b7280; margin-bottom: 1.5rem; }}
  a {{ display: inline-block; background: #2563eb; color: white; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-size: 0.875rem; }}
  a:hover {{ background: #1d4ed8; }}
  .foot {{ font-size: 0.75rem; color: #9ca3af; margin-top: 1rem; }}
</style>
</head>
<body>
<div class="card">
  <div class="icon">&#10003;</div>
  <h1>Muchas gracias por su compra</h1>
  <p>Tu pago se ha procesado correctamente.</p>
  <a href="{pedidos_url}">Ver mis pedidos</a>
  <p class="foot">Redirigiendo automaticamente en 2 segundos...</p>
</div>
<script>
setTimeout(function(){{ window.location.href = '{pedidos_url}'; }}, 2000);
</script>
</body>
</html>"""
        return HTMLResponse(content=html)

    if status == "failure":
        return RedirectResponse(url=f"{frontend_url}/carrito")

    return RedirectResponse(url=f"{frontend_url}/mis-pedidos")

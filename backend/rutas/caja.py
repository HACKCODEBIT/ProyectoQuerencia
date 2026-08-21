from ninja import Router
from typing import List
from django.utils import timezone
from datetime import timedelta
from ninja.errors import HttpError
from django.http import HttpResponse

from rutas.auth import AuthBearer
from modelos.models import Producto, Pedido, Factura
from esquemas.caja import (
    ProductoResponse, PedidoCreate, PedidoUpdate, 
    PedidoResponse, FacturaResponse
)
from crud.caja import (
    crear_pedido_crud, formatear_pedido_response, 
    enviar_pedido_proveedor, generar_factura_pedido,
    generar_pdf_factura
)

caja_router = Router()

@caja_router.get("/productos", response=List[ProductoResponse], auth=AuthBearer())
def listar_productos(request):
    return Producto.objects.all()

@caja_router.post("/pedidos", response=PedidoResponse, auth=AuthBearer())
def crear_pedido(request, datos: PedidoCreate):
    if request.auth.tipo_usuario != 'administrador':
        raise HttpError(403, "Solo administradores pueden crear pedidos")
    
    try:
        nuevo_pedido = crear_pedido_crud(datos, request.auth)
        return formatear_pedido_response(nuevo_pedido)
    except ValueError as e:
        raise HttpError(400, str(e))

import requests
import os
from esquemas.caja import CalcularEnvioRequest

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "AIzaSyCoj1dIj7uUJjtiQnuBcuEQWQpBPsRK9X4")
# IMPORTANTE: Cambia esta variable por la dirección real de tu local para que el cálculo sea exacto
DIRECCION_ORIGEN = os.getenv("DIRECCION_ORIGEN", "Cali, Valle del Cauca, Colombia")

@caja_router.post("/calcular-envio", auth=AuthBearer())
def calcular_envio(request, body: CalcularEnvioRequest):
    direccion_destino = body.direccion.strip()
    if not direccion_destino:
        return {"distancia_km": 0.0, "costo_envio": 0.0}
        
    # Le agregamos ", Colombia" si el usuario no lo puso, para evitar que Google Maps busque la dirección en otro país
    if "colombia" not in direccion_destino.lower():
        direccion_destino += ", Colombia"

    url = "https://maps.googleapis.com/maps/api/distancematrix/json"
    params = {
        "origins": DIRECCION_ORIGEN,
        "destinations": direccion_destino,
        "key": GOOGLE_MAPS_API_KEY,
        "units": "metric"
    }
    
    import urllib.parse
    
    try:
        res = requests.get(url, params=params, timeout=10)
        data = res.json()
        
        if data.get("status") == "OK":
            element = data["rows"][0]["elements"][0]
            if element.get("status") == "OK":
                # 'value' está en metros, lo convertimos a kilómetros
                metros = element["distance"]["value"]
                km_exactos = metros / 1000.0
                
                # Regla de Negocio: Tarifa de $3000 base + $1000 por cada KM exacto (redondeando hacia abajo)
                costo = 3000 + (1000 * int(km_exactos))
                
                # Generar imagen estática del mapa centrada en el destino
                dir_codificada = urllib.parse.quote(direccion_destino)
                mapa_url = f"https://maps.googleapis.com/maps/api/staticmap?center={dir_codificada}&zoom=15&size=200x200&markers=color:red%7C{dir_codificada}&key={GOOGLE_MAPS_API_KEY}"
                
                return {
                    "distancia_km": round(km_exactos, 1),
                    "costo_envio": float(costo),
                    "mapa_url": mapa_url
                }
            else:
                raise HttpError(400, "Google Maps no encontró una ruta válida hacia esa dirección.")
        else:
            raise HttpError(400, f"Error del servicio de mapas: {data.get('status')}")
            
    except requests.exceptions.RequestException:
        raise HttpError(500, "Error de conexión con Google Maps.")

@caja_router.get("/pedidos", response=List[PedidoResponse], auth=AuthBearer())
def listar_pedidos(request):
    pedidos = Pedido.objects.all().order_by('-fecha', '-idPedido')
    return [formatear_pedido_response(p) for p in pedidos]

@caja_router.put("/pedidos/{pedido_id}", response=PedidoResponse, auth=AuthBearer())
def actualizar_pedido(request, pedido_id: int, datos: PedidoUpdate):
    if request.auth.tipo_usuario != 'administrador':
        raise HttpError(403, "Solo administradores")
        
    try:
        pedido = Pedido.objects.get(idPedido=pedido_id)
        if datos.estado:
            pedido.estado = datos.estado
        if datos.responsableRecepcion:
            pedido.responsableRecepcion = datos.responsableRecepcion
        pedido.save()
        return formatear_pedido_response(pedido)
    except Pedido.DoesNotExist:
        raise HttpError(404, "Pedido no encontrado")

@caja_router.delete("/pedidos/{pedido_id}", auth=AuthBearer())
def cancelar_pedido(request, pedido_id: int):
    if request.auth.tipo_usuario != 'administrador':
        raise HttpError(403, "Solo administradores")
        
    try:
        pedido = Pedido.objects.get(idPedido=pedido_id)
        # Devolver el stock
        for det in pedido.detalles.all():
            det.producto.stock += det.cantidad
            det.producto.save()
            
        pedido.estado = "Cancelado"
        pedido.save()
        return {"message": "Pedido cancelado correctamente y stock devuelto."}
    except Pedido.DoesNotExist:
        raise HttpError(404, "Pedido no encontrado")

@caja_router.post("/pedidos/{pedido_id}/enviar-proveedor", auth=AuthBearer())
def enviar_a_proveedor(request, pedido_id: int):
    exito = enviar_pedido_proveedor(pedido_id)
    if exito:
        return {"message": "Pedido enviado al proveedor"}
    raise HttpError(500, "Error enviando correo")

@caja_router.put("/pedidos/{pedido_id}/recepcion", auth=AuthBearer())
def verificar_recepcion(request, pedido_id: int):
    try:
        pedido = Pedido.objects.get(idPedido=pedido_id)
        pedido.estado = "Recibido"
        pedido.save()
        return {"message": "Pedido marcado como recibido"}
    except Pedido.DoesNotExist:
        raise HttpError(404, "Pedido no encontrado")

@caja_router.post("/pedidos/{pedido_id}/factura", response=FacturaResponse, auth=AuthBearer())
def generar_factura(request, pedido_id: int):
    try:
        pedido = Pedido.objects.get(idPedido=pedido_id)
        if pedido.estado not in ["Completado", "Pagado"]:
            raise HttpError(400, "El pedido debe estar pagado para poder generar la factura.")
            
        factura = generar_factura_pedido(pedido_id)
        
        # ACTULIZAR ESTADO A COMPLETADO
        if pedido.estado != "Completado":
            pedido.estado = "Completado"
            pedido.save()
            
        return factura
    except Pedido.DoesNotExist:
        raise HttpError(404, "Pedido no encontrado")

@caja_router.get("/pedidos/{pedido_id}/pdf", auth=AuthBearer())
def descargar_pdf_por_pedido(request, pedido_id: int):
    try:
        pedido = Pedido.objects.get(idPedido=pedido_id)
        factura = pedido.facturas.first()
        if not factura:
            raise HttpError(404, "El pedido aún no tiene factura generada")
            
        buffer = generar_pdf_factura(factura.idFactura)
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="factura_pedido_{pedido_id}.pdf"'
        return response
    except Pedido.DoesNotExist:
        raise HttpError(404, "Pedido no encontrado")

@caja_router.get("/reporte-ventas", auth=AuthBearer())
def reporte_ventas(request):
    fecha_inicio = timezone.now().date() - timedelta(days=30)
    facturas = Factura.objects.filter(fecha__gte=fecha_inicio)
    
    total_ventas = sum(f.total for f in facturas)
    return {
        "dias": 30,
        "cantidad_facturas": facturas.count(),
        "total_ventas": total_ventas,
        "facturas": [{"id": f.idFactura, "fecha": f.fecha, "total": f.total, "pedido_id": f.pedido.idPedido} for f in facturas]
    }

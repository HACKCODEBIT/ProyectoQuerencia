from ninja import Schema
from typing import List, Optional
from datetime import date

# ==================== PRODUCTOS ====================
class ProductoCreate(Schema):
    nombre: str
    descripcion: str = ""
    precio: float
    stock: int = 0
    categoria_id: Optional[int] = None

class ProductoResponse(Schema):
    idProducto: int
    nombre: str
    descripcion: str
    precio: float
    stock: int
    
class CategoriaResponse(Schema):
    idCategoria: int
    nombre: str

# ==================== PEDIDOS ====================
class DetallePedidoCreate(Schema):
    producto_id: int
    cantidad: int

class DetallePedidoResponse(Schema):
    idDetalle: int
    producto_id: int
    producto_nombre: str
    cantidad: int
    subtotal: float
    cliente: str
    cedulaCliente: int

class PedidoCreate(Schema):
    cliente: str
    cedulaCliente: int
    responsableRecepcion: str
    direccionEnvio: Optional[str] = None
    distancia_km: Optional[float] = 0.0
    costo_envio: Optional[float] = 0.0
    detalles: List[DetallePedidoCreate]

class PedidoUpdate(Schema):
    estado: Optional[str] = None
    responsableRecepcion: Optional[str] = None

class PedidoResponse(Schema):
    idPedido: int
    fecha: date
    estado: str
    responsableRecepcion: Optional[str] = None
    direccionEnvio: Optional[str] = None
    distancia_km: Optional[float] = 0.0
    costo_envio: Optional[float] = 0.0
    usuario_id: int
    total: float
    detalles: List[DetallePedidoResponse]
    wompi_transaction_id: Optional[str] = None
    wompi_payment_url: Optional[str] = None

class CalcularEnvioRequest(Schema):
    direccion: str

# ==================== FACTURAS ====================
class FacturaResponse(Schema):
    idFactura: int
    fecha: date
    total: float
    pedido_id: int

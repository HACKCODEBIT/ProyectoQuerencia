import { useState, useEffect } from 'react';
import './App.css';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

export default function Caja({ currentUser, token, showToast }) {
  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [clientesRegistrados, setClientesRegistrados] = useState([]);
  
  // Formulario Pedido
  const [form, setForm] = useState({
    cliente: '',
    celular: '',
    responsableRecepcion: '',
    direccionEnvio: '',
    distancia_km: 0.0,
    costo_envio: 0.0,
    detalles: []
  });

  const [tempProducto, setTempProducto] = useState('');
  const [tempCantidad, setTempCantidad] = useState(1);
  const [isCalculandoEnvio, setIsCalculandoEnvio] = useState(false);

  // Estados para Modal de Modificar Pedido
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editModalData, setEditModalData] = useState(null);
  const [editTempProducto, setEditTempProducto] = useState('');
  const [editTempCantidad, setEditTempCantidad] = useState(1);

  useEffect(() => {
    cargarPedidos();
    cargarProductos();
  }, []);

  // Extraer clientes únicos cada vez que cargan los pedidos
  useEffect(() => {
    const clientesUnicos = new Set();
    pedidos.forEach(p => {
      if (p.detalles && p.detalles.length > 0 && p.detalles[0].cliente) {
        clientesUnicos.add(p.detalles[0].cliente);
      }
    });
    setClientesRegistrados(Array.from(clientesUnicos));
  }, [pedidos]);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const calcularEnvio = async (dirOverride = null, isEditModal = false) => {
    const dir = dirOverride !== null ? dirOverride : (isEditModal ? editModalData?.direccionEnvio : form.direccionEnvio);
    if (!dir || !dir.trim()) {
      if (isEditModal) {
        setEditModalData(prev => prev ? { ...prev, distancia_km: 0, costo_envio: 0, mapa_url: '' } : null);
      } else {
        setForm(prev => ({ ...prev, distancia_km: 0, costo_envio: 0, mapa_url: '' }));
      }
      return;
    }
    setIsCalculandoEnvio(true);
    try {
      const negocioInfo = JSON.parse(localStorage.getItem('app_negocio_info') || '{}');
      const origen = negocioInfo.direccion || '';
      const res = await fetch(`${API_BASE_URL}/caja/calcular-envio`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ direccion: dir.trim(), origen })
      });
      if (res.ok) {
        const data = await res.json();
        if (isEditModal) {
          setEditModalData(prev => prev ? {
            ...prev,
            distancia_km: data.distancia_km,
            costo_envio: data.costo_envio,
            mapa_url: data.mapa_url
          } : null);
        } else {
          setForm(prev => ({
            ...prev,
            distancia_km: data.distancia_km,
            costo_envio: data.costo_envio,
            mapa_url: data.mapa_url
          }));
        }
        showToast(`Envío calculado: ${data.distancia_km}km = $${Number(data.costo_envio).toLocaleString()}`, 'success');
      } else {
        const err = await res.json();
        showToast(err.detail || 'No se pudo calcular el envío automáticamente', 'warning');
      }
    } catch (e) {
      showToast('Error de conexión calculando envío', 'error');
    } finally {
      setIsCalculandoEnvio(false);
    }
  };

  const handleAbrirModificar = (pedido) => {
    const primerDet = pedido.detalles && pedido.detalles.length > 0 ? pedido.detalles[0] : null;
    setEditModalData({
      idPedido: pedido.idPedido,
      cliente: primerDet?.cliente || '',
      celular: primerDet?.cedulaCliente ? String(primerDet.cedulaCliente) : '',
      responsableRecepcion: pedido.responsableRecepcion || '',
      estado: pedido.estado,
      direccionEnvio: pedido.direccionEnvio || '',
      distancia_km: pedido.distancia_km || 0.0,
      costo_envio: pedido.costo_envio || 0.0,
      mapa_url: '',
      detalles: (pedido.detalles || []).map(d => ({
        producto_id: d.producto_id,
        nombre: d.producto_nombre,
        precio: d.cantidad > 0 ? (d.subtotal / d.cantidad) : 0,
        cantidad: d.cantidad
      }))
    });
    setEditTempProducto('');
    setEditTempCantidad(1);
    setIsEditModalOpen(true);
  };

  const handleEditAddProducto = () => {
    if (!editTempProducto || editTempCantidad <= 0) return;
    const prod = productos.find(p => p.dni_producto == editTempProducto);
    if (!prod) return;

    setEditModalData(prev => {
      if (!prev) return null;
      const exists = prev.detalles.find(d => d.producto_id == prod.dni_producto);
      if (exists) {
        return {
          ...prev,
          detalles: prev.detalles.map(d =>
            d.producto_id == prod.dni_producto ? { ...d, cantidad: d.cantidad + parseInt(editTempCantidad) } : d
          )
        };
      } else {
        return {
          ...prev,
          detalles: [...prev.detalles, {
            producto_id: prod.dni_producto,
            nombre: prod.nombre,
            precio: prod.precio,
            cantidad: parseInt(editTempCantidad)
          }]
        };
      }
    });
    setEditTempProducto('');
    setEditTempCantidad(1);
  };

  const handleEditChangeCantidad = (producto_id, delta) => {
    setEditModalData(prev => {
      if (!prev) return null;
      const nuevos = prev.detalles.map(d => {
        if (d.producto_id == producto_id) {
          const nueva = d.cantidad + delta;
          return nueva > 0 ? { ...d, cantidad: nueva } : null;
        }
        return d;
      }).filter(Boolean);
      return { ...prev, detalles: nuevos };
    });
  };

  const handleEditRemoveProducto = (producto_id) => {
    setEditModalData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        detalles: prev.detalles.filter(d => d.producto_id != producto_id)
      };
    });
  };

  const guardarModificacionPedido = async (e) => {
    e.preventDefault();
    if (!editModalData) return;

    if (editModalData.detalles.length === 0) {
      showToast('El pedido debe tener al menos un producto', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        cliente: editModalData.cliente,
        cedulaCliente: parseInt(editModalData.celular) || 0,
        responsableRecepcion: editModalData.responsableRecepcion,
        direccionEnvio: editModalData.direccionEnvio,
        distancia_km: parseFloat(editModalData.distancia_km) || 0,
        costo_envio: parseFloat(editModalData.costo_envio) || 0,
        estado: editModalData.estado,
        detalles: editModalData.detalles.map(d => ({
          producto_id: d.producto_id,
          cantidad: d.cantidad
        }))
      };

      const res = await fetch(`${API_BASE_URL}/caja/pedidos/${editModalData.idPedido}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(`Pedido #${editModalData.idPedido} modificado exitosamente`, 'success');
        setIsEditModalOpen(false);
        setEditModalData(null);
        cargarPedidos();
        cargarProductos();
      } else {
        const err = await res.json();
        showToast(err.detail || 'Error modificando pedido', 'error');
      }
    } catch (err) {
      showToast('Error de conexión guardando cambios', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const cargarPedidos = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/caja/pedidos`, { headers });
      if (res.ok) setPedidos(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const cargarProductos = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/caja/productos`, { headers });
      if (res.ok) setProductos(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddProducto = () => {
    if (!tempProducto || tempCantidad <= 0) return;
    const prod = productos.find(p => p.dni_producto == tempProducto);
    if (!prod) return;
    
    const exists = form.detalles.find(d => d.producto_id == prod.dni_producto);
    if (exists) {
      setForm({
        ...form,
        detalles: form.detalles.map(d => 
          d.producto_id == prod.dni_producto ? { ...d, cantidad: d.cantidad + parseInt(tempCantidad) } : d
        )
      });
    } else {
      setForm({
        ...form,
        detalles: [...form.detalles, { 
          producto_id: prod.dni_producto, 
          cantidad: parseInt(tempCantidad),
          nombre: prod.nombre,
          precio: prod.precio 
        }]
      });
    }
    setTempCantidad(1);
    setTempProducto('');
  };

  const handleRemoveProducto = (pid) => {
    setForm({
      ...form,
      detalles: form.detalles.filter(d => d.producto_id !== pid)
    });
  };

  const crearPedido = async (e) => {
    e.preventDefault();
    
    // Validación celular colombiano
    const regexCelular = /^3\d{9}$/;
    if (!regexCelular.test(form.celular)) {
      showToast('El celular debe tener 10 dígitos y empezar por 3', 'error');
      return;
    }

    if (form.detalles.length === 0) {
      showToast('Añade al menos un producto al pedido', 'error');
      return;
    }
    
    setIsLoading(true);
    try {
      const payload = {
        cliente: form.cliente,
        cedulaCliente: parseInt(form.celular), // Enviamos como cedulaCliente para no romper backend
        responsableRecepcion: form.responsableRecepcion,
        direccionEnvio: form.direccionEnvio,
        distancia_km: form.distancia_km,
        costo_envio: form.costo_envio,
        detalles: form.detalles.map(d => ({ producto_id: d.producto_id, cantidad: d.cantidad }))
      };
      
      const res = await fetch(`${API_BASE_URL}/caja/pedidos`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        showToast('Pedido creado exitosamente', 'success');
        setForm({ cliente: '', celular: '', responsableRecepcion: '', detalles: [] });
        cargarPedidos();
      } else {
        const err = await res.json();
        showToast(err.detail || 'Error creando pedido', 'error');
      }
    } catch (e) {
      showToast('Error de conexión', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const actualizarEstado = async (id, estado) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/caja/pedidos/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ estado })
      });
      if (res.ok) {
        showToast('Estado actualizado', 'success');
        cargarPedidos();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const cancelarPedido = async (id) => {
    if (!window.confirm(`¿Estás seguro de cancelar el Pedido #${id}? Se devolverá el stock de todos sus productos al inventario.`)) {
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/caja/pedidos/${id}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        showToast(`Pedido #${id} cancelado correctamente y stock devuelto`, 'success');
        if (isEditModalOpen) {
          setIsEditModalOpen(false);
          setEditModalData(null);
        }
        cargarPedidos();
        cargarProductos();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Error al cancelar el pedido', 'error');
      }
    } catch (e) {
      showToast('Error de conexión al cancelar pedido', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const enviarProveedor = async (id) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/caja/pedidos/${id}/enviar-proveedor`, {
        method: 'POST',
        headers
      });
      if (res.ok) {
        showToast('Enviado al proveedor exitosamente', 'success');
        cargarPedidos();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const generarFactura = async (id) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/caja/pedidos/${id}/factura`, {
        method: 'POST',
        headers
      });
      if (res.ok) {
        showToast('Factura generada', 'success');
        cargarPedidos();
      } else {
        const err = await res.json();
        showToast(err.detail || 'Error', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const descargarPDF = (id) => {
    fetch(`${API_BASE_URL}/caja/pedidos/${id}/pdf`, { headers })
      .then(async (res) => {
        if (!res.ok) {
           const err = await res.json();
           showToast(err.detail || 'Error descargando PDF', 'error');
           return;
        }
        return res.blob();
      })
      .then(blob => {
        if(!blob) return;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `factura_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(() => showToast('Error conectando al servidor', 'error'));
  };

  const totalForm = form.detalles.reduce((acc, d) => acc + (d.precio * d.cantidad), 0);

  return (
    <div className="dashboard-grid" style={{ gridTemplateColumns: '400px 1fr', gap: '30px', alignItems: 'start' }}>
      
      {/* Panel Formulario */}
      <div className="crud-panel" style={{ position: 'sticky', top: '20px' }}>
        <h4 style={{ color: '#5e43f3', borderBottom: '2px solid #5e43f3', paddingBottom: '10px', marginBottom: '20px' }}>
          📝 Registrar Nuevo Pedido
        </h4>
        <form onSubmit={crearPedido}>
          
          <div className="form-group">
            <label>Cliente (Filtro automático)</label>
            <input 
              type="text" 
              list="clientes-registrados"
              required 
              placeholder="Ej. Juan Pérez"
              value={form.cliente} 
              onChange={e => setForm({...form, cliente: e.target.value})} 
              disabled={isLoading} 
            />
            <datalist id="clientes-registrados">
              {clientesRegistrados.map((c, i) => <option key={i} value={c} />)}
            </datalist>
          </div>

          <div className="form-group">
            <label>Celular (10 dígitos)</label>
            <input 
              type="number" 
              required 
              placeholder="3XXXXXXXXX"
              value={form.celular} 
              onChange={e => setForm({...form, celular: e.target.value})} 
              disabled={isLoading} 
            />
            <small style={{ color: '#666', fontSize: '0.75rem' }}>Debe empezar por 3</small>
          </div>

          <div className="form-group">
            <label>Resp. Recepción</label>
            <input 
              type="text" 
              required 
              placeholder="Ej. Carlos Castro"
              value={form.responsableRecepcion} 
              onChange={e => setForm({...form, responsableRecepcion: e.target.value})} 
              disabled={isLoading} 
            />
          </div>

          {/* Sección de Domicilio */}
          <div style={{ background: '#e0f2fe', padding: '15px', borderRadius: '8px', marginTop: '20px', border: '1px solid #bae6fd' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#0369a1', margin: 0 }}>
                🛵 Domicilio (Opcional)
              </label>
              <span style={{ fontSize: '0.75rem', color: '#0284c7', background: '#e0f7fa', padding: '2px 8px', borderRadius: '10px', fontWeight: '500' }}>
                Base $3.000 + $1.000/km
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <input 
                type="text" 
                placeholder="Dirección destino (Ej. Calle 5 # 30-10, Cali)"
                value={form.direccionEnvio}
                onChange={e => setForm({...form, direccionEnvio: e.target.value})}
                disabled={isLoading}
                style={{ flex: '1 1 auto', padding: '9px', borderRadius: '6px', border: '1px solid #7dd3fc', background: 'white' }}
              />
              <button 
                type="button" 
                onClick={() => calcularEnvio(form.direccionEnvio, false)}
                disabled={isCalculandoEnvio || !form.direccionEnvio}
                style={{ background: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', padding: '0 14px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Calcular distancia y tarifa automáticamente"
              >
                {isCalculandoEnvio ? '⏳...' : '📍 Calcular'}
              </button>
              {(form.distancia_km > 0 || form.costo_envio > 0 || form.direccionEnvio !== '') && (
                <button 
                  type="button" 
                  onClick={() => setForm({...form, direccionEnvio: '', distancia_km: 0, costo_envio: 0, mapa_url: ''})}
                  style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '0 12px', cursor: 'pointer', fontWeight: 'bold' }}
                  title="Quitar domicilio y volver a $0"
                >
                  ✖
                </button>
              )}
            </div>

            {/* Inputs editables para ajuste manual o automático de distancia y tarifa */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: '600', display: 'block', marginBottom: '3px' }}>
                  Distancia (km)
                </label>
                <input 
                  type="number" 
                  step="0.1" 
                  min="0"
                  placeholder="0.0"
                  value={form.distancia_km || ''}
                  onChange={e => {
                    const km = parseFloat(e.target.value) || 0;
                    const autoTarifa = km > 0 ? 3000 + Math.floor(km) * 1000 : 0;
                    setForm(prev => ({ 
                      ...prev, 
                      distancia_km: km, 
                      costo_envio: prev.costo_envio === 0 || prev.costo_envio === (3000 + Math.floor(prev.distancia_km) * 1000) ? autoTarifa : prev.costo_envio 
                    }));
                  }}
                  style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', border: '1px solid #7dd3fc', background: 'white', fontSize: '0.9rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: '600', display: 'block', marginBottom: '3px' }}>
                  Tarifa Domicilio ($)
                </label>
                <input 
                  type="number" 
                  step="500" 
                  min="0"
                  placeholder="$0"
                  value={form.costo_envio || ''}
                  onChange={e => setForm(prev => ({ ...prev, costo_envio: parseFloat(e.target.value) || 0 }))}
                  style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', border: '1px solid #7dd3fc', background: 'white', fontSize: '0.9rem', fontWeight: 'bold', color: '#059669' }}
                />
              </div>
            </div>

            {form.distancia_km > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', background: 'white', padding: '8px 12px', borderRadius: '6px', border: '1px solid #bae6fd', fontSize: '0.85rem' }}>
                <span style={{ color: '#0369a1' }}>
                  🚗 <strong>{form.distancia_km} km</strong> estimados
                </span>
                <span style={{ color: '#059669', fontWeight: 'bold' }}>
                  Tarifa: ${Number(form.costo_envio).toLocaleString()}
                </span>
                {form.mapa_url && (
                  <a 
                    href={form.mapa_url} 
                    target="_blank" 
                    rel="noreferrer" 
                    style={{ color: '#0284c7', textDecoration: 'underline', fontWeight: '600' }}
                  >
                    Ver Mapa ↗
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Caja de selección de productos mejorada */}
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginTop: '20px', border: '1px solid #e9ecef', width: '100%', boxSizing: 'border-box' }}>
            <label style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '10px' }}>
              🛍️ Men� Pedido
            </label>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
              <select 
                value={tempProducto} 
                onChange={e => setTempProducto(e.target.value)} 
                style={{ flex: '1 1 auto', minWidth: '0', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: 'white', color: '#333', margin: 0, boxSizing: 'border-box', height: '40px' }}
              >
                <option value="" style={{ color: '#333' }}>Seleccione...</option>
                {productos.map(p => <option key={p.dni_producto} value={p.dni_producto} style={{ color: '#333' }}>{p.nombre} (${p.precio}) - Disp: {p.stock}</option>)}
              </select>
              
              <input 
                type="number" 
                min="1" 
                style={{ width: '60px', flex: '0 0 60px', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: 'white', color: '#333', margin: 0, boxSizing: 'border-box', height: '40px', textAlign: 'center' }} 
                value={tempCantidad} 
                onChange={e => setTempCantidad(e.target.value)} 
              />
              
              <button 
                type="button" 
                onClick={handleAddProducto}
                style={{ 
                  background: '#10b981', color: 'white', border: 'none', 
                  borderRadius: '6px', width: '40px', flex: '0 0 40px', height: '40px', 
                  fontSize: '1.2rem', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', padding: 0, margin: 0
                }}
                title="Añadir al pedido"
              >
                ➕
              </button>
            </div>
            
            {/* Lista productos agregados */}
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '15px', fontSize: '0.9rem' }}>
              {form.detalles.map(d => (
                <li key={d.producto_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', background: '#fff', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ddd' }}>
                  <span><strong style={{color:'#5e43f3'}}>{d.cantidad}x</strong> {d.nombre}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 'bold' }}>${d.precio * d.cantidad}</span>
                    <button type="button" onClick={() => handleRemoveProducto(d.producto_id)} style={{ color: '#ef4444', border: 'none', background: '#fee2e2', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Quitar">
                      ✖
                    </button>
                  </div>
                </li>
              ))}
              {form.detalles.length === 0 && (
                <li style={{ textAlign: 'center', color: '#999', fontStyle: 'italic', padding: '10px 0' }}>Ningún producto añadido aún</li>
              )}
            </ul>
            
            <div style={{ borderTop: '2px solid #ddd', marginTop: '10px', paddingTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '0.9rem' }}>
                <span>Subtotal Productos:</span>
                <span>${totalForm}</span>
              </div>
              {form.costo_envio > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '0.9rem', marginTop: '4px' }}>
                  <span>Costo Envío:</span>
                  <span>${form.costo_envio}</span>
                </div>
              )}
              <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.2rem', marginTop: '10px', color: '#111' }}>
                Total: <span style={{ color: '#10b981' }}>${totalForm + form.costo_envio}</span>
              </div>
            </div>
          </div>

          <button type="submit" className="btn" style={{ marginTop: '20px', width: '100%', padding: '12px', fontSize: '1rem', background: '#5e43f3' }} disabled={isLoading || form.detalles.length === 0}>
            {isLoading ? 'Procesando...' : 'Crear Pedido'}
          </button>
        </form>
      </div>

      {/* Tabla Pedidos */}
      <div className="users-list-panel">
        <h2 style={{ color: '#5e43f3', marginBottom: '20px' }}>Gestión de Pedidos</h2>
        <div className="users-table-container" style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #ddd' }}>
          <table style={{ minWidth: '800px', width: '100%' }}>
            <thead style={{ background: '#f4f4f4' }}>
              <tr>
                <th style={{ padding: '12px' }}>ID</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Pago (Wompi)</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.length === 0 && (
                <tr><td colSpan="7" style={{textAlign: 'center', padding: '20px'}}>No hay pedidos registrados</td></tr>
              )}
              {pedidos.map(p => (
                <tr key={p.idPedido} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: '#555' }}>#{p.idPedido}</td>
                  <td>{p.fecha}</td>
                  <td>{p.detalles[0]?.cliente}</td>
                  <td style={{ fontWeight: 'bold', color: '#10b981' }}>${p.total}</td>
                  <td>
                    <span className={`role-badge ${p.estado === 'Completado' || p.estado === 'Pagado' ? 'administrador' : p.estado === 'Cancelado' ? 'error' : 'normal'}`}>
                      {p.estado}
                    </span>
                  </td>
                  <td>
                    {/* El botón de pagar aparece mientras no esté cancelado ni completado ni pagado */}
                    {p.estado !== 'Pagado' && p.estado !== 'Completado' && p.estado !== 'Cancelado' && p.wompi_payment_url && (
                      <a href={p.wompi_payment_url} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ background: '#002E82', color: 'white', padding: '6px 12px', textDecoration: 'none' }}>
                        Pagar
                      </a>
                    )}
                    {p.estado === 'Pagado' && <span style={{color: '#10b981', fontWeight: 'bold'}}>Pagado ✅</span>}
                  </td>
                  <td className="actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleAbrirModificar(p)}
                      style={{ background: '#4f46e5', color: 'white', fontWeight: 'bold' }}
                      title="Modificar inconsistencias, platillos, estado o domicilio"
                    >
                      ✏️ Modificar
                    </button>
                    {p.estado === 'Pendiente' && (
                      <button className="btn btn-sm" style={{ background: '#6c757d' }} onClick={() => enviarProveedor(p.idPedido)}>
                        Enviar Prov.
                      </button>
                    )}
                    {p.estado === 'En Proceso' && (
                      <button className="btn btn-sm" style={{ background: '#f59e0b', color: 'white' }} onClick={() => actualizarEstado(p.idPedido, 'Recibido')}>
                        Marcar Recibido
                      </button>
                    )}
                    {p.estado === 'Recibido' && (
                      <button className="btn btn-sm" style={{ background: '#3b82f6', color: 'white' }} onClick={() => actualizarEstado(p.idPedido, 'Pagado')}>
                        💲 Marcar Pagado (Manual)
                      </button>
                    )}
                    {p.estado === 'Pagado' && (
                      <button className="btn btn-sm" style={{ background: '#10b981' }} onClick={() => generarFactura(p.idPedido)}>
                        🧾 Generar Factura
                      </button>
                    )}
                    {p.estado === 'Completado' && (
                       <button className="btn btn-sm" style={{ background: '#0dcaf0', color: '#000', fontWeight: 'bold' }} onClick={() => descargarPDF(p.idPedido)}>
                         📄 Descargar PDF
                       </button>
                    )}
                    {/* Botón Cancelar Pedido siempre disponible para pedidos activos */}
                    {p.estado !== 'Cancelado' && p.estado !== 'Completado' && (
                      <button 
                        className="btn btn-danger btn-sm" 
                        onClick={() => cancelarPedido(p.idPedido)}
                        disabled={isLoading}
                        title="Cancelar pedido y devolver stock a inventario"
                        style={{ fontWeight: 'bold' }}
                      >
                        🚫 Cancelar Pedido
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL PARA MODIFICAR PEDIDO */}
      {isEditModalOpen && editModalData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--panel-bg, #ffffff)',
            borderRadius: '16px',
            maxWidth: '750px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '25px 30px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            border: '1px solid var(--glass-border, #e2e8f0)',
            color: 'var(--text-main, #1e293b)'
          }}>
            {/* Encabezado del Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #5e43f3', paddingBottom: '12px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#5e43f3', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.3rem' }}>
                  ✏️ Modificar Pedido #{editModalData.idPedido}
                </h3>
                <small style={{ color: 'var(--text-muted, #64748b)' }}>Corrige datos de cliente, platillos, domicilio o estado del pedido</small>
              </div>
              <button 
                type="button"
                onClick={() => { setIsEditModalOpen(false); setEditModalData(null); }}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}
                title="Cerrar ventana"
              >
                ✕
              </button>
            </div>

            <form onSubmit={guardarModificacionPedido}>
              {/* Datos de Cabecera */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Nombre del Cliente</label>
                  <input 
                    type="text" 
                    required 
                    value={editModalData.cliente} 
                    onChange={e => setEditModalData({ ...editModalData, cliente: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Celular / Contacto</label>
                  <input 
                    type="text" 
                    required 
                    value={editModalData.celular} 
                    onChange={e => setEditModalData({ ...editModalData, celular: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Responsable de Recepción</label>
                  <input 
                    type="text" 
                    required 
                    value={editModalData.responsableRecepcion} 
                    onChange={e => setEditModalData({ ...editModalData, responsableRecepcion: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Estado del Pedido</label>
                  <select 
                    value={editModalData.estado} 
                    onChange={e => setEditModalData({ ...editModalData, estado: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', height: '40px', background: 'white' }}
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="En Proceso">En Proceso</option>
                    <option value="Recibido">Recibido</option>
                    <option value="Pagado">Pagado</option>
                    <option value="Completado">Completado</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              {/* Sección Domicilio en el Modal */}
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '12px 15px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#0369a1' }}>🛵 Ajuste de Domicilio</span>
                  <span style={{ fontSize: '0.75rem', color: '#0284c7' }}>Base $3.000 + $1.000/km</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <input 
                    type="text" 
                    placeholder="Dirección (o déjalo en blanco si es en local)"
                    value={editModalData.direccionEnvio || ''}
                    onChange={e => setEditModalData({ ...editModalData, direccionEnvio: e.target.value })}
                    style={{ flex: '1 1 auto', padding: '8px', borderRadius: '6px', border: '1px solid #7dd3fc', background: 'white' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => calcularEnvio(editModalData.direccionEnvio, true)}
                    disabled={isCalculandoEnvio || !editModalData.direccionEnvio}
                    style={{ background: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', padding: '0 12px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {isCalculandoEnvio ? '⏳...' : '📍 Recalcular'}
                  </button>
                  {(editModalData.distancia_km > 0 || editModalData.costo_envio > 0 || editModalData.direccionEnvio) && (
                    <button 
                      type="button" 
                      onClick={() => setEditModalData({ ...editModalData, direccionEnvio: '', distancia_km: 0, costo_envio: 0, mapa_url: '' })}
                      style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '0 10px', cursor: 'pointer' }}
                      title="Quitar domicilio"
                    >
                      ✖
                    </button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: '600' }}>Distancia (km)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      min="0"
                      value={editModalData.distancia_km || ''}
                      onChange={e => {
                        const km = parseFloat(e.target.value) || 0;
                        const autoTarifa = km > 0 ? 3000 + Math.floor(km) * 1000 : 0;
                        setEditModalData(prev => ({ ...prev, distancia_km: km, costo_envio: autoTarifa }));
                      }}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #7dd3fc', background: 'white' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: '600' }}>Tarifa Envío ($)</label>
                    <input 
                      type="number" 
                      step="500" 
                      min="0"
                      value={editModalData.costo_envio || ''}
                      onChange={e => setEditModalData({ ...editModalData, costo_envio: parseFloat(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #7dd3fc', background: 'white', fontWeight: 'bold', color: '#059669' }}
                    />
                  </div>
                </div>
              </div>

              {/* Platillos y Productos del Pedido */}
              <div style={{ background: 'var(--input-bg, #f8fafc)', border: '1px solid var(--glass-border, #e2e8f0)', borderRadius: '8px', padding: '15px', marginBottom: '20px' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>
                  🛍️ Platillos y Cantidades en este Pedido
                </label>

                {/* Agregar nuevo plato */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                  <select 
                    value={editTempProducto} 
                    onChange={e => setEditTempProducto(e.target.value)}
                    style={{ flex: '1 1 auto', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', background: 'white' }}
                  >
                    <option value="">Añadir otro platillo del menú...</option>
                    {productos.map(p => (
                      <option key={p.dni_producto} value={p.dni_producto}>
                        {p.nombre} (${p.precio}) - Disp: {p.stock}
                      </option>
                    ))}
                  </select>
                  <input 
                    type="number" 
                    min="1" 
                    value={editTempCantidad} 
                    onChange={e => setEditTempCantidad(e.target.value)}
                    style={{ width: '60px', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', textAlign: 'center', background: 'white' }}
                  />
                  <button 
                    type="button" 
                    onClick={handleEditAddProducto}
                    style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    ➕ Añadir
                  </button>
                </div>

                {/* Lista de productos actuales */}
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {editModalData.detalles.map(d => (
                    <li key={d.producto_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'white', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '6px' }}>
                      <span style={{ fontWeight: '500' }}>{d.nombre} (${d.precio})</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button 
                            type="button" 
                            onClick={() => handleEditChangeCantidad(d.producto_id, -1)}
                            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', width: '26px', height: '26px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            -
                          </button>
                          <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 'bold', color: '#5e43f3' }}>
                            {d.cantidad}
                          </span>
                          <button 
                            type="button" 
                            onClick={() => handleEditChangeCantidad(d.producto_id, 1)}
                            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', width: '26px', height: '26px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            +
                          </button>
                        </div>
                        <span style={{ fontWeight: 'bold', minWidth: '70px', textAlign: 'right' }}>
                          ${d.precio * d.cantidad}
                        </span>
                        <button 
                          type="button" 
                          onClick={() => handleEditRemoveProducto(d.producto_id)}
                          style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer' }}
                          title="Eliminar producto"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                  {editModalData.detalles.length === 0 && (
                    <li style={{ textAlign: 'center', color: '#ef4444', padding: '10px 0', fontStyle: 'italic' }}>
                      Debes tener al menos un producto en el pedido
                    </li>
                  )}
                </ul>

                {/* Resumen Totales dentro del modal */}
                {(() => {
                  const subtotalItems = editModalData.detalles.reduce((acc, d) => acc + (d.precio * d.cantidad), 0);
                  const envio = parseFloat(editModalData.costo_envio) || 0;
                  const granTotal = subtotalItems + envio;
                  return (
                    <div style={{ borderTop: '2px solid #e2e8f0', marginTop: '12px', paddingTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.9rem' }}>
                        <span>Subtotal Platillos:</span>
                        <span>${subtotalItems}</span>
                      </div>
                      {envio > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
                          <span>Costo Envío:</span>
                          <span>${envio}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.2rem', marginTop: '8px', color: '#1e293b' }}>
                        <span>Total Actualizado:</span>
                        <span style={{ color: '#10b981' }}>${granTotal}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Botones de Acción */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
                {editModalData.estado !== 'Cancelado' && editModalData.estado !== 'Completado' ? (
                  <button 
                    type="button" 
                    className="btn btn-danger"
                    onClick={() => cancelarPedido(editModalData.idPedido)}
                    disabled={isLoading}
                    style={{ width: 'auto', padding: '10px 18px', fontWeight: 'bold' }}
                    title="Cancelar este pedido y devolver stock a inventario"
                  >
                    🚫 Cancelar este Pedido
                  </button>
                ) : <div />}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => { setIsEditModalOpen(false); setEditModalData(null); }}
                    disabled={isLoading}
                    style={{ width: 'auto', padding: '10px 20px' }}
                  >
                    Cerrar
                  </button>
                  <button 
                    type="submit" 
                    className="btn"
                    disabled={isLoading || editModalData.detalles.length === 0}
                    style={{ width: 'auto', padding: '10px 24px', background: '#5e43f3', color: 'white', fontWeight: 'bold' }}
                  >
                    {isLoading ? 'Guardando...' : '💾 Guardar Cambios'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

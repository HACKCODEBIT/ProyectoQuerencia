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

  const calcularEnvio = async () => {
    if (!form.direccionEnvio) {
      setForm({ ...form, distancia_km: 0, costo_envio: 0, mapa_url: '' });
      return;
    }
    setIsCalculandoEnvio(true);
    try {
      const res = await fetch(`${API_BASE_URL}/caja/calcular-envio`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ direccion: form.direccionEnvio })
      });
      if (res.ok) {
        const data = await res.json();
        setForm({ ...form, distancia_km: data.distancia_km, costo_envio: data.costo_envio, mapa_url: data.mapa_url });
        showToast(`Envío calculado: ${data.distancia_km}km = $${data.costo_envio}`, 'success');
      }
    } catch (e) {
      showToast('Error calculando envío', 'error');
    } finally {
      setIsCalculandoEnvio(false);
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
    const prod = productos.find(p => p.idProducto == tempProducto);
    if (!prod) return;
    
    const exists = form.detalles.find(d => d.producto_id == prod.idProducto);
    if (exists) {
      setForm({
        ...form,
        detalles: form.detalles.map(d => 
          d.producto_id == prod.idProducto ? { ...d, cantidad: d.cantidad + parseInt(tempCantidad) } : d
        )
      });
    } else {
      setForm({
        ...form,
        detalles: [...form.detalles, { 
          producto_id: prod.idProducto, 
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
            <label style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#0369a1', display: 'block', marginBottom: '10px' }}>
              🛵 Domicilio (Opcional)
            </label>
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <input 
                type="text" 
                placeholder="Dirección (Ej. Calle 5 # 30-10)"
                value={form.direccionEnvio}
                onChange={e => setForm({...form, direccionEnvio: e.target.value})}
                disabled={isLoading}
                style={{ flex: '1 1 auto', padding: '8px', borderRadius: '6px', border: '1px solid #7dd3fc' }}
              />
              <button 
                type="button" 
                onClick={calcularEnvio}
                disabled={isCalculandoEnvio || !form.direccionEnvio}
                style={{ background: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', padding: '0 15px', cursor: 'pointer' }}
              >
                {isCalculandoEnvio ? '...' : 'Calcular'}
              </button>
              {(form.distancia_km > 0 || form.direccionEnvio !== '') && (
                <button 
                  type="button" 
                  onClick={() => setForm({...form, direccionEnvio: '', distancia_km: 0, costo_envio: 0, mapa_url: ''})}
                  style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '0 15px', cursor: 'pointer', fontWeight: 'bold' }}
                  title="Quitar domicilio y volver a $0"
                >
                  ✖
                </button>
              )}
            </div>
            
            {form.distancia_km > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '15px', gap: '15px', background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                {form.mapa_url && (
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.direccionEnvio + ', Colombia')}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Haz clic para abrir el mapa interactivo completo"
                    style={{ 
                      display: 'inline-block', 
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease'
                    }}
                    onMouseOver={e => e.currentTarget.style.transform = 'scale(1.08)'}
                    onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <img 
                      src={form.mapa_url} 
                      alt="Mini mapa" 
                      style={{ 
                        width: '70px', height: '70px', 
                        borderRadius: '50%', objectFit: 'cover', 
                        border: '3px solid #0284c7',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                        display: 'block'
                      }} 
                    />
                  </a>
                )}
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Distancia Ruta
                  </div>
                  <div style={{ fontSize: '1.2rem', color: '#0369a1', fontWeight: 'bold', marginBottom: '2px' }}>
                    {form.distancia_km} km
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#10b981', fontWeight: '800' }}>
                    Tarifa: ${form.costo_envio}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Caja de selección de productos mejorada */}
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginTop: '20px', border: '1px solid #e9ecef', width: '100%', boxSizing: 'border-box' }}>
            <label style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '10px' }}>
              🛍️ Agregar Productos
            </label>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
              <select 
                value={tempProducto} 
                onChange={e => setTempProducto(e.target.value)} 
                style={{ flex: '1 1 auto', minWidth: '0', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: 'white', color: '#333', margin: 0, boxSizing: 'border-box', height: '40px' }}
              >
                <option value="" style={{ color: '#333' }}>Seleccione...</option>
                {productos.map(p => <option key={p.idProducto} value={p.idProducto} style={{ color: '#333' }}>{p.nombre} (${p.precio}) - Disp: {p.stock}</option>)}
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
                    {p.estado === 'Pendiente' && (
                      <>
                        <button className="btn btn-sm" style={{ background: '#6c757d' }} onClick={() => enviarProveedor(p.idPedido)}>Enviar Prov.</button>
                        <button className="btn btn-danger btn-sm" onClick={() => actualizarEstado(p.idPedido, 'Cancelado')}>Cancelar</button>
                      </>
                    )}
                    {p.estado === 'En Proceso' && (
                      <button className="btn btn-sm" style={{ background: '#f59e0b', color: 'white' }} onClick={() => actualizarEstado(p.idPedido, 'Recibido')}>Marcar Recibido</button>
                    )}
                    {p.estado === 'Recibido' && (
                      <button className="btn btn-sm" style={{ background: '#3b82f6', color: 'white' }} onClick={() => actualizarEstado(p.idPedido, 'Pagado')}>💲 Marcar Pagado (Manual)</button>
                    )}
                    {p.estado === 'Pagado' && (
                      <button className="btn btn-sm" style={{ background: '#10b981' }} onClick={() => generarFactura(p.idPedido)}>🧾 Generar Factura</button>
                    )}
                    {p.estado === 'Completado' && (
                       <button className="btn btn-sm" style={{ background: '#0dcaf0', color: '#000', fontWeight: 'bold' }} onClick={() => descargarPDF(p.idPedido)}>📄 Descargar PDF</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

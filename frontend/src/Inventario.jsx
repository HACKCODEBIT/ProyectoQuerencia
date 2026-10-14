import { useState, useEffect } from "react";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000/api/inventario";

export default function Inventario({ currentUser, token, showToast }) {
  const [activeSubTab, setActiveSubTab] = useState("productos");

  // States
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [entradas, setEntradas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editandoProducto, setEditandoProducto] = useState(false);

  // Forms
  const [catForm, setCatForm] = useState({ codigo: "", nombre: "", descripcion: "" });
  const [provForm, setProvForm] = useState({ nit: "", nombre: "", telefono: "", correo: "" });
  const [prodForm, setProdForm] = useState({ dni_producto: "", nombre: "", descripcion: "", stock: "", categoria_id: "" });
  const [entradaForm, setEntradaForm] = useState({ cantidad: "", precio_compra_unidad: "", proveedor_id: "", producto_id: "" });

  const descargarReporte = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/reporte/excel`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "reporte_inventario.xlsx";
        a.click();
        showToast("Reporte descargado exitosamente", "success");
      } else {
        showToast("Error al generar el reporte", "error");
      }
    } catch (e) { showToast("Error al descargar", "error"); }
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };

  useEffect(() => {
    cargarCategorias();
    cargarProveedores();
    cargarProductos();
    if (activeSubTab === "entradas") cargarEntradas();
  }, [activeSubTab]);

  // CARGAS
  const cargarCategorias = async () => {
    try { const res = await fetch(`${API_BASE_URL}/categorias`, { headers }); if (res.ok) setCategorias(await res.json()); } catch (e) {}
  };
  const cargarProveedores = async () => {
    try { const res = await fetch(`${API_BASE_URL}/proveedores`, { headers }); if (res.ok) setProveedores(await res.json()); } catch (e) {}
  };
  const cargarProductos = async () => {
    try { const res = await fetch(`${API_BASE_URL}/productos`, { headers }); if (res.ok) setProductos(await res.json()); } catch (e) {}
  };
  const cargarEntradas = async () => {
    try { const res = await fetch(`${API_BASE_URL}/entradas`, { headers }); if (res.ok) setEntradas(await res.json()); } catch (e) {}
  };

  // CREACIONES
  const crearCategoria = async (e) => {
    e.preventDefault(); setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/categorias`, { method: "POST", headers, body: JSON.stringify(catForm) });
      if (res.ok) { 
        showToast("Categoría creada exitosamente", "success"); 
        setCatForm({ codigo: "", nombre: "", descripcion: "" }); 
        cargarCategorias(); 
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Error al crear la categoría", "error");
      }
    } catch (err) {
      showToast("Error de conexión al crear categoría", "error");
    } finally { 
      setIsLoading(false); 
    }
  };

  const crearProveedor = async (e) => {
    e.preventDefault(); setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/proveedores`, { method: "POST", headers, body: JSON.stringify(provForm) });
      if (res.ok) { 
        showToast("Proveedor creado exitosamente", "success"); 
        setProvForm({ nit: "", nombre: "", telefono: "", correo: "" }); 
        cargarProveedores(); 
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Error al crear el proveedor", "error");
      }
    } catch (err) {
      showToast("Error de conexión al crear proveedor", "error");
    } finally { 
      setIsLoading(false); 
    }
  };

  const crearProducto = async (e) => {
    e.preventDefault();
    
    // Validación de duplicado antes del submit si es creación
    if (!editandoProducto) {
      const codigoBuscado = String(prodForm.dni_producto).trim();
      const yaExiste = productos.find(p => String(p.dni_producto).trim() === codigoBuscado);
      if (yaExiste) {
        showToast(`Ya existe el producto "${yaExiste.nombre}" con el código ${codigoBuscado}. Usa 'Editar' para actualizarlo.`, "error");
        return;
      }
    }

    setIsLoading(true);
    const payload = { ...prodForm, precio: 0, es_insumo: true, stock: parseInt(prodForm.stock) };
    try {
      let res;
      if (editandoProducto) {
        res = await fetch(`${API_BASE_URL}/productos/${prodForm.dni_producto}`, { method: "PUT", headers, body: JSON.stringify(payload) });
      } else {
        res = await fetch(`${API_BASE_URL}/productos`, { method: "POST", headers, body: JSON.stringify(payload) });
      }
      if (res.ok) { 
        showToast(editandoProducto ? "Producto actualizado correctamente" : "Producto agregado exitosamente", "success"); 
        setProdForm({ dni_producto: "", nombre: "", descripcion: "", stock: "", categoria_id: "" }); 
        setEditandoProducto(false);
        cargarProductos(); 
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Error al guardar el producto", "error");
      }
    } catch (err) {
      showToast("Error de red al conectar con el servidor", "error");
    } finally { 
      setIsLoading(false); 
    }
  };

  const iniciarEdicion = (p) => {
    setProdForm({ 
      dni_producto: p.dni_producto, 
      nombre: p.nombre, 
      descripcion: p.descripcion || "", 
      stock: p.stock, 
      categoria_id: p.categoria_id || "" 
    });
    setEditandoProducto(true);
  };

  const cancelarEdicion = () => {
    setEditandoProducto(false);
    setProdForm({ dni_producto: "", nombre: "", descripcion: "", stock: "", categoria_id: "" });
  };

  const eliminarProducto = async (id) => {
    if (!window.confirm("¿Seguro que quieres eliminar este producto?")) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/productos/${id}`, { method: "DELETE", headers });
      if (res.ok) { 
        showToast("Producto eliminado exitosamente", "success"); 
        cargarProductos(); 
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Error al eliminar producto", "error");
      }
    } catch (err) {
      showToast("Error de red al eliminar producto", "error");
    } finally { 
      setIsLoading(false); 
    }
  };

  const registrarEntrada = async (e) => {
    e.preventDefault();
    const cant = parseInt(entradaForm.cantidad);
    const precioU = parseFloat(entradaForm.precio_compra_unidad);
    const total = cant * precioU;
    
    if (!window.confirm(`¿Estás seguro de registrar esta entrada por un TOTAL de $${total}?\nCantidad: ${cant}\nCosto Unitario: $${precioU}`)) {
      return;
    }
    
    setIsLoading(true);
    const payload = { 
      cantidad: cant, 
      precio_compra_unidad: precioU,
      proveedor_id: String(entradaForm.proveedor_id), 
      producto_id: String(entradaForm.producto_id) 
    };
    try {
      const res = await fetch(`${API_BASE_URL}/entradas`, { method: "POST", headers, body: JSON.stringify(payload) });
      if (res.ok) { 
        showToast(`Stock actualizado y factura generada por $${total}`, "success"); 
        setEntradaForm({ cantidad: "", precio_compra_unidad: "", proveedor_id: "", producto_id: "" }); 
        cargarEntradas(); 
        cargarProductos(); 
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Error al registrar la entrada", "error");
      }
    } catch (err) {
      showToast("Error de red al registrar la entrada", "error");
    } finally { 
      setIsLoading(false); 
    }
  };

  if (currentUser?.tipo_usuario !== "administrador") {
    return <div style={{ padding: "40px", textAlign: "center" }}><h2>Acceso Denegado</h2><p>Solo los administradores pueden gestionar el inventario.</p></div>;
  }

  // Detectar si el DNI escrito ya pertenece a un producto en el catálogo
  const productoExistente = !editandoProducto && prodForm.dni_producto.trim()
    ? productos.find(p => String(p.dni_producto).trim() === prodForm.dni_producto.trim())
    : null;

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button className={`btn ${activeSubTab === "productos" ? "" : "btn-secondary"}`} onClick={() => setActiveSubTab("productos")}>Productos</button>
        <button className={`btn ${activeSubTab === "entradas" ? "" : "btn-secondary"}`} onClick={() => setActiveSubTab("entradas")}>Entradas (Stock)</button>
        <button className={`btn ${activeSubTab === "categorias" ? "" : "btn-secondary"}`} onClick={() => setActiveSubTab("categorias")}>Categorías</button>
        <button className={`btn ${activeSubTab === "proveedores" ? "" : "btn-secondary"}`} onClick={() => setActiveSubTab("proveedores")}>Proveedores</button>
      </div>

      {activeSubTab === "productos" && (
        <div className="dashboard-grid" style={{ gridTemplateColumns: "350px 1fr" }}>
          <div className="crud-panel">
            <h4>{editandoProducto ? "Editar Producto" : "Nuevo Producto"}</h4>
            <form onSubmit={crearProducto}>
              <div className="form-group">
                <label>DNI / Código</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ej. 1528"
                  value={prodForm.dni_producto} 
                  onChange={e => setProdForm({...prodForm, dni_producto: e.target.value})} 
                  disabled={isLoading || editandoProducto} 
                />
                {productoExistente && (
                  <div style={{ color: "#ef4444", fontSize: "0.82rem", marginTop: "6px", lineHeight: "1.3" }}>
                    ⚠️ Ya existe "<strong>{productoExistente.nombre}</strong>" con este código.{" "}
                    <button
                      type="button"
                      style={{ background: "none", border: "none", color: "var(--primary)", textDecoration: "underline", cursor: "pointer", padding: 0, fontWeight: "600" }}
                      onClick={() => iniciarEdicion(productoExistente)}
                    >
                      ¿Editarlo ahora?
                    </button>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Nombre</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ej. Café Sello Rojo 500g"
                  value={prodForm.nombre} 
                  onChange={e => setProdForm({...prodForm, nombre: e.target.value})} 
                  disabled={isLoading} 
                />
              </div>
              <div className="form-group">
                <label>Categoría</label>
                <select required value={prodForm.categoria_id} onChange={e => setProdForm({...prodForm, categoria_id: e.target.value})} disabled={isLoading}>
                  <option value="">Seleccione...</option>
                  {categorias.map(c => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}
                </select>
              </div>
              
              <div className="form-group">
                <label>Stock {editandoProducto ? "Actual" : "Inicial"}</label>
                <input 
                  type="number" 
                  min="0"
                  required 
                  value={prodForm.stock} 
                  onChange={e => setProdForm({...prodForm, stock: e.target.value})} 
                  disabled={isLoading} 
                />
              </div>
              <button 
                type="submit" 
                className="btn" 
                style={{ width: "100%", marginTop: "10px" }} 
                disabled={isLoading || Boolean(productoExistente)}
              >
                {editandoProducto ? "Guardar Cambios" : "Guardar Producto"}
              </button>
              {editandoProducto && (
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ width: "100%", marginTop: "10px" }} 
                  onClick={cancelarEdicion}
                >
                  Cancelar Edición
                </button>
              )}
            </form>
          </div>
          <div className="users-list-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>Catálogo de Productos ({productos.length})</h2>
              <button className="btn" onClick={descargarReporte} style={{ background: "#059669" }}>📊 Descargar Excel</button>
            </div>
            <div style={{ marginBottom: "15px" }}>
              <input type="text" placeholder="Buscar por DNI o Nombre..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ccc" }} />
            </div>
            <div className="users-table-container">
              <table>
                <thead><tr><th>DNI</th><th>Nombre</th><th>Categoría</th><th>Stock Actual</th><th>Acciones</th></tr></thead>
                <tbody>
                  {productos.filter(p => (p.nombre && p.nombre.toLowerCase().includes(searchTerm.toLowerCase())) || (p.dni_producto && String(p.dni_producto).toLowerCase().includes(searchTerm.toLowerCase()))).map(p => (
                    <tr key={p.dni_producto} style={p.stock <= 5 ? { background: "#fee2e2" } : {}}>
                      <td>{p.dni_producto}</td>
                      <td style={{ fontWeight: "bold" }}>{p.nombre} {p.stock <= 5 && <span style={{color: "red", fontSize: "12px", marginLeft: "5px"}}>⚠️ Stock Bajo</span>}</td>
                      <td>{p.categoria_nombre || "Sin categoría"}</td>
                      <td>
                        <span style={{ fontWeight: "bold", padding: "4px 8px", borderRadius: "12px", background: p.stock <= 5 ? "#fca5a5" : "#d1fae5", color: p.stock <= 5 ? "#991b1b" : "#059669" }}>
                          {p.stock}
                        </span>
                      </td>
                      <td style={{ display: "flex", gap: "5px" }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => iniciarEdicion(p)}>Editar</button>
                        <button className="btn btn-sm btn-danger" onClick={() => eliminarProducto(p.dni_producto)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                  {productos.length === 0 && (
                    <tr><td colSpan="5" style={{ textAlign: "center", padding: "20px" }}>No hay productos registrados en el inventario.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "entradas" && (
        <div className="dashboard-grid" style={{ gridTemplateColumns: "350px 1fr" }}>
          <div className="crud-panel">
            <h4>Registrar Entrada</h4>
            <form onSubmit={registrarEntrada}>
              <div className="form-group"><label>Proveedor</label>
                <select required value={entradaForm.proveedor_id} onChange={e => setEntradaForm({...entradaForm, proveedor_id: e.target.value})} disabled={isLoading}>
                  <option value="">Seleccione proveedor...</option>
                  {proveedores.map(p => <option key={p.nit} value={p.nit}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Producto a Reabastecer</label>
                <select required value={entradaForm.producto_id} onChange={e => setEntradaForm({...entradaForm, producto_id: e.target.value})} disabled={isLoading}>
                  <option value="">Seleccione producto...</option>
                  {productos.map(p => <option key={p.dni_producto} value={p.dni_producto}>{p.nombre} (Stock: {p.stock})</option>)}
                </select>
              </div>
              <div className="form-group"><label>Cantidad que ingresa</label><input type="number" min="1" required value={entradaForm.cantidad} onChange={e => setEntradaForm({...entradaForm, cantidad: e.target.value})} disabled={isLoading} /></div>
              <div className="form-group"><label>Costo de compra (x Unidad)</label><input type="number" min="0" step="0.01" required value={entradaForm.precio_compra_unidad} onChange={e => setEntradaForm({...entradaForm, precio_compra_unidad: e.target.value})} disabled={isLoading} /></div>
              
              <div style={{ fontSize: "1.1rem", fontWeight: "bold", marginBottom: "15px", padding: "10px", background: "#f0f9ff", borderLeft: "4px solid #0284c7" }}>
                Total de la Factura: ${(parseFloat(entradaForm.cantidad || 0) * parseFloat(entradaForm.precio_compra_unidad || 0)).toFixed(2)}
              </div>

              <button type="submit" className="btn" style={{ width: "100%", marginTop: "10px", background: "#10b981" }} disabled={isLoading}>Registrar Entrada y Generar Factura</button>
            </form>
          </div>
          <div className="users-list-panel">
            <h2>Historial de Entradas</h2>
            <div className="users-table-container">
              <table>
                <thead><tr><th>Fecha</th><th>Proveedor</th><th>Producto</th><th>Cantidad</th><th>Costo/U</th><th>Total Pagado</th></tr></thead>
                <tbody>
                  {entradas.map(e => (
                    <tr key={e.idEntrada}>
                      <td>{e.fechaEntrada}</td>
                      <td>{e.proveedor_nombre}</td>
                      <td style={{ fontWeight: "bold", color: "#5e43f3" }}>{e.producto_nombre}</td>
                      <td><span style={{ fontWeight: "bold", color: "#10b981" }}>+{e.cantidad} unid.</span></td>
                      <td>${e.precio_compra_unidad}</td>
                      <td style={{ fontWeight: "bold", color: "#b91c1c" }}>${e.costo_total}</td>
                    </tr>
                  ))}
                  {entradas.length === 0 && (
                    <tr><td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>No hay entradas de inventario registradas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "categorias" && (
        <div className="dashboard-grid" style={{ gridTemplateColumns: "350px 1fr" }}>
          <div className="crud-panel">
            <h4>Nueva Categoría</h4>
            <form onSubmit={crearCategoria}>
              <div className="form-group"><label>Código</label><input type="text" required value={catForm.codigo} onChange={e => setCatForm({...catForm, codigo: e.target.value})} /></div>
              <div className="form-group"><label>Nombre</label><input type="text" required value={catForm.nombre} onChange={e => setCatForm({...catForm, nombre: e.target.value})} /></div>
              <div className="form-group"><label>Descripción</label><input type="text" value={catForm.descripcion} onChange={e => setCatForm({...catForm, descripcion: e.target.value})} /></div>
              <button type="submit" className="btn" style={{ width: "100%", marginTop: "10px" }} disabled={isLoading}>Guardar Categoría</button>
            </form>
          </div>
          <div className="users-list-panel">
            <h2>Categorías ({categorias.length})</h2>
            <div className="users-table-container">
              <table>
                <thead><tr><th>Código</th><th>Nombre</th><th>Descripción</th></tr></thead>
                <tbody>
                  {categorias.map(c => <tr key={c.codigo}><td>{c.codigo}</td><td style={{fontWeight:"bold"}}>{c.nombre}</td><td>{c.descripcion}</td></tr>)}
                  {categorias.length === 0 && <tr><td colSpan="3" style={{ textAlign: "center", padding: "20px" }}>No hay categorías registradas.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "proveedores" && (
        <div className="dashboard-grid" style={{ gridTemplateColumns: "350px 1fr" }}>
          <div className="crud-panel">
            <h4>Nuevo Proveedor</h4>
            <form onSubmit={crearProveedor}>
              <div className="form-group"><label>NIT</label><input type="text" required value={provForm.nit} onChange={e => setProvForm({...provForm, nit: e.target.value})} /></div>
              <div className="form-group"><label>Nombre / Empresa</label><input type="text" required value={provForm.nombre} onChange={e => setProvForm({...provForm, nombre: e.target.value})} /></div>
              <div className="form-group"><label>Contacto (Teléfono)</label><input type="text" value={provForm.telefono} onChange={e => setProvForm({...provForm, telefono: e.target.value})} /></div>
              <div className="form-group"><label>Correo</label><input type="email" value={provForm.correo} onChange={e => setProvForm({...provForm, correo: e.target.value})} /></div>
              <button type="submit" className="btn" style={{ width: "100%", marginTop: "10px" }} disabled={isLoading}>Guardar Proveedor</button>
            </form>
          </div>
          <div className="users-list-panel">
            <h2>Proveedores ({proveedores.length})</h2>
            <div className="users-table-container">
              <table>
                <thead><tr><th>NIT</th><th>Empresa</th><th>Contacto</th><th>Correo</th></tr></thead>
                <tbody>
                  {proveedores.map(p => <tr key={p.nit}><td>{p.nit}</td><td style={{fontWeight:"bold"}}>{p.nombre}</td><td>{p.telefono}</td><td>{p.correo}</td></tr>)}
                  {proveedores.length === 0 && <tr><td colSpan="4" style={{ textAlign: "center", padding: "20px" }}>No hay proveedores registrados.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

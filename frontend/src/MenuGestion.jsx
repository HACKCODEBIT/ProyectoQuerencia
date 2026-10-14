import { useState, useEffect } from "react";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000/api/menu";

export default function MenuGestion({ currentUser, token, showToast }) {
  const [platos, setPlatos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [insumosDisponibles, setInsumosDisponibles] = useState([]);
  const [insumosSeleccionados, setInsumosSeleccionados] = useState([]);
  const [tempInsumoId, setTempInsumoId] = useState("");
  const [tempCantidad, setTempCantidad] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [editingPlatoId, setEditingPlatoId] = useState(null);

  const [platoForm, setPlatoForm] = useState({ 
    nombre: "", 
    descripcion: "", 
    precio: "", 
    stock: 100, 
    categoria_id: "" 
  });

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };

  useEffect(() => {
    cargarCategorias();
    cargarPlatos();
    cargarInsumos();
  }, []);

  const cargarCategorias = async () => {
    try { 
      const res = await fetch(`${API_BASE_URL}/categorias`, { headers }); 
      if (res.ok) setCategorias(await res.json()); 
    } catch (e) {}
  };

  const cargarPlatos = async () => {
    try { 
      const res = await fetch(`${API_BASE_URL}/platos`, { headers }); 
      if (res.ok) setPlatos(await res.json()); 
    } catch (e) {}
  };

  const cargarInsumos = async () => {
    try { 
      const res = await fetch(`${API_BASE_URL}/insumos`, { headers }); 
      if (res.ok) setInsumosDisponibles(await res.json()); 
    } catch (e) {}
  };

  const iniciarEdicion = (p) => {
    setEditingPlatoId(p.dni_producto);
    setPlatoForm({
      nombre: p.nombre,
      descripcion: p.descripcion || "",
      precio: p.precio,
      stock: p.stock !== undefined ? p.stock : 100,
      categoria_id: p.categoria_id || ""
    });

    if (p.ingredientes && p.ingredientes.length > 0) {
      setInsumosSeleccionados(p.ingredientes.map(ing => {
        const insumoReal = insumosDisponibles.find(i => String(i.dni_producto) === String(ing.producto_id));
        return {
          producto_id: ing.producto_id,
          nombre: ing.nombre,
          cantidad: ing.cantidad,
          stock_disponible: (insumoReal ? insumoReal.stock : 0) + ing.cantidad
        };
      }));
    } else {
      setInsumosSeleccionados([]);
    }

    setTempInsumoId("");
    setTempCantidad(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicion = () => {
    setEditingPlatoId(null);
    setPlatoForm({ nombre: "", descripcion: "", precio: "", stock: 100, categoria_id: "" });
    setInsumosSeleccionados([]);
    setTempInsumoId("");
    setTempCantidad(1);
  };

  // Manejo de la lista de insumos / ingredientes a descontar del plato
  const handleAgregarInsumo = () => {
    if (!tempInsumoId) {
      showToast("Selecciona un insumo del inventario", "error");
      return;
    }
    const cant = parseInt(tempCantidad);
    if (isNaN(cant) || cant <= 0) {
      showToast("La cantidad debe ser mayor a 0", "error");
      return;
    }

    const insumoEncontrado = insumosDisponibles.find(i => String(i.dni_producto) === String(tempInsumoId));
    if (!insumoEncontrado) return;

    if (cant > insumoEncontrado.stock) {
      showToast(`Stock insuficiente. '${insumoEncontrado.nombre}' solo cuenta con ${insumoEncontrado.stock} unidades disponibles`, "error");
      return;
    }

    const existeIndex = insumosSeleccionados.findIndex(i => String(i.producto_id) === String(tempInsumoId));
    if (existeIndex >= 0) {
      const nuevaCantidad = insumosSeleccionados[existeIndex].cantidad + cant;
      if (nuevaCantidad > insumoEncontrado.stock) {
        showToast(`No puedes agregar ${nuevaCantidad} unidades. El stock máximo disponible es ${insumoEncontrado.stock}`, "error");
        return;
      }
      const copia = [...insumosSeleccionados];
      copia[existeIndex].cantidad = nuevaCantidad;
      setInsumosSeleccionados(copia);
    } else {
      setInsumosSeleccionados([
        ...insumosSeleccionados,
        {
          producto_id: insumoEncontrado.dni_producto,
          nombre: insumoEncontrado.nombre,
          cantidad: cant,
          stock_disponible: insumoEncontrado.stock
        }
      ]);
    }
    setTempInsumoId("");
    setTempCantidad(1);
  };

  const handleQuitarInsumo = (prodId) => {
    setInsumosSeleccionados(insumosSeleccionados.filter(i => String(i.producto_id) !== String(prodId)));
  };

  const guardarPlato = async (e) => {
    e.preventDefault(); 
    setIsLoading(true);

    const payload = { 
      ...platoForm, 
      precio: parseFloat(platoForm.precio), 
      stock: parseInt(platoForm.stock || 100), 
      categoria_id: String(platoForm.categoria_id),
      insumos: insumosSeleccionados.map(i => ({
        producto_id: String(i.producto_id),
        cantidad: parseInt(i.cantidad)
      }))
    };

    try {
      const url = editingPlatoId 
        ? `${API_BASE_URL}/platos/${editingPlatoId}` 
        : `${API_BASE_URL}/platos`;
      const method = editingPlatoId ? "PUT" : "POST";

      const res = await fetch(url, { 
        method, 
        headers, 
        body: JSON.stringify(payload) 
      });

      if (res.ok) { 
        const descMsg = insumosSeleccionados.length > 0
          ? ` (con ${insumosSeleccionados.length} insumo(s) vinculados al stock)`
          : "";
        showToast(
          editingPlatoId
            ? `Plato '${platoForm.nombre}' modificado exitosamente${descMsg}.`
            : `Plato agregado al menú exitosamente${descMsg}.`,
          "success"
        ); 
        cancelarEdicion();
        cargarPlatos(); 
        cargarInsumos();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Error al procesar el plato del menú", "error");
      }
    } catch (e) {
      showToast("Error de conexión al guardar el plato", "error");
    } finally { 
      setIsLoading(false); 
    }
  };

  const eliminarPlato = async (id) => {
    if (!window.confirm("¿Seguro que quieres eliminar este plato del menú?")) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/platos/${id}`, { method: "DELETE", headers });
      if (res.ok) { 
        showToast("Plato eliminado", "success"); 
        cargarPlatos(); 
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Error al eliminar plato", "error");
      }
    } catch (e) {
      showToast("Error de conexión al eliminar plato", "error");
    } finally { 
      setIsLoading(false); 
    }
  };

  if (currentUser?.tipo_usuario !== "administrador") {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h2>Acceso Denegado</h2>
        <p>Solo los administradores pueden gestionar el menú.</p>
      </div>
    );
  }

  const platosFiltrados = platos.filter(p => 
    (p.nombre && p.nombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.dni_producto && String(p.dni_producto).toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.categoria_nombre && p.categoria_nombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.ingredientes && p.ingredientes.some(ing => ing.nombre.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  return (
    <div className="dashboard-grid" style={{ gridTemplateColumns: "380px 1fr", gap: "25px", alignItems: "start" }}>
      {/* Panel Formulario */}
      <div className="crud-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h4 style={{ margin: 0 }}>{editingPlatoId ? "✏️ Editar Plato" : "➕ Crear Plato del Menú"}</h4>
          {editingPlatoId && (
            <button 
              type="button" 
              className="btn btn-secondary btn-sm" 
              onClick={cancelarEdicion}
              style={{ width: "auto", fontSize: "0.75rem", padding: "4px 8px" }}
            >
              ✕ Cancelar
            </button>
          )}
        </div>
        {editingPlatoId && (
          <div style={{ background: "rgba(245, 158, 11, 0.15)", padding: "6px 10px", borderRadius: "6px", marginBottom: "12px", fontSize: "0.8rem", color: "#92400e" }}>
            Editando plato: <strong>{editingPlatoId}</strong>
          </div>
        )}
        <form onSubmit={guardarPlato}>
          <div className="form-group">
            <label>Nombre del Plato</label>
            <input 
              type="text" 
              required 
              placeholder="Ej. Café Americano Especial"
              value={platoForm.nombre} 
              onChange={e => setPlatoForm({...platoForm, nombre: e.target.value})} 
              disabled={isLoading} 
            />
          </div>
          
          <div className="form-group">
            <label>Categoría</label>
            <select 
              required 
              value={platoForm.categoria_id} 
              onChange={e => setPlatoForm({...platoForm, categoria_id: e.target.value})} 
              disabled={isLoading}
            >
              <option value="">Seleccione categoría...</option>
              {categorias.map(c => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}
            </select>
          </div>
          
          <div className="form-group">
            <label>Precio de Venta al Público ($)</label>
            <input 
              type="number" 
              required 
              min="1" 
              step="1" 
              placeholder="Ej. 6500"
              value={platoForm.precio} 
              onChange={e => setPlatoForm({...platoForm, precio: e.target.value})} 
              disabled={isLoading} 
            />
          </div>
          
          <div className="form-group">
            <label>Descripción (Opcional)</label>
            <input 
              type="text" 
              placeholder="Ej. Café filtrado con notas achocolatadas"
              value={platoForm.descripcion} 
              onChange={e => setPlatoForm({...platoForm, descripcion: e.target.value})} 
              disabled={isLoading} 
            />
          </div>

          {/* SECCIÓN: Selección de insumos a descontar del stock */}
          <div style={{
            marginTop: "16px",
            marginBottom: "18px",
            padding: "14px",
            background: "rgba(245, 158, 11, 0.05)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "12px"
          }}>
            <label style={{ display: "block", fontWeight: "700", color: "#b45309", marginBottom: "4px", fontSize: "0.85rem" }}>
              📦 Descontar Insumos del Stock
            </label>
            <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginBottom: "10px", lineHeight: "1.3" }}>
              Selecciona los productos de inventario que consume este plato y la cantidad a descontar de su stock:
            </p>

            {/* Controles para seleccionar insumo y cantidad */}
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", marginBottom: "8px" }}>
              <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <label style={{ fontSize: "0.7rem", textTransform: "uppercase", fontWeight: "600", color: "var(--text-muted)", display: "block", marginBottom: "3px" }}>
                  Insumo
                </label>
                <select
                  value={tempInsumoId}
                  onChange={e => setTempInsumoId(e.target.value)}
                  disabled={isLoading}
                  style={{ width: "100%", padding: "8px", fontSize: "0.82rem", borderRadius: "8px" }}
                >
                  <option value="">Seleccionar insumo...</option>
                  {insumosDisponibles.map(ins => (
                    <option 
                      key={ins.dni_producto} 
                      value={ins.dni_producto}
                      disabled={ins.stock <= 0}
                    >
                      {ins.nombre} (Stock: {ins.stock}) {ins.stock <= 0 ? "⚠️ Agotado" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ width: "70px", flexShrink: 0 }}>
                <label style={{ fontSize: "0.7rem", textTransform: "uppercase", fontWeight: "600", color: "var(--text-muted)", display: "block", marginBottom: "3px" }}>
                  Cant.
                </label>
                <input
                  type="number"
                  min="1"
                  value={tempCantidad}
                  onChange={e => setTempCantidad(e.target.value)}
                  disabled={isLoading || !tempInsumoId}
                  style={{ width: "100%", padding: "8px", fontSize: "0.85rem", borderRadius: "8px", textAlign: "center" }}
                />
              </div>

              <button
                type="button"
                className="btn"
                onClick={handleAgregarInsumo}
                disabled={isLoading || !tempInsumoId}
                style={{
                  width: "auto",
                  padding: "8px 12px",
                  height: "38px",
                  background: "#f59e0b",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "8px"
                }}
                title="Agregar insumo a la preparación"
              >
                ➕
              </button>
            </div>

            {/* Listado de insumos agregados */}
            {insumosSeleccionados.length > 0 ? (
              <div style={{ marginTop: "10px", borderTop: "1px dashed rgba(245, 158, 11, 0.4)", paddingTop: "8px" }}>
                <span style={{ fontSize: "0.74rem", fontWeight: "600", color: "#92400e" }}>
                  Insumos a descontar ({insumosSeleccionados.length}):
                </span>
                <ul style={{ listStyle: "none", padding: 0, marginTop: "6px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {insumosSeleccionados.map((item) => (
                    <li
                      key={item.producto_id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 8px",
                        background: "#fff",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        borderRadius: "6px",
                        fontSize: "0.8rem"
                      }}
                    >
                      <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                        <div style={{ fontWeight: "600", color: "var(--text-main)" }}>{item.nombre}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          Stock: {item.stock_disponible} → Restante: {item.stock_disponible - item.cantidad}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                        <span style={{ fontWeight: "700", background: "#f59e0b", color: "#fff", padding: "2px 6px", borderRadius: "8px", fontSize: "0.72rem" }}>
                          -{item.cantidad} u.
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuitarInsumo(item.producto_id)}
                          style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontWeight: "700", fontSize: "0.9rem", padding: "0 2px" }}
                          title="Quitar de la lista"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div style={{ marginTop: "6px", fontSize: "0.72rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                (Opcional) Puedes añadir los insumos requeridos arriba para descontarlos al guardar.
              </div>
            )}
          </div>
          
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            {editingPlatoId && (
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={cancelarEdicion}
                disabled={isLoading}
                style={{ flex: 1, padding: "10px" }}
              >
                Cancelar
              </button>
            )}
            <button 
              type="submit" 
              className="btn" 
              style={{ flex: 2, background: editingPlatoId ? "#4f46e5" : "#f59e0b", color: "#fff", fontWeight: "600", padding: "10px" }} 
              disabled={isLoading}
            >
              {isLoading ? "Guardando..." : editingPlatoId ? "💾 Guardar Cambios" : "Agregar al Menú"}
            </button>
          </div>
        </form>
      </div>

      {/* Panel Listado */}
      <div className="users-list-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
          <h2 style={{ margin: 0 }}>Menú del Restaurante ({platosFiltrados.length})</h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => { cargarPlatos(); cargarInsumos(); }}
            disabled={isLoading}
            style={{ width: "auto" }}
          >
            🔄 Actualizar
          </button>
        </div>

        <div style={{ marginBottom: "15px" }}>
          <input 
            type="text" 
            placeholder="Buscar plato por código, nombre, categoría o insumo..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--glass-border)", background: "var(--input-bg)" }} 
          />
        </div>

        <div className="users-table-container">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre e Insumos</th>
                <th>Categoría</th>
                <th>Precio Venta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {platosFiltrados.map(p => (
                <tr key={p.dni_producto}>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{p.dni_producto}</td>
                  <td>
                    <div style={{ fontWeight: "bold", color: "#b45309", fontSize: "1rem" }}>{p.nombre}</div>
                    {p.descripcion && <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>{p.descripcion}</div>}
                    
                    {/* Visualización de insumos descontados en la receta */}
                    {p.ingredientes && p.ingredientes.length > 0 ? (
                      <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {p.ingredientes.map(ing => (
                          <span 
                            key={ing.producto_id}
                            style={{
                              fontSize: "0.72rem",
                              padding: "2px 6px",
                              borderRadius: "6px",
                              background: "rgba(245, 158, 11, 0.15)",
                              color: "#92400e",
                              fontWeight: "600",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px"
                            }}
                            title={`Insumo consumido: ${ing.nombre} (${ing.cantidad} unidades)`}
                          >
                            🌾 {ing.nombre} <strong>(x{ing.cantidad})</strong>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontStyle: "italic", marginTop: "4px" }}>
                        Sin insumos registrados
                      </div>
                    )}
                  </td>
                  <td>{p.categoria_nombre || "Sin categoría"}</td>
                  <td style={{ fontWeight: "bold", fontSize: "1.1rem" }}>${p.precio}</td>
                  <td className="actions">
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button 
                        className="btn btn-sm btn-secondary" 
                        onClick={() => iniciarEdicion(p)}
                        disabled={isLoading}
                        style={{ background: "#4f46e5", color: "white", fontWeight: "bold" }}
                        title="Modificar precio, descripción, categoría o insumos de este plato"
                      >
                        ✏️ Editar
                      </button>
                      <button 
                        className="btn btn-sm btn-danger" 
                        onClick={() => eliminarPlato(p.dni_producto)}
                        disabled={isLoading}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {platosFiltrados.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    {searchTerm ? `No se encontraron platos que coincidan con "${searchTerm}".` : "No hay platos registrados en el menú."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

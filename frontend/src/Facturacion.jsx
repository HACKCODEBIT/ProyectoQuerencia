import { useState, useEffect } from "react";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000/api/facturacion";

export default function Facturacion({ currentUser, token, showToast }) {
  const [activeTab, setActiveTab] = useState("emitir");
  const [pedidos, setPedidos] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Seleccion en Emitir
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [facturaForm, setFacturaForm] = useState({
    nit_cliente: "",
    razon_social: "",
    metodo_pago: "Efectivo",
    iva_porcentaje: 19,
    monto_recibido: ""
  });
  const [facturaGenerada, setFacturaGenerada] = useState(null);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };

  useEffect(() => {
    if (activeTab === "emitir") cargarPedidos();
    else cargarHistorial();
  }, [activeTab]);

  const cargarPedidos = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/pedidos-pendientes`, { headers });
      if (res.ok) setPedidos(await res.json());
    } catch (e) {}
  };

  const cargarHistorial = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/historial`, { headers });
      if (res.ok) setFacturas(await res.json());
    } catch (e) {}
  };

  const handleSeleccionarPedido = (p) => {
    setPedidoSeleccionado(p);
    setFacturaForm({ ...facturaForm, razon_social: p.cliente, monto_recibido: "" });
    setFacturaGenerada(null);
  };

  const emitirFactura = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Subtotal = total del pedido (asumimos que en el pedido el total ya incluye el costo de envío pero no el IVA en este nuevo modelo contable)
    const subtotal = pedidoSeleccionado.total;
    const iva_calc = (subtotal * facturaForm.iva_porcentaje) / 100;
    const granTotal = subtotal + iva_calc;

    const payload = {
      pedido_id: pedidoSeleccionado.idPedido,
      nit_cliente: facturaForm.nit_cliente || "222222222222",
      razon_social: facturaForm.razon_social || "Consumidor Final",
      metodo_pago: facturaForm.metodo_pago,
      iva_porcentaje: parseFloat(facturaForm.iva_porcentaje),
      monto_recibido: facturaForm.metodo_pago === "Efectivo" ? parseFloat(facturaForm.monto_recibido || 0) : granTotal
    };

    if (facturaForm.metodo_pago === "Efectivo" && payload.monto_recibido < granTotal) {
      showToast("El monto recibido no puede ser menor al total", "error");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/emitir`, { method: "POST", headers, body: JSON.stringify(payload) });
      if (res.ok) {
        const data = await res.json();
        showToast("Factura emitida correctamente", "success");
        setFacturaGenerada(data);
        cargarPedidos();
      } else {
        const err = await res.json();
        showToast(err.detail || "Error al emitir factura", "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const exportarExcel = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/exportar-excel`, { headers });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Reporte_Ventas_Mensual.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      showToast("Error al exportar a Excel", "error");
    }
  };

  if (currentUser?.tipo_usuario !== "administrador") {
    return <div style={{ padding: "40px", textAlign: "center" }}><h2>Acceso Denegado</h2></div>;
  }

  // Cálculos en tiempo real
  const subtotalLive = pedidoSeleccionado ? pedidoSeleccionado.total : 0;
  const ivaLive = (subtotalLive * facturaForm.iva_porcentaje) / 100;
  const totalLive = subtotalLive + ivaLive;
  const devueltaLive = facturaForm.metodo_pago === "Efectivo" && facturaForm.monto_recibido ? (parseFloat(facturaForm.monto_recibido) - totalLive) : 0;

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button className={`btn ${activeTab === "emitir" ? "" : "btn-secondary"}`} onClick={() => setActiveTab("emitir")}>Emitir Factura</button>
        <button className={`btn ${activeTab === "historial" ? "" : "btn-secondary"}`} onClick={() => setActiveTab("historial")}>Historial y Reportes</button>
      </div>

      {activeTab === "emitir" && (
        <div className="dashboard-grid" style={{ gridTemplateColumns: "350px 1fr" }}>
          <div className="users-list-panel">
            <h2>Pedidos Pendientes</h2>
            <div className="users-table-container">
              <table>
                <thead><tr><th># Pedido</th><th>Cliente</th><th>Total Base</th><th>Acción</th></tr></thead>
                <tbody>
                  {pedidos.map(p => (
                    <tr key={p.idPedido}>
                      <td>#{p.idPedido}</td>
                      <td>{p.cliente}</td>
                      <td>${p.total}</td>
                      <td><button className="btn btn-sm" onClick={() => handleSeleccionarPedido(p)}>Facturar</button></td>
                    </tr>
                  ))}
                  {pedidos.length === 0 && <tr><td colSpan="4" style={{ textAlign: "center" }}>No hay pedidos por facturar.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {pedidoSeleccionado && !facturaGenerada && (
            <div className="crud-panel">
              <h4>Facturar Pedido #{pedidoSeleccionado.idPedido}</h4>
              <form onSubmit={emitirFactura}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="form-group"><label>NIT / C.C.</label><input type="text" value={facturaForm.nit_cliente} onChange={e => setFacturaForm({...facturaForm, nit_cliente: e.target.value})} placeholder="Consumidor Final" /></div>
                  <div className="form-group"><label>Nombre / Razón Social</label><input type="text" value={facturaForm.razon_social} onChange={e => setFacturaForm({...facturaForm, razon_social: e.target.value})} /></div>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="form-group"><label>Método de Pago</label>
                    <select value={facturaForm.metodo_pago} onChange={e => setFacturaForm({...facturaForm, metodo_pago: e.target.value})}>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Tarjeta">Tarjeta (Datafono)</option>
                      <option value="Transferencia">Transferencia (Wompi/Nequi)</option>
                    </select>
                  </div>
                  <div className="form-group"><label>% IVA</label><input type="number" min="0" max="100" value={facturaForm.iva_porcentaje} onChange={e => setFacturaForm({...facturaForm, iva_porcentaje: e.target.value})} /></div>
                </div>

                <div style={{ padding: "15px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", marginBottom: "15px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}><span>Subtotal:</span> <strong>${subtotalLive.toFixed(2)}</strong></div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}><span>IVA ({facturaForm.iva_porcentaje}%):</span> <strong>${ivaLive.toFixed(2)}</strong></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.2rem", color: "#0f172a", borderTop: "1px solid #cbd5e1", paddingTop: "5px" }}>
                    <span>Total a Cobrar:</span> <strong>${totalLive.toFixed(2)}</strong>
                  </div>
                </div>

                {facturaForm.metodo_pago === "Efectivo" && (
                  <div className="form-group">
                    <label>Efectivo Recibido ($)</label>
                    <input type="number" required min={totalLive} step="0.01" value={facturaForm.monto_recibido} onChange={e => setFacturaForm({...facturaForm, monto_recibido: e.target.value})} />
                    {devueltaLive > 0 && <div style={{ color: "#059669", fontWeight: "bold", marginTop: "5px" }}>Cambio a devolver: ${devueltaLive.toFixed(2)}</div>}
                  </div>
                )}

                <button type="submit" className="btn" style={{ width: "100%", background: "#10b981" }} disabled={isLoading}>Emitir Factura Electrónica</button>
              </form>
            </div>
          )}

          {facturaGenerada && (
            <div className="crud-panel" style={{ textAlign: "center" }}>
              <div style={{ background: "#dcfce7", padding: "20px", borderRadius: "8px", marginBottom: "15px" }}>
                <h3 style={{ color: "#166534" }}>¡Factura {facturaGenerada.numero_factura} Emitida!</h3>
                <p><strong>Cliente:</strong> {facturaGenerada.razon_social} (NIT: {facturaGenerada.nit_cliente})</p>
                <p><strong>Método de Pago:</strong> {facturaGenerada.metodo_pago}</p>
                <hr style={{ borderColor: "#bbf7d0", margin: "10px 0" }} />
                <p><strong>Subtotal:</strong> ${facturaGenerada.subtotal}</p>
                <p><strong>IVA:</strong> ${facturaGenerada.iva}</p>
                <h2 style={{ margin: "10px 0" }}>Total: ${facturaGenerada.total}</h2>
                {facturaGenerada.metodo_pago === "Efectivo" && (
                  <p style={{ color: "#059669", fontWeight: "bold" }}>Cambio entregado: ${facturaGenerada.cambio}</p>
                )}
              </div>
              <button className="btn" onClick={() => { setFacturaGenerada(null); setPedidoSeleccionado(null); }}>Facturar Otro Pedido</button>
            </div>
          )}
        </div>
      )}

      {activeTab === "historial" && (
        <div className="users-list-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>Historial de Facturas (Mes Actual)</h2>
            <button className="btn" style={{ background: "#0284c7" }} onClick={exportarExcel}>⬇️ Exportar a Excel</button>
          </div>
          <div className="users-table-container" style={{ marginTop: "15px" }}>
            <table>
              <thead><tr><th>Factura</th><th>Fecha</th><th>NIT</th><th>Razón Social</th><th>Pago</th><th>Subtotal</th><th>IVA</th><th>Total</th></tr></thead>
              <tbody>
                {facturas.map(f => (
                  <tr key={f.idFactura}>
                    <td style={{ fontWeight: "bold" }}>{f.numero_factura}</td>
                    <td>{f.fecha}</td>
                    <td>{f.nit_cliente}</td>
                    <td>{f.razon_social}</td>
                    <td>{f.metodo_pago}</td>
                    <td>${f.subtotal}</td>
                    <td>${f.iva}</td>
                    <td style={{ fontWeight: "bold", color: "#10b981" }}>${f.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

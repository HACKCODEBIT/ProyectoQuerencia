import { useState, useEffect } from "react";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000/api";

export default function Configuracion({ currentUser, token, showToast, themeSettings, onUpdateThemeSettings }) {
  const [activeSubTab, setActiveSubTab] = useState("apariencia"); // 'apariencia' | 'reportes' | 'negocio'
  const [metricas, setMetricas] = useState(null);
  const [historialReportes, setHistorialReportes] = useState([]);
  const [isDescargando, setIsDescargando] = useState(false);
  const [isLoadingMetricas, setIsLoadingMetricas] = useState(false);

  // Estados locales de apariencia (heredados o inicializados desde localStorage)
  const [currentTheme, setCurrentTheme] = useState(themeSettings?.theme || localStorage.getItem("app_theme") || "light");
  const [currentDaltonism, setCurrentDaltonism] = useState(themeSettings?.daltonism || localStorage.getItem("app_daltonism") || "normal");
  const [currentFontSize, setCurrentFontSize] = useState(themeSettings?.fontSize || localStorage.getItem("app_font_size") || "normal");

  // Configuración del Restaurante (Persistida en localStorage)
  const [negocioForm, setNegocioForm] = useState(() => {
    const guardado = localStorage.getItem("app_negocio_info");
    if (guardado) {
      try { return JSON.parse(guardado); } catch (e) {}
    }
    return {
      nombreComercial: "La Querencia - Restaurante y Café",
      nit: "900.876.543-1",
      telefono: "3185551234",
      direccionOrigen: "Cali, Valle del Cauca, Colombia",
      costoEnvioBase: 4000,
      moneda: "COP ($)"
    };
  });

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };

  useEffect(() => {
    if (activeSubTab === "reportes") {
      cargarMetricas();
      cargarHistorialReportes();
    }
  }, [activeSubTab]);

  const aplicarApariencia = (nuevoTema, nuevoDaltonismo, nuevaFuente) => {
    setCurrentTheme(nuevoTema);
    setCurrentDaltonism(nuevoDaltonismo);
    setCurrentFontSize(nuevaFuente);

    localStorage.setItem("app_theme", nuevoTema);
    localStorage.setItem("app_daltonism", nuevoDaltonismo);
    localStorage.setItem("app_font_size", nuevaFuente);

    document.documentElement.setAttribute("data-theme", nuevoTema);
    document.documentElement.setAttribute("data-daltonism", nuevoDaltonismo);
    document.documentElement.setAttribute("data-font-size", nuevaFuente);

    if (onUpdateThemeSettings) {
      onUpdateThemeSettings({ theme: nuevoTema, daltonism: nuevoDaltonismo, fontSize: nuevaFuente });
    }
  };

  const cambiarTema = (tema) => {
    aplicarApariencia(tema, currentDaltonism, currentFontSize);
    showToast(`Tema ${tema === "dark" ? "Oscuro" : "Claro"} activado`, "success");
  };

  const cambiarDaltonismo = (modo) => {
    aplicarApariencia(currentTheme, modo, currentFontSize);
    const nombres = {
      normal: "Visión Estándar",
      protanopia: "Protanopía (Rojo)",
      deuteranopia: "Deuteranopía (Verde)",
      tritanopia: "Tritanopía (Azul)",
      achromatopsia: "Acromatopsia (Monocromo)",
      "high-contrast": "Alto Contraste"
    };
    showToast(`Modo de color: ${nombres[modo] || modo}`, "success");
  };

  const cambiarFontSize = (tam) => {
    aplicarApariencia(currentTheme, currentDaltonism, tam);
    showToast(`Tamaño de texto actualizado`, "success");
  };

  const restablecerApariencia = () => {
    aplicarApariencia("light", "normal", "normal");
    showToast("Configuración visual restablecida por defecto", "success");
  };

  // ------------------ CARGAS DE REPORTES Y MÉTRICAS ------------------
  const cargarMetricas = async () => {
    setIsLoadingMetricas(true);
    try {
      const res = await fetch(`${API_BASE_URL}/configuracion/metricas`, { headers });
      if (res.ok) {
        setMetricas(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingMetricas(false);
    }
  };

  const cargarHistorialReportes = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/configuracion/historial-reportes`, { headers });
      if (res.ok) {
        setHistorialReportes(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const descargarReporteGeneralExcel = async () => {
    setIsDescargando(true);
    try {
      const res = await fetch(`${API_BASE_URL}/configuracion/reporte/general-excel`, { headers });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Reporte_Consolidado_Querencia_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast("Reporte general generado y descargado exitosamente", "success");
        cargarHistorialReportes();
      } else {
        showToast("No se pudo generar el reporte consolidado", "error");
      }
    } catch (e) {
      showToast("Error de conexión al descargar el reporte", "error");
    } finally {
      setIsDescargando(false);
    }
  };

  const guardarNegocio = (e) => {
    e.preventDefault();
    localStorage.setItem("app_negocio_info", JSON.stringify(negocioForm));
    showToast("Datos del restaurante actualizados correctamente", "success");
  };

  return (
    <div>
      {/* Navegación interna del módulo */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "25px", flexWrap: "wrap" }}>
        <button 
          className={`btn ${activeSubTab === "apariencia" ? "" : "btn-secondary"}`} 
          onClick={() => setActiveSubTab("apariencia")}
        >
          🎨 Apariencia y Accesibilidad
        </button>
        <button 
          className={`btn ${activeSubTab === "reportes" ? "" : "btn-secondary"}`} 
          onClick={() => setActiveSubTab("reportes")}
        >
          📊 Centro de Reportes y KPIs
        </button>
        <button 
          className={`btn ${activeSubTab === "negocio" ? "" : "btn-secondary"}`} 
          onClick={() => setActiveSubTab("negocio")}
        >
          🏢 Datos del Restaurante
        </button>
      </div>

      {/* ========================================================= */}
      {/* PESTAÑA 1: APARIENCIA Y ACCESIBILIDAD                      */}
      {/* ========================================================= */}
      {activeSubTab === "apariencia" && (
        <div className="dashboard-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "25px", alignItems: "start" }}>
          {/* Columna Izquierda: Controles */}
          <div className="crud-panel">
            <h3 style={{ marginBottom: "15px", color: "var(--primary)" }}>🎨 Tema Visual</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "20px" }}>
              Personaliza el aspecto de la plataforma para trabajar con mayor comodidad visual según la hora del día o tus preferencias.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "30px" }}>
              <button
                type="button"
                className={`btn ${currentTheme === "light" ? "" : "btn-secondary"}`}
                onClick={() => cambiarTema("light")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  padding: "16px",
                  border: currentTheme === "light" ? "2px solid var(--primary)" : "1px solid var(--glass-border)"
                }}
              >
                <span style={{ fontSize: "1.4rem" }}>☀️</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: "bold" }}>Modo Claro</div>
                  <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>Luminoso y nítido</div>
                </div>
              </button>

              <button
                type="button"
                className={`btn ${currentTheme === "dark" ? "" : "btn-secondary"}`}
                onClick={() => cambiarTema("dark")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  padding: "16px",
                  border: currentTheme === "dark" ? "2px solid var(--primary)" : "1px solid var(--glass-border)"
                }}
              >
                <span style={{ fontSize: "1.4rem" }}>🌙</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: "bold" }}>Modo Oscuro</div>
                  <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>Descanso visual</div>
                </div>
              </button>
            </div>

            <h3 style={{ marginBottom: "12px", color: "var(--primary)" }}>👁️ Modo Daltonismo (Accesibilidad Visual)</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "15px" }}>
              Ajusta las combinaciones de color y niveles de contraste del sistema para facilitar la lectura e identificación de estados:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "25px" }}>
              {[
                { id: "normal", nombre: "Visión Estándar", desc: "Paleta equilibrada por defecto", icon: "🌈" },
                { id: "protanopia", nombre: "Protanopía / Protanomalía", desc: "Optimizado para dificultad con tonos rojos (prioriza azules y dorados)", icon: "🔴" },
                { id: "deuteranopia", nombre: "Deuteranopía / Deuteranomalía", desc: "Optimizado para dificultad con tonos verdes (prioriza azul y naranja)", icon: "🟢" },
                { id: "tritanopia", nombre: "Tritanopía / Tritanomalía", desc: "Optimizado para dificultad con tonos azules (prioriza fucsia y turquesa)", icon: "🔵" },
                { id: "high-contrast", nombre: "Alto Contraste", desc: "Máxima legibilidad con bordes gruesos y colores puros de alto impacto", icon: "🔲" },
                { id: "achromatopsia", nombre: "Acromatopsia (Escala de Grises)", desc: "Monocromático completo para sensibilidad lumínica", icon: "⚪" },
              ].map(opt => (
                <div 
                  key={opt.id}
                  onClick={() => cambiarDaltonismo(opt.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    cursor: "pointer",
                    border: currentDaltonism === opt.id ? "2px solid var(--primary)" : "1px solid var(--glass-border)",
                    background: currentDaltonism === opt.id ? "var(--primary-light)" : "var(--panel-bg)",
                    transition: "all 0.2s ease"
                  }}
                >
                  <span style={{ fontSize: "1.3rem" }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "700", fontSize: "0.92rem", color: currentDaltonism === opt.id ? "var(--primary)" : "var(--text-main)" }}>
                      {opt.nombre}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      {opt.desc}
                    </div>
                  </div>
                  {currentDaltonism === opt.id && (
                    <span style={{ color: "var(--primary)", fontWeight: "bold", fontSize: "1.2rem" }}>✓</span>
                  )}
                </div>
              ))}
            </div>

            <h3 style={{ marginBottom: "12px", color: "var(--primary)" }}>🔤 Tamaño de Texto de Interfaz</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "25px" }}>
              {[
                { id: "normal", label: "Normal (100%)" },
                { id: "large", label: "Grande (112%)" },
                { id: "xlarge", label: "Muy Grande (125%)" }
              ].map(sz => (
                <button
                  key={sz.id}
                  type="button"
                  className={`btn ${currentFontSize === sz.id ? "" : "btn-secondary"}`}
                  onClick={() => cambiarFontSize(sz.id)}
                  style={{ fontSize: "0.85rem", padding: "10px 4px" }}
                >
                  {sz.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={restablecerApariencia}
              style={{ width: "100%", padding: "12px" }}
            >
              🔄 Restablecer Ajustes por Defecto
            </button>
          </div>

          {/* Columna Derecha: Vista Previa Interactiva */}
          <div className="users-list-panel">
            <h3 style={{ marginBottom: "15px", color: "var(--text-main)" }}>🔍 Vista Previa en Tiempo Real</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "20px" }}>
              Comprueba de inmediato cómo los botones, alertas y estados se distinguen visualmente con tu configuración actual:
            </p>

            <div style={{
              padding: "20px",
              borderRadius: "16px",
              border: "1px solid var(--glass-border)",
              background: "var(--input-bg)",
              marginBottom: "20px"
            }}>
              <h4 style={{ margin: "0 0 12px 0", color: "var(--text-main)" }}>Indicadores de Estado del Sistema</h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}>
                <span style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  background: "var(--success)",
                  color: "#ffffff",
                  fontWeight: "bold",
                  fontSize: "0.85rem"
                }}>
                  ✅ Pedido Completado / Pagado
                </span>
                <span style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  background: "var(--warning, #f59e0b)",
                  color: "#ffffff",
                  fontWeight: "bold",
                  fontSize: "0.85rem"
                }}>
                  ⏳ Pedido en Proceso / Pendiente
                </span>
                <span style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  background: "var(--error)",
                  color: "#ffffff",
                  fontWeight: "bold",
                  fontSize: "0.85rem"
                }}>
                  ⚠️ Stock Agotado / Cancelado
                </span>
                <span style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  background: "var(--primary)",
                  color: "#ffffff",
                  fontWeight: "bold",
                  fontSize: "0.85rem"
                }}>
                  ℹ️ Botón Principal de Acción
                </span>
              </div>

              <h4 style={{ margin: "0 0 12px 0", color: "var(--text-main)" }}>Muestra de Tabla de Datos</h4>
              <div className="users-table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Elemento</th>
                      <th>Estado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>#1001</td>
                      <td>Café Especial Querencia</td>
                      <td>
                        <span style={{ color: "var(--success)", fontWeight: "bold" }}>● Activo</span>
                      </td>
                      <td><button className="btn btn-sm">Ver</button></td>
                    </tr>
                    <tr>
                      <td>#1002</td>
                      <td>Insumo Leche Entera</td>
                      <td>
                        <span style={{ color: "var(--warning, #f59e0b)", fontWeight: "bold" }}>● Stock Bajo</span>
                      </td>
                      <td><button className="btn btn-sm btn-secondary">Editar</button></td>
                    </tr>
                    <tr>
                      <td>#1003</td>
                      <td>Pedido Domicilio Cancelado</td>
                      <td>
                        <span style={{ color: "var(--error)", fontWeight: "bold" }}>● Cancelado</span>
                      </td>
                      <td><button className="btn btn-sm btn-danger">Eliminar</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{
              padding: "16px 20px",
              background: "var(--primary-light)",
              border: "1px solid var(--primary)",
              borderRadius: "14px",
              color: "var(--text-main)",
              fontSize: "0.88rem"
            }}>
              💡 <strong>Ajustes Guardados Automáticamente:</strong> Tus elecciones se almacenan localmente en el navegador y se mantendrán activas cada vez que inicies sesión.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 2: CENTRO DE REPORTES Y KPIS                       */}
      {/* ========================================================= */}
      {activeSubTab === "reportes" && (
        <div>
          {/* Métricas KPI Rápidas */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
            marginBottom: "25px"
          }}>
            <div className="crud-panel" style={{ padding: "18px", textAlign: "center" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Total Ventas</div>
              <div style={{ fontSize: "1.6rem", fontWeight: "800", color: "#10b981", margin: "6px 0" }}>
                ${metricas ? metricas.total_ventas.toLocaleString() : "..."}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Facturación acumulada</div>
            </div>

            <div className="crud-panel" style={{ padding: "18px", textAlign: "center" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Pedidos Registrados</div>
              <div style={{ fontSize: "1.6rem", fontWeight: "800", color: "#5240CF", margin: "6px 0" }}>
                {metricas ? metricas.total_pedidos : "..."}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{metricas?.facturas_count || 0} con factura</div>
            </div>

            <div className="crud-panel" style={{ padding: "18px", textAlign: "center" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Insumos en Almacén</div>
              <div style={{ fontSize: "1.6rem", fontWeight: "800", color: "#0284c7", margin: "6px 0" }}>
                {metricas ? metricas.productos_insumos : "..."}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Materia prima inventariada</div>
            </div>

            <div className="crud-panel" style={{ padding: "18px", textAlign: "center" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Insumos Alerta Stock</div>
              <div style={{ fontSize: "1.6rem", fontWeight: "800", color: "#ef4444", margin: "6px 0" }}>
                {metricas ? metricas.stock_bajo_count : "..."}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Requieren reabastecimiento</div>
            </div>

            <div className="crud-panel" style={{ padding: "18px", textAlign: "center" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Platos en Menú</div>
              <div style={{ fontSize: "1.6rem", fontWeight: "800", color: "#f59e0b", margin: "6px 0" }}>
                {metricas ? metricas.platos_menu : "..."}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Recetas activas</div>
            </div>

            <div className="crud-panel" style={{ padding: "18px", textAlign: "center" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Usuarios Registrados</div>
              <div style={{ fontSize: "1.6rem", fontWeight: "800", color: "var(--text-main)", margin: "6px 0" }}>
                {metricas ? metricas.usuarios_count : "..."}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Cuentas de sistema</div>
            </div>
          </div>

          {/* Opciones de Descarga de Reportes */}
          <div className="dashboard-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "25px", alignItems: "start" }}>
            <div className="crud-panel">
              <h3 style={{ marginBottom: "15px", color: "var(--primary)" }}>📥 Generar Reportes Ejecutivos</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: "20px" }}>
                Descarga informes consolidados en formato Microsoft Excel (.xlsx) estructurados por hojas para contabilidad, auditoría o análisis gerencial:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                {/* Reporte General Completo */}
                <div style={{
                  padding: "18px",
                  borderRadius: "14px",
                  border: "2px solid #5240CF",
                  background: "rgba(82, 64, 207, 0.05)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontWeight: "800", fontSize: "1.05rem", color: "#5240CF" }}>
                      📊 Reporte Ejecutivo Consolidado
                    </span>
                    <span style={{ background: "#5240CF", color: "#fff", fontSize: "0.7rem", padding: "2px 8px", borderRadius: "10px", fontWeight: "bold" }}>
                      Multi-Hoja
                    </span>
                  </div>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 14px 0" }}>
                    Contiene 5 hojas completas: Resumen de Indicadores, Inventario detallado de Insumos, Platos del Menú con sus recetas, Facturación histórica y Usuarios.
                  </p>
                  <button 
                    className="btn" 
                    onClick={descargarReporteGeneralExcel}
                    disabled={isDescargando}
                    style={{ width: "100%", background: "#5240CF", color: "#fff" }}
                  >
                    {isDescargando ? "Generando Excel..." : "Descargar Reporte Consolidado (Excel)"}
                  </button>
                </div>

                {/* Reporte de Inventario */}
                <div style={{
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid var(--glass-border)",
                  background: "var(--panel-bg)"
                }}>
                  <div style={{ fontWeight: "700", marginBottom: "4px" }}>📦 Reporte de Inventario y Stock</div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 10px 0" }}>
                    Listado de productos, existencias en almacén y niveles de abastecimiento.
                  </p>
                  <a
                    href={`${API_BASE_URL}/inventario/reporte/excel`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ display: "inline-block", textDecoration: "none" }}
                  >
                    Descargar Inventario (.xlsx)
                  </a>
                </div>

                {/* Reporte de Facturación */}
                <div style={{
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid var(--glass-border)",
                  background: "var(--panel-bg)"
                }}>
                  <div style={{ fontWeight: "700", marginBottom: "4px" }}>🧾 Reporte de Facturación y Ventas</div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 10px 0" }}>
                    Historial de facturas emitidas, desglose de IVA y formas de pago utilizadas.
                  </p>
                  <a
                    href={`${API_BASE_URL}/facturacion/exportar-excel`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ display: "inline-block", textDecoration: "none" }}
                  >
                    Descargar Facturación (.xlsx)
                  </a>
                </div>
              </div>
            </div>

            {/* Historial de Reportes Generados */}
            <div className="users-list-panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                <h3 style={{ margin: 0, color: "var(--text-main)" }}>📜 Historial de Reportes</h3>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={cargarHistorialReportes}
                  style={{ width: "auto" }}
                >
                  🔄 Refrescar
                </button>
              </div>

              <div className="users-table-container">
                <table>
                  <thead>
                    <tr>
                      <th># ID</th>
                      <th>Fecha</th>
                      <th>Tipo de Reporte</th>
                      <th>Generado Por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialReportes.map(rep => (
                      <tr key={rep.idReporte}>
                        <td style={{ fontWeight: "bold" }}>#{rep.idReporte}</td>
                        <td>{rep.fechaGeneracion}</td>
                        <td style={{ color: "var(--primary)", fontWeight: "600" }}>{rep.tipo}</td>
                        <td>{rep.GeneradoPor}</td>
                      </tr>
                    ))}
                    {historialReportes.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                          No hay reportes generados en el historial aún.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 3: DATOS DEL RESTAURANTE                           */}
      {/* ========================================================= */}
      {activeSubTab === "negocio" && (
        <div className="crud-panel" style={{ maxWidth: "680px", margin: "0 auto" }}>
          <h3 style={{ marginBottom: "15px", color: "var(--primary)" }}>🏢 Información Comercial de La Querencia</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: "25px" }}>
            Configura los datos del establecimiento que se utilizan para el encabezado de facturas impresas, tickets de caja y el cálculo de domicilios.
          </p>

          <form onSubmit={guardarNegocio}>
            <div className="form-group">
              <label>Nombre Comercial del Establecimiento</label>
              <input
                type="text"
                required
                value={negocioForm.nombreComercial}
                onChange={e => setNegocioForm({ ...negocioForm, nombreComercial: e.target.value })}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div className="form-group">
                <label>NIT / Identificación Tributaria</label>
                <input
                  type="text"
                  required
                  value={negocioForm.nit}
                  onChange={e => setNegocioForm({ ...negocioForm, nit: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Teléfono de Contacto</label>
                <input
                  type="text"
                  required
                  value={negocioForm.telefono}
                  onChange={e => setNegocioForm({ ...negocioForm, telefono: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Dirección del Local (Origen para Cálculo de Envíos)</label>
              <input
                type="text"
                required
                value={negocioForm.direccionOrigen}
                onChange={e => setNegocioForm({ ...negocioForm, direccionOrigen: e.target.value })}
                placeholder="Ej. Calle 5 # 30-10, Cali, Colombia"
              />
              <small style={{ color: "var(--text-muted)", fontSize: "0.75rem", display: "block", marginTop: "4px" }}>
                Esta dirección se utiliza como punto de partida para calcular las tarifas y distancias de entrega a domicilio.
              </small>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px" }}>
              <div className="form-group">
                <label>Tarifa Base de Domicilio ($)</label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  required
                  value={negocioForm.costoEnvioBase}
                  onChange={e => setNegocioForm({ ...negocioForm, costoEnvioBase: parseFloat(e.target.value || 0) })}
                />
              </div>

              <div className="form-group">
                <label>Moneda del Sistema</label>
                <input
                  type="text"
                  disabled
                  value={negocioForm.moneda}
                />
              </div>
            </div>

            <button type="submit" className="btn" style={{ width: "100%", padding: "14px" }}>
              💾 Guardar Configuración del Establecimiento
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import './App.css';
import Caja from './Caja';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

// Iconos SVG para reutilizar
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const WarningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

// Función de validación de fortaleza de contraseña
const checkPasswordStrength = (pass) => {
  if (!pass) return { score: 0, text: 'Ninguna', class: '' };
  if (pass.length < 8) return { score: 1, text: 'Muy corta (mín. 8 caracteres)', class: 'weak' };
  
  let score = 1;
  const hasUppercase = /[A-Z]/.test(pass);
  const hasLowercase = /[a-z]/.test(pass);
  const hasNumber = /[0-9]/.test(pass);
  const hasSpecial = /[^A-Za-z0-9]/.test(pass);

  const variationsCount = [hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;
  
  if (pass.length >= 8 && variationsCount >= 2) {
    score = 2; // Media
  }
  if (pass.length >= 10 && variationsCount >= 3) {
    score = 3; // Fuerte
  }
  
  const textMap = {
    1: 'Débil',
    2: 'Media',
    3: 'Fuerte'
  };
  
  const classMap = {
    1: 'weak',
    2: 'medium',
    3: 'strong'
  };
  
  return {
    score,
    text: textMap[score],
    class: classMap[score]
  };
};

function App() {
  // Estados de Autenticación
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'

  // Estados de Formularios de Autenticación
  const [authForm, setAuthForm] = useState({ nombre: '', correo: '', contrasena: '', tipo_usuario: 'normal', token: '' });

  // Estados del CRUD de Usuarios
  const [users, setUsers] = useState([]);
  const [crudMode, setCrudMode] = useState('create'); // 'create' | 'edit'
  const [crudForm, setCrudForm] = useState({ nombre: '', correo: '', contrasena: '', tipo_usuario: 'normal', token: '' });
  const [editingUserId, setEditingUserId] = useState(null);

  // Estados de carga (Spinner y botones deshabilitados)
  const [isLoading, setIsLoading] = useState(false);
  const [isUsersLoading, setIsUsersLoading] = useState(false);

  // Estados de visibilidad de contraseña
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [showCrudPassword, setShowCrudPassword] = useState(false);

  // Estados del Menú / Pestañas de Navegación del Dashboard
  const [activeTab, setActiveTab] = useState('inicio'); // 'inicio' | 'usuarios'

  // Estado del sistema de Notificaciones (Toasts)
  const [toasts, setToasts] = useState([]);

  // Estados de Validación de Inputs en tiempo real
  const [emailError, setEmailError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, text: 'Ninguna', class: '' });

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Efecto para verificar autenticación y cargar datos iniciales
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      obtenerPerfilActual();
    } else {
      localStorage.removeItem('token');
      setIsAuthenticated(false);
      setCurrentUser(null);
    }
  }, [token]);

  // Cargar lista de usuarios cuando está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      cargarUsuarios();
    }
  }, [isAuthenticated]);

  // 1. Obtener Perfil del Usuario Actual (GET /auth/me)
  const obtenerPerfilActual = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
        setIsAuthenticated(true);
        setActiveTab('inicio'); // Direcciona a la vista de inicio al ingresar
      } else {
        // Token inválido o expirado
        cerrarSesion();
      }
    } catch (err) {
      showToast('Error al conectar con el servidor para verificar perfil.', 'error');
      cerrarSesion();
    }
  };

  // 2. Registro de Usuario (POST /auth/register)
  const manejarRegistro = async (e) => {
    e.preventDefault();
    
    // Validaciones extra antes del submit
    if (emailError) {
      showToast('Corrige el formato del correo electrónico.', 'error');
      return;
    }
    if (authForm.contrasena.length < 8) {
      showToast('La contraseña debe tener al menos 8 caracteres.', 'error');
      return;
    }
    if (authForm.tipo_usuario === 'administrador' && !authForm.token) {
      showToast('Debes ingresar el token para registrarte como administrador.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (res.ok) {
        showToast('¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.', 'success');
        cambiarModoAuth('login');
      } else {
        showToast(data.detail || 'Fallo en el registro de usuario.', 'error');
      }
    } catch (err) {
      showToast('Error de red al registrar usuario.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Inicio de Sesión (POST /auth/login)
  const manejarLogin = async (e) => {
    e.preventDefault();
    
    if (emailError) {
      showToast('Formato de correo electrónico inválido.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: authForm.correo,
          contrasena: authForm.contrasena
        })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.access_token);
        showToast('Sesión iniciada con éxito.', 'success');
        setAuthForm({ nombre: '', correo: '', contrasena: '', tipo_usuario: 'normal', token: '' });
        setEmailError('');
        setPasswordStrength({ score: 0, text: 'Ninguna', class: '' });
        setShowAuthPassword(false);
      } else {
        showToast(data.detail || 'Credenciales incorrectas.', 'error');
      }
    } catch (err) {
      showToast('Error de red al iniciar sesión.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Listar Todos los Usuarios (GET /usuarios/)
  const cargarUsuarios = async () => {
    setIsUsersLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/usuarios/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        showToast('No se pudo cargar la lista de usuarios.', 'error');
      }
    } catch (err) {
      showToast('Error al obtener la lista de usuarios de la base de datos.', 'error');
    } finally {
      setIsUsersLoading(false);
    }
  };

  // 5. Crear Usuario desde CRUD (POST /auth/register)
  const manejarCrearCrud = async (e) => {
    e.preventDefault();
    if (currentUser?.tipo_usuario !== 'administrador') {
      showToast('No tienes permisos para crear usuarios.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(crudForm)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Usuario "${data.nombre}" creado exitosamente.`, 'success');
        setCrudForm({ nombre: '', correo: '', contrasena: '', tipo_usuario: 'normal', token: '' });
        setShowCrudPassword(false);
        cargarUsuarios();
      } else {
        showToast(data.detail || 'No se pudo crear el usuario.', 'error');
      }
    } catch (err) {
      showToast('Error de red al conectar con el servidor.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Cargar datos en el formulario para editar (Modo Editar)
  const iniciarEdicion = (usuario) => {
    if (currentUser?.tipo_usuario !== 'administrador') {
      showToast('No tienes permisos de edición.', 'error');
      return;
    }
    setCrudMode('edit');
    setEditingUserId(usuario.idUsuario);
    setCrudForm({ 
      nombre: usuario.nombre, 
      correo: usuario.correo, 
      contrasena: '', 
      tipo_usuario: usuario.tipo_usuario || 'normal' 
    });
    setShowCrudPassword(false);
  };

  // 7. Modificar Usuario (PUT /usuarios/{id})
  const manejarEditarCrud = async (e) => {
    e.preventDefault();
    if (currentUser?.tipo_usuario !== 'administrador') {
      showToast('No tienes permisos para modificar usuarios.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const bodyPayload = { ...crudForm };
      if (!bodyPayload.contrasena) {
        delete bodyPayload.contrasena;
      }

      const res = await fetch(`${API_BASE_URL}/usuarios/${editingUserId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyPayload)
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Usuario actualizado correctamente.', 'success');
        cancelarEdicion();
        cargarUsuarios();
        if (editingUserId === currentUser?.idUsuario) {
          obtenerPerfilActual();
        }
      } else {
        showToast(data.detail || 'Error al actualizar el usuario.', 'error');
      }
    } catch (err) {
      showToast('Error de conexión al actualizar usuario.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 8. Eliminar Usuario (DELETE /usuarios/{id})
  const manejarEliminar = async (idUsuario) => {
    if (currentUser?.tipo_usuario !== 'administrador') {
      showToast('No tienes permisos para eliminar usuarios.', 'error');
      return;
    }

    if (!confirm('¿Estás seguro de que deseas eliminar este usuario?')) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/usuarios/${idUsuario}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Usuario eliminado exitosamente.', 'success');
        cargarUsuarios();
        if (idUsuario === currentUser?.idUsuario) {
          cerrarSesion();
        }
      } else {
        const data = await res.json();
        showToast(data.detail || 'No se pudo eliminar el usuario.', 'error');
      }
    } catch (err) {
      showToast('Error al conectar con el servidor para eliminar.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const cambiarModoAuth = (modo) => {
    setAuthMode(modo);
    setAuthForm({ nombre: '', correo: '', contrasena: '', tipo_usuario: 'normal', token: '' });
    setEmailError('');
    setPasswordStrength({ score: 0, text: 'Ninguna', class: '' });
    setShowAuthPassword(false);
  };

  const cancelarEdicion = () => {
    setCrudMode('create');
    setEditingUserId(null);
    setCrudForm({ nombre: '', correo: '', contrasena: '', tipo_usuario: 'normal', token: '' });
    setShowCrudPassword(false);
  };

  const cerrarSesion = () => {
    setToken('');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setActiveTab('inicio');
    showToast('Sesión cerrada correctamente.', 'success');
  };

  const salirDelPrograma = () => {
    if (confirm('¿Estás seguro de que deseas salir del programa?')) {
      setToken('');
      setIsAuthenticated(false);
      setCurrentUser(null);
      window.close();
      setTimeout(() => {
        window.location.href = "about:blank";
      }, 300);
    }
  };

  return (
    <div className="container">
      {/* Contenedor Flotante de Toasts */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? <CheckIcon /> : <WarningIcon />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {!isAuthenticated ? (
        // --- FORMULARIO DE ACCESO (LOGIN / REGISTRO) ---
        <div className="auth-box">
          <h2>La Querencia</h2>
          <p className="subtitle">
            {authMode === 'login' 
              ? 'Ingresa tus credenciales para acceder al sistema' 
              : 'Completa los campos para crear un nuevo usuario'}
          </p>

          <form onSubmit={authMode === 'login' ? manejarLogin : manejarRegistro}>
            {authMode === 'register' && (
              <>
                <div className="form-group">
                  <label>Nombre Completo</label>
                  <input
                    type="text"
                    placeholder="Ej. Harry Potter"
                    required
                    disabled={isLoading}
                    value={authForm.nombre}
                    onChange={(e) => setAuthForm({ ...authForm, nombre: e.target.value })}
                  />
                </div>
                
                <div className="form-group">
                  <label>Tipo de Usuario</label>
                  <select
                    value={authForm.tipo_usuario}
                    onChange={(e) => setAuthForm({ ...authForm, tipo_usuario: e.target.value, token: '' })}
                    disabled={isLoading}
                  >
                    <option value="normal">Usuario Normal</option>
                    <option value="administrador">Administrador</option>
                  </select>
                </div>

                {authForm.tipo_usuario === 'administrador' && (
                  <div className="form-group">
                    <label>Token de Invitación / Administrador</label>
                    <input
                      type="password"
                      placeholder="Ingresa tu token de administrador"
                      required
                      disabled={isLoading}
                      value={authForm.token}
                      onChange={(e) => setAuthForm({ ...authForm, token: e.target.value })}
                    />
                  </div>
                )}
              </>
            )}

            <div className="form-group">
              <label>Correo Electrónico</label>
              <input
                type="email"
                placeholder="ejemplo@correo.com"
                required
                disabled={isLoading}
                value={authForm.correo}
                className={emailError ? 'invalid' : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setAuthForm({ ...authForm, correo: val });
                  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (val && !re.test(val)) {
                    setEmailError('Introduce un formato de correo válido (ejemplo@dominio.com)');
                  } else {
                    setEmailError('');
                  }
                }}
              />
              {emailError && <span className="input-error-msg">{emailError}</span>}
            </div>

            <div className="form-group">
              <label>Contraseña</label>
              <div className="input-wrapper">
                <input
                  type={showAuthPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  value={authForm.contrasena}
                  className={authMode === 'register' && authForm.contrasena && passwordStrength.score === 1 ? 'invalid' : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAuthForm({ ...authForm, contrasena: val });
                    if (authMode === 'register') {
                      setPasswordStrength(checkPasswordStrength(val));
                    }
                  }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowAuthPassword(!showAuthPassword)}
                  tabIndex="-1"
                >
                  {showAuthPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {authMode === 'register' && authForm.contrasena && (
                <div className="password-strength">
                  <div className="strength-header">
                    <span className="strength-text">Seguridad: {passwordStrength.text}</span>
                  </div>
                  <div className="strength-bars">
                    <div className={`strength-bar ${passwordStrength.score >= 1 ? passwordStrength.class : ''}`}></div>
                    <div className={`strength-bar ${passwordStrength.score >= 2 ? passwordStrength.class : ''}`}></div>
                    <div className={`strength-bar ${passwordStrength.score >= 3 ? passwordStrength.class : ''}`}></div>
                  </div>
                </div>
              )}
            </div>

            <button 
              type="submit" 
              className="btn" 
              disabled={isLoading || (authMode === 'register' && (emailError || authForm.contrasena.length < 8 || (authForm.tipo_usuario === 'administrador' && !authForm.token)))}
            >
              {isLoading ? <span className="spinner"></span> : null}
              {isLoading 
                ? (authMode === 'login' ? 'Iniciando sesión...' : 'Registrando...') 
                : (authMode === 'login' ? 'Iniciar Sesión' : 'Registrarse')}
            </button>
          </form>

          <div className="toggle-mode">
            {authMode === 'login' ? (
              <>
                ¿No tienes una cuenta?{' '}
                <span className="toggle-link" onClick={() => !isLoading && cambiarModoAuth('register')}>
                  Regístrate aquí
                </span>
              </>
            ) : (
              <>
                ¿Ya tienes una cuenta?{' '}
                <span className="toggle-link" onClick={() => !isLoading && cambiarModoAuth('login')}>
                  Inicia sesión aquí
                </span>
              </>
            )}
            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid var(--glass-border)', textAlign: 'center' }}>
              <span className="toggle-link" style={{ color: 'var(--error)', cursor: 'pointer' }} onClick={salirDelPrograma}>
                Salir del Programa
              </span>
            </div>
          </div>
        </div>
      ) : (
        // --- PANEL DE CONTROL / DASHBOARD ---
        <>
          {/* Barra de Navegación (Menú) */}
          <div className="navbar">
            <span className="navbar-brand">La Querencia</span>
            <div className="nav-links">
              <button 
                className={`nav-btn ${activeTab === 'inicio' ? 'active' : ''}`}
                onClick={() => setActiveTab('inicio')}
              >
                Inicio
              </button>
              <button 
                className={`nav-btn ${activeTab === 'usuarios' ? 'active' : ''}`}
                onClick={() => setActiveTab('usuarios')}
              >
                Gestión de Usuarios
              </button>
              <button 
                className={`nav-btn ${activeTab === 'caja' ? 'active' : ''}`}
                onClick={() => setActiveTab('caja')}
              >
                Gestión de Caja
              </button>
              <button className="nav-btn" onClick={() => showToast('Módulo en desarrollo (Simulado)', 'success')} style={{ opacity: 0.5 }}>
                Configuración
              </button>
            </div>
          </div>

          {/* Encabezado del Perfil */}
          <div className="dashboard-header">
            <div className="user-info">
              <div className="avatar">
                {currentUser?.nombre ? currentUser.nombre.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="user-details">
                <h3>
                  {currentUser?.nombre}{' '}
                  <span className={`role-badge ${currentUser?.tipo_usuario}`}>
                    {currentUser?.tipo_usuario === 'administrador' ? 'Admin' : 'Normal'}
                  </span>
                </h3>
                <p>{currentUser?.correo} (ID: {currentUser?.idUsuario})</p>
              </div>
            </div>
            <div className="header-actions" style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary logout-btn" onClick={cerrarSesion} disabled={isLoading}>
                Cerrar Sesión
              </button>
              <button className="btn btn-danger logout-btn" onClick={salirDelPrograma} disabled={isLoading} style={{ width: 'auto', padding: '10px 20px' }}>
                Salir
              </button>
            </div>
          </div>

          {/* Renderizado de Pestañas */}
          {activeTab === 'inicio' ? (
            // --- VISTA DE INICIO (PANTALLA DE BIENVENIDA) ---
            <div className="home-container">
              <div className="welcome-card">
                <h3>¡Te damos la bienvenida, {currentUser?.nombre}!</h3>
                <p>
                  Has ingresado al panel central de **La Querencia**. Puedes navegar entre los distintos módulos funcionales del sistema mediante la barra de navegación superior.
                </p>
                <p style={{ marginTop: '14px', fontWeight: '500' }}>
                  Nivel de acceso actual:{' '}
                  <span className={`role-badge ${currentUser?.tipo_usuario}`}>
                    {currentUser?.tipo_usuario === 'administrador' ? 'Administrador (Escritura)' : 'Usuario Normal (Solo Lectura)'}
                  </span>
                </p>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-label">Usuarios Registrados</span>
                  <span className="stat-value">{users.length}</span>
                  <span className="stat-description">Total de cuentas guardadas en base de datos</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Permisos de Gestión</span>
                  <span className="stat-value" style={{ fontSize: '1.4rem' }}>
                    {currentUser?.tipo_usuario === 'administrador' ? 'Acceso Total' : 'Solo Lectura'}
                  </span>
                  <span className="stat-description">Define tus operaciones en el sistema</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Estado del Sistema</span>
                  <span className="stat-value" style={{ color: 'var(--success)', fontSize: '1.6rem' }}>Online</span>
                  <span className="stat-description">Conectado a PostgreSQL</span>
                </div>
              </div>
            </div>
          ) : activeTab === 'caja' ? (
            <Caja currentUser={currentUser} token={token} showToast={showToast} />
          ) : (
            // --- VISTA DEL CRUD DE USUARIOS ---
            <div className="dashboard-grid" style={{ gridTemplateColumns: currentUser?.tipo_usuario === 'administrador' ? '300px 1fr' : '1fr' }}>
              {/* Panel de Formulario CRUD (Solo visible para administradores) */}
              {currentUser?.tipo_usuario === 'administrador' && (
                <div className="crud-panel">
                  <h4>{crudMode === 'create' ? 'Crear Nuevo Usuario' : 'Editar Usuario'}</h4>
                  <form onSubmit={crudMode === 'create' ? manejarCrearCrud : manejarEditarCrud}>
                    <div className="form-group">
                      <label>Nombre</label>
                      <input
                        type="text"
                        required
                        disabled={isLoading}
                        value={crudForm.nombre}
                        onChange={(e) => setCrudForm({ ...crudForm, nombre: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Correo Electrónico</label>
                      <input
                        type="email"
                        required
                        disabled={isLoading}
                        value={crudForm.correo}
                        onChange={(e) => setCrudForm({ ...crudForm, correo: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Rol de Usuario</label>
                      <select
                        value={crudForm.tipo_usuario}
                        onChange={(e) => setCrudForm({ ...crudForm, tipo_usuario: e.target.value, token: '' })}
                        disabled={isLoading}
                      >
                        <option value="normal">Usuario Normal</option>
                        <option value="administrador">Administrador</option>
                      </select>
                    </div>

                    {crudMode === 'create' && crudForm.tipo_usuario === 'administrador' && (
                      <div className="form-group">
                        <label>Token de Invitación</label>
                        <input
                          type="text"
                          placeholder="Ingresa el token de invitación"
                          required
                          disabled={isLoading}
                          value={crudForm.token}
                          onChange={(e) => setCrudForm({ ...crudForm, token: e.target.value })}
                        />
                      </div>
                    )}
                    <div className="form-group">
                      <label>Contraseña {crudMode === 'edit' && '(dejar en blanco para no cambiar)'}</label>
                      <div className="input-wrapper">
                        <input
                          type={showCrudPassword ? 'text' : 'password'}
                          placeholder={crudMode === 'edit' ? 'Omitir contraseña...' : '••••••••'}
                          required={crudMode === 'create'}
                          disabled={isLoading}
                          value={crudForm.contrasena}
                          onChange={(e) => setCrudForm({ ...crudForm, contrasena: e.target.value })}
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => setShowCrudPassword(!showCrudPassword)}
                          tabIndex="-1"
                        >
                          {showCrudPassword ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      </div>
                    </div>

                    <button type="submit" className="btn" disabled={isLoading}>
                      {isLoading ? <span className="spinner"></span> : null}
                      {crudMode === 'create' 
                        ? (isLoading ? 'Agregando...' : 'Agregar Usuario') 
                        : (isLoading ? 'Actualizando...' : 'Actualizar Usuario')}
                    </button>

                    {crudMode === 'edit' && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ marginTop: '12px' }}
                        onClick={cancelarEdicion}
                        disabled={isLoading}
                      >
                        Cancelar
                      </button>
                    )}
                  </form>
                </div>
              )}

              {/* Listado de Usuarios (Tabla CRUD) */}
              <div className="users-list-panel">
                {currentUser?.tipo_usuario !== 'administrador' && (
                  <div className="read-only-alert">
                    <WarningIcon />
                    <span>
                      <strong>Modo de solo lectura:</strong> Tu nivel de usuario actual no permite crear, modificar ni eliminar registros en la base de datos de usuarios.
                    </span>
                  </div>
                )}

                <h2 style={{ textAlign: 'left', marginBottom: '20px', fontSize: '1.5rem', color: 'var(--text-main)' }}>
                  Usuarios Registrados ({users.length})
                </h2>
                <div className="users-table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Correo</th>
                        <th>Rol</th>
                        {currentUser?.tipo_usuario === 'administrador' && <th>Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {isUsersLoading ? (
                        <tr>
                          <td colSpan={currentUser?.tipo_usuario === 'administrador' ? 5 : 4} style={{ textAlign: 'center', padding: '40px' }}>
                            <span className="spinner btn-secondary" style={{ width: '24px', height: '24px' }}></span>
                            <p style={{ marginTop: '10px', color: 'var(--text-muted)' }}>Cargando usuarios...</p>
                          </td>
                        </tr>
                      ) : users.length > 0 ? (
                        users.map((u) => (
                          <tr key={u.idUsuario}>
                            <td>{u.idUsuario}</td>
                            <td style={{ fontWeight: '600' }}>{u.nombre}</td>
                            <td style={{ color: 'var(--text-muted)' }}>{u.correo}</td>
                            <td>
                              <span className={`role-badge ${u.tipo_usuario || 'normal'}`}>
                                {u.tipo_usuario === 'administrador' ? 'Admin' : 'Normal'}
                              </span>
                            </td>
                            {currentUser?.tipo_usuario === 'administrador' && (
                              <td className="actions">
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => iniciarEdicion(u)}
                                  disabled={isLoading}
                                >
                                  Editar
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => manejarEliminar(u.idUsuario)}
                                  disabled={isLoading}
                                >
                                  Eliminar
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={currentUser?.tipo_usuario === 'administrador' ? 5 : 4}>
                            <div className="empty-state">
                              <p>No hay usuarios registrados.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;

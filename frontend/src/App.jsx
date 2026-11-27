import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

const REFERENCIAS_RAPIDAS = [
  'Mi celular',
  'Laptop oficina',
  'Equipo soporte',
  'Entrega en terreno'
];

const EXPIRACIONES_RAPIDAS = [
  { label: '15 min', valor: 15 },
  { label: '30 min', valor: 30 },
  { label: '1 hora', valor: 60 },
  { label: '4 horas', valor: 240 },
  { label: '24 horas', valor: 1440 }
];

const ESTADO_INFO = {
  PENDIENTE: {
    texto: 'Sin sincronizar',
    subtexto: 'Esperando respuesta',
    clase: 'pendiente',
    icono: '◌',
    ayuda: 'Comparte el enlace y pide que presionen "Compartir mi ubicación".'
  },
  COMPLETADO: {
    texto: 'Sincronizado',
    subtexto: 'Ubicación recibida',
    clase: 'completado',
    icono: '✓',
    ayuda: 'El equipo ya compartió su ubicación correctamente.'
  },
  EXPIRADO: {
    texto: 'Vencido',
    subtexto: 'Sin sincronizar a tiempo',
    clase: 'expirado',
    icono: '✕',
    ayuda: 'El tiempo límite terminó. Puedes generar uno nuevo con un clic.'
  }
};

function formatearFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

function formatearHora(date) {
  if (!date) return '—';
  return date.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function tiempoRestante(isoExpiracion, ahoraMs) {
  if (!isoExpiracion) return '';
  const diffMs = new Date(isoExpiracion).getTime() - ahoraMs;
  if (diffMs <= 0) return 'Vencido';
  const mins = Math.ceil(diffMs / 60000);
  if (mins < 60) return `Vence en ${mins} min`;
  const horas = Math.floor(mins / 60);
  const resto = mins % 60;
  return resto > 0 ? `Vence en ${horas} h ${resto} min` : `Vence en ${horas} h`;
}

function describirPrecision(metros) {
  if (metros == null) return null;
  const m = Math.round(metros);
  if (m <= 30) return { nivel: 'Alta precisión', detalle: `~${m} m`, clase: 'alta' };
  if (m <= 150) return { nivel: 'Precisión media', detalle: `~${m} m`, clase: 'media' };
  return { nivel: 'Ubicación aproximada', detalle: `~${m} m`, clase: 'baja' };
}

function construirUrlEmbedOsm(lat, lon) {
  const delta = 0.006;
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lon}`;
}

export default function App() {
  const [etiqueta, setEtiqueta] = useState('');
  const [correoDestino, setCorreoDestino] = useState('');
  const [minutosExpiracion, setMinutosExpiracion] = useState(30);

  const [enlaces, setEnlaces] = useState([]);
  const [seccionActiva, setSeccionActiva] = useState('RESUMEN'); // RESUMEN | PENDIENTE | COMPLETADO | EXPIRADO | CREAR
  const [busqueda, setBusqueda] = useState('');
  const [mapaAbiertoToken, setMapaAbiertoToken] = useState(null);
  const [mostrarVencidosEnResumen, setMostrarVencidosEnResumen] = useState(false);

  const [cargandoLista, setCargandoLista] = useState(false);
  const [conectado, setConectado] = useState(true);
  const [ultimaSync, setUltimaSync] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [ultimoCreado, setUltimoCreado] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [mostrarGuia, setMostrarGuia] = useState(false);
  const [ahoraMs, setAhoraMs] = useState(() => Date.now());
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('adminKey') || '');
  const [claveInput, setClaveInput] = useState('');
  const [requiereClave, setRequiereClave] = useState(false);

  const abortRef = useRef(null);
  const formRef = useRef(null);
  const toastTimerRef = useRef(null);

  const mostrarToast = useCallback((texto) => {
    setToast(texto);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const cargarEnlaces = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setCargandoLista(true);
    try {
      const res = await fetch(`${API_BASE}/api/enlaces`, {
        signal: controller.signal,
        headers: adminKey ? { 'X-Admin-Key': adminKey } : {}
      });
      if (res.status === 401) {
        setRequiereClave(true);
        setConectado(true);
        setError('Ingresa la clave del panel para continuar.');
        return;
      }
      if (!res.ok) throw new Error('No se pudo obtener la lista de enlaces');
      const data = await res.json();
      setEnlaces(data);
      setRequiereClave(false);
      setConectado(true);
      setUltimaSync(new Date());
      setError((prev) =>
        prev && (prev.startsWith('No se pudo conectar') || prev.startsWith('Ingresa la clave'))
          ? null
          : prev
      );
    } catch (err) {
      if (err.name === 'AbortError') return;
      setConectado(false);
      setError(`No se pudo conectar con el backend en ${API_BASE || 'http://localhost:8080'}.`);
    } finally {
      if (abortRef.current === controller) {
        setCargandoLista(false);
      }
    }
  }, [adminKey]);

  useEffect(() => {
    cargarEnlaces();
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [cargarEnlaces]);

  useEffect(() => {
    const reloj = setInterval(() => setAhoraMs(Date.now()), 30000);
    return () => clearInterval(reloj);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        cargarEnlaces();
      }
    }, 10000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        cargarEnlaces();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [autoRefresh, cargarEnlaces]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setUltimoCreado(null);
    setEnviando(true);

    try {
      const payload = {
        etiqueta: etiqueta.trim(),
        minutosExpiracion: Number(minutosExpiracion) || 30,
        correoDestino: correoDestino.trim() || null
      };

      const res = await fetch(`${API_BASE}/api/enlaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminKey ? { 'X-Admin-Key': adminKey } : {})
        },
        body: JSON.stringify(payload)
      });
      if (res.status === 401) {
        setRequiereClave(true);
      }

      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: `Error del servidor (HTTP ${res.status}). Verifica que el backend esté activo.` };
      }
      if (!res.ok) {
        const detalle =
          data.error ||
          Object.values(data).join('. ') ||
          'No se pudo crear el enlace.';
        throw new Error(detalle);
      }

      setUltimoCreado(data);
      setEtiqueta('');
      setCorreoDestino('');
      mostrarToast(
        data.correoEnviado
          ? `Enlace enviado a ${data.correoDestino}`
          : 'Enlace creado y listo para compartir'
      );
      await cargarEnlaces();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function copiarTexto(texto, mensajeExito) {
    try {
      await navigator.clipboard.writeText(texto);
      mostrarToast(mensajeExito);
    } catch {
      setError('No se pudo copiar al portapapeles.');
    }
  }

  function abrirCrearSolicitud() {
    setSeccionActiva('CREAR');
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
  }

  function prepararReenvio(item) {
    setEtiqueta(item.etiqueta || '');
    setCorreoDestino(item.correoDestino || '');
    setUltimoCreado(null);
    setSeccionActiva('CREAR');
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
    mostrarToast('Formulario rellenado. Presiona "Crear enlace" para generar uno nuevo.');
  }

  const contadores = useMemo(() => {
    return enlaces.reduce(
      (acc, item) => {
        acc.TODOS += 1;
        if (acc[item.estado] !== undefined) acc[item.estado] += 1;
        return acc;
      },
      { TODOS: 0, PENDIENTE: 0, COMPLETADO: 0, EXPIRADO: 0 }
    );
  }, [enlaces]);

  const enlacesPorBusqueda = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return enlaces;
    return enlaces.filter(
      (item) =>
        (item.etiqueta && item.etiqueta.toLowerCase().includes(q)) ||
        (item.correoDestino && item.correoDestino.toLowerCase().includes(q)) ||
        (item.token && item.token.toLowerCase().includes(q))
    );
  }, [enlaces, busqueda]);

  const grupos = useMemo(() => {
    return {
      PENDIENTE: enlacesPorBusqueda.filter((i) => i.estado === 'PENDIENTE'),
      COMPLETADO: enlacesPorBusqueda.filter((i) => i.estado === 'COMPLETADO'),
      EXPIRADO: enlacesPorBusqueda.filter((i) => i.estado === 'EXPIRADO')
    };
  }, [enlacesPorBusqueda]);

  const porcentajeSincronizados = useMemo(() => {
    const activos = contadores.PENDIENTE + contadores.COMPLETADO;
    if (activos === 0) return 0;
    return Math.round((contadores.COMPLETADO / activos) * 100);
  }, [contadores]);

  const urlWhatsApp = (item) =>
    `https://wa.me/?text=${encodeURIComponent(
      `Hola, por favor abre este enlace para compartir tu ubicación (${item.etiqueta}): ${item.urlCompartir}`
    )}`;

  function renderEnlaceCard(item) {
    const info = ESTADO_INFO[item.estado] || {
      texto: item.estado,
      clase: 'pendiente',
      icono: '•',
      ayuda: ''
    };
    const precision = describirPrecision(item.precisionMetros);
    const mapaVisible = mapaAbiertoToken === item.token;
    const urlGoogleMaps =
      item.latitud != null && item.longitud != null
        ? `https://www.google.com/maps?q=${item.latitud},${item.longitud}`
        : null;

    return (
      <article key={item.token} className={`enlace-item item-${info.clase}`}>
        <div className="enlace-top">
          <div className="enlace-title-group">
            <span className={`status-indicator status-${info.clase}`} aria-hidden="true">
              {info.icono}
            </span>
            <strong className="enlace-title">{item.etiqueta}</strong>
            <span className={`badge badge-${info.clase}`}>{info.texto}</span>
            {item.correoEnviado && item.correoDestino && (
              <span className="badge badge-mail" title={`Enviado por correo a ${item.correoDestino}`}>
                ✉ {item.correoDestino}
              </span>
            )}
          </div>
          <span className="meta">Creado: {formatearFecha(item.fechaCreacion)}</span>
        </div>

        <p className="item-ayuda">{info.ayuda}</p>

        {item.estado === 'PENDIENTE' && (
          <>
            <div className="url-row">
              <code>{item.urlCompartir}</code>
            </div>
            <div className="item-actions">
              <button
                type="button"
                className="btn-action btn-action-primary"
                onClick={() => copiarTexto(item.urlCompartir, 'Enlace copiado')}
              >
                Copiar enlace
              </button>
              <a
                href={urlWhatsApp(item)}
                target="_blank"
                rel="noreferrer"
                className="btn-action btn-whatsapp"
              >
                WhatsApp
              </a>
              <a
                href={item.urlCompartir}
                target="_blank"
                rel="noreferrer"
                className="btn-action"
              >
                Abrir enlace
              </a>
              <span className="countdown">
                {tiempoRestante(item.fechaExpiracion, ahoraMs)}
              </span>
            </div>
          </>
        )}

        {item.estado === 'COMPLETADO' && (
          <div className="coords-panel">
            <div className="coords-info">
              <div className="coords-line">
                <strong>Coordenadas:</strong>{' '}
                <span className="coords-val">
                  {item.latitud.toFixed(6)}, {item.longitud.toFixed(6)}
                </span>
                {precision && (
                  <span className={`precision-pill prec-${precision.clase}`}>
                    {precision.nivel} ({precision.detalle})
                  </span>
                )}
              </div>
              <div className="meta">Recibida el {formatearFecha(item.fechaCaptura)}</div>
            </div>

            <div className="item-actions">
              <button
                type="button"
                className="btn-action btn-map"
                onClick={() => setMapaAbiertoToken(mapaVisible ? null : item.token)}
              >
                {mapaVisible ? 'Ocultar mapa' : 'Ver mapa aquí'}
              </button>
              {item.urlMapa && (
                <a
                  href={item.urlMapa}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-action"
                >
                  OpenStreetMap ↗
                </a>
              )}
              {urlGoogleMaps && (
                <a
                  href={urlGoogleMaps}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-action"
                >
                  Google Maps ↗
                </a>
              )}
              <button
                type="button"
                className="btn-action"
                onClick={() =>
                  copiarTexto(`${item.latitud}, ${item.longitud}`, 'Coordenadas copiadas')
                }
              >
                Copiar coordenadas
              </button>
            </div>

            {mapaVisible && (
              <div className="map-embed-wrap">
                <iframe
                  title={`Mapa de ${item.etiqueta}`}
                  src={construirUrlEmbedOsm(item.latitud, item.longitud)}
                  loading="lazy"
                />
              </div>
            )}
          </div>
        )}

        {item.estado === 'EXPIRADO' && (
          <div className="item-actions">
            <span className="meta">Venció el {formatearFecha(item.fechaExpiracion)}</span>
            <button
              type="button"
              className="btn-action btn-action-primary"
              onClick={() => prepararReenvio(item)}
            >
              Crear uno nuevo igual
            </button>
          </div>
        )}
      </article>
    );
  }

  const navSecciones = [
    {
      key: 'RESUMEN',
      titulo: 'Panel General',
      desc: 'Vista dividida',
      count: contadores.TODOS,
      tone: 'neutral',
      icono: '◫'
    },
    {
      key: 'PENDIENTE',
      titulo: 'Sin sincronizar',
      desc: 'Esperando GPS',
      count: contadores.PENDIENTE,
      tone: 'pendiente',
      icono: '◌'
    },
    {
      key: 'COMPLETADO',
      titulo: 'Sincronizados',
      desc: 'Con ubicación',
      count: contadores.COMPLETADO,
      tone: 'completado',
      icono: '✓'
    },
    {
      key: 'EXPIRADO',
      titulo: 'Vencidos',
      desc: 'Historial',
      count: contadores.EXPIRADO,
      tone: 'expirado',
      icono: '✕'
    },
    {
      key: 'CREAR',
      titulo: 'Nueva solicitud',
      desc: 'Generar enlace',
      count: null,
      tone: 'crear',
      icono: '＋'
    }
  ];

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <img src="/img/max_andres_head_256.webp" alt="Logo Geolocalizador" className="brand-icon" />
            <div>
              <h1>Geolocalizador</h1>
              <p className="subtitle">
                Control de ubicaciones con consentimiento · Separa al instante equipos sincronizados y pendientes.
              </p>
            </div>
          </div>

          <div className="topbar-right">
            <span className={`conn-pill ${conectado ? 'conn-ok' : 'conn-off'}`}>
              <span className="dot" />
              {conectado ? 'Servidor activo' : 'Sin conexión'}
            </span>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setMostrarGuia((v) => !v)}
            >
              {mostrarGuia ? 'Ocultar guía' : '¿Cómo funciona?'}
            </button>
            <button
              type="button"
              className={`btn-topbar-cta ${seccionActiva === 'CREAR' ? 'btn-topbar-cta-active' : ''}`}
              onClick={abrirCrearSolicitud}
            >
              ＋ Nueva solicitud
            </button>
          </div>
        </div>
      </header>

      <main className="container">
        {requiereClave && (
          <section className="card auth-card" aria-label="Acceso al panel">
            <div className="card-head">
              <h2>🔒 Acceso al panel</h2>
              <span className="hint-badge">Protegido por clave</span>
            </div>
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                const limpia = claveInput.trim();
                sessionStorage.setItem('adminKey', limpia);
                setAdminKey(limpia);
                setClaveInput('');
              }}
            >
              <div className="field">
                <label htmlFor="admin-key">Clave de administrador</label>
                <input
                  id="admin-key"
                  type="password"
                  placeholder="Ingresa APP_ADMIN_KEY"
                  value={claveInput}
                  onChange={(e) => setClaveInput(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-primary">
                Desbloquear panel
              </button>
            </form>
          </section>
        )}

        {mostrarGuia && (
          <section className="card guide-card" aria-label="Cómo funciona">
            <div className="card-head">
              <h2>Cómo funciona en 3 pasos</h2>
              <button
                type="button"
                className="btn-dismiss"
                onClick={() => setMostrarGuia(false)}
                aria-label="Cerrar guía"
              >
                ✕
              </button>
            </div>
            <div className="steps-grid">
              <div className="step-box">
                <span className="step-num">1</span>
                <strong>Crea la solicitud</strong>
                <p>En <em>Nueva solicitud</em> escribe un nombre y opcionalmente un correo. El enlace entra a <strong>Sin sincronizar</strong>.</p>
              </div>
              <div className="step-box">
                <span className="step-num">2</span>
                <strong>La persona acepta</strong>
                <p>Al abrir el enlace verá el motivo, presionará <em>Compartir mi ubicación</em> y aceptará el permiso del navegador.</p>
              </div>
              <div className="step-box">
                <span className="step-num">3</span>
                <strong>Pasa a Sincronizados</strong>
                <p>Automáticamente se mueve a la sección <strong>Sincronizados</strong> con coordenadas, precisión y mapa interactivo.</p>
              </div>
            </div>
          </section>
        )}

        {/* Navegación principal por secciones (Ley de Fitts: objetivos grandes >= 76px con contador claro) */}
        <nav className="workspace-nav" aria-label="Secciones del panel">
          {navSecciones.map((sec) => (
            <button
              key={sec.key}
              type="button"
              className={`nav-tile nav-tone-${sec.tone} ${seccionActiva === sec.key ? 'nav-tile-active' : ''}`}
              onClick={() => setSeccionActiva(sec.key)}
              aria-current={seccionActiva === sec.key ? 'page' : undefined}
            >
              <div className="nav-tile-top">
                <span className="nav-tile-icon" aria-hidden="true">{sec.icono}</span>
                {sec.count !== null && (
                  <span className="nav-tile-count">{sec.count}</span>
                )}
              </div>
              <span className="nav-tile-title">{sec.titulo}</span>
              <span className="nav-tile-desc">{sec.desc}</span>
            </button>
          ))}
        </nav>

        {error && <div className="alert alert-error alert-global" role="alert">{error}</div>}

        {/* Barra de sincronización y búsqueda (visible en vistas de seguimiento) */}
        {seccionActiva !== 'CREAR' && (
          <section className="toolbar-card" aria-label="Controles de búsqueda y sincronización">
            <div className="toolbar-left">
              <div className="search-wrap">
                <input
                  type="search"
                  placeholder="Buscar equipo, correo o token en todas las secciones..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  aria-label="Buscar enlaces"
                />
                {busqueda && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setBusqueda('')}
                  >
                    Limpiar
                  </button>
                )}
              </div>
              {(contadores.PENDIENTE + contadores.COMPLETADO) > 0 && (
                <div className="sync-progress" title="Progreso de enlaces activos sincronizados">
                  <div className="sync-progress-labels">
                    <span>Tasa de sincronización activa</span>
                    <strong>{porcentajeSincronizados}% ({contadores.COMPLETADO}/{contadores.PENDIENTE + contadores.COMPLETADO})</strong>
                  </div>
                  <div className="sync-progress-track" role="progressbar" aria-valuenow={porcentajeSincronizados} aria-valuemin={0} aria-valuemax={100}>
                    <div className="sync-progress-fill" style={{ width: `${porcentajeSincronizados}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="toolbar-right">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                Auto-sync (10s)
              </label>
              <button
                type="button"
                className="btn-secondary"
                onClick={cargarEnlaces}
                disabled={cargandoLista}
              >
                {cargandoLista ? 'Actualizando...' : '↻ Actualizar'}
              </button>
              {ultimaSync && (
                <span className="sync-time">Última: {formatearHora(ultimaSync)}</span>
              )}
            </div>
          </section>
        )}

        {/* SECCIÓN: NUEVA SOLICITUD */}
        {seccionActiva === 'CREAR' && (
          <section className="card form-card" ref={formRef}>
            <div className="section-banner banner-crear">
              <div className="section-banner-title">
                <span className="section-banner-icon" aria-hidden="true">＋</span>
                <div>
                  <h2>Crear nueva solicitud de ubicación</h2>
                  <p>Al generarlo, el enlace aparecerá en <strong>Sin sincronizar</strong> hasta que el equipo acepte el permiso.</p>
                </div>
              </div>
              <span className="hint-badge">Enlace de un solo uso</span>
            </div>

            <form onSubmit={handleSubmit} className="form">
              <div className="field">
                <label htmlFor="etiqueta">¿De qué equipo o persona es esta solicitud? *</label>
                <input
                  id="etiqueta"
                  type="text"
                  placeholder="Ej. Celular de Juan, Laptop oficina, Pedido #104..."
                  value={etiqueta}
                  onChange={(e) => setEtiqueta(e.target.value)}
                  required
                />
                <div className="chip-row" aria-label="Sugerencias rápidas">
                  {REFERENCIAS_RAPIDAS.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      className={`chip ${etiqueta === sug ? 'chip-active' : ''}`}
                      onClick={() => setEtiqueta(sug)}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>¿Cuánto tiempo estará activo el enlace?</label>
                <div className="preset-row">
                  {EXPIRACIONES_RAPIDAS.map((opt) => (
                    <button
                      key={opt.valor}
                      type="button"
                      className={`preset-btn ${Number(minutosExpiracion) === opt.valor ? 'preset-active' : ''}`}
                      onClick={() => setMinutosExpiracion(opt.valor)}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <label className="custom-min" title="Minutos personalizados">
                    <input
                      id="minutos"
                      type="number"
                      min="1"
                      max="1440"
                      value={minutosExpiracion}
                      onChange={(e) => setMinutosExpiracion(e.target.value)}
                      aria-label="Minutos personalizados"
                    />
                    <span>min</span>
                  </label>
                </div>
              </div>

              <div className="field">
                <label htmlFor="correo">Enviar por correo automáticamente (opcional)</label>
                <input
                  id="correo"
                  type="email"
                  placeholder="persona@gmail.com (déjalo vacío si prefieres copiar el enlace)"
                  value={correoDestino}
                  onChange={(e) => setCorreoDestino(e.target.value)}
                />
                <small>
                  Si escribes un correo, el sistema lo enviará enseguida por Gmail. Si lo dejas vacío, podrás copiarlo o enviarlo por WhatsApp.
                </small>
              </div>

              <div className="form-submit-row">
                <button type="submit" className="btn-primary" disabled={enviando}>
                  {enviando
                    ? 'Creando enlace...'
                    : correoDestino.trim()
                      ? 'Crear enlace y enviar por correo'
                      : 'Crear enlace ahora'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSeccionActiva('RESUMEN')}
                >
                  Volver al Panel General
                </button>
              </div>
            </form>

            {ultimoCreado && (
              <div className="ready-box" role="status">
                <div className="ready-head">
                  <strong>
                    {ultimoCreado.correoEnviado
                      ? `Enlace creado y enviado a ${ultimoCreado.correoDestino}`
                      : '¡Tu enlace está listo para compartir!'}
                  </strong>
                  <button
                    type="button"
                    className="btn-dismiss"
                    onClick={() => setUltimoCreado(null)}
                    aria-label="Cerrar aviso"
                  >
                    ✕
                  </button>
                </div>
                <code className="ready-url">{ultimoCreado.urlCompartir}</code>
                <div className="ready-actions">
                  <button
                    type="button"
                    className="btn-action btn-action-primary"
                    onClick={() => copiarTexto(ultimoCreado.urlCompartir, 'Enlace copiado al portapapeles')}
                  >
                    Copiar enlace
                  </button>
                  <a
                    href={urlWhatsApp(ultimoCreado)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-action btn-whatsapp"
                  >
                    Enviar por WhatsApp
                  </a>
                  <a
                    href={ultimoCreado.urlCompartir}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-action"
                  >
                    Probar enlace
                  </a>
                  <button
                    type="button"
                    className="btn-action"
                    onClick={() => setSeccionActiva('PENDIENTE')}
                  >
                    Ver en Sin sincronizar →
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* SECCIÓN: PANEL GENERAL (VISTA DIVIDIDA SIN SINCRONIZAR vs SINCRONIZADOS) */}
        {seccionActiva === 'RESUMEN' && (
          <>
            <div className="split-board">
              {/* Columna Izquierda: Sin sincronizar */}
              <section className="card board-column board-pendiente" aria-label="Equipos sin sincronizar">
                <div className="section-banner banner-pendiente">
                  <div className="section-banner-title">
                    <span className="section-banner-icon pulse-dot" aria-hidden="true">◌</span>
                    <div>
                      <h2>Sin sincronizar ({grupos.PENDIENTE.length})</h2>
                      <p>Enlaces activos esperando que el usuario comparta su ubicación.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-mini"
                    onClick={() => setSeccionActiva('PENDIENTE')}
                  >
                    Ampliar →
                  </button>
                </div>

                {grupos.PENDIENTE.length === 0 ? (
                  <div className="empty-state">
                    <p>
                      {busqueda
                        ? 'No hay enlaces sin sincronizar que coincidan con tu búsqueda.'
                        : 'No tienes solicitudes pendientes en este momento.'}
                    </p>
                    {!busqueda && (
                      <button
                        type="button"
                        className="btn-action btn-action-primary empty-cta"
                        onClick={abrirCrearSolicitud}
                      >
                        ＋ Crear nueva solicitud
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="list">
                    {grupos.PENDIENTE.map(renderEnlaceCard)}
                  </div>
                )}
              </section>

              {/* Columna Derecha: Sincronizados */}
              <section className="card board-column board-completado" aria-label="Equipos sincronizados">
                <div className="section-banner banner-completado">
                  <div className="section-banner-title">
                    <span className="section-banner-icon" aria-hidden="true">✓</span>
                    <div>
                      <h2>Sincronizados ({grupos.COMPLETADO.length})</h2>
                      <p>Equipos que ya enviaron sus coordenadas y están listos en mapa.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-mini"
                    onClick={() => setSeccionActiva('COMPLETADO')}
                  >
                    Ampliar →
                  </button>
                </div>

                {grupos.COMPLETADO.length === 0 ? (
                  <div className="empty-state">
                    <p>
                      {busqueda
                        ? 'No hay equipos sincronizados que coincidan con tu búsqueda.'
                        : 'Aún no hay ubicaciones recibidas. Aparecerán aquí apenas alguien acepte el permiso.'}
                    </p>
                  </div>
                ) : (
                  <div className="list">
                    {grupos.COMPLETADO.map(renderEnlaceCard)}
                  </div>
                )}
              </section>
            </div>

            {/* Franja colapsable de vencidos para no ensuciar el trabajo activo */}
            {grupos.EXPIRADO.length > 0 && (
              <section className="card expired-drawer" aria-label="Enlaces vencidos">
                <div className="expired-drawer-head">
                  <div className="section-banner-title">
                    <span className="section-banner-icon icon-expirado" aria-hidden="true">✕</span>
                    <div>
                      <h2>Vencidos sin sincronizar ({grupos.EXPIRADO.length})</h2>
                      <p>Enlaces cuyo tiempo límite terminó. Puedes reenviarlos con 1 clic.</p>
                    </div>
                  </div>
                  <div className="expired-drawer-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setMostrarVencidosEnResumen((v) => !v)}
                    >
                      {mostrarVencidosEnResumen ? 'Ocultar lista' : `Mostrar (${grupos.EXPIRADO.length})`}
                    </button>
                    <button
                      type="button"
                      className="btn-mini"
                      onClick={() => setSeccionActiva('EXPIRADO')}
                    >
                      Ir a Vencidos →
                    </button>
                  </div>
                </div>

                {mostrarVencidosEnResumen && (
                  <div className="list expired-drawer-list">
                    {grupos.EXPIRADO.map(renderEnlaceCard)}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {/* SECCIÓN DEDICADA: SIN SINCRONIZAR */}
        {seccionActiva === 'PENDIENTE' && (
          <section className="card board-column board-pendiente" aria-label="Sección sin sincronizar">
            <div className="section-banner banner-pendiente">
              <div className="section-banner-title">
                <span className="section-banner-icon pulse-dot" aria-hidden="true">◌</span>
                <div>
                  <h2>Sin sincronizar ({grupos.PENDIENTE.length})</h2>
                  <p>Solicitudes activas esperando que el equipo abra el enlace y comparta su ubicación.</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-action btn-action-primary"
                onClick={abrirCrearSolicitud}
              >
                ＋ Nueva solicitud
              </button>
            </div>

            {grupos.PENDIENTE.length === 0 ? (
              <div className="empty-state">
                <p>
                  {busqueda
                    ? 'Ningún enlace sin sincronizar coincide con tu búsqueda.'
                    : '¡Todo al día! No hay solicitudes esperando respuesta.'}
                </p>
              </div>
            ) : (
              <div className="list">{grupos.PENDIENTE.map(renderEnlaceCard)}</div>
            )}
          </section>
        )}

        {/* SECCIÓN DEDICADA: SINCRONIZADOS */}
        {seccionActiva === 'COMPLETADO' && (
          <section className="card board-column board-completado" aria-label="Sección sincronizados">
            <div className="section-banner banner-completado">
              <div className="section-banner-title">
                <span className="section-banner-icon" aria-hidden="true">✓</span>
                <div>
                  <h2>Sincronizados ({grupos.COMPLETADO.length})</h2>
                  <p>Equipos cuya ubicación ya fue capturada. Abre el mapa integrado o copia sus coordenadas.</p>
                </div>
              </div>
            </div>

            {grupos.COMPLETADO.length === 0 ? (
              <div className="empty-state">
                <p>
                  {busqueda
                    ? 'Ningún equipo sincronizado coincide con tu búsqueda.'
                    : 'Todavía no hay equipos sincronizados.'}
                </p>
              </div>
            ) : (
              <div className="list">{grupos.COMPLETADO.map(renderEnlaceCard)}</div>
            )}
          </section>
        )}

        {/* SECCIÓN DEDICADA: VENCIDOS */}
        {seccionActiva === 'EXPIRADO' && (
          <section className="card board-column board-expirado" aria-label="Sección vencidos">
            <div className="section-banner banner-expirado">
              <div className="section-banner-title">
                <span className="section-banner-icon icon-expirado" aria-hidden="true">✕</span>
                <div>
                  <h2>Historial vencido ({grupos.EXPIRADO.length})</h2>
                  <p>Enlaces que expiraron antes de ser sincronizados. Usa "Crear uno nuevo igual" para reenviar.</p>
                </div>
              </div>
            </div>

            {grupos.EXPIRADO.length === 0 ? (
              <div className="empty-state">
                <p>
                  {busqueda
                    ? 'Ningún enlace vencido coincide con tu búsqueda.'
                    : 'No tienes enlaces vencidos.'}
                </p>
              </div>
            ) : (
              <div className="list">{grupos.EXPIRADO.map(renderEnlaceCard)}</div>
            )}
          </section>
        )}
      </main>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}

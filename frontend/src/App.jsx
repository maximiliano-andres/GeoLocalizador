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
    texto: 'Esperando respuesta',
    clase: 'pendiente',
    ayuda: 'Comparte el enlace y pide que presionen "Compartir mi ubicación".'
  },
  COMPLETADO: {
    texto: 'Ubicación recibida',
    clase: 'completado',
    ayuda: 'El equipo ya compartió su ubicación correctamente.'
  },
  EXPIRADO: {
    texto: 'Enlace vencido',
    clase: 'expirado',
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
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [mapaAbiertoToken, setMapaAbiertoToken] = useState(null);

  const [cargandoLista, setCargandoLista] = useState(false);
  const [conectado, setConectado] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [ultimoCreado, setUltimoCreado] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [mostrarGuia, setMostrarGuia] = useState(false);
  const [ahoraMs, setAhoraMs] = useState(() => Date.now());

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
        signal: controller.signal
      });
      if (!res.ok) throw new Error('No se pudo obtener la lista de enlaces');
      const data = await res.json();
      setEnlaces(data);
      setConectado(true);
      setError((prev) =>
        prev && prev.startsWith('No se pudo conectar') ? null : prev
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
  }, []);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

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

  function prepararReenvio(item) {
    setEtiqueta(item.etiqueta || '');
    setCorreoDestino(item.correoDestino || '');
    setUltimoCreado(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const enlacesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return enlaces.filter((item) => {
      if (filtroEstado !== 'TODOS' && item.estado !== filtroEstado) return false;
      if (!q) return true;
      return (
        (item.etiqueta && item.etiqueta.toLowerCase().includes(q)) ||
        (item.correoDestino && item.correoDestino.toLowerCase().includes(q)) ||
        (item.token && item.token.toLowerCase().includes(q))
      );
    });
  }, [enlaces, filtroEstado, busqueda]);

  const urlWhatsApp = (item) =>
    `https://wa.me/?text=${encodeURIComponent(
      `Hola, por favor abre este enlace para compartir tu ubicación (${item.etiqueta}): ${item.urlCompartir}`
    )}`;

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <img src="/img/max_andres_head_256.webp" alt="Icono" className="brand-icon" />
            <div>
              <h1>Geolocalizador</h1>
              <p className="subtitle">
                Solicita la ubicación de un equipo con consentimiento en 3 pasos simples.
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
          </div>
        </div>
      </header>

      <main className="container">
        {mostrarGuia && (
          <section className="card guide-card" aria-label="Cómo funciona">
            <h2>Cómo funciona en 3 pasos</h2>
            <div className="steps-grid">
              <div className="step-box">
                <span className="step-num">1</span>
                <strong>Crea el enlace</strong>
                <p>Escribe un nombre fácil de recordar (o elige una sugerencia) y opcionalmente un correo.</p>
              </div>
              <div className="step-box">
                <span className="step-num">2</span>
                <strong>La persona acepta</strong>
                <p>Al abrir el enlace, verá el motivo y deberá presionar <em>Compartir mi ubicación</em> y aceptar el permiso.</p>
              </div>
              <div className="step-box">
                <span className="step-num">3</span>
                <strong>Ve el mapa aquí</strong>
                <p>En pocos segundos verás el estado en verde, la precisión estimada y el mapa interactivo.</p>
              </div>
            </div>
          </section>
        )}

        {/* KPI interactivos (Ley de Fitts: objetivos amplios para filtrar con 1 clic) */}
        <section className="kpi-grid" aria-label="Resumen por estado">
          {[
            { key: 'TODOS', label: 'Todos los enlaces', tone: 'neutral' },
            { key: 'PENDIENTE', label: 'Esperando respuesta', tone: 'pendiente' },
            { key: 'COMPLETADO', label: 'Ubicación recibida', tone: 'completado' },
            { key: 'EXPIRADO', label: 'Vencidos', tone: 'expirado' }
          ].map((kpi) => (
            <button
              key={kpi.key}
              type="button"
              className={`kpi-card kpi-${kpi.tone} ${filtroEstado === kpi.key ? 'kpi-active' : ''}`}
              onClick={() => setFiltroEstado(kpi.key)}
            >
              <span className="kpi-value">{contadores[kpi.key]}</span>
              <span className="kpi-label">{kpi.label}</span>
            </button>
          ))}
        </section>

        {/* Formulario principal */}
        <section className="card form-card" ref={formRef}>
          <div className="card-head">
            <h2>1. Crear enlace de ubicación</h2>
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

            <button type="submit" className="btn-primary" disabled={enviando}>
              {enviando
                ? 'Creando enlace...'
                : correoDestino.trim()
                  ? 'Crear enlace y enviar por correo'
                  : 'Crear enlace ahora'}
            </button>
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
              </div>
            </div>
          )}

          {error && <div className="alert alert-error" role="alert">{error}</div>}
        </section>

        {/* Listado de enlaces */}
        <section className="card">
          <div className="section-header">
            <div>
              <h2>2. Seguimiento de enlaces ({enlacesFiltrados.length})</h2>
              <p className="section-sub">
                {filtroEstado === 'TODOS'
                  ? 'Mostrando del más reciente al más antiguo.'
                  : `Filtro activo: ${ESTADO_INFO[filtroEstado]?.texto}.`}
              </p>
            </div>

            <div className="actions">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                Auto-actualizar (10s)
              </label>
              <button
                type="button"
                className="btn-secondary"
                onClick={cargarEnlaces}
                disabled={cargandoLista}
              >
                {cargandoLista ? 'Actualizando...' : 'Actualizar ahora'}
              </button>
            </div>
          </div>

          {enlaces.length > 0 && (
            <div className="search-bar">
              <input
                type="search"
                placeholder="Buscar por nombre de equipo o correo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                aria-label="Buscar enlaces"
              />
              {(busqueda || filtroEstado !== 'TODOS') && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setBusqueda('');
                    setFiltroEstado('TODOS');
                  }}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}

          {enlacesFiltrados.length === 0 ? (
            <div className="empty-state">
              <p>
                {enlaces.length === 0
                  ? 'Todavía no has creado ningún enlace. Usa el formulario de arriba para generar el primero.'
                  : 'No hay enlaces que coincidan con tu filtro o búsqueda.'}
              </p>
            </div>
          ) : (
            <div className="list">
              {enlacesFiltrados.map((item) => {
                const info = ESTADO_INFO[item.estado] || {
                  texto: item.estado,
                  clase: 'pendiente',
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
                        <strong className="enlace-title">{item.etiqueta}</strong>
                        <span className={`badge badge-${info.clase}`}>{info.texto}</span>
                        {item.correoEnviado && item.correoDestino && (
                          <span className="badge badge-mail" title={`Enviado por correo a ${item.correoDestino}`}>
                            ✉ {item.correoDestino}
                          </span>
                        )}
                      </div>
                      <span className="meta">
                        Creado: {formatearFecha(item.fechaCreacion)}
                      </span>
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
                          <div className="meta">
                            Recibida el {formatearFecha(item.fechaCaptura)}
                          </div>
                        </div>

                        <div className="item-actions">
                          <button
                            type="button"
                            className="btn-action btn-map"
                            onClick={() =>
                              setMapaAbiertoToken(mapaVisible ? null : item.token)
                            }
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
                              copiarTexto(
                                `${item.latitud}, ${item.longitud}`,
                                'Coordenadas copiadas'
                              )
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
                        <span className="meta">
                          Venció el {formatearFecha(item.fechaExpiracion)}
                        </span>
                        <button
                          type="button"
                          className="btn-action"
                          onClick={() => prepararReenvio(item)}
                        >
                          Crear uno nuevo igual
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}

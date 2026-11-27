import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapaInteractivo from './components/MapaInteractivo.jsx';

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
    clase: 'pendiente',
    icono: '◌',
    ayuda: 'Esperando que el usuario abra el enlace y acepte el permiso.'
  },
  COMPLETADO: {
    texto: 'Sincronizado',
    clase: 'completado',
    icono: '✓',
    ayuda: 'Ubicación capturada y lista en el mapa.'
  },
  EXPIRADO: {
    texto: 'Vencido',
    clase: 'expirado',
    icono: '✕',
    ayuda: 'El enlace venció sin recibir respuesta.'
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
    minute: '2-digit'
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
  return { nivel: 'Aproximada', detalle: `~${m} m`, clase: 'baja' };
}

function construirUrlEmbedOsm(lat, lon) {
  const delta = 0.005;
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lon}`;
}

export default function App() {
  const [etiqueta, setEtiqueta] = useState('');
  const [correoDestino, setCorreoDestino] = useState('');
  const [minutosExpiracion, setMinutosExpiracion] = useState(30);

  const [enlaces, setEnlaces] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroMetrica, setFiltroMetrica] = useState('TODOS'); // TODOS | COMPLETADO | PENDIENTE | EXPIRADO
  const [seleccionadoToken, setSeleccionadoToken] = useState(null);
  const [verTodosEnMapa, setVerTodosEnMapa] = useState(false);
  const [accionEnCursoToken, setAccionEnCursoToken] = useState(null);

  // Control de secciones colapsables por estado
  const [seccionesAbiertas, setSeccionesAbiertas] = useState({
    COMPLETADO: true,
    PENDIENTE: true,
    EXPIRADO: false
  });

  // Control de visibilidad individual por dispositivo (token -> boolean)
  const [dispositivosAbiertos, setDispositivosAbiertos] = useState({});

  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [mostrarGuia, setMostrarGuia] = useState(false);

  const [cargandoLista, setCargandoLista] = useState(false);
  const [conectado, setConectado] = useState(true);
  const [ultimaSync, setUltimaSync] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [ultimoCreado, setUltimoCreado] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [ahoraMs, setAhoraMs] = useState(() => Date.now());
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('adminKey') || '');
  const [claveInput, setClaveInput] = useState('');
  const [requiereClave, setRequiereClave] = useState(false);

  const abortRef = useRef(null);
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

  // Cerrar modales con tecla Escape
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setModalCrearAbierto(false);
        setMostrarGuia(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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

  const sincronizadosTodos = useMemo(
    () => enlaces.filter((i) => i.estado === 'COMPLETADO' && i.latitud != null && i.longitud != null),
    [enlaces]
  );

  // Auto-seleccionar el equipo sincronizado más reciente en el mapa si no hay selección válida
  useEffect(() => {
    if (sincronizadosTodos.length === 0) {
      setSeleccionadoToken(null);
      return;
    }
    const existe = sincronizadosTodos.some((i) => i.token === seleccionadoToken);
    if (!existe) {
      setSeleccionadoToken(sincronizadosTodos[0].token);
    }
  }, [sincronizadosTodos, seleccionadoToken]);

  const equipoEnMapa = useMemo(
    () => sincronizadosTodos.find((i) => i.token === seleccionadoToken) || null,
    [sincronizadosTodos, seleccionadoToken]
  );

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

  const grupos = useMemo(
    () => ({
      COMPLETADO: enlacesPorBusqueda.filter((i) => i.estado === 'COMPLETADO'),
      PENDIENTE: enlacesPorBusqueda.filter((i) => i.estado === 'PENDIENTE'),
      EXPIRADO: enlacesPorBusqueda.filter((i) => i.estado === 'EXPIRADO')
    }),
    [enlacesPorBusqueda]
  );

  const tasaSincronizacion = useMemo(() => {
    const activos = contadores.PENDIENTE + contadores.COMPLETADO;
    if (activos === 0) return 0;
    return Math.round((contadores.COMPLETADO / activos) * 100);
  }, [contadores]);

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
      setSeccionesAbiertas((prev) => ({ ...prev, PENDIENTE: true }));
      setDispositivosAbiertos((prev) => ({ ...prev, [data.token]: true }));
      mostrarToast(
        data.correoEnviado
          ? `Enlace enviado a ${data.correoDestino}`
          : data.errorCorreo
            ? 'Enlace creado (el correo falló; puedes reintentar o copiarlo)'
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
    setModalCrearAbierto(true);
    mostrarToast('Formulario rellenado para reenviar.');
  }

  function toggleSeccion(clave) {
    setSeccionesAbiertas((prev) => ({ ...prev, [clave]: !prev[clave] }));
  }

  function toggleDispositivo(token) {
    setDispositivosAbiertos((prev) => ({ ...prev, [token]: !prev[token] }));
  }

  function seleccionarMetrica(clave) {
    setFiltroMetrica(clave);
    if (clave !== 'TODOS') {
      setSeccionesAbiertas((prev) => ({ ...prev, [clave]: true }));
    }
  }

  function colapsarTodosDispositivos() {
    setDispositivosAbiertos({});
    mostrarToast('Detalles de dispositivos ocultados');
  }

  function navegarMapa(direccion) {
    if (sincronizadosTodos.length <= 1) return;
    setVerTodosEnMapa(false);
    const idx = sincronizadosTodos.findIndex((i) => i.token === seleccionadoToken);
    const nextIdx = (idx + direccion + sincronizadosTodos.length) % sincronizadosTodos.length;
    const siguiente = sincronizadosTodos[nextIdx];
    setSeleccionadoToken(siguiente.token);
  }

  async function revocarEnlace(item) {
    setAccionEnCursoToken(item.token);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/enlaces/${encodeURIComponent(item.token)}/revocar`, {
        method: 'PATCH',
        headers: adminKey ? { 'X-Admin-Key': adminKey } : {}
      });
      if (res.status === 401) {
        setRequiereClave(true);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo revocar el enlace.');
      }
      mostrarToast(`Enlace "${item.etiqueta}" revocado`);
      await cargarEnlaces();
    } catch (err) {
      setError(err.message);
    } finally {
      setAccionEnCursoToken(null);
    }
  }

  async function eliminarEnlace(item) {
    if (!window.confirm(`¿Eliminar definitivamente "${item.etiqueta}" del historial?`)) {
      return;
    }
    setAccionEnCursoToken(item.token);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/enlaces/${encodeURIComponent(item.token)}`, {
        method: 'DELETE',
        headers: adminKey ? { 'X-Admin-Key': adminKey } : {}
      });
      if (res.status === 401) {
        setRequiereClave(true);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo eliminar el enlace.');
      }
      if (ultimoCreado?.token === item.token) {
        setUltimoCreado(null);
      }
      mostrarToast(`"${item.etiqueta}" eliminado`);
      await cargarEnlaces();
    } catch (err) {
      setError(err.message);
    } finally {
      setAccionEnCursoToken(null);
    }
  }

  async function reenviarCorreo(item) {
    setAccionEnCursoToken(item.token);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/enlaces/${encodeURIComponent(item.token)}/reenviar-correo`, {
        method: 'POST',
        headers: adminKey ? { 'X-Admin-Key': adminKey } : {}
      });
      if (res.status === 401) {
        setRequiereClave(true);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo reenviar el correo.');
      }
      if (ultimoCreado?.token === item.token) {
        setUltimoCreado(data);
      }
      mostrarToast(`Correo enviado a ${data.correoDestino}`);
      await cargarEnlaces();
    } catch (err) {
      setError(err.message);
    } finally {
      setAccionEnCursoToken(null);
    }
  }

  const urlWhatsApp = (item) =>
    `https://wa.me/?text=${encodeURIComponent(
      `Hola, por favor abre este enlace para compartir tu ubicación (${item.etiqueta}): ${item.urlCompartir}`
    )}`;

  function renderDispositivoRow(item) {
    const info = ESTADO_INFO[item.estado] || {
      texto: item.estado,
      clase: 'pendiente',
      icono: '•',
      ayuda: ''
    };
    const abierto = Boolean(dispositivosAbiertos[item.token]);
    const esSeleccionadoEnMapa = item.estado === 'COMPLETADO' && seleccionadoToken === item.token;
    const precision = describirPrecision(item.precisionMetros);
    const urlGoogleMaps =
      item.latitud != null && item.longitud != null
        ? `https://www.google.com/maps?q=${item.latitud},${item.longitud}`
        : null;

    const subResumen =
      item.estado === 'COMPLETADO'
        ? item.direccionAproximada || `${precision ? precision.detalle + ' · ' : ''}${formatearFecha(item.fechaCaptura)}`
        : item.estado === 'PENDIENTE'
          ? `${tiempoRestante(item.fechaExpiracion, ahoraMs)}${item.errorCorreo ? ' · Correo pendiente' : ''}`
          : `Venció ${formatearFecha(item.fechaExpiracion)}`;
    const ocupado = accionEnCursoToken === item.token;

    return (
      <article
        key={item.token}
        className={`device-card device-${info.clase} ${esSeleccionadoEnMapa ? 'device-selected' : ''} ${abierto ? 'device-open' : ''}`}
      >
        <div className="device-row">
          <button
            type="button"
            className="device-main-btn"
            onClick={() => {
              if (item.estado === 'COMPLETADO') {
                setSeleccionadoToken(item.token);
              }
              toggleDispositivo(item.token);
            }}
            aria-expanded={abierto}
          >
            <span className={`device-dot dot-${info.clase}`} aria-hidden="true">
              {info.icono}
            </span>
            <span className="device-text">
              <strong className="device-name">{item.etiqueta}</strong>
              <span className="device-sub">{subResumen}</span>
            </span>
          </button>

          <button
            type="button"
            className="device-toggle-btn"
            onClick={() => toggleDispositivo(item.token)}
            aria-label={abierto ? `Ocultar detalles de ${item.etiqueta}` : `Mostrar detalles de ${item.etiqueta}`}
            title={abierto ? 'Ocultar' : 'Ver detalles'}
          >
            {abierto ? '▾' : '▸'}
          </button>
        </div>

        {abierto && (
          <div className="device-body">
            <div className="device-meta-row">
              <span className={`badge badge-${info.clase}`}>{info.texto}</span>
              {item.correoEnviado && item.correoDestino && (
                <span className="badge badge-mail" title={item.correoDestino}>
                  ✉ {item.correoDestino}
                </span>
              )}
              <span className="meta">Creado {formatearFecha(item.fechaCreacion)}</span>
            </div>

            {item.estado === 'PENDIENTE' && (
              <>
                {item.errorCorreo && (
                  <div className="mail-warn">
                    <span>⚠ {item.errorCorreo}</span>
                    {item.correoDestino && (
                      <button
                        type="button"
                        className="btn-retry-inline"
                        onClick={() => reenviarCorreo(item)}
                        disabled={ocupado}
                      >
                        {ocupado ? 'Enviando...' : 'Reintentar correo'}
                      </button>
                    )}
                  </div>
                )}
                <code className="mini-url">{item.urlCompartir}</code>
                <div className="device-actions">
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
                    Abrir
                  </a>
                  <button
                    type="button"
                    className="btn-action btn-danger-ghost"
                    onClick={() => revocarEnlace(item)}
                    disabled={ocupado}
                  >
                    {ocupado ? '...' : 'Revocar'}
                  </button>
                  <button
                    type="button"
                    className="btn-action btn-danger-ghost"
                    onClick={() => eliminarEnlace(item)}
                    disabled={ocupado}
                  >
                    Eliminar
                  </button>
                </div>
              </>
            )}

            {item.estado === 'COMPLETADO' && (
              <>
                {item.direccionAproximada && (
                  <div className="device-address">📍 {item.direccionAproximada}</div>
                )}
                <div className="device-coords">
                  <span className="coords-val">
                    {item.latitud.toFixed(5)}, {item.longitud.toFixed(5)}
                  </span>
                  {precision && (
                    <span className={`precision-pill prec-${precision.clase}`}>
                      {precision.nivel} ({precision.detalle})
                    </span>
                  )}
                </div>
                <div className="device-actions">
                  <button
                    type="button"
                    className={`btn-action ${esSeleccionadoEnMapa && !verTodosEnMapa ? 'btn-map-active' : 'btn-map'}`}
                    onClick={() => {
                      setVerTodosEnMapa(false);
                      setSeleccionadoToken(item.token);
                    }}
                  >
                    {esSeleccionadoEnMapa && !verTodosEnMapa ? 'En mapa ✓' : 'Centrar mapa'}
                  </button>
                  <button
                    type="button"
                    className="btn-action"
                    onClick={() =>
                      copiarTexto(`${item.latitud}, ${item.longitud}`, 'Coordenadas copiadas')
                    }
                  >
                    Copiar
                  </button>
                  {urlGoogleMaps && (
                    <a
                      href={urlGoogleMaps}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-action"
                    >
                      Maps ↗
                    </a>
                  )}
                  <button
                    type="button"
                    className="btn-action btn-danger-ghost"
                    onClick={() => eliminarEnlace(item)}
                    disabled={ocupado}
                  >
                    Eliminar
                  </button>
                </div>
              </>
            )}

            {item.estado === 'EXPIRADO' && (
              <div className="device-actions">
                <button
                  type="button"
                  className="btn-action btn-action-primary"
                  onClick={() => prepararReenvio(item)}
                >
                  Reenviar solicitud
                </button>
                <button
                  type="button"
                  className="btn-action btn-danger-ghost"
                  onClick={() => eliminarEnlace(item)}
                  disabled={ocupado}
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        )}
      </article>
    );
  }

  const seccionesConfig = [
    {
      key: 'COMPLETADO',
      titulo: 'Sincronizados',
      subtitulo: 'Con ubicación GPS en mapa',
      tone: 'completado',
      items: grupos.COMPLETADO
    },
    {
      key: 'PENDIENTE',
      titulo: 'Sin sincronizar',
      subtitulo: 'Esperando permiso del equipo',
      tone: 'pendiente',
      items: grupos.PENDIENTE
    },
    {
      key: 'EXPIRADO',
      titulo: 'Vencidos',
      subtitulo: 'Historial expirado',
      tone: 'expirado',
      items: grupos.EXPIRADO
    }
  ].filter((sec) => filtroMetrica === 'TODOS' || filtroMetrica === sec.key);

  const precisionMapa = equipoEnMapa ? describirPrecision(equipoEnMapa.precisionMetros) : null;
  const urlGoogleMapa =
    equipoEnMapa && equipoEnMapa.latitud != null && equipoEnMapa.longitud != null
      ? `https://www.google.com/maps?q=${equipoEnMapa.latitud},${equipoEnMapa.longitud}`
      : null;
  const indiceEnMapa = equipoEnMapa
    ? sincronizadosTodos.findIndex((i) => i.token === equipoEnMapa.token) + 1
    : 0;

  return (
    <div className="app-viewport">
      {/* Barra superior ordenada: Marca + Métricas + Controles rápidos */}
      <header className="topbar">
        <div className="topbar-left">
          <img src="/img/max_andres_head_256.webp" alt="Logo" className="brand-icon" />
          <div className="brand-copy">
            <h1>Geolocalizador</h1>
            <div className="status-strip">
              <span className={`conn-dot ${conectado ? 'ok' : 'off'}`} />
              <span>{conectado ? 'En línea' : 'Sin conexión'}</span>
              {ultimaSync && <span className="sep">·</span>}
              {ultimaSync && <span>Sync {formatearHora(ultimaSync)}</span>}
            </div>
          </div>
        </div>

        {/* Métricas ordenadas en una sola franja interactiva */}
        <nav className="metrics-bar" aria-label="Métricas de estado">
          {[
            { key: 'TODOS', label: 'Total', val: contadores.TODOS, tone: 'neutral' },
            { key: 'COMPLETADO', label: 'Sincronizados', val: contadores.COMPLETADO, tone: 'completado' },
            { key: 'PENDIENTE', label: 'Sin sincronizar', val: contadores.PENDIENTE, tone: 'pendiente' },
            { key: 'EXPIRADO', label: 'Vencidos', val: contadores.EXPIRADO, tone: 'expirado' }
          ].map((m) => (
            <button
              key={m.key}
              type="button"
              className={`metric-pill metric-${m.tone} ${filtroMetrica === m.key ? 'metric-active' : ''}`}
              onClick={() => seleccionarMetrica(m.key)}
            >
              <span className="metric-num">{m.val}</span>
              <span className="metric-label">{m.label}</span>
            </button>
          ))}
          <div className="metric-rate" title="Porcentaje de solicitudes activas sincronizadas">
            <span className="metric-rate-val">{tasaSincronizacion}%</span>
            <span className="metric-label">Tasa</span>
          </div>
        </nav>

        {/* Acciones rápidas en esquina superior derecha (Ley de Fitts) */}
        <div className="topbar-actions">
          <label className="auto-pill" title="Actualizar automáticamente cada 10 segundos">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto</span>
          </label>
          <button
            type="button"
            className="btn-icon"
            onClick={cargarEnlaces}
            disabled={cargandoLista}
            title="Actualizar ahora"
            aria-label="Actualizar ahora"
          >
            {cargandoLista ? '…' : '↻'}
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setMostrarGuia(true)}
            title="¿Cómo funciona?"
            aria-label="¿Cómo funciona?"
          >
            ?
          </button>
          <button
            type="button"
            className="btn-cta"
            onClick={() => {
              setUltimoCreado(null);
              setModalCrearAbierto(true);
            }}
          >
            ＋ Nueva solicitud
          </button>
        </div>
      </header>

      {/* Workspace principal: Panel lateral izquierdo + Mapa dominante derecho */}
      <div className="workspace">
        <aside className="sidebar" aria-label="Panel de dispositivos">
          <div className="sidebar-tools">
            <div className="search-box">
              <input
                type="search"
                placeholder="Buscar dispositivo o correo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                aria-label="Buscar dispositivos"
              />
              {busqueda && (
                <button
                  type="button"
                  className="btn-clear"
                  onClick={() => setBusqueda('')}
                  aria-label="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="sidebar-subtools">
              <span className="sidebar-count">
                {filtroMetrica === 'TODOS'
                  ? `${enlacesPorBusqueda.length} dispositivos`
                  : `Filtro: ${ESTADO_INFO[filtroMetrica]?.texto}`}
              </span>
              <div className="sidebar-mini-btns">
                {filtroMetrica !== 'TODOS' && (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => setFiltroMetrica('TODOS')}
                  >
                    Ver todos
                  </button>
                )}
                {Object.values(dispositivosAbiertos).some(Boolean) && (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={colapsarTodosDispositivos}
                  >
                    Ocultar detalles
                  </button>
                )}
              </div>
            </div>
          </div>

          {error && <div className="sidebar-alert" role="alert">{error}</div>}

          <div className="sidebar-scroll">
            {seccionesConfig.map((sec) => {
              const abierta = seccionesAbiertas[sec.key];
              return (
                <section key={sec.key} className={`acc-section acc-${sec.tone}`}>
                  <button
                    type="button"
                    className="acc-header"
                    onClick={() => toggleSeccion(sec.key)}
                    aria-expanded={abierta}
                  >
                    <div className="acc-header-left">
                      <span className={`acc-dot dot-${sec.tone}`} />
                      <div className="acc-titles">
                        <strong>{sec.titulo}</strong>
                        <span>{sec.subtitulo}</span>
                      </div>
                    </div>
                    <div className="acc-header-right">
                      <span className="acc-count">{sec.items.length}</span>
                      <span className="acc-chevron">{abierta ? '▾' : '▸'}</span>
                    </div>
                  </button>

                  {abierta && (
                    <div className="acc-content">
                      {sec.items.length === 0 ? (
                        <div className="acc-empty">
                          {busqueda
                            ? 'Sin coincidencias en esta sección.'
                            : sec.key === 'PENDIENTE'
                              ? 'Sin solicitudes pendientes.'
                              : sec.key === 'COMPLETADO'
                                ? 'Aún no hay equipos sincronizados.'
                                : 'No hay enlaces vencidos.'}
                        </div>
                      ) : (
                        sec.items.map(renderDispositivoRow)
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </aside>

        {/* Mapa Dominante Interactivo (Leaflet + radio de precisión) */}
        <main className="map-stage" aria-label="Mapa de ubicación dominante">
          {equipoEnMapa ? (
            <>
              <MapaInteractivo
                dispositivos={sincronizadosTodos}
                seleccionadoToken={equipoEnMapa.token}
                verTodos={verTodosEnMapa}
                onSeleccionar={(token) => {
                  setSeleccionadoToken(token);
                  setVerTodosEnMapa(false);
                }}
              />

              {/* Tarjeta flotante superior con contexto del equipo */}
              <div className="map-hud-top">
                <div className="hud-device">
                  <span className="hud-badge">
                    {verTodosEnMapa
                      ? `✓ Mostrando ${sincronizadosTodos.length} sincronizados`
                      : '✓ Sincronizado'}
                  </span>
                  <h2>{equipoEnMapa.etiqueta}</h2>
                  {equipoEnMapa.direccionAproximada && (
                    <div className="hud-address">📍 {equipoEnMapa.direccionAproximada}</div>
                  )}
                  <div className="hud-meta">
                    <span className="coords-val">
                      {equipoEnMapa.latitud.toFixed(6)}, {equipoEnMapa.longitud.toFixed(6)}
                    </span>
                    {precisionMapa && (
                      <span className={`precision-pill prec-${precisionMapa.clase}`}>
                        {precisionMapa.nivel} ({precisionMapa.detalle})
                      </span>
                    )}
                  </div>
                  <div className="hud-time">
                    Recibida el {formatearFecha(equipoEnMapa.fechaCaptura)}
                    {equipoEnMapa.correoDestino ? ` · ${equipoEnMapa.correoDestino}` : ''}
                  </div>
                </div>

                {sincronizadosTodos.length > 1 && (
                  <div className="hud-controls-right">
                    <button
                      type="button"
                      className={`hud-mode-btn ${verTodosEnMapa ? 'hud-mode-active' : ''}`}
                      onClick={() => setVerTodosEnMapa((v) => !v)}
                    >
                      {verTodosEnMapa
                        ? 'Enfocar equipo'
                        : `Ver todos (${sincronizadosTodos.length})`}
                    </button>
                    <div className="hud-pager">
                      <button
                        type="button"
                        className="hud-pager-btn"
                        onClick={() => navegarMapa(-1)}
                        aria-label="Equipo anterior"
                        title="Equipo anterior"
                      >
                        ←
                      </button>
                      <span className="hud-pager-count">
                        {indiceEnMapa} / {sincronizadosTodos.length}
                      </span>
                      <button
                        type="button"
                        className="hud-pager-btn"
                        onClick={() => navegarMapa(1)}
                        aria-label="Siguiente equipo"
                        title="Siguiente equipo"
                      >
                        →
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Barra flotante inferior de acciones rápidas (Ley de Fitts) */}
              <div className="map-hud-bottom">
                <button
                  type="button"
                  className="btn-action btn-action-primary"
                  onClick={() =>
                    copiarTexto(
                      `${equipoEnMapa.latitud}, ${equipoEnMapa.longitud}`,
                      'Coordenadas copiadas'
                    )
                  }
                >
                  Copiar coordenadas
                </button>
                {urlGoogleMapa && (
                  <a
                    href={urlGoogleMapa}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-action"
                  >
                    Google Maps ↗
                  </a>
                )}
                {equipoEnMapa.urlMapa && (
                  <a
                    href={equipoEnMapa.urlMapa}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-action"
                  >
                    OpenStreetMap ↗
                  </a>
                )}
              </div>
            </>
          ) : (
            <div className="map-empty-stage">
              <div className="map-empty-card">
                <span className="map-empty-icon" aria-hidden="true">📍</span>
                <h2>Mapa listo para recibir ubicaciones</h2>
                <p>
                  {contadores.PENDIENTE > 0
                    ? `Tienes ${contadores.PENDIENTE} solicitud(es) esperando respuesta. Apenas alguien comparta su ubicación, aparecerá aquí.`
                    : 'Crea una nueva solicitud y compártela. Cuando el equipo acepte el permiso, verás su punto exacto en este mapa.'}
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setUltimoCreado(null);
                    setModalCrearAbierto(true);
                  }}
                >
                  ＋ Crear nueva solicitud
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal: Acceso al panel (si APP_ADMIN_KEY está activa) */}
      {requiereClave && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Acceso al panel">
          <div className="modal-card modal-sm">
            <div className="modal-head">
              <h2>🔒 Acceso al panel</h2>
            </div>
            <p className="modal-desc">
              El backend tiene protección activa. Ingresa tu clave de administrador para ver y crear enlaces.
            </p>
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
                  placeholder="Ingresa La CLave Secreta de Uso"
                  value={claveInput}
                  onChange={(e) => setClaveInput(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <button type="submit" className="btn-primary btn-full">
                Desbloquear panel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nueva solicitud */}
      {modalCrearAbierto && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Crear nueva solicitud"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalCrearAbierto(false);
          }}
        >
          <div className="modal-card">
            <div className="modal-head">
              <div>
                <h2>Nueva solicitud de ubicación</h2>
                <p className="modal-desc">
                  Se agregará a <strong>Sin sincronizar</strong> hasta que el equipo acepte el permiso.
                </p>
              </div>
              <button
                type="button"
                className="btn-dismiss"
                onClick={() => setModalCrearAbierto(false)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="form">
              <div className="field">
                <label htmlFor="etiqueta">Equipo o persona *</label>
                <input
                  id="etiqueta"
                  type="text"
                  placeholder="Ej. Celular de Juan, Laptop oficina..."
                  value={etiqueta}
                  onChange={(e) => setEtiqueta(e.target.value)}
                  autoFocus
                  required
                />
                <div className="chip-row">
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
                <label>Tiempo activo del enlace</label>
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
                <label htmlFor="correo">Enviar por correo (opcional)</label>
                <input
                  id="correo"
                  type="email"
                  placeholder="persona@gmail.com"
                  value={correoDestino}
                  onChange={(e) => setCorreoDestino(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-primary btn-full" disabled={enviando}>
                {enviando
                  ? 'Creando enlace...'
                  : correoDestino.trim()
                    ? 'Crear y enviar por correo'
                    : 'Crear enlace ahora'}
              </button>
            </form>

            {ultimoCreado && (
              <div className="ready-box" role="status">
                <div className="ready-head">
                  <strong>
                    {ultimoCreado.correoEnviado
                      ? `Enviado a ${ultimoCreado.correoDestino}`
                      : ultimoCreado.errorCorreo
                        ? 'Enlace creado (correo no enviado)'
                        : '¡Enlace listo para compartir!'}
                  </strong>
                </div>
                {ultimoCreado.errorCorreo && (
                  <div className="mail-warn">
                    <span>⚠ {ultimoCreado.errorCorreo}</span>
                    {ultimoCreado.correoDestino && (
                      <button
                        type="button"
                        className="btn-retry-inline"
                        onClick={() => reenviarCorreo(ultimoCreado)}
                        disabled={accionEnCursoToken === ultimoCreado.token}
                      >
                        {accionEnCursoToken === ultimoCreado.token ? 'Enviando...' : 'Reintentar'}
                      </button>
                    )}
                  </div>
                )}
                <code className="mini-url">{ultimoCreado.urlCompartir}</code>
                <div className="device-actions">
                  <button
                    type="button"
                    className="btn-action btn-action-primary"
                    onClick={() => copiarTexto(ultimoCreado.urlCompartir, 'Enlace copiado')}
                  >
                    Copiar enlace
                  </button>
                  <a
                    href={urlWhatsApp(ultimoCreado)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-action btn-whatsapp"
                  >
                    WhatsApp
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
          </div>
        </div>
      )}

      {/* Modal: Guía rápida */}
      {mostrarGuia && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Cómo funciona"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMostrarGuia(false);
          }}
        >
          <div className="modal-card modal-sm">
            <div className="modal-head">
              <h2>Cómo funciona en 3 pasos</h2>
              <button
                type="button"
                className="btn-dismiss"
                onClick={() => setMostrarGuia(false)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="guide-list">
              <div className="step-box">
                <span className="step-num">1</span>
                <div>
                  <strong>Crea una solicitud</strong>
                  <p>Pulsa <em>＋ Nueva solicitud</em> y compártela por WhatsApp, correo o copiando el enlace.</p>
                </div>
              </div>
              <div className="step-box">
                <span className="step-num">2</span>
                <div>
                  <strong>Consentimiento explícito</strong>
                  <p>La persona abre el enlace, presiona <em>Compartir mi ubicación</em> y acepta el permiso.</p>
                </div>
              </div>
              <div className="step-box">
                <span className="step-num">3</span>
                <div>
                  <strong>Explora en el mapa</strong>
                  <p>El equipo pasa a <strong>Sincronizados</strong> en el panel lateral y se muestra en el mapa principal.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}

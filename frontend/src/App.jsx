import { useEffect, useState } from 'react';

function formatearFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

export default function App() {
  const [etiqueta, setEtiqueta] = useState('');
  const [correoDestino, setCorreoDestino] = useState('');
  const [minutosExpiracion, setMinutosExpiracion] = useState(30);

  const [enlaces, setEnlaces] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [copiadoToken, setCopiadoToken] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  async function cargarEnlaces() {
    setCargandoLista(true);
    try {
      const res = await fetch('/api/enlaces');
      if (!res.ok) throw new Error('No se pudo obtener la lista de enlaces');
      const data = await res.json();
      setEnlaces([...data].reverse());
      setError((prev) =>
        prev && prev.startsWith('No se pudo conectar') ? null : prev
      );
    } catch (err) {
      setError('No se pudo conectar con el backend en http://localhost:8080.');
    } finally {
      setCargandoLista(false);
    }
  }

  useEffect(() => {
    cargarEnlaces();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(cargarEnlaces, 10000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    setEnviando(true);

    try {
      const payload = {
        etiqueta: etiqueta.trim(),
        minutosExpiracion: Number(minutosExpiracion) || 30,
        correoDestino: correoDestino.trim() || null
      };

      const res = await fetch('/api/enlaces', {
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

      setMensaje(
        data.correoEnviado
          ? `Enlace creado y enviado por correo a ${payload.correoDestino}.`
          : 'Enlace creado correctamente. Ya puedes copiarlo y compartirlo.'
      );
      setEtiqueta('');
      setCorreoDestino('');
      await cargarEnlaces();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function copiarEnlace(enlace) {
    try {
      await navigator.clipboard.writeText(enlace.urlCompartir);
      setCopiadoToken(enlace.token);
      setTimeout(() => setCopiadoToken(null), 2000);
    } catch {
      setError('No se pudo copiar al portapapeles.');
    }
  }

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>Geolocalizador</h1>
          <p className="subtitle">
            Genera enlaces de prueba con consentimiento y consulta la ubicación reportada.
          </p>
        </div>
      </header>

      <section className="card">
        <h2>Crear enlace de ubicación</h2>
        <form onSubmit={handleSubmit} className="form">
          <div className="field">
            <label htmlFor="etiqueta">Referencia / Equipo *</label>
            <input
              id="etiqueta"
              type="text"
              placeholder="Ej. Laptop oficina, Celular pruebas..."
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="correo">Correo destino (opcional)</label>
              <input
                id="correo"
                type="email"
                placeholder="destino@gmail.com"
                value={correoDestino}
                onChange={(e) => setCorreoDestino(e.target.value)}
              />
              <small>Si lo completas, se enviará automáticamente por SMTP de Gmail.</small>
            </div>

            <div className="field field-small">
              <label htmlFor="minutos">Expira en (min)</label>
              <input
                id="minutos"
                type="number"
                min="1"
                max="1440"
                value={minutosExpiracion}
                onChange={(e) => setMinutosExpiracion(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={enviando}>
            {enviando
              ? 'Procesando...'
              : correoDestino.trim()
                ? 'Generar y enviar por correo'
                : 'Generar enlace'}
          </button>
        </form>

        {mensaje && <div className="alert alert-ok">{mensaje}</div>}
        {error && <div className="alert alert-error">{error}</div>}
      </section>

      <section className="card">
        <div className="section-header">
          <h2>Enlaces generados ({enlaces.length})</h2>
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
              {cargandoLista ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        {enlaces.length === 0 ? (
          <p className="empty">
            Aún no hay enlaces creados. Genera el primero usando el formulario de arriba.
          </p>
        ) : (
          <div className="list">
            {enlaces.map((item) => (
              <article key={item.token} className="enlace-item">
                <div className="enlace-top">
                  <div>
                    <strong>{item.etiqueta}</strong>
                    <span className={`badge badge-${item.estado.toLowerCase()}`}>
                      {item.estado}
                    </span>
                  </div>
                  <span className="meta">
                    Creado: {formatearFecha(item.fechaCreacion)}
                  </span>
                </div>

                <div className="url-row">
                  <code>{item.urlCompartir}</code>
                  <button
                    type="button"
                    className="btn-small"
                    onClick={() => copiarEnlace(item)}
                  >
                    {copiadoToken === item.token ? '¡Copiado!' : 'Copiar'}
                  </button>
                  <a
                    href={item.urlCompartir}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-small btn-link"
                  >
                    Abrir
                  </a>
                </div>

                {item.estado === 'COMPLETADO' ? (
                  <div className="coords-box">
                    <div>
                      <strong>Coordenadas:</strong> {item.latitud.toFixed(6)}, {item.longitud.toFixed(6)}
                      {item.precisionMetros != null && (
                        <span> (precisión ~{Math.round(item.precisionMetros)} m)</span>
                      )}
                      <div className="meta">
                        Capturada: {formatearFecha(item.fechaCaptura)}
                      </div>
                    </div>
                    {item.urlMapa && (
                      <a
                        href={item.urlMapa}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-map"
                      >
                        Ver en mapa
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="meta">
                    Expira: {formatearFecha(item.fechaExpiracion)}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

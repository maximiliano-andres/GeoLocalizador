import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function crearIconoMarcador(seleccionado) {
  return L.divIcon({
    className: 'geo-marker-wrap',
    html: `<div class="geo-marker ${seleccionado ? 'geo-marker-active' : ''}"></div>`,
    iconSize: seleccionado ? [24, 24] : [18, 18],
    iconAnchor: seleccionado ? [12, 12] : [9, 9]
  });
}

function zoomSegunPrecision(metros) {
  if (metros == null) return 16;
  if (metros <= 50) return 16;
  if (metros <= 250) return 15;
  if (metros <= 1000) return 14;
  return 13;
}

function escaparHtml(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function MapaInteractivo({
  dispositivos,
  seleccionadoToken,
  verTodos,
  onSeleccionar
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);

  // Inicializar mapa una sola vez
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Actualizar marcadores, círculos de precisión y vista
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group || !dispositivos || dispositivos.length === 0) return;

    group.clearLayers();

    const listaAMostrar = verTodos
      ? dispositivos
      : dispositivos.filter((d) => d.token === seleccionadoToken);

    const visibles = listaAMostrar.length > 0 ? listaAMostrar : [dispositivos[0]];
    const bounds = [];

    visibles.forEach((item) => {
      const esSeleccionado = item.token === seleccionadoToken;
      const latLng = [item.latitud, item.longitud];
      bounds.push(latLng);

      // Círculo translúcido con radio real de precisión GPS en metros
      if (item.precisionMetros != null && item.precisionMetros > 0) {
        L.circle(latLng, {
          radius: item.precisionMetros,
          color: esSeleccionado ? '#287271' : '#D4A373',
          weight: esSeleccionado ? 2 : 1.5,
          fillColor: esSeleccionado ? '#287271' : '#D4A373',
          fillOpacity: esSeleccionado ? 0.16 : 0.1
        }).addTo(group);
      }

      const direccionHtml = item.direccionAproximada
        ? `<div class="geo-popup-addr">${escaparHtml(item.direccionAproximada)}</div>`
        : '';
      const precisionHtml =
        item.precisionMetros != null
          ? `<div class="geo-popup-meta">Precisión aprox. ${Math.round(item.precisionMetros)} m</div>`
          : '';

      const marker = L.marker(latLng, {
        icon: crearIconoMarcador(esSeleccionado),
        zIndexOffset: esSeleccionado ? 500 : 100
      }).addTo(group);

      marker.bindPopup(
        `<div class="geo-popup">
          <strong>${escaparHtml(item.etiqueta)}</strong>
          ${direccionHtml}
          ${precisionHtml}
        </div>`
      );

      marker.on('click', () => {
        if (onSeleccionar) onSeleccionar(item.token);
      });
    });

    if (verTodos && bounds.length > 1) {
      map.fitBounds(bounds, { padding: [90, 90], maxZoom: 16 });
    } else {
      const objetivo = visibles.find((d) => d.token === seleccionadoToken) || visibles[0];
      map.setView(
        [objetivo.latitud, objetivo.longitud],
        zoomSegunPrecision(objetivo.precisionMetros),
        { animate: true }
      );
    }
  }, [dispositivos, seleccionadoToken, verTodos, onSeleccionar]);

  return <div ref={containerRef} className="dominant-map" />;
}

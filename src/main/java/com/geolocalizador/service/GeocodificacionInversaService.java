package com.geolocalizador.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class GeocodificacionInversaService {

    private static final Logger log = LoggerFactory.getLogger(GeocodificacionInversaService.class);
    private static final int MAX_LENGTH = 280;

    private final boolean enabled;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public GeocodificacionInversaService(
            @Value("${app.geocoding.enabled:true}") boolean enabled,
            ObjectMapper objectMapper) {
        this.enabled = enabled;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
    }

    /**
     * Resuelve una dirección legible aproximada usando Nominatim (OpenStreetMap).
     * Es completamente resiliente: si falla o supera el timeout, retorna null sin interrumpir el flujo.
     */
    public String obtenerDireccionAproximada(double latitud, double longitud) {
        if (!enabled) {
            return null;
        }
        try {
            String url = String.format(
                    Locale.ROOT,
                    "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=%.6f&lon=%.6f&accept-language=es",
                    latitud,
                    longitud
            );
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(3))
                    .header("User-Agent", "GeolocalizadorApp/1.0 (reverse-geocoding)")
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200 || response.body() == null || response.body().isBlank()) {
                log.warn("Nominatim devolvió estado {} al geocodificar {},{}", response.statusCode(), latitud, longitud);
                return null;
            }

            JsonNode root = objectMapper.readTree(response.body());
            String formateada = construirDireccionCorta(root.path("address"));
            if (formateada == null || formateada.isBlank()) {
                formateada = root.path("display_name").asText(null);
            }
            if (formateada == null || formateada.isBlank()) {
                return null;
            }
            return formateada.length() > MAX_LENGTH
                    ? formateada.substring(0, MAX_LENGTH - 1) + "…"
                    : formateada;
        } catch (Exception ex) {
            log.warn("No se pudo obtener dirección aproximada para {},{}: {}", latitud, longitud, ex.getMessage());
            return null;
        }
    }

    private static String construirDireccionCorta(JsonNode address) {
        if (address == null || address.isMissingNode() || !address.isObject()) {
            return null;
        }
        List<String> partes = new ArrayList<>();

        String calle = primeroNoVacio(address, "road", "pedestrian", "footway", "neighbourhood");
        String numero = primeroNoVacio(address, "house_number");
        if (calle != null) {
            partes.add(numero != null ? calle + " " + numero : calle);
        }

        String comuna = primeroNoVacio(address, "suburb", "city_district", "town", "village", "municipality", "city");
        if (comuna != null && !partes.contains(comuna)) {
            partes.add(comuna);
        }

        String ciudad = primeroNoVacio(address, "city", "state");
        if (ciudad != null && !partes.contains(ciudad)) {
            partes.add(ciudad);
        }

        return partes.isEmpty() ? null : String.join(", ", partes);
    }

    private static String primeroNoVacio(JsonNode node, String... keys) {
        for (String key : keys) {
            String val = node.path(key).asText(null);
            if (val != null && !val.isBlank()) {
                return val.trim();
            }
        }
        return null;
    }
}

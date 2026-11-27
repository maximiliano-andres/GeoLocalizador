package com.geolocalizador.controller;

import com.geolocalizador.dto.CrearEnlaceRequest;
import com.geolocalizador.dto.EnlaceResponse;
import com.geolocalizador.dto.ReportarUbicacionRequest;
import com.geolocalizador.service.EnlaceUbicacionService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/enlaces")
public class EnlaceUbicacionController {

    private final EnlaceUbicacionService enlaceService;
    private final String configuredBaseUrl;

    public EnlaceUbicacionController(EnlaceUbicacionService enlaceService,
                                     @Value("${app.base-url:}") String configuredBaseUrl) {
        this.enlaceService = enlaceService;
        this.configuredBaseUrl = validarYNormalizarBaseUrl(configuredBaseUrl);
    }

    @PostMapping
    public ResponseEntity<EnlaceResponse> crear(@Valid @RequestBody CrearEnlaceRequest request) {
        EnlaceResponse creado = enlaceService.crearEnlace(request, obtenerBaseUrl());
        return ResponseEntity.status(HttpStatus.CREATED).body(creado);
    }

    @GetMapping
    public List<EnlaceResponse> listar() {
        return enlaceService.listarEnlaces(obtenerBaseUrl());
    }

    @GetMapping("/{token}")
    public EnlaceResponse obtenerPorToken(@PathVariable String token) {
        return enlaceService.obtenerPorToken(token, obtenerBaseUrl());
    }

    @PostMapping("/{token}/ubicacion")
    public EnlaceResponse registrarUbicacion(
            @PathVariable String token,
            @Valid @RequestBody ReportarUbicacionRequest request) {
        return enlaceService.registrarUbicacion(token, request, obtenerBaseUrl());
    }

    @PatchMapping("/{token}/revocar")
    public EnlaceResponse revocar(@PathVariable String token) {
        return enlaceService.revocarEnlace(token, obtenerBaseUrl());
    }

    @PostMapping("/{token}/reenviar-correo")
    public EnlaceResponse reenviarCorreo(@PathVariable String token) {
        return enlaceService.reenviarCorreo(token, obtenerBaseUrl());
    }

    @DeleteMapping("/{token}")
    public ResponseEntity<Void> eliminar(@PathVariable String token) {
        enlaceService.eliminarEnlace(token);
        return ResponseEntity.noContent().build();
    }

    private String obtenerBaseUrl() {
        if (!configuredBaseUrl.isEmpty()) {
            return configuredBaseUrl;
        }
        return ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString();
    }

    private static String validarYNormalizarBaseUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return "";
        }
        String normalized = rawUrl.trim().replaceAll("/+$", "");
        URI uri = URI.create(normalized);
        String scheme = uri.getScheme();
        if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))
                || uri.getHost() == null || uri.getHost().isBlank()) {
            throw new IllegalArgumentException(
                    "APP_BASE_URL debe ser una URL válida con http:// o https:// (valor recibido: '" + rawUrl + "')");
        }
        return normalized;
    }
}

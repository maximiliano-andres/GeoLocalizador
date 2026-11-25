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

import java.util.List;

@RestController
@RequestMapping("/api/enlaces")
public class EnlaceUbicacionController {

    private final EnlaceUbicacionService enlaceService;
    private final String configuredBaseUrl;

    public EnlaceUbicacionController(EnlaceUbicacionService enlaceService,
                                     @Value("${app.base-url:}") String configuredBaseUrl) {
        this.enlaceService = enlaceService;
        this.configuredBaseUrl = configuredBaseUrl;
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

    private String obtenerBaseUrl() {
        if (configuredBaseUrl != null && !configuredBaseUrl.isBlank()) {
            return configuredBaseUrl.replaceAll("/+$", "");
        }
        return ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString();
    }
}

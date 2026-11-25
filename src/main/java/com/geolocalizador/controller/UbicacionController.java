package com.geolocalizador.controller;

import com.geolocalizador.dto.UbicacionRequest;
import com.geolocalizador.dto.UbicacionResponse;
import com.geolocalizador.service.GeolocalizacionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ubicaciones")
public class UbicacionController {

    private final GeolocalizacionService geolocalizacionService;

    public UbicacionController(GeolocalizacionService geolocalizacionService) {
        this.geolocalizacionService = geolocalizacionService;
    }

    @GetMapping
    public List<UbicacionResponse> listarTodas() {
        return geolocalizacionService.listarTodas();
    }

    @GetMapping("/{id}")
    public UbicacionResponse obtenerPorId(@PathVariable Long id) {
        return geolocalizacionService.obtenerPorId(id);
    }

    @PostMapping
    public ResponseEntity<UbicacionResponse> crear(@Valid @RequestBody UbicacionRequest request) {
        UbicacionResponse creada = geolocalizacionService.guardar(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(creada);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        geolocalizacionService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/cercanas")
    public List<UbicacionResponse> buscarCercanas(
            @RequestParam double lat,
            @RequestParam double lon,
            @RequestParam(defaultValue = "5.0") double radioKm) {
        return geolocalizacionService.buscarCercanas(lat, lon, radioKm);
    }

    @GetMapping("/distancia")
    public Map<String, Double> calcularDistancia(
            @RequestParam double lat1,
            @RequestParam double lon1,
            @RequestParam double lat2,
            @RequestParam double lon2) {
        double distancia = geolocalizacionService.calcularDistanciaKm(lat1, lon1, lat2, lon2);
        return Map.of("distanciaKm", Math.round(distancia * 100.0) / 100.0);
    }
}

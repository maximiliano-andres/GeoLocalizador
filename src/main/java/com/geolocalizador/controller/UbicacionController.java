package com.geolocalizador.controller;

import com.geolocalizador.dto.UbicacionRequest;
import com.geolocalizador.dto.UbicacionResponse;
import com.geolocalizador.service.GeolocalizacionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ubicaciones")
@Validated
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
            @RequestParam @DecimalMin("-90.0") @DecimalMax("90.0") double lat,
            @RequestParam @DecimalMin("-180.0") @DecimalMax("180.0") double lon,
            @RequestParam(defaultValue = "5.0") @Positive double radioKm) {
        return geolocalizacionService.buscarCercanas(lat, lon, radioKm);
    }

    @GetMapping("/distancia")
    public Map<String, Double> calcularDistancia(
            @RequestParam @DecimalMin("-90.0") @DecimalMax("90.0") double lat1,
            @RequestParam @DecimalMin("-180.0") @DecimalMax("180.0") double lon1,
            @RequestParam @DecimalMin("-90.0") @DecimalMax("90.0") double lat2,
            @RequestParam @DecimalMin("-180.0") @DecimalMax("180.0") double lon2) {
        double distancia = geolocalizacionService.calcularDistanciaKm(lat1, lon1, lat2, lon2);
        return Map.of("distanciaKm", Math.round(distancia * 100.0) / 100.0);
    }
}

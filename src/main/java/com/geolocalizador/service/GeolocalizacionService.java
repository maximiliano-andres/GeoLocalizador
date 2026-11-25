package com.geolocalizador.service;

import com.geolocalizador.dto.UbicacionRequest;
import com.geolocalizador.dto.UbicacionResponse;
import com.geolocalizador.model.Ubicacion;
import com.geolocalizador.repository.UbicacionRepository;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.NoSuchElementException;

@Service
public class GeolocalizacionService {

    private static final double RADIO_TIERRA_KM = 6371.0;

    private final UbicacionRepository ubicacionRepository;

    public GeolocalizacionService(UbicacionRepository ubicacionRepository) {
        this.ubicacionRepository = ubicacionRepository;
    }

    public List<UbicacionResponse> listarTodas() {
        return ubicacionRepository.findAll()
                .stream()
                .map(UbicacionResponse::fromEntity)
                .toList();
    }

    public UbicacionResponse obtenerPorId(Long id) {
        Ubicacion ubicacion = ubicacionRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Ubicación no encontrada con id: " + id));
        return UbicacionResponse.fromEntity(ubicacion);
    }

    public UbicacionResponse guardar(UbicacionRequest request) {
        Ubicacion ubicacion = new Ubicacion(
                request.nombre(),
                request.descripcion(),
                request.latitud(),
                request.longitud(),
                request.direccion()
        );
        Ubicacion guardada = ubicacionRepository.save(ubicacion);
        return UbicacionResponse.fromEntity(guardada);
    }

    public void eliminar(Long id) {
        if (!ubicacionRepository.existsById(id)) {
            throw new NoSuchElementException("Ubicación no encontrada con id: " + id);
        }
        ubicacionRepository.deleteById(id);
    }

    /**
     * Busca ubicaciones registradas dentro de un radio (en km) desde un punto dado,
     * ordenadas de menor a mayor distancia.
     */
    public List<UbicacionResponse> buscarCercanas(double lat, double lon, double radioKm) {
        return ubicacionRepository.findAll()
                .stream()
                .map(u -> {
                    double distancia = calcularDistanciaKm(lat, lon, u.getLatitud(), u.getLongitud());
                    return UbicacionResponse.fromEntity(u, Math.round(distancia * 100.0) / 100.0);
                })
                .filter(resp -> resp.distanciaKm() <= radioKm)
                .sorted(Comparator.comparingDouble(UbicacionResponse::distanciaKm))
                .toList();
    }

    /**
     * Calcula la distancia en kilómetros entre dos coordenadas usando la fórmula de Haversine.
     */
    public double calcularDistanciaKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return RADIO_TIERRA_KM * c;
    }
}

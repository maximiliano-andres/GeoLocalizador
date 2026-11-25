package com.geolocalizador.dto;

import com.geolocalizador.model.Ubicacion;
import java.time.LocalDateTime;

public record UbicacionResponse(
        Long id,
        String nombre,
        String descripcion,
        Double latitud,
        Double longitud,
        String direccion,
        LocalDateTime fechaRegistro,
        Double distanciaKm
) {
    public static UbicacionResponse fromEntity(Ubicacion ubicacion) {
        return fromEntity(ubicacion, null);
    }

    public static UbicacionResponse fromEntity(Ubicacion ubicacion, Double distanciaKm) {
        return new UbicacionResponse(
                ubicacion.getId(),
                ubicacion.getNombre(),
                ubicacion.getDescripcion(),
                ubicacion.getLatitud(),
                ubicacion.getLongitud(),
                ubicacion.getDireccion(),
                ubicacion.getFechaRegistro(),
                distanciaKm
        );
    }
}

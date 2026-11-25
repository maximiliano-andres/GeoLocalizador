package com.geolocalizador.dto;

import com.geolocalizador.model.EnlaceUbicacion;
import java.time.LocalDateTime;

public record EnlaceResponse(
        String token,
        String etiqueta,
        String urlCompartir,
        EnlaceUbicacion.Estado estado,
        String correoDestino,
        boolean correoEnviado,
        Double latitud,
        Double longitud,
        Double precisionMetros,
        String urlMapa,
        LocalDateTime fechaCreacion,
        LocalDateTime fechaExpiracion,
        LocalDateTime fechaCaptura
) {
    public static EnlaceResponse fromEntity(EnlaceUbicacion enlace, String baseUrl) {
        String urlCompartir = baseUrl + "/compartir/" + enlace.getToken();
        String urlMapa = (enlace.getLatitud() != null && enlace.getLongitud() != null)
                ? String.format("https://www.openstreetmap.org/?mlat=%s&mlon=%s#map=16/%s/%s",
                enlace.getLatitud(), enlace.getLongitud(), enlace.getLatitud(), enlace.getLongitud())
                : null;

        return new EnlaceResponse(
                enlace.getToken(),
                enlace.getEtiqueta(),
                urlCompartir,
                enlace.getEstado(),
                enlace.getCorreoDestino(),
                enlace.isCorreoEnviado(),
                enlace.getLatitud(),
                enlace.getLongitud(),
                enlace.getPrecisionMetros(),
                urlMapa,
                enlace.getFechaCreacion(),
                enlace.getFechaExpiracion(),
                enlace.getFechaCaptura()
        );
    }
}

package com.geolocalizador.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record CrearEnlaceRequest(
        @NotBlank(message = "La etiqueta es obligatoria (ej. nombre del equipo o referencia)")
        String etiqueta,

        @Min(value = 1, message = "La expiración mínima es de 1 minuto")
        @Max(value = 1440, message = "La expiración máxima es de 1440 minutos (24 horas)")
        Integer minutosExpiracion,

        @Email(message = "El correo de destino no tiene un formato válido")
        String correoDestino
) {
    public int minutosExpiracionEfectivos() {
        return minutosExpiracion != null ? minutosExpiracion : 60;
    }
}

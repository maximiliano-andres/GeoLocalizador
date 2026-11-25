package com.geolocalizador;

import com.geolocalizador.dto.CrearEnlaceRequest;
import com.geolocalizador.dto.EnlaceResponse;
import com.geolocalizador.dto.ReportarUbicacionRequest;
import com.geolocalizador.model.EnlaceUbicacion;
import com.geolocalizador.service.EnlaceUbicacionService;
import com.geolocalizador.service.GeolocalizacionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class GeolocalizadorApplicationTests {

    @Autowired
    private GeolocalizacionService geolocalizacionService;

    @Autowired
    private EnlaceUbicacionService enlaceUbicacionService;

    @Test
    void contextLoads() {
        assertThat(geolocalizacionService).isNotNull();
        assertThat(enlaceUbicacionService).isNotNull();
    }

    @Test
    void calcularDistanciaHaversine() {
        // Distancia aproximada entre Plaza de Armas (Santiago) y Costanera Center (~4.5 km)
        double distancia = geolocalizacionService.calcularDistanciaKm(
                -33.4378, -70.6504,
                -33.4172, -70.6067
        );
        assertThat(distancia).isBetween(4.0, 5.5);
    }

    @Test
    void flujoEnlaceCompartirUbicacion() {
        EnlaceResponse creado = enlaceUbicacionService.crearEnlace(
                new CrearEnlaceRequest("Equipo de prueba", 30, null),
                "http://localhost:8080"
        );

        assertThat(creado.token()).isNotBlank();
        assertThat(creado.estado()).isEqualTo(EnlaceUbicacion.Estado.PENDIENTE);
        assertThat(creado.correoEnviado()).isFalse();
        assertThat(creado.urlCompartir()).endsWith("/compartir/" + creado.token());

        EnlaceResponse completado = enlaceUbicacionService.registrarUbicacion(
                creado.token(),
                new ReportarUbicacionRequest(-33.4378, -70.6504, 15.0),
                "http://localhost:8080"
        );

        assertThat(completado.estado()).isEqualTo(EnlaceUbicacion.Estado.COMPLETADO);
        assertThat(completado.latitud()).isEqualTo(-33.4378);
        assertThat(completado.longitud()).isEqualTo(-70.6504);
        assertThat(completado.urlMapa()).contains("openstreetmap.org");

        // No debe permitir reutilizar el mismo enlace
        assertThatThrownBy(() -> enlaceUbicacionService.registrarUbicacion(
                creado.token(),
                new ReportarUbicacionRequest(-33.44, -70.65, 10.0),
                "http://localhost:8080"
        )).isInstanceOf(IllegalStateException.class);
    }
}

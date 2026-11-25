package com.geolocalizador;

import com.geolocalizador.dto.UbicacionRequest;
import com.geolocalizador.dto.UbicacionResponse;
import com.geolocalizador.repository.UbicacionRepository;
import com.geolocalizador.service.GeolocalizacionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

@SpringBootTest
class GeolocalizacionServiceTest {

    @Autowired
    private GeolocalizacionService geolocalizacionService;

    @Autowired
    private UbicacionRepository ubicacionRepository;

    @BeforeEach
    void limpiarDatos() {
        ubicacionRepository.deleteAll();
    }

    @Test
    void distanciaEntreMismoPuntoDebeSerCero() {
        double distancia = geolocalizacionService.calcularDistanciaKm(
                -33.4378, -70.6504,
                -33.4378, -70.6504
        );
        assertThat(distancia).isCloseTo(0.0, within(0.0001));
    }

    @Test
    void distanciaEntreHitosRealesDeChileDebeSerPrecisa() {
        // Plaza de Armas (Santiago) -> Costanera Center (~4.66 km en línea recta)
        double santiagoCorto = geolocalizacionService.calcularDistanciaKm(
                -33.4378, -70.6504,
                -33.4172, -70.6067
        );
        assertThat(santiagoCorto).isCloseTo(4.66, within(0.2));

        // Santiago (Plaza de Armas) -> Valparaíso (Plaza Sotomayor) (~99 km en línea recta)
        double santiagoValparaiso = geolocalizacionService.calcularDistanciaKm(
                -33.4378, -70.6504,
                -33.0389, -71.6299
        );
        assertThat(santiagoValparaiso).isCloseTo(99.0, within(3.0));
    }

    @Test
    void buscarCercanasFiltraPorRadioYOrdenaPorDistanciaAscendente() {
        // Origen: Plaza de Armas, Santiago (-33.4378, -70.6504)
        geolocalizacionService.guardar(new UbicacionRequest(
                "Aeropuerto SCL", "Terminal Internacional", -33.3930, -70.7858, "Pudahuel"
        )); // ~13.5 km (fuera de radio de 6 km)

        geolocalizacionService.guardar(new UbicacionRequest(
                "Costanera Center", "Torre", -33.4172, -70.6067, "Providencia"
        )); // ~4.66 km (dentro)

        geolocalizacionService.guardar(new UbicacionRequest(
                "La Moneda", "Palacio", -33.4429, -70.6539, "Santiago Centro"
        )); // ~0.65 km (más cercana)

        List<UbicacionResponse> cercanas = geolocalizacionService.buscarCercanas(-33.4378, -70.6504, 6.0);

        assertThat(cercanas)
                .extracting(UbicacionResponse::nombre)
                .containsExactly("La Moneda", "Costanera Center");
        assertThat(cercanas.get(0).distanciaKm()).isLessThan(cercanas.get(1).distanciaKm());
    }
}

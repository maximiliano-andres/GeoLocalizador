package com.geolocalizador;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.geolocalizador.repository.UbicacionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class UbicacionControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UbicacionRepository ubicacionRepository;

    @BeforeEach
    void limpiarDatos() {
        ubicacionRepository.deleteAll();
    }

    @Test
    void crudCompletoDeUbicaciones() throws Exception {
        String body = """
                {
                  "nombre": "Oficina Central",
                  "descripcion": "Sede Santiago",
                  "latitud": -33.4378,
                  "longitud": -70.6504,
                  "direccion": "Plaza de Armas 123"
                }
                """;

        // 1. Crear (201)
        String respuestaJson = mockMvc.perform(post("/api/ubicaciones")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.nombre").value("Oficina Central"))
                .andExpect(jsonPath("$.fechaRegistro").isNotEmpty())
                .andReturn().getResponse().getContentAsString();

        JsonNode creada = objectMapper.readTree(respuestaJson);
        long id = creada.get("id").asLong();

        // 2. Obtener por ID (200)
        mockMvc.perform(get("/api/ubicaciones/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.latitud").value(-33.4378));

        // 3. Eliminar (204)
        mockMvc.perform(delete("/api/ubicaciones/{id}", id))
                .andExpect(status().isNoContent());

        // 4. Consultar eliminada -> 404
        mockMvc.perform(get("/api/ubicaciones/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error", containsString("Ubicación no encontrada")));
    }

    @Test
    void rechazaCoordenadasYCamposInvalidosEnPost() throws Exception {
        String bodyInvalido = """
                {
                  "nombre": "",
                  "latitud": 95.5,
                  "longitud": -200.0
                }
                """;

        mockMvc.perform(post("/api/ubicaciones")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bodyInvalido))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.nombre").isNotEmpty())
                .andExpect(jsonPath("$.latitud").isNotEmpty())
                .andExpect(jsonPath("$.longitud").isNotEmpty());
    }

    @Test
    void rechazaParametrosInvalidosEnCercanasYDistancia() throws Exception {
        mockMvc.perform(get("/api/ubicaciones/cercanas")
                        .param("lat", "999")
                        .param("lon", "-70.65")
                        .param("radioKm", "-5"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/ubicaciones/distancia")
                        .param("lat1", "-33.4378")
                        .param("lon1", "-70.6504")
                        .param("lat2", "-33.4172")
                        .param("lon2", "-70.6067"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.distanciaKm", allOf(greaterThan(4.4), lessThan(4.9))));
    }
}

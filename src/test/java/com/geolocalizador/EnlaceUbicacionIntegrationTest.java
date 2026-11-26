package com.geolocalizador;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.geolocalizador.model.EnlaceUbicacion;
import com.geolocalizador.repository.EnlaceUbicacionRepository;
import com.geolocalizador.repository.UbicacionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class EnlaceUbicacionIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private EnlaceUbicacionRepository enlaceRepository;

    @Autowired
    private UbicacionRepository ubicacionRepository;

    @MockitoBean
    private JavaMailSender mailSender;

    @BeforeEach
    void limpiarDatos() {
        enlaceRepository.deleteAll();
        ubicacionRepository.deleteAll();
    }

    @Test
    void flujoCompletoConEnvioDeCorreoYCapturaDeUbicacion() throws Exception {
        String crearBody = """
                {
                  "etiqueta": "Laptop Terreno 01",
                  "minutosExpiracion": 30,
                  "correoDestino": "usuario.prueba@ejemplo.com"
                }
                """;

        // 1. Crear enlace y verificar que se invoca Gmail SMTP con el link correcto
        String crearJson = mockMvc.perform(post("/api/enlaces")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(crearBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estado").value("PENDIENTE"))
                .andExpect(jsonPath("$.correoEnviado").value(true))
                .andExpect(jsonPath("$.correoDestino").value("usuario.prueba@ejemplo.com"))
                .andExpect(jsonPath("$.urlCompartir", startsWith("https://geo.ejemplo.com/compartir/")))
                .andReturn().getResponse().getContentAsString();

        JsonNode creado = objectMapper.readTree(crearJson);
        String token = creado.get("token").asText();

        ArgumentCaptor<SimpleMailMessage> mailCaptor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender, times(1)).send(mailCaptor.capture());
        SimpleMailMessage enviado = mailCaptor.getValue();
        assertThat(enviado.getTo()).containsExactly("usuario.prueba@ejemplo.com");
        assertThat(enviado.getSubject()).contains("Laptop Terreno 01");
        assertThat(enviado.getText()).contains("https://geo.ejemplo.com/compartir/" + token);

        // 2. Verificar que la ruta web /compartir/{token} hace forward a /compartir.html
        mockMvc.perform(get("/compartir/{token}", token))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/compartir.html"));

        // 3. Verificar que GET /api/enlaces/{token} conserva correoEnviado=true
        mockMvc.perform(get("/api/enlaces/{token}", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.correoEnviado").value(true))
                .andExpect(jsonPath("$.estado").value("PENDIENTE"));

        // 4. Simular que el usuario acepta permisos y reporta coordenadas reales
        String reporteBody = """
                {
                  "latitud": -33.4378,
                  "longitud": -70.6504,
                  "precisionMetros": 18.5
                }
                """;

        mockMvc.perform(post("/api/enlaces/{token}/ubicacion", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reporteBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("COMPLETADO"))
                .andExpect(jsonPath("$.latitud").value(-33.4378))
                .andExpect(jsonPath("$.longitud").value(-70.6504))
                .andExpect(jsonPath("$.urlMapa", containsString("openstreetmap.org")));

        // 5. Confirmar que también se registró en /api/ubicaciones
        mockMvc.perform(get("/api/ubicaciones"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].nombre").value("Laptop Terreno 01"));

        // 6. Confirmar que el enlace es de un solo uso (reutilizarlo -> 400)
        mockMvc.perform(post("/api/enlaces/{token}/ubicacion", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reporteBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("ya fue utilizado")));
    }

    @Test
    void crearEnlaceSinCorreoNoInvocaSmtp() throws Exception {
        String body = """
                {
                  "etiqueta": "Prueba local sin correo",
                  "minutosExpiracion": 15
                }
                """;

        mockMvc.perform(post("/api/enlaces")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.correoEnviado").value(false))
                .andExpect(jsonPath("$.correoDestino").value(nullValue()));

        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void enlaceExpiradoCambiaAExpiradoYRechazaUbicacion() throws Exception {
        EnlaceUbicacion vencido = new EnlaceUbicacion(
                "token-expirado-test",
                "Equipo vencido",
                LocalDateTime.now().minusMinutes(5)
        );
        enlaceRepository.save(vencido);

        mockMvc.perform(get("/api/enlaces/{token}", "token-expirado-test"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("EXPIRADO"));

        String reporteBody = """
                {
                  "latitud": -33.4378,
                  "longitud": -70.6504
                }
                """;

        mockMvc.perform(post("/api/enlaces/{token}/ubicacion", "token-expirado-test")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reporteBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("expiró")));
    }

    @Test
    void errorDeSmtpDevuelve502YHaceRollbackSinDejarEnlaceHuerfano() throws Exception {
        doThrow(new MailSendException("535 Authentication failed"))
                .when(mailSender).send(any(SimpleMailMessage.class));

        String body = """
                {
                  "etiqueta": "Prueba fallo SMTP",
                  "minutosExpiracion": 30,
                  "correoDestino": "destino@ejemplo.com"
                }
                """;

        mockMvc.perform(post("/api/enlaces")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error", containsString("Gmail SMTP")));

        assertThat(enlaceRepository.count()).isZero();
    }

    @Test
    void rechazaTokenInexistenteYDatosInvalidos() throws Exception {
        mockMvc.perform(get("/api/enlaces/token-que-no-existe"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error", containsString("no encontrado")));

        String bodyInvalido = """
                {
                  "etiqueta": "",
                  "minutosExpiracion": 0,
                  "correoDestino": "correo-invalido"
                }
                """;

        mockMvc.perform(post("/api/enlaces")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bodyInvalido))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.etiqueta").isNotEmpty())
                .andExpect(jsonPath("$.minutosExpiracion").isNotEmpty())
                .andExpect(jsonPath("$.correoDestino").isNotEmpty());
    }

    @Test
    void corsPermiteOrigenConfiguradoYRechazaNoAutorizado() throws Exception {
        mockMvc.perform(options("/api/enlaces")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));

        mockMvc.perform(options("/api/enlaces")
                        .header("Origin", "https://sitio-no-autorizado.ejemplo.com")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }

    @Test
    void rechazaPrecisionNegativaYExpiraEnBloqueAlListar() throws Exception {
        EnlaceUbicacion vencido = new EnlaceUbicacion(
                "token-vencido-listado",
                "Antiguo",
                LocalDateTime.now().minusMinutes(10)
        );
        vencido.setFechaCreacion(LocalDateTime.now().minusMinutes(20));
        enlaceRepository.save(vencido);

        EnlaceUbicacion vigente = new EnlaceUbicacion(
                "token-vigente-listado",
                "Reciente",
                LocalDateTime.now().plusMinutes(30)
        );
        enlaceRepository.save(vigente);

        // GET /api/enlaces expira en bloque y ordena del más reciente al más antiguo
        mockMvc.perform(get("/api/enlaces"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].token").value("token-vigente-listado"))
                .andExpect(jsonPath("$[0].estado").value("PENDIENTE"))
                .andExpect(jsonPath("$[1].token").value("token-vencido-listado"))
                .andExpect(jsonPath("$[1].estado").value("EXPIRADO"));

        // Precisión negativa -> 400 Bad Request
        String precisionInvalida = """
                {
                  "latitud": -33.4378,
                  "longitud": -70.6504,
                  "precisionMetros": -12.0
                }
                """;

        mockMvc.perform(post("/api/enlaces/{token}/ubicacion", "token-vigente-listado")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(precisionInvalida))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.precisionMetros").isNotEmpty());
    }
}

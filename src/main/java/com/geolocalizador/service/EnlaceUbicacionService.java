package com.geolocalizador.service;

import com.geolocalizador.dto.CrearEnlaceRequest;
import com.geolocalizador.dto.EnlaceResponse;
import com.geolocalizador.dto.ReportarUbicacionRequest;
import com.geolocalizador.model.EnlaceUbicacion;
import com.geolocalizador.model.Ubicacion;
import com.geolocalizador.repository.EnlaceUbicacionRepository;
import com.geolocalizador.repository.UbicacionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
public class EnlaceUbicacionService {

    private static final Logger log = LoggerFactory.getLogger(EnlaceUbicacionService.class);

    private final EnlaceUbicacionRepository enlaceRepository;
    private final UbicacionRepository ubicacionRepository;
    private final CorreoService correoService;
    private final GeocodificacionInversaService geocodificacionInversaService;

    public EnlaceUbicacionService(EnlaceUbicacionRepository enlaceRepository,
                                  UbicacionRepository ubicacionRepository,
                                  CorreoService correoService,
                                  GeocodificacionInversaService geocodificacionInversaService) {
        this.enlaceRepository = enlaceRepository;
        this.ubicacionRepository = ubicacionRepository;
        this.correoService = correoService;
        this.geocodificacionInversaService = geocodificacionInversaService;
    }

    /**
     * Crea el enlace fuera de una transacción larga: primero persiste el enlace en BD
     * y luego intenta enviar el correo SMTP. Si el correo falla, el enlace se conserva
     * con correoEnviado=false y errorCorreo informado para poder reintentar o copiarlo.
     */
    public EnlaceResponse crearEnlace(CrearEnlaceRequest request, String baseUrl) {
        String token = UUID.randomUUID().toString();
        int minutos = request.minutosExpiracionEfectivos();
        Instant expiracion = Instant.now().plus(minutos, ChronoUnit.MINUTES);
        EnlaceUbicacion enlace = new EnlaceUbicacion(token, request.etiqueta(), expiracion);

        boolean tieneCorreo = request.correoDestino() != null && !request.correoDestino().isBlank();
        if (tieneCorreo) {
            enlace.setCorreoDestino(request.correoDestino().trim());
        }

        EnlaceUbicacion guardado = enlaceRepository.save(enlace);

        if (tieneCorreo) {
            String urlCompartir = baseUrl + "/compartir/" + token;
            try {
                correoService.enviarEnlaceUbicacion(
                        guardado.getCorreoDestino(),
                        guardado.getEtiqueta(),
                        urlCompartir,
                        minutos);
                guardado.setCorreoEnviado(true);
                guardado.setErrorCorreo(null);
            } catch (MailException | IllegalStateException ex) {
                log.warn("Enlace {} creado, pero falló el envío SMTP a {}: {}",
                        token, guardado.getCorreoDestino(), ex.getMessage());
                guardado.setCorreoEnviado(false);
                guardado.setErrorCorreo("No se pudo enviar el correo. Puedes reintentar o compartir el enlace manualmente.");
            }
            guardado = enlaceRepository.save(guardado);
        }

        return EnlaceResponse.fromEntity(guardado, baseUrl);
    }

    public EnlaceResponse reenviarCorreo(String token, String baseUrl) {
        EnlaceUbicacion enlace = buscarEntidadPorToken(token);
        actualizarExpiracionSiCorresponde(enlace);

        if (enlace.getEstado() != EnlaceUbicacion.Estado.PENDIENTE) {
            throw new IllegalStateException("Solo se puede reenviar el correo de enlaces pendientes.");
        }
        if (enlace.getCorreoDestino() == null || enlace.getCorreoDestino().isBlank()) {
            throw new IllegalStateException("Este enlace no tiene un correo de destino configurado.");
        }

        long minutosRestantes = Math.max(1, ChronoUnit.MINUTES.between(Instant.now(), enlace.getFechaExpiracion()));
        String urlCompartir = baseUrl + "/compartir/" + enlace.getToken();

        correoService.enviarEnlaceUbicacion(
                enlace.getCorreoDestino(),
                enlace.getEtiqueta(),
                urlCompartir,
                (int) minutosRestantes);

        enlace.setCorreoEnviado(true);
        enlace.setErrorCorreo(null);
        EnlaceUbicacion actualizado = enlaceRepository.save(enlace);
        return EnlaceResponse.fromEntity(actualizado, baseUrl);
    }

    @Transactional
    public List<EnlaceResponse> listarEnlaces(String baseUrl) {
        enlaceRepository.marcarExpirados(Instant.now());
        return enlaceRepository.findAllByOrderByFechaCreacionDesc()
                .stream()
                .map(enlace -> EnlaceResponse.fromEntity(enlace, baseUrl))
                .toList();
    }

    @Transactional
    public EnlaceResponse obtenerPorToken(String token, String baseUrl) {
        EnlaceUbicacion enlace = buscarEntidadPorToken(token);
        actualizarExpiracionSiCorresponde(enlace);
        return EnlaceResponse.fromEntity(enlace, baseUrl);
    }

    @Transactional
    public EnlaceResponse registrarUbicacion(String token, ReportarUbicacionRequest request, String baseUrl) {
        EnlaceUbicacion enlace = buscarEntidadPorToken(token);
        actualizarExpiracionSiCorresponde(enlace);

        if (enlace.getEstado() == EnlaceUbicacion.Estado.EXPIRADO) {
            throw new IllegalStateException("Este enlace ya expiró.");
        }
        if (enlace.getEstado() == EnlaceUbicacion.Estado.COMPLETADO) {
            throw new IllegalStateException("Este enlace ya fue utilizado para compartir una ubicación.");
        }

        String direccionAproximada = geocodificacionInversaService.obtenerDireccionAproximada(
                request.latitud(),
                request.longitud());

        enlace.setLatitud(request.latitud());
        enlace.setLongitud(request.longitud());
        enlace.setPrecisionMetros(request.precisionMetros());
        enlace.setDireccionAproximada(direccionAproximada);
        enlace.setFechaCaptura(Instant.now());
        enlace.setEstado(EnlaceUbicacion.Estado.COMPLETADO);
        EnlaceUbicacion actualizado = enlaceRepository.save(enlace);

        String descripcion = request.precisionMetros() != null
                ? String.format("Compartida por enlace (precisión aprox. %.0f m)", request.precisionMetros())
                : "Compartida por enlace";
        ubicacionRepository.save(new Ubicacion(
                enlace.getEtiqueta(),
                descripcion,
                request.latitud(),
                request.longitud(),
                direccionAproximada));

        return EnlaceResponse.fromEntity(actualizado, baseUrl);
    }

    @Transactional
    public EnlaceResponse revocarEnlace(String token, String baseUrl) {
        EnlaceUbicacion enlace = buscarEntidadPorToken(token);
        if (enlace.getEstado() == EnlaceUbicacion.Estado.COMPLETADO) {
            throw new IllegalStateException("No se puede revocar un enlace que ya fue sincronizado.");
        }
        enlace.setEstado(EnlaceUbicacion.Estado.EXPIRADO);
        enlace.setFechaExpiracion(Instant.now());
        EnlaceUbicacion actualizado = enlaceRepository.save(enlace);
        return EnlaceResponse.fromEntity(actualizado, baseUrl);
    }

    @Transactional
    public void eliminarEnlace(String token) {
        EnlaceUbicacion enlace = buscarEntidadPorToken(token);
        enlaceRepository.delete(enlace);
    }

    private EnlaceUbicacion buscarEntidadPorToken(String token) {
        return enlaceRepository.findByToken(token)
                .orElseThrow(() -> new NoSuchElementException("Enlace no encontrado."));
    }

    private void actualizarExpiracionSiCorresponde(EnlaceUbicacion enlace) {
        if (enlace.getEstado() == EnlaceUbicacion.Estado.PENDIENTE && enlace.estaExpirado()) {
            enlace.setEstado(EnlaceUbicacion.Estado.EXPIRADO);
            enlaceRepository.save(enlace);
        }
    }
}

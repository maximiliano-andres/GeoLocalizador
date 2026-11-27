package com.geolocalizador.service;

import com.geolocalizador.dto.CrearEnlaceRequest;
import com.geolocalizador.dto.EnlaceResponse;
import com.geolocalizador.dto.ReportarUbicacionRequest;
import com.geolocalizador.model.EnlaceUbicacion;
import com.geolocalizador.model.Ubicacion;
import com.geolocalizador.repository.EnlaceUbicacionRepository;
import com.geolocalizador.repository.UbicacionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
public class EnlaceUbicacionService {

    private final EnlaceUbicacionRepository enlaceRepository;
    private final UbicacionRepository ubicacionRepository;
    private final CorreoService correoService;

    public EnlaceUbicacionService(EnlaceUbicacionRepository enlaceRepository,
            UbicacionRepository ubicacionRepository,
            CorreoService correoService) {
        this.enlaceRepository = enlaceRepository;
        this.ubicacionRepository = ubicacionRepository;
        this.correoService = correoService;
    }

    @Transactional
    public EnlaceResponse crearEnlace(CrearEnlaceRequest request, String baseUrl) {
        String token = UUID.randomUUID().toString();
        int minutos = request.minutosExpiracionEfectivos();
        Instant expiracion = Instant.now().plus(minutos, ChronoUnit.MINUTES);
        EnlaceUbicacion enlace = new EnlaceUbicacion(token, request.etiqueta(), expiracion);
        if (request.correoDestino() != null && !request.correoDestino().isBlank()) {
            String destino = request.correoDestino().trim();
            enlace.setCorreoDestino(destino);
            String urlCompartir = baseUrl + "/compartir/" + token;
            correoService.enviarEnlaceUbicacion(
                    destino,
                    enlace.getEtiqueta(),
                    urlCompartir,
                    minutos);
            enlace.setCorreoEnviado(true);
        }

        EnlaceUbicacion guardado = enlaceRepository.save(enlace);
        return EnlaceResponse.fromEntity(guardado, baseUrl);
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

        enlace.setLatitud(request.latitud());
        enlace.setLongitud(request.longitud());
        enlace.setPrecisionMetros(request.precisionMetros());
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
                null));

        return EnlaceResponse.fromEntity(actualizado, baseUrl);
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

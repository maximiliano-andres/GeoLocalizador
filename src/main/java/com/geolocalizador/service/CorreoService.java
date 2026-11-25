package com.geolocalizador.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class CorreoService {

    private static final Logger log = LoggerFactory.getLogger(CorreoService.class);

    private final JavaMailSender mailSender;
    private final String remitente;

    public CorreoService(JavaMailSender mailSender,
                         @Value("${spring.mail.username:}") String remitente) {
        this.mailSender = mailSender;
        this.remitente = remitente;
        log.info("Estado SMTP Gmail al iniciar -> configurado: {}", remitente != null && !remitente.isBlank());
    }

    public void enviarEnlaceUbicacion(String destino, String etiqueta, String urlCompartir, int minutosExpiracion) {
        if (remitente == null || remitente.isBlank()) {
            throw new IllegalStateException(
                    "SMTP de Gmail no configurado. Define las variables de entorno MAIL_USERNAME y MAIL_PASSWORD.");
        }

        SimpleMailMessage mensaje = new SimpleMailMessage();
        mensaje.setFrom(remitente);
        mensaje.setTo(destino);
        mensaje.setSubject("Solicitud para compartir ubicación: " + etiqueta);
        mensaje.setText(
                "Hola,\n\n" +
                "Se ha generado un enlace de prueba para compartir la ubicación de tu equipo.\n" +
                "Referencia: " + etiqueta + "\n\n" +
                "Para compartir tu ubicación, abre el siguiente enlace y acepta el permiso en tu navegador:\n" +
                urlCompartir + "\n\n" +
                "Este enlace es de un solo uso y expira en " + minutosExpiracion + " minutos.\n" +
                "Si no esperabas este correo, puedes ignorarlo sin problema."
        );

        log.info("Enviando correo a {} con enlace {}", destino, urlCompartir);
        mailSender.send(mensaje);
        log.info("Correo enviado correctamente a {}", destino);
    }
}

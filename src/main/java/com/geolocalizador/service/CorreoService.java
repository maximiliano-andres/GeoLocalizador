package com.geolocalizador.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

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

        String textoPlano = "Hola,\n\n"
                + "Se ha generado una solicitud para compartir la ubicación de tu equipo.\n"
                + "Referencia: " + etiqueta + "\n\n"
                + "Abre el siguiente enlace y acepta el permiso en tu navegador:\n"
                + urlCompartir + "\n\n"
                + "Este enlace es de un solo uso y expira en " + minutosExpiracion + " minutos.\n"
                + "Si no esperabas este correo, puedes ignorarlo sin problema.";

        String etiquetaEscapada = HtmlUtils.htmlEscape(etiqueta);
        String urlEscapada = HtmlUtils.htmlEscape(urlCompartir);

        String html = """
                <!doctype html>
                <html lang="es">
                <body style="margin:0;padding:24px;background:#FAF5EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1D3B3A;">
                  <div style="max-width:520px;margin:0 auto;background:#FFFDF9;border:1px solid #DFD1B6;border-radius:14px;overflow:hidden;">
                    <div style="background:#1D3B3A;color:#FAF5EC;padding:20px 24px;">
                      <h1 style="margin:0;font-size:18px;letter-spacing:-0.2px;">Geolocalizador · Solicitud de ubicación</h1>
                    </div>
                    <div style="padding:24px;">
                      <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Hola,</p>
                      <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
                        Se ha solicitado la ubicación actual del siguiente equipo o referencia:
                      </p>
                      <div style="display:inline-block;background:#EADFC8;border:1px solid #D4A373;color:#1D3B3A;font-weight:700;padding:7px 14px;border-radius:999px;font-size:14px;margin-bottom:20px;">
                        %s
                      </div>
                      <div style="margin:10px 0 22px;">
                        <a href="%s" style="display:inline-block;background:#287271;color:#FAF5EC;text-decoration:none;font-weight:700;font-size:15px;padding:14px 24px;border-radius:10px;">
                          Compartir mi ubicación
                        </a>
                      </div>
                      <p style="margin:0 0 12px;font-size:13px;color:#526A69;line-height:1.5;">
                        No se enviará ningún dato hasta que abras el enlace, presiones el botón y aceptes el permiso de tu navegador.
                        Este enlace es de <strong>un solo uso</strong> y expira en <strong>%d minutos</strong>.
                      </p>
                      <p style="margin:16px 0 0;font-size:12px;color:#526A69;word-break:break-all;">
                        Si el botón no funciona, copia este enlace:<br/>
                        <a href="%s" style="color:#287271;">%s</a>
                      </p>
                    </div>
                  </div>
                </body>
                </html>
                """.formatted(etiquetaEscapada, urlEscapada, minutosExpiracion, urlEscapada, urlEscapada);

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setFrom(remitente);
            helper.setTo(destino);
            helper.setSubject("Solicitud de ubicación: " + etiqueta);
            helper.setText(textoPlano, html);

            log.info("Enviando correo HTML a {} con enlace {}", destino, urlCompartir);
            mailSender.send(mimeMessage);
            log.info("Correo HTML enviado correctamente a {}", destino);
        } catch (MessagingException ex) {
            throw new MailSendException("Error construyendo el correo HTML", ex);
        }
    }
}

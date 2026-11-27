package com.geolocalizador.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Component
public class AdminKeyFilter extends OncePerRequestFilter {

    private final String adminKey;

    public AdminKeyFilter(@Value("${app.admin-key:}") String adminKey) {
        this.adminKey = adminKey == null ? "" : adminKey.trim();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        // Si no hay clave configurada, o es preflight CORS (OPTIONS), deja pasar
        if (adminKey.isEmpty() || "OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        // Protegemos las rutas de gestión del panel, dejando públicas solo las del receptor por token
        String path = request.getRequestURI();
        String method = request.getMethod();
        boolean esRutaAdmin = "/api/enlaces".equals(path)
                || "/api/enlaces/".equals(path)
                || (path.startsWith("/api/enlaces/") && ("DELETE".equalsIgnoreCase(method)
                        || "PATCH".equalsIgnoreCase(method)
                        || path.endsWith("/reenviar-correo")));
        if (!esRutaAdmin) {
            filterChain.doFilter(request, response);
            return;
        }

        String recibida = request.getHeader("X-Admin-Key");
        boolean valida = recibida != null && MessageDigest.isEqual(
                adminKey.getBytes(StandardCharsets.UTF_8),
                recibida.getBytes(StandardCharsets.UTF_8));

        if (!valida) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"error\":\"Clave de acceso requerida para usar el panel.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }
}
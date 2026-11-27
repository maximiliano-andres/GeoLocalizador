package com.geolocalizador.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "enlaces_ubicacion", indexes = {
        @Index(name = "idx_enlace_estado_expiracion", columnList = "estado, fechaExpiracion"),
        @Index(name = "idx_enlace_fecha_creacion", columnList = "fechaCreacion")
})
public class EnlaceUbicacion {

    public enum Estado {
        PENDIENTE,
        COMPLETADO,
        EXPIRADO
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    private Long version;

    @Column(nullable = false, unique = true, length = 64)
    private String token;

    @Column(nullable = false)
    private String etiqueta;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Estado estado;

    private String correoDestino;

    @Column(nullable = false)
    private boolean correoEnviado;

    private Double latitud;
    private Double longitud;
    private Double precisionMetros;

    @Column(nullable = false, updatable = false)
    private Instant fechaCreacion;

    @Column(nullable = false)
    private Instant fechaExpiracion;

    private Instant fechaCaptura;

    public EnlaceUbicacion() {
    }

    public EnlaceUbicacion(String token, String etiqueta, Instant fechaExpiracion) {
        this.token = token;
        this.etiqueta = etiqueta;
        this.estado = Estado.PENDIENTE;
        this.correoEnviado = false;
        this.fechaCreacion = Instant.now();
        this.fechaExpiracion = fechaExpiracion;
    }

    public boolean estaExpirado() {
        return Instant.now().isAfter(this.fechaExpiracion);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getEtiqueta() {
        return etiqueta;
    }

    public void setEtiqueta(String etiqueta) {
        this.etiqueta = etiqueta;
    }

    public Estado getEstado() {
        return estado;
    }

    public void setEstado(Estado estado) {
        this.estado = estado;
    }

    public String getCorreoDestino() {
        return correoDestino;
    }

    public void setCorreoDestino(String correoDestino) {
        this.correoDestino = correoDestino;
    }

    public boolean isCorreoEnviado() {
        return correoEnviado;
    }

    public void setCorreoEnviado(boolean correoEnviado) {
        this.correoEnviado = correoEnviado;
    }

    public Double getLatitud() {
        return latitud;
    }

    public void setLatitud(Double latitud) {
        this.latitud = latitud;
    }

    public Double getLongitud() {
        return longitud;
    }

    public void setLongitud(Double longitud) {
        this.longitud = longitud;
    }

    public Double getPrecisionMetros() {
        return precisionMetros;
    }

    public void setPrecisionMetros(Double precisionMetros) {
        this.precisionMetros = precisionMetros;
    }

    public Instant getFechaCreacion() {
        return fechaCreacion;
    }

    public void setFechaCreacion(Instant fechaCreacion) {
        this.fechaCreacion = fechaCreacion;
    }

    public Instant getFechaExpiracion() {
        return fechaExpiracion;
    }

    public void setFechaExpiracion(Instant fechaExpiracion) {
        this.fechaExpiracion = fechaExpiracion;
    }

    public Instant getFechaCaptura() {
        return fechaCaptura;
    }

    public void setFechaCaptura(Instant fechaCaptura) {
        this.fechaCaptura = fechaCaptura;
    }
}

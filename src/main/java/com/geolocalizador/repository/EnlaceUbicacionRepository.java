package com.geolocalizador.repository;

import com.geolocalizador.model.EnlaceUbicacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface EnlaceUbicacionRepository extends JpaRepository<EnlaceUbicacion, Long> {

    Optional<EnlaceUbicacion> findByToken(String token);

    List<EnlaceUbicacion> findAllByOrderByFechaCreacionDesc();

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE EnlaceUbicacion e SET e.estado = com.geolocalizador.model.EnlaceUbicacion$Estado.EXPIRADO " +
            "WHERE e.estado = com.geolocalizador.model.EnlaceUbicacion$Estado.PENDIENTE " +
            "AND e.fechaExpiracion < :ahora")
    int marcarExpirados(@Param("ahora") LocalDateTime ahora);
}

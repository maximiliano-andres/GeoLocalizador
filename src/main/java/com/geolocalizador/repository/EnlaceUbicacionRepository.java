package com.geolocalizador.repository;

import com.geolocalizador.model.EnlaceUbicacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EnlaceUbicacionRepository extends JpaRepository<EnlaceUbicacion, Long> {
    Optional<EnlaceUbicacion> findByToken(String token);
}

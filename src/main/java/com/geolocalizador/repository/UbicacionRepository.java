package com.geolocalizador.repository;

import com.geolocalizador.model.Ubicacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UbicacionRepository extends JpaRepository<Ubicacion, Long> {
    List<Ubicacion> findByNombreContainingIgnoreCase(String nombre);

    List<Ubicacion> findByLatitudBetweenAndLongitudBetween(
            double minLat, double maxLat, double minLon, double maxLon);
}

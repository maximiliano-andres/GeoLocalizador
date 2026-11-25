package com.geolocalizador.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
public class CompartirViewController {

    @GetMapping("/compartir/{token}")
    public String mostrarPaginaCompartir(@PathVariable String token) {
        return "forward:/compartir.html";
    }
}

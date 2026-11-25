<div align="center">

# 📍 Geolocalizador

**Solicita, registra y consulta la ubicación de un equipo mediante enlaces de un solo uso con consentimiento explícito del navegador.**

Aplicación full-stack (Spring Boot + React) diseñada para generar enlaces temporales, enviarlos automáticamente por Gmail SMTP y registrar coordenadas precisas con visualización directa en OpenStreetMap.

<p>
  <img src="https://img.shields.io/badge/Java-21-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java 21" />
  <img src="https://img.shields.io/badge/Spring_Boot-3.4.5-6DB33F?style=for-the-badge&logo=springboot&logoColor=white" alt="Spring Boot 3.4.5" />
  <img src="https://img.shields.io/badge/React-19.1-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19.1" />
  <img src="https://img.shields.io/badge/Vite-6.3-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite 6.3" />
  <img src="https://img.shields.io/badge/H2_Database-2.3-004088?style=for-the-badge" alt="H2 Database" />
</p>

<p>
  <img src="https://img.shields.io/badge/SMTP-Gmail_STARTTLS-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Gmail SMTP" />
  <img src="https://img.shields.io/badge/Mapas-OpenStreetMap-7EBC6F?style=flat-square&logo=openstreetmap&logoColor=white" alt="OpenStreetMap" />
  <img src="https://img.shields.io/badge/Tests-11_pasando-2EA44F?style=flat-square" alt="11 tests pasando" />
  <img src="https://img.shields.io/badge/Licencia-Sin_definir-lightgrey?style=flat-square" alt="Licencia sin definir" />
</p>

[En 30 segundos](#-el-proyecto-en-30-segundos) · [Capturas](#-capturas) · [Funcionalidades](#-funcionalidades) · [Tecnología](#-tecnología) · [Mapas del sistema](#-mapas-del-sistema) · [Instalación](#-instalación) · [Manual de uso](#-manual-de-uso) · [Seguridad](#-seguridad) · [Pruebas](#-calidad-y-pruebas)

</div>

---

## ⚡ El proyecto en 30 segundos

| Dimensión | Resumen |
| :--- | :--- |
| **El problema** | Confirmar dónde está un equipo en terreno, validar una entrega o asistir a un usuario remoto suele implicar pasos manuales propensos a error (copiar coordenadas o enviar ubicaciones por mensajería informal). |
| **La solución** | Un panel web que genera un enlace único con vencimiento, lo envía por correo si se desea y, tras el permiso explícito del navegador, guarda las coordenadas y genera un acceso directo al mapa. |
| **Para quién** | Equipos de soporte técnico, operaciones en terreno, logística o administradores que necesitan validar la ubicación de dispositivos propios o asistidos. |
| **Seguridad** | El navegador siempre pide permiso explícito al usuario (`Geolocation API`), los enlaces expiran y son de un solo uso, las credenciales SMTP viven en `.env` y el envío usa cifrado `STARTTLS`. |
| **Alcance** | Aplicación full-stack local/privada con API REST, base de datos H2 persistente en archivo, página pública de consentimiento, panel en React y 11 pruebas automatizadas. |

> [!IMPORTANT]
> **Modalidad de uso: herramienta de uso individual / entorno privado.**
> El proyecto no implementa cuentas de usuario, inicio de sesión ni roles. Cualquier persona con acceso al panel (`http://localhost:5173`) o a la API (`http://localhost:8080/api/**`) puede crear enlaces y consultar ubicaciones. Además, utiliza una única cuenta remitente de Gmail configurada mediante variables de entorno.

---

## 🖼️ Capturas

> [!TIP]
> Las capturas de demostración con datos ficticios se almacenarán en `docs/screenshots/` siguiendo la numeración indicada abajo. Una vez generadas, basta con reemplazar cada celda por su imagen correspondiente.

<table>
  <tr>
    <td width="50%" align="center">
      <em>Pendiente: <code>docs/screenshots/01-panel-crear-enlace.png</code></em><br />
      <strong>Panel principal</strong>: formulario para generar enlaces y enviarlos por Gmail SMTP.
    </td>
    <td width="50%" align="center">
      <em>Pendiente: <code>docs/screenshots/02-lista-enlaces-estado.png</code></em><br />
      <strong>Seguimiento en vivo</strong>: listado de enlaces con estado (<code>PENDIENTE</code>, <code>COMPLETADO</code>, <code>EXPIRADO</code>) y auto-actualización.
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <em>Pendiente: <code>docs/screenshots/03-pagina-consentimiento.png</code></em><br />
      <strong>Página de consentimiento</strong>: vista transparente con botón <em>Compartir mi ubicación</em> antes de pedir permiso al navegador.
    </td>
    <td width="50%" align="center">
      <em>Pendiente: <code>docs/screenshots/04-ubicacion-capturada.png</code></em><br />
      <strong>Resultado y mapa</strong>: coordenadas capturadas, precisión estimada en metros y acceso directo a OpenStreetMap.
    </td>
  </tr>
</table>

---

## 🧩 Funcionalidades

### Para el usuario de negocio

| | Funcionalidad | Qué permite hacer |
| :-: | :--- | :--- |
| 🔗 | **Enlaces temporales de un solo uso** | Generar un enlace para un equipo específico (ej. *"Laptop Oficina 04"*) con vencimiento configurable entre 1 minuto y 24 horas. |
| ✉️ | **Envío automático por correo** | Si ingresas un correo de destino, el sistema envía el enlace automáticamente desde tu cuenta de Gmail sin salir del panel. |
| 🛡️ | **Consentimiento transparente** | Quien abre el enlace ve el motivo de la solicitud y debe presionar un botón y aceptar el permiso del navegador; nunca se captura nada de forma oculta. |
| 🗺️ | **Visualización en mapa** | Una vez compartida la ubicación, muestra latitud, longitud, precisión aproximada en metros y un botón directo a OpenStreetMap. |
| 🔄 | **Monitoreo automático** | El panel actualiza el listado cada 10 segundos (activable/desactivable) para ver apenas el equipo responde. |
| 📏 | **Cálculo de distancias y cercanía** | Consultar la distancia en kilómetros entre dos puntos o listar ubicaciones guardadas dentro de un radio determinado. |

### Para el perfil técnico

| | Funcionalidad | Detalle técnico |
| :-: | :--- | :--- |
| 🌐 | **API REST de enlaces (`/api/enlaces`)** | `POST /api/enlaces`, `GET /api/enlaces`, `GET /api/enlaces/{token}`, `POST /api/enlaces/{token}/ubicacion` y forward web en `GET /compartir/{token}`. |
| 📌 | **API REST de ubicaciones (`/api/ubicaciones`)** | CRUD completo (`GET`, `GET /{id}`, `POST`, `DELETE /{id}`), búsqueda radial (`GET /cercanas`) y distancia Haversine (`GET /distancia`). |
| 🧭 | **Cálculo geodésico (Haversine)** | Implementado en `GeolocalizacionService` con radio terrestre de `6371.0 km`, ordenamiento ascendente por distancia y redondeo a 2 decimales. |
| 🗄️ | **Persistencia JPA + H2 en archivo** | Entidades `EnlaceUbicacion` y `Ubicacion` sobre `jdbc:h2:file:./data/geolocalizadordb;AUTO_SERVER=TRUE` (sobrevive reinicios de DevTools). |
| ⚛️ | **Frontend React + Vite con proxy** | Proxy integrado en `vite.config.js` (`/api` y `/compartir` → `localhost:8080`) y CORS explícito en `CorsConfig` para desarrollo. |
| 🚨 | **Manejo centralizado de errores** | `@RestControllerAdvice` (`GlobalExceptionHandler`) traduce `400` (validación/estado), `404` (no encontrado) y `502` (fallo SMTP) a JSON uniforme. |

---

## 🛠️ Tecnología

| Capa | Tecnología | Versión real | Uso en el proyecto |
| :--- | :--- | :--- | :--- |
| **Lenguaje backend** | Java | `21` | Runtime y compilación (`<java.version>21</java.version>`). |
| **Framework backend** | Spring Boot | `3.4.5` | API REST (`web`), validación (`validation`), persistencia (`data-jpa`), correo (`mail`) y recarga (`devtools`). |
| **Base de datos** | H2 Database | `2.3.232` | Almacenamiento local persistente en archivo (`./data/`) y base en memoria aislada para tests. |
| **Frontend** | React + Vite | `^19.1.0` / `^6.3.5` | Panel de administración de enlaces con estados en vivo y diseño responsive. |
| **Pruebas** | JUnit 5 + MockMvc + Mockito | Gestionado por Spring Boot `3.4.5` | 11 pruebas automatizadas (unitarias + integración HTTP end-to-end). |
| **Integraciones** | Gmail SMTP + OpenStreetMap | `smtp.gmail.com:587` | Envío de enlaces con `STARTTLS` obligatorio y apertura directa de coordenadas en mapa. |

### Competencias técnicas que demuestra

- **Arquitectura en capas y transacciones atómicas**: separación limpia entre controladores, DTOs inmutables (`record`), servicios y repositorios JPA; el alta de enlace + envío SMTP corre bajo `@Transactional`, haciendo rollback automático si Gmail falla para evitar enlaces huérfanos.
- **Seguridad defensiva aplicada**: validación estricta con Jakarta Bean Validation (`@Valid` y `@Validated` tanto en cuerpos JSON como en parámetros de query), prevención de XSS en `compartir.html` usando `textContent` y nodos DOM en lugar de `innerHTML`, y verificación de `window.isSecureContext`.
- **Usabilidad y accesibilidad (Ley de Fitts)**: áreas interactivas mínimas de `44×44 px` en botones, inputs y checkbox, separación segura entre acciones adyacentes y botones a ancho completo en pantallas móviles (`≤ 600 px`).
- **Ingeniería de pruebas determinista**: entorno de test aislado de `.env` (`src/test/resources/application.properties`), `JavaMailSender` simulado con `@MockitoBean` y verificación real de códigos HTTP, payloads JSON, expiración y rollback.

---

## 🗺️ Mapas del sistema

### 1. Arquitectura general

```mermaid
flowchart LR
    subgraph Usuario["👤 Usuarios"]
        Admin["Operador en navegador"]
        Equipo["Equipo remoto"]
    end

    subgraph Frontend["⚛️ Frontend"]
        React["Panel React (Vite :5173)"]
        Consent["Página compartir.html"]
    end

    subgraph Backend["☕ Backend Spring Boot (:8080)"]
        CtrlEnlace["EnlaceUbicacionController"]
        CtrlUbic["UbicacionController"]
        SvcEnlace["EnlaceUbicacionService"]
        SvcGeo["GeolocalizacionService"]
        SvcMail["CorreoService"]
    end

    subgraph Datos["🗄️ Datos y Servicios"]
        H2[("H2 Archivo local")]
        Gmail["Gmail SMTP :587"]
        OSM["OpenStreetMap"]
    end

    Admin --> React
    React -- "/api/enlaces" --> CtrlEnlace
    Equipo -- "/compartir/{token}" --> Consent
    Consent -- "GET/POST /api/enlaces" --> CtrlEnlace
    CtrlEnlace --> SvcEnlace
    CtrlUbic --> SvcGeo
    SvcEnlace --> H2
    SvcGeo --> H2
    SvcEnlace --> SvcMail
    SvcMail -- "STARTTLS" --> Gmail
    React -. "Ver en mapa" .-> OSM
```

### 2. Recorrido del usuario

```mermaid
flowchart TD
    Inicio(["👤 Operador abre el panel"]) --> Form["Completa referencia y expiración"]
    Form --> TieneCorreo{"¿Ingresó correo destino?"}
    TieneCorreo -- "Sí" --> EnviaMail["Crea enlace y envía Gmail SMTP"]
    TieneCorreo -- "No" --> SoloLink["Crea enlace y lo copia manualmente"]
    EnviaMail --> AbreEquipo["📱 Equipo abre /compartir/{token}"]
    SoloLink --> AbreEquipo
    AbreEquipo --> Valido{"¿Enlace pendiente y HTTPS/localhost?"}
    Valido -- "No" --> ErrorEstado["Muestra motivo (expirado, usado o falta HTTPS)"]
    Valido -- "Sí" --> ClickBtn["Presiona Compartir mi ubicación"]
    ClickBtn --> Permiso{"¿Acepta permiso del navegador?"}
    Permiso -- "No" --> Denegado["Muestra permiso denegado"]
    Permiso -- "Sí" --> Guarda["Guarda coordenadas y marca COMPLETADO"]
    Guarda --> Mapa(["🗺️ Operador ve coordenadas y abre mapa"])
```

### 3. Flujo crítico: creación, envío SMTP y captura (con errores)

```mermaid
sequenceDiagram
    actor Operador
    participant Panel as Panel React
    participant API as Spring Boot API
    participant SMTP as Gmail SMTP
    participant DB as H2 Database
    actor Equipo as Navegador Equipo

    Operador->>Panel: Clic en "Generar y enviar por correo"
    Panel->>API: POST /api/enlaces
    API->>SMTP: Enviar correo con /compartir/{token}
    alt Fallo de autenticación o red SMTP
        SMTP-->>API: MailException
        API-->>Panel: 502 Bad Gateway (rollback, sin enlace huérfano)
    else Envío exitoso
        SMTP-->>API: 250 OK
        API->>DB: Guardar EnlaceUbicacion (PENDIENTE)
        API-->>Panel: 201 Created (token, urlCompartir)
    end

    Equipo->>API: GET /compartir/{token}
    Equipo->>API: POST /api/enlaces/{token}/ubicacion
    alt Enlace expirado o ya usado
        API-->>Equipo: 400 Bad Request
    else Enlace válido
        API->>DB: Actualizar COMPLETADO + insertar en ubicaciones
        API-->>Equipo: 200 OK (urlMapa)
    end
```

### 4. Modelo de datos

```mermaid
erDiagram
    ENLACES_UBICACION {
        bigint id PK
        varchar token UK
        varchar etiqueta
        varchar estado
        varchar correo_destino
        boolean correo_enviado
        double latitud
        double longitud
        double precision_metros
        timestamp fecha_creacion
        timestamp fecha_expiracion
        timestamp fecha_captura
    }

    UBICACIONES {
        bigint id PK
        varchar nombre
        varchar descripcion
        double latitud
        double longitud
        varchar direccion
        timestamp fecha_registro
    }

    ENLACES_UBICACION ||..o| UBICACIONES : "al completarse registra copia"
```

---

## 📋 Requisitos previos

### Para usar la aplicación (usuario final)

| Elemento | Qué necesitas |
| :--- | :--- |
| **Navegador moderno** | Chrome, Edge, Firefox o Safari con soporte para Geolocation API. |
| **Cuenta de Gmail (solo si envías correos)** | Cuenta con verificación en 2 pasos activada y una **Contraseña de aplicación** de 16 caracteres. |
| **Conexión HTTPS (solo para equipos externos)** | Si abrirás el enlace desde un celular u otro computador, el enlace debe servirse por HTTPS (en `localhost` funciona sin HTTPS). |

### Para instalarla (perfil técnico)

| Requisito | Versión | Obligatorio | Para qué se necesita |
| :--- | :--- | :-: | :--- |
| **JDK (Java)** | `21` o superior | ✅ | Compilar y ejecutar el backend Spring Boot. |
| **Apache Maven** | `3.9+` | ✅ | Gestionar dependencias, correr pruebas y levantar el backend. |
| **Node.js y npm** | Node `20+` / npm `10+` | Opcional | Solo si deseas ejecutar el panel visual en React (`frontend/`). |
| **Cloudflare Tunnel o ngrok** | Cualquiera | Opcional | Solo para exponer `localhost:8080` con HTTPS al probar desde otro dispositivo. |

> [!TIP]
> Nunca uses tu contraseña normal de Gmail en `MAIL_PASSWORD`. Google la rechaza por SMTP: genera una **Contraseña de aplicación** desde *Cuenta de Google → Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones*.

---

## 🚀 Instalación

### Paso 1 · Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto (está ignorado en `.gitignore` y Spring Boot lo carga automáticamente mediante `spring.config.import=optional:file:.env[.properties]`):

| Variable | Obligatoria | Descripción | Valor por defecto |
| :--- | :-: | :--- | :--- |
| `MAIL_USERNAME` | Solo para envío de correos | Cuenta de Gmail remitente (`tu_correo@gmail.com`). | *(vacío)* |
| `MAIL_PASSWORD` | Solo para envío de correos | Contraseña de aplicación de Google (16 caracteres). | *(vacío)* |
| `APP_BASE_URL` | Opcional | URL base usada para construir `urlCompartir` (ej. `http://localhost:8080` o tu túnel `https://...`). | URL de la petición actual |

Ejemplo de `.env`:

```properties
MAIL_USERNAME=tu_correo@gmail.com
MAIL_PASSWORD=xxxxxxxxxxxxxxxx
APP_BASE_URL=http://localhost:8080
```

### Paso 2 · Ejecutar la aplicación

<details open>
<summary><strong>Opción A (recomendada): Desarrollo local (Backend + Frontend React)</strong></summary>

1. **Terminal 1 — Backend Spring Boot:**
   ```bash
   mvn spring-boot:run
   ```
   Backend disponible en `http://localhost:8080`.

2. **Terminal 2 — Frontend React:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Panel visual disponible en **`http://localhost:5173`**.

</details>

<details>
<summary><strong>Opción B: Empaquetar artefactos de producción (JAR + bundle estático)</strong></summary>

1. **Generar el JAR ejecutable del backend:**
   ```bash
   mvn clean package
   java -jar target/geolocalizador-0.0.1-SNAPSHOT.jar
   ```

2. **Generar el bundle optimizado del frontend:**
   ```bash
   cd frontend
   npm install
   npm run build
   ```
   Los archivos estáticos quedan en `frontend/dist/`.

</details>

<details>
<summary><strong>Opción C: Probar desde otro equipo o celular con túnel HTTPS</strong></summary>

1. Expón el puerto `8080` con HTTPS (por ejemplo, con Cloudflare Tunnel):
   ```bash
   cloudflared tunnel --url http://localhost:8080
   ```
2. Copia la URL `https://...` generada en `APP_BASE_URL` dentro de tu `.env` y reinicia `mvn spring-boot:run`.

</details>

### Cómo funciona el acceso

- **Sin login ni usuarios**: el panel y la API no requieren autenticación; están pensados para ejecutarse en tu entorno local o red privada.
- **Credenciales SMTP**: provienen exclusivamente de `MAIL_USERNAME` y `MAIL_PASSWORD` en `.env` (o variables de entorno del sistema). Para cambiar la clave, edita `.env` y reinicia el backend.
- **Si falta la configuración SMTP**: crear enlaces sin correo sigue funcionando normalmente; si intentas enviar un correo, el servidor responde `400 Bad Request` indicando qué variables faltan.
- **Consola H2**: disponible en `http://localhost:8080/h2-console` con JDBC URL `jdbc:h2:file:./data/geolocalizadordb`, usuario `sa` y contraseña vacía.

---

## 📖 Manual de uso

1. **Paso 1 · Abrir el panel**: entra a `http://localhost:5173` en tu navegador.
2. **Paso 2 · Completar la solicitud**: escribe una referencia en **Referencia / Equipo \*** (por ejemplo, *"Celular soporte"*), ajusta **Expira en (min)** y, si deseas envío automático, ingresa el **Correo destino (opcional)**.
3. **Paso 3 · Generar el enlace**: presiona **Generar enlace** (o **Generar y enviar por correo** si llenaste el correo).
4. **Paso 4 · Compartir y autorizar**: abre el enlace desde el correo o usando los botones **Copiar** / **Abrir** del panel. En la página que se abre, presiona **Compartir mi ubicación** y acepta el permiso del navegador.
5. **Paso 5 · Consultar el resultado**: vuelve al panel (se actualiza solo cada 10 segundos si **Auto-actualizar (10s)** está marcado, o presiona **Actualizar**). Verás el estado **`COMPLETADO`**, las coordenadas y el botón **Ver en mapa**.

### Si ves este mensaje…

| Si ves este mensaje… | Qué hacer |
| :--- | :--- |
| `SMTP de Gmail no configurado. Define las variables de entorno MAIL_USERNAME y MAIL_PASSWORD.` | Completa esas dos variables en `.env` y reinicia `mvn spring-boot:run` (Spring Boot no recarga `.env` en caliente). |
| `Error al enviar correo por Gmail SMTP: ...` | Verifica que `MAIL_PASSWORD` sea una **Contraseña de aplicación** de Google (sin errores de tipeo) y que la verificación en 2 pasos esté activa. |
| `No se pudo conectar con el backend en http://localhost:8080.` | Asegúrate de que `mvn spring-boot:run` esté ejecutándose sin errores en otra terminal. |
| `Este enlace debe abrirse mediante HTTPS (o localhost) para que el navegador permita compartir la ubicación.` | Si abres el link desde otro dispositivo, usa un túnel HTTPS en `APP_BASE_URL` y genera un enlace nuevo. |
| `Permiso de ubicación denegado por el usuario.` | Habilita el permiso de ubicación para ese sitio en la barra de direcciones del navegador e intenta de nuevo. |
| `Este enlace ha expirado.` / `Este enlace ya fue utilizado...` | Los enlaces vencen y son de un solo uso; genera uno nuevo desde el panel. |

> [!TIP]
> El panel incluye la casilla **Auto-actualizar (10s)** activada por defecto y muestra directamente el motivo exacto de cada error devuelto por el servidor o por Gmail SMTP.

---

## 🔒 Seguridad

| Riesgo | Cómo se mitiga (verificado en el código) |
| :--- | :--- |
| **Rastreo sin consentimiento** | La página `compartir.html` requiere acción manual en el botón y aprobación explícita del permiso nativo `navigator.geolocation`, bloqueando contextos no seguros (`!window.isSecureContext`). |
| **Reutilización o adivinación de enlaces** | Cada enlace usa un token `UUID` aleatorio único, expira automáticamente tras el tiempo configurado y se bloquea tras el primer uso (`Estado.COMPLETADO`). |
| **Exposición de credenciales SMTP** | `MAIL_USERNAME` y `MAIL_PASSWORD` se leen desde `.env` (excluido en `.gitignore`) y la conexión a Gmail exige `STARTTLS` (`mail.smtp.starttls.required=true`). |
| **Inyección SQL y datos malformados** | Persistencia mediante Spring Data JPA / Hibernate con consultas parametrizadas y validación estricta de rangos geográficos (`-90..90`, `-180..180`), correos y campos requeridos. |
| **Cross-Site Scripting (XSS)** | `compartir.html` renderiza mensajes con `textContent` y crea enlaces con `document.createElement("a")` en lugar de `innerHTML`. |
| **CORS abierto** | `CorsConfig` restringe `/api/**` únicamente a `http://localhost:5173` y `http://127.0.0.1:5173`. |

---

## ✅ Calidad y pruebas

Ejecutar la suite completa del backend (**11 pruebas automatizadas**):

```bash
mvn test
```

Verificar la compilación del frontend React:

```bash
cd frontend && npm run build
```

*(El proyecto no incluye un linter configurado como ESLint o Checkstyle.)*

**Qué cubren las 11 pruebas** (aisladas del `.env` real usando `src/test/resources/application.properties`):
- `GeolocalizacionServiceTest` *(3 casos)*: precisión de Haversine entre hitos reales (mismo punto `0 km`, Santiago corto y Santiago–Valparaíso) y filtrado/ordenamiento radial.
- `UbicacionControllerIntegrationTest` *(3 casos)*: CRUD completo HTTP (`201`, `200`, `204`, `404`), rechazo `400` de coordenadas inválidas y validación de parámetros en `/cercanas` y `/distancia`.
- `EnlaceUbicacionIntegrationTest` *(5 casos)*: flujo end-to-end con `JavaMailSender` mockeado, forward `/compartir/{token}`, captura + doble registro en `ubicaciones`, bloqueo de reutilización (`400`), expiración automática (`EXPIRADO`), rollback + `502` ante fallo SMTP y `404`/`400` en entradas inválidas.

---

## 📁 Estructura del proyecto

```text
geolocalizador/
├── pom.xml                                # Dependencias y configuración Maven (Java 21, Spring Boot 3.4.5)
├── src/main/java/com/geolocalizador/
│   ├── config/                            # Configuración CORS para el frontend
│   ├── controller/                        # Endpoints REST (/api/ubicaciones, /api/enlaces) y vista /compartir
│   ├── dto/                               # Records de entrada/salida con validaciones Jakarta
│   ├── exception/                         # Manejo centralizado de errores HTTP (400, 404, 502)
│   ├── model/                             # Entidades JPA (Ubicacion y EnlaceUbicacion)
│   ├── repository/                        # Repositorios Spring Data JPA
│   └── service/                           # Lógica geodésica (Haversine), enlaces y envío SMTP Gmail
├── src/main/resources/
│   ├── application.properties             # Configuración de H2 en archivo, Gmail SMTP e importación de .env
│   └── static/                            # Página pública de consentimiento (compartir.html)
├── src/test/
│   ├── java/com/geolocalizador/           # 11 pruebas unitarias y de integración con MockMvc
│   └── resources/                         # Propiedades aisladas para pruebas (H2 en memoria, sin .env)
└── frontend/
    └── src/                               # Panel visual en React 19 + Vite (App.jsx y styles.css)
```

---

## ❓ Preguntas frecuentes

<details>
<summary><strong>¿Esta aplicación modifica o borra archivos de mi equipo o mi cuenta de Gmail?</strong></summary>

No. Solo guarda registros en su base de datos local (`./data/geolocalizadordb`) y, únicamente cuando completas el campo **Correo destino**, envía un correo simple usando las credenciales SMTP configuradas en `.env`.

</details>

<details>
<summary><strong>¿Pueden usarla varias personas al mismo tiempo?</strong></summary>

No está diseñada como sistema multiusuario: no tiene cuentas, login ni permisos por rol. Puede usarse de forma individual o compartida dentro de una red interna de confianza, teniendo en cuenta que todos verían el mismo historial de enlaces.

</details>

<details>
<summary><strong>No arranca el backend o los cambios en <code>.env</code> no se aplican</strong></summary>

Verifica tener Java 21+ y Maven instalados (`mvn -version`). Si editaste `.env`, detén el servidor con `Ctrl + C` y vuelve a ejecutar `mvn spring-boot:run`, ya que Spring Boot solo lee `.env` al iniciar.

</details>

<details>
<summary><strong>Olvidé o rechaza la contraseña de Gmail (error 535)</strong></summary>

Gmail no permite usar la contraseña normal de tu cuenta vía SMTP. Genera una nueva **Contraseña de aplicación** en la configuración de seguridad de tu cuenta de Google, pégala en `MAIL_PASSWORD` dentro de `.env` y reinicia el backend.

</details>

<details>
<summary><strong>Abrí el enlace en mi celular y no carga o no pide ubicación</strong></summary>

Si el enlace dice `http://localhost:8080`, solo funcionará en el computador donde corre el servidor. Para abrirlo desde un celular necesitas exponer el puerto `8080` con HTTPS (por ejemplo con Cloudflare Tunnel), poner esa URL en `APP_BASE_URL` y reiniciar el backend.

</details>

---

## 🔭 Limitaciones conocidas y próximos pasos

| Hoy | Evolución propuesta |
| :--- | :--- |
| Sin autenticación ni roles en el panel y la API (`/api/**`). | Incorporar Spring Security + JWT o OAuth2 para uso multiusuario. |
| Base de datos H2 local con consola habilitada en `/h2-console`. | Migrar a PostgreSQL + PostGIS para consultas espaciales nativas y deshabilitar consolas en producción. |
| Sin rate limiting en creación de enlaces ni envío de correos. | Agregar límite de tasa (ej. Bucket4j) para prevenir abuso de SMTP. |
| Visualización en mapa abriendo OpenStreetMap en pestaña externa. | Integrar un mapa interactivo embebido (Leaflet) dentro del panel React. |
| Sin contenedorización (`Dockerfile`) ni pipeline CI. | Añadir `Dockerfile`, `docker-compose.yml` y GitHub Actions para correr `mvn test` y `npm run build` en cada PR. |

---

<div align="center">

Desarrollado por **[Tu Nombre / Usuario de GitHub](https://github.com/tu-usuario)**

*Backend Java & Spring Boot · APIs REST y Persistencia JPA · Frontend React · Testing Automatizado · UX y Seguridad Aplicada*

</div>

# Geolocalizador — Guía de uso

API REST en **Spring Boot 3 (Java 21)** para registrar ubicaciones, calcular distancias y enviar enlaces de prueba por correo (SMTP de Gmail) para solicitar la ubicación de un equipo con consentimiento explícito del navegador.

---

## 1. Requisitos previos

- **Java 21+** y **Maven 3.9+**
- Una cuenta de **Gmail** con **Verificación en 2 pasos** activada y una **Contraseña de aplicación** (16 caracteres):
  1. Entra a [Cuenta de Google → Seguridad](https://myaccount.google.com/security).
  2. Activa **Verificación en 2 pasos** (si no está activa).
  3. Busca **Contraseñas de aplicaciones**, crea una llamada `Geolocalizador` y copia la clave generada.

---

## 2. Configurar el archivo `.env`

Crea o edita el archivo `.env` en la raíz del proyecto (este archivo está ignorado en `.gitignore` para proteger tus credenciales):

```properties
MAIL_USERNAME=tu_correo@gmail.com
MAIL_PASSWORD=xxxx xxxx xxxx xxxx
APP_BASE_URL=
```

- `MAIL_USERNAME`: tu correo de Gmail.
- `MAIL_PASSWORD`: la **Contraseña de aplicación** de 16 caracteres (no tu clave normal de Gmail).
- `APP_BASE_URL`:
  - Déjalo vacío si solo vas a probar en tu mismo equipo (`http://localhost:8080`).
  - Si vas a abrir el enlace desde **otro equipo o celular**, pon aquí tu URL pública **HTTPS** (ver sección 4).

> Spring Boot cargará automáticamente el archivo `.env` al iniciar gracias a `spring.config.import=optional:file:.env[.properties]`.

---

## 3. Levantar el servidor

En la carpeta del proyecto, ejecuta:

```bash
mvn spring-boot:run
```

Cuando veas `Started GeolocalizadorApplication`, el servidor estará activo en `http://localhost:8080`.

### Levantar el frontend en React (opcional)

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173` en tu navegador para crear/enviar enlaces y ver las ubicaciones recibidas desde la interfaz visual.

---

## 4. Cómo probarlo paso a paso

### Opción A: Prueba rápida en tu mismo equipo (`localhost`)

1. **Crear y enviar el enlace por correo** (en otra terminal):
   ```bash
   curl -X POST http://localhost:8080/api/enlaces \
     -H "Content-Type: application/json" \
     -d '{
       "etiqueta": "Mi laptop de prueba",
       "minutosExpiracion": 30,
       "correoDestino": "tu_correo_destino@gmail.com"
     }'
   ```
   *(Si no quieres enviar correo y solo quieres el link, omite el campo `correoDestino`.)*

   Respuesta de ejemplo:
   ```json
   {
     "token": "a1b2c3d4-...",
     "etiqueta": "Mi laptop de prueba",
     "urlCompartir": "http://localhost:8080/compartir/a1b2c3d4-...",
     "estado": "PENDIENTE",
     "correoEnviado": true,
     "latitud": null,
     "longitud": null
   }
   ```

2. **Abrir el enlace recibido en el correo** (o copiar `urlCompartir` en el navegador).
3. Hacer clic en **"Compartir mi ubicación"** y aceptar el permiso del navegador.
4. **Consultar la ubicación capturada**:
   ```bash
   curl http://localhost:8080/api/enlaces/<TOKEN>
   ```
   Recibirás `estado: "COMPLETADO"`, `latitud`, `longitud`, `precisionMetros` y `urlMapa` (enlace directo a OpenStreetMap).

---

### Opción B: Probar desde otro equipo o celular (requiere HTTPS)

Los navegadores bloquean `navigator.geolocation` en direcciones `http://` externas (solo lo permiten en `localhost` o `https://`). Para probar desde un celular u otro computador:

1. Expon tu puerto local `8080` con un túnel HTTPS gratuito, por ejemplo con **Cloudflare Tunnel**:
   ```bash
   cloudflared tunnel --url http://localhost:8080
   ```
   Te entregará una URL como `https://algo-aleatorio.trycloudflare.com`.

2. Coloca esa URL en tu `.env`:
   ```properties
   APP_BASE_URL=https://algo-aleatorio.trycloudflare.com
   ```
3. Reinicia `mvn spring-boot:run` y ejecuta el `POST /api/enlaces` con `correoDestino`. El correo llegará con el enlace `https://...` listo para abrir desde cualquier dispositivo.

---

## 5. Resumen de todos los endpoints

### Enlaces de ubicación (`/api/enlaces`)

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/enlaces` | Crea un enlace (y envía correo si incluyes `correoDestino`) |
| `GET` | `/api/enlaces` | Lista todos los enlaces creados y su estado |
| `GET` | `/api/enlaces/{token}` | Consulta el estado y coordenadas de un enlace específico |
| `GET` | `/compartir/{token}` | Página web donde el usuario acepta compartir su ubicación |

### Ubicaciones registradas (`/api/ubicaciones`)

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/ubicaciones` | Lista todas las ubicaciones (incluyendo las capturadas por enlace) |
| `POST` | `/api/ubicaciones` | Registra una ubicación manualmente |
| `GET` | `/api/ubicaciones/cercanas?lat=-33.44&lon=-70.65&radioKm=5` | Busca ubicaciones dentro de un radio |
| `GET` | `/api/ubicaciones/distancia?lat1=-33.4378&lon1=-70.6504&lat2=-33.4172&lon2=-70.6067` | Calcula distancia en km (Haversine) |

### Consola de base de datos H2

Mientras el servidor esté corriendo, puedes inspeccionar las tablas en:
- URL: `http://localhost:8080/h2-console`
- JDBC URL: `jdbc:h2:mem:geolocalizadordb`
- User: `sa` | Password: *(vacío)*

> Nota: H2 está en memoria, así que los datos se reinician cada vez que detienes el servidor.

# Recibos Veneiatech en tu servidor

Tres archivos:

- `index.html`: el generador. Descarga el PDF y lo envía a tu n8n.
- `n8n-recibos-workflow.json`: el workflow que recibe el recibo, comprueba la clave y te manda el PDF por correo.
- `LEEME.md`: esta guía.

La dirección de ejemplo es `recibos.veneiatech.de`. Si prefieres otra, cámbiala en todos los pasos.

---

## 1. Crea la clave secreta

En tu servidor ejecuta:

```bash
openssl rand -base64 32
```

Guarda el resultado. Es la clave que usarás en n8n (paso 3) y en la página (paso 4). No la publiques ni la subas a GitHub.

## 2. Publica la página

**DNS (INWX):** crea un registro `A` con nombre `recibos` que apunte a la IP de tu servidor. Tarda de unos minutos a una hora.

**Sube el archivo:**

```bash
ssh usuario@IP-del-servidor "sudo mkdir -p /var/www/recibos"
scp index.html usuario@IP-del-servidor:/tmp/
ssh usuario@IP-del-servidor "sudo mv /tmp/index.html /var/www/recibos/index.html"
```

**Sírvela con el mismo proxy que ya usa n8n.** Usa solo la opción que corresponda a tu servidor.

*Opción A: Nginx*

Crea `/etc/nginx/sites-available/recibos`:

```nginx
server {
    server_name recibos.veneiatech.de;
    root /var/www/recibos;
    index index.html;
    add_header X-Robots-Tag "noindex, nofollow";
    location / { try_files $uri /index.html; }
}
```

Luego activa el sitio y saca el certificado HTTPS:

```bash
sudo ln -s /etc/nginx/sites-available/recibos /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d recibos.veneiatech.de
```

*Opción B: Caddy* (Caddy pone el HTTPS solo). Añade esto al `Caddyfile`:

```
recibos.veneiatech.de {
    root * /var/www/recibos
    file_server
    header X-Robots-Tag "noindex, nofollow"
}
```

Después: `sudo systemctl reload caddy`.

**Opcional, más privacidad:** para que nadie más pueda ni ver la página, añade una contraseña al sitio. En Nginx es `auth_basic` y en Caddy es `basic_auth`. Aunque no la pongas, nadie puede enviar recibos sin la clave.

## 3. Configura n8n (n8n.veneiatech.de)

1. **Importa el workflow:** Workflows → Import from File → `n8n-recibos-workflow.json`.
2. **Configura el nodo "Webhook recibo":**
   - En Credential, elige *Create new* (tipo **Header Auth**).
   - **Name:** `X-Veneiatech-Key`
   - **Value:** la clave del paso 1
3. **Configura el nodo "Enviarme el PDF":** conecta tu cuenta de Gmail (OAuth).
4. **Revisa el destino:** en el nodo "Validar y preparar PDF", la primera línea define a qué correo llegan los recibos (`info@veneiatech.de`). Si esos correos no aparecen en tu bandeja de entrada, pon ahí tu Gmail directamente. Gmail a veces oculta los correos que te vuelven a ti mismo por reenvío.
5. **Activa el workflow** con el interruptor de arriba a la derecha.
6. **URL de producción:** `https://n8n.veneiatech.de/webhook/recibo-veneiatech`

**Seguridad:** cuando todo funcione, cambia en el nodo Webhook → Options → *Allowed Origins (CORS)* el `*` por `https://recibos.veneiatech.de`.

## 4. Conecta la página

1. Abre `https://recibos.veneiatech.de`.
2. Despliega **Conexión con el servidor**.
3. Revisa la URL del webhook y pega la clave.
4. Pulsa **Guardar conexión**. El indicador de arriba pasa a "Servidor conectado".
5. Pulsa **Enviar a mi correo** con los datos de ejemplo. En segundos te llega el PDF.

## Qué guarda cada parte

- **Tu correo:** recibe una copia de cada recibo que envías, con el PDF adjunto. Es tu archivo permanente.
- **Historial de la página:** se guarda en el navegador donde la usas. Si cambias de computador o borras los datos del navegador, ese historial empieza vacío, pero los PDFs siguen en tu correo.

## Si algo falla

| Mensaje en la página | Causa probable |
|---|---|
| "El servidor rechazó la clave" | La clave de la página no es igual a la de la credencial Header Auth. |
| "El webhook no existe o el workflow no está activo" | El workflow está apagado, o la ruta no es `recibo-veneiatech`. |
| "No se pudo conectar con el servidor" | Falla de CORS, de DNS o del certificado. Revisa Allowed Origins y que n8n responda por HTTPS. |
| "El servidor respondió con un error (500)" | Abre Executions en n8n. Ahí verás qué nodo falló, normalmente la credencial de Gmail. |

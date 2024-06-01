# WebhookToLocalSQLServer

Aplicación Deno para escuchar Webhooks y ejecutar consultas en un servidor SQL local. Puedes usar un tunel (Como Ngrok) para generar una dirección pública y configurarlo en tu servicio de Webhooks.


## Características

- **Escucha de Webhooks**: Recibe notificaciones automáticas de tus servicios web.
- **Ejecución de consultas SQL**: Ejecuta consultas en tu servidor SQL local para insertar, actualizar o modificar datos.
- **Ejemplo de caso de uso**: Se puede configurar un Webhook en tu Ecommerce y cuando se haga un pedido, este ejecuta una acción en el servidor local, como insertar el pedido en la base de datos o actualizar el inventario.


## Requisitos

- **Deno**: Puedes instalarlo siguiendo las instrucciones en [deno.land](https://deno.land/#installation).
- **Servidor SQL local**: Un servidor SQL instalado y configurado en tu máquina local.
- **Ngrok**: Para configurar una dirección pública a tu servidor local. Puedes descargarlo desde [ngrok.com](https://ngrok.com/).


## Instalación

1. Clona este repositorio en tu máquina local:

    ```bash
    git clone https://github.com/wZVanG/WebhookToLocalSQLServer.git
    ```

2. Navega al directorio del proyecto:

    ```bash
    cd WebhookToLocalSQLServer
    ```

## Configuración

1. Configura la conexión a tu base de datos SQL local. Crea un archivo `.env` en el directorio raíz del proyecto con el siguiente formato:

    ```env
    SYNC_SERVER_PORT=8000 # Puerto en el que se ejecutará el servidor web de sincronización
    DATABASE_HOST="127.0.0.1"
    DATABASE_USER="sa"
    DATABASE_PASSWORD="mypassword"
    DATABASE_NAME="mydatabase"
    DATABASE_PORT=1433
    ```

2. Asegúrate de que tu servidor SQL esté en funcionamiento y accesible desde tu máquina local.
3. Configura Ngrok para permitir el acceso seguro al servidor local:

    - Descarga e instala Ngrok desde [ngrok.com](https://ngrok.com/).
    - Abre una terminal y ejecuta el siguiente comando para crear una URL pública que redirige al puerto en el que está escuchando tu aplicación (por defecto, 8000):

      ```bash
      ngrok http 8000
      ```

    - Ngrok te proporcionará una URL pública que redirige al servidor local. Usa esta URL para configurar los Webhooks de tus servicios web.

## Uso

1. Inicia la aplicación:

    ```bash
    deno run --allow-read --allow-env --allow-net --allow-sys --watch server.ts
    ```

2. La aplicación estará escuchando los Webhooks en el puerto especificado (por defecto, 8000). Configura tus servicios web para enviar Webhooks a la URL pública proporcionada por Ngrok (por ejemplo, `http://<tu-ngrok-url>.ngrok.io/nuevoPedidoCreado`).

3. Define las rutas y la lógica para manejar los Webhooks y ejecutar las consultas SQL en `controllers`.

# Más

1. Testing:

    ```bash
    deno test --allow-read --allow-env --allow-net --allow-sys
    ```

2. Crear ejecutable en carpeta `_dist`:

    ```bash
    deno task appGenerator
    ```

3. Tunnel dominio personalizado

	```bash
	ngrok http --domain=your-free-domain.ngrok-free.app 8000
	```

4. Instalar como Servicio de windows (Ejecutar PowerShell como administrador)

	```bash
	ngrok service install --config C:\DenoApps\ChangSync\ngrok\ngrok.yml
	ngrok service start
	
	#Usar `ngrok service uninstall` para volver a configurar ngrok.yml
	```

	Nota: La primera visita del dominio estático muestra una página de advertencia. Se puede desactivar enviando un request header: `ngrok-skip-browser-warning` con cualquier valor

# Autor

<table>
  <tr>
    <td align="center"><a href="https://stackoverflow.com/users/1074519/walter-chapilliquen-wzvang"><img src="https://i.sstatic.net/aaKX6.jpg?s=256" width="100px;" alt="Walter Chapilliquen"/></a><br /><sub>💻<b>Walter Chapilliquen</b> (wZVanG)</sub><br/><a href="https://stackoverflow.com/users/1074519/walter-chapilliquen-wzvang">Perfil de StackOverflow</a></td>
  </tr>
</table>
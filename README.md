# WebhookToLocalSQLServer

Aplicación Deno para escuchar Webhooks y ejecutar consultas en un servidor SQL local.

## Características

- **Escucha de Webhooks**: Recibe notificaciones automáticas de tus servicios web.
- **Ejecución de consultas SQL**: Ejecuta consultas en tu servidor SQL local para insertar, actualizar o modificar datos.
- **Ejemplo de caso de uso**: Se puede configurar un Webhook en tu Ecommerce y cuando se haga un pedido, este ejecuta una acción en el servidor local, como insertar el pedido en la base de datos o actualizar el inventario.

## Requisitos

- **Deno**: Puedes instalarlo siguiendo las instrucciones en [deno.land](https://deno.land/#installation).
- **Servidor SQL local**: Un servidor SQL instalado y configurado en tu máquina local.

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

1. Configura la conexión a tu base de datos SQL local. Crea un archivo `.env` con el contenido del archivo `.env.example`
2. Asegúrate de que tu servidor SQL esté en funcionamiento y accesible desde tu máquina local.

## Uso

1. Inicia la aplicación:

    ```bash
    deno run --allow-read --allow-env --allow-net --allow-sys --watch server.ts
    ```

2. La aplicación estará escuchando los Webhooks en el puerto especificado (por defecto, 8000). Configura tus servicios web para enviar Webhooks directamente a la URL pública de tu servidor local.

# Más

1. Testing:

    ```bash
    deno test --allow-read --allow-env --allow-net --allow-sys
    ```

2. Crear ejecutable en carpeta `_dist`:

    ```bash
    deno task appGenerator
    ```

# Autor

<table>
  <tr>
    <td align="center"><a href="https://stackoverflow.com/users/1074519/walter-chapilliquen-wzvang"><img src="https://i.sstatic.net/aaKX6.jpg?s=256" width="100px;" alt="Walter Chapilliquen"/></a><br /><sub>💻<b>Walter Chapilliquen</b> (wZVanG)</sub><br/><a href="https://stackoverflow.com/users/1074519/walter-chapilliquen-wzvang">Perfil de StackOverflow</a></td>
  </tr>
</table>

-- Seguir haciendo pruebas de actualización de productos para ver si se está sincronizando el precio, y atributos si es necesario

1: Retail (Este)
2: Mayorista
En caso 2-2 (Jala el que manda el Stock)
- Stock masive: Actualizar EAN, Actualizar Precios, Vaciar etiquetas
- Pasar updgrade20240614
- Desactivar LAN_COMMERCE_EMPTY_SOMEFIELDS_SINCRONIZACION cuando ya se sincronizaron todos los productos
- Permisos Tunnel
- Descripciones de productos no escapan en SQL
- Excel de productos sin foto


-- Crear el tipo de mensaje
CREATE MESSAGE TYPE MensajeMovimientosLocal VALIDATION = NONE;
CREATE CONTRACT ContratoMovimientosLocal (MensajeMovimientosLocal SENT BY INITIATOR);
CREATE QUEUE ColaMovimientosLocal;

-- Crear el servicio que utilizará la cola
CREATE SERVICE ServicioMovimientosLocal ON QUEUE ColaMovimientosLocal (ContratoMovimientosLocal);
CREATE SERVICE ServicioDestinoMovimientosLocal ON QUEUE ColaMovimientosLocal (ContratoMovimientosLocal);

-- Eliminar trigger si existe
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TriggerActualizacionWebLocalInsert')
BEGIN
	DROP TRIGGER TriggerActualizacionWebLocalInsert;
END;

-- Crear el trigger para enviar a la cola el registro de actualizacion_web_local
CREATE TRIGGER TriggerActualizacionWebLocalInsert
ON [BDFCHANG_DEMOCOMMERCE].[dbo].[actualizacion_web_local]
AFTER INSERT
AS
BEGIN
	DECLARE @cuerpoMensaje NVARCHAR(MAX);
	DECLARE @newid NUMERIC(9, 0);
	
	-- Obtener id de sincronización
	SELECT @newid = id FROM inserted;

	-- Mensaje JSON con el id de sincronización
	SET @cuerpoMensaje = N'{"ID":' + CAST(@newid AS NVARCHAR(9)) + '}';

	DECLARE @identificadorDialogo UNIQUEIDENTIFIER;
	
	BEGIN DIALOG CONVERSATION @identificadorDialogo
		FROM SERVICE ServicioMovimientosLocal
		TO SERVICE N'ServicioDestinoMovimientosLocal'
		ON CONTRACT ContratoMovimientosLocal 
		WITH ENCRYPTION = OFF;

	SEND ON CONVERSATION @identificadorDialogo
	MESSAGE TYPE MensajeMovimientosLocal (@cuerpoMensaje);

END;


-- Habilitar el Service Broker
ALTER DATABASE BDFCHANG_DEMOCOMMERCE SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
ALTER DATABASE BDFCHANG_DEMOCOMMERCE SET ENABLE_BROKER;
-- Restablecer el modo de usuario múltiple
ALTER DATABASE BDFCHANG_DEMOCOMMERCE SET MULTI_USER;


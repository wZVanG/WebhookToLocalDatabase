-- Eliminar trigger si existe
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TriggerVentasInsert')
BEGIN
	DROP TRIGGER TriggerVentasInsert;
END;

GO

-- Crear el trigger para insertar en la tabla actualizacion_web_local
CREATE TRIGGER TriggerVentasInsert
ON [dbo].[TBDOCEGR]
AFTER INSERT
AS
BEGIN
    DECLARE @cuerpoMensaje NVARCHAR(MAX);
    DECLARE @itemid NUMERIC(9, 0);
	DECLARE @tipo_movimiento INT;

    SET @tipo_movimiento = 1;

	-- Obtener NEGR de venta agregada
    SELECT @itemid = NEGR FROM inserted;

	-- Insertar en tabla actualizacion_web_local para posterior sincronización
	INSERT INTO actualizacion_web_local (fecha_transaccion, tipo, id_venta) VALUES (GETDATE(), @tipo_movimiento, @itemid);

END;
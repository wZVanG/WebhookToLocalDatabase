-- Eliminar trigger obsoleto (TriggerVentasInsert) si existe
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TriggerVentasInsert')
BEGIN
	DROP TRIGGER TriggerVentasInsert;
END;

GO

IF NOT EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'actualizacion_web_local' 
      AND COLUMN_NAME = 'codigo_item'
)
BEGIN
    ALTER TABLE actualizacion_web_local
    ADD codigo_item NUMERIC(5, 0);
END;

GO

IF NOT EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'actualizacion_web_local' 
      AND COLUMN_NAME = 'codigo_tienda'
)
BEGIN
    ALTER TABLE actualizacion_web_local
    ADD codigo_tienda CHAR(2);
END;

GO

IF NOT EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'actualizacion_web_local' 
      AND COLUMN_NAME = 'stock'
)
BEGIN
    ALTER TABLE actualizacion_web_local
    ADD stock NUMERIC(15, 4);
END;


GO

IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TriggerProducStocksUpdate')
BEGIN
	DROP TRIGGER TriggerProducStocksUpdate;
END;

GO

-- Crear el trigger para insertar en la tabla actualizacion_web_local
CREATE TRIGGER TriggerProducStocksUpdate
ON [dbo].[TBPRODUCSTOCKS]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @tipo_movimiento INT;
    SET @tipo_movimiento = 8;

    -- Insertar en tabla actualizacion_web_local para posterior sincronización
    INSERT INTO actualizacion_web_local (fecha_transaccion, tipo, codigo_item, codigo_tienda, stock)
    SELECT GETDATE(), @tipo_movimiento, CODITM, CODTDA, STOCK 
    FROM inserted;
END;
GO

IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TriggerProducStocksInsert')
BEGIN
	DROP TRIGGER TriggerProducStocksInsert;
END;

GO

CREATE TRIGGER TriggerProducStocksInsert
ON [dbo].[TBPRODUCSTOCKS]
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @tipo_movimiento INT;
    SET @tipo_movimiento = 8;

    -- Insertar en tabla actualizacion_web_local para posterior sincronización
    INSERT INTO actualizacion_web_local (fecha_transaccion, tipo, codigo_item, codigo_tienda, stock)
    SELECT GETDATE(), @tipo_movimiento, CODITM, CODTDA, STOCK 
    FROM inserted;
END;
GO
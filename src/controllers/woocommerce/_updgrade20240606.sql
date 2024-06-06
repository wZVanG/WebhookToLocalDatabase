-- Agregar columna id_proforma a la tabla actualizacion_web_local

IF NOT EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'actualizacion_web_local' 
      AND COLUMN_NAME = 'id_proforma'
)
BEGIN
    ALTER TABLE actualizacion_web_local
    ADD id_proforma INT;
END;

-- Agregar columna ecommerce_status a la tabla actualizacion_web_local

IF NOT EXISTS (
	SELECT 1 
	FROM INFORMATION_SCHEMA.COLUMNS 
	WHERE TABLE_NAME = 'actualizacion_web_local' 
	  AND COLUMN_NAME = 'ecommerce_status'
)
BEGIN
	ALTER TABLE actualizacion_web_local
	ADD ecommerce_status TINYINT;
END;

-- Actualizar los tipos 

UPDATE actualizacion_web_local SET tipo = 1 WHERE tipo = 'server-venta';
UPDATE actualizacion_web_local SET tipo = 2 WHERE tipo = 'server-compra';
UPDATE actualizacion_web_local SET tipo = 3 WHERE tipo = 'web-venta';

-- Cambiar el tipo de la columna tipo a TINYINT

ALTER TABLE actualizacion_web_local
ALTER COLUMN tipo TINYINT;

-- Definir una descripción de ayuda para la columna tipo

-- Verificar si ya existe una descripción para la columna 'tipo'
IF EXISTS (
    SELECT * 
    FROM sys.extended_properties 
    WHERE major_id = OBJECT_ID('actualizacion_web_local')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('actualizacion_web_local'), 'tipo', 'ColumnId')
)
BEGIN
    -- Actualizar la descripción existente para la columna 'tipo'
    EXEC sp_updateextendedproperty 
        @name = N'MS_Description', 
        @value = N'1: SERVER_VENTA, 2: SERVER_COMPRA, 3: WEB_VENTA, 4: WEB_COMPRA, 5: WEB_PRODUCTO, 6: SERVER_PRODUCTO, 7: WEB_STOCK, 8: SERVER_STOCK',
        @level0type = N'SCHEMA', @level0name = 'dbo', 
        @level1type = N'TABLE',  @level1name = 'actualizacion_web_local', 
        @level2type = N'COLUMN', @level2name = 'tipo';
END
ELSE
BEGIN
    -- Si no existe una descripción, agregar una nueva
    EXEC sp_addextendedproperty 
        @name = N'MS_Description', 
        @value = N'1: SERVER_VENTA, 2: SERVER_COMPRA, 3: WEB_VENTA, 4: WEB_COMPRA, 5: WEB_PRODUCTO, 6: SERVER_PRODUCTO, 7: WEB_STOCK, 8: SERVER_STOCK', 
        @level0type = N'SCHEMA', @level0name = 'dbo', 
        @level1type = N'TABLE',  @level1name = 'actualizacion_web_local', 
        @level2type = N'COLUMN', @level2name = 'tipo';
END;

-- Vaciar prueba (NO EJECUTAR EN PRODUCCIÓN)

DELETE FROM TBPROITM WHERE (
	NEGR IN (
		SELECT id_proforma
		FROM actualizacion_web_local
		WHERE id_venta = 17111
	)
);

DELETE FROM TBDOCPRO WHERE (
	NEGR IN (
		SELECT id_proforma
		FROM actualizacion_web_local
		WHERE id_venta = 17111
	)
);

DELETE FROM actualizacion_web_local WHERE id_venta = 17111;

-- vaciar prueba (NO EJECUTAR EN PRODUCCIÓN)



-- Tipos sincronización:
-- SERVER_VENTA: 1,
-- SERVER_COMPRA: 2,
-- WEB_VENTA: 3,
-- WEB_COMPRA: 4,
-- WEB_PRODUCTO: 5,
-- SERVER_PRODUCTO: 6,
-- WEB_STOCK: 7,
-- SERVER_STOCK: 8

-- Eliminar trigger obsoleto (TriggerVentasInsert) si existe
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TriggerVentasInsert')
BEGIN
	DROP TRIGGER TriggerVentasInsert;
END;

-- Eliminar trigger obsoleto (TriggerActualizacionWebLocalInsert) si existe
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TriggerActualizacionWebLocalInsert')
BEGIN
	DROP TRIGGER TriggerActualizacionWebLocalInsert;
END;

-- Eliminar contenido de la tabla actualizacion_web_local

DELETE FROM actualizacion_web_local;

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

IF NOT EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'actualizacion_web_local' 
      AND COLUMN_NAME = 'infojson'
)
BEGIN
    ALTER TABLE actualizacion_web_local
    ADD infojson NVARCHAR(MAX);
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

    -- Verificar si hay cambios relevantes en la columna STOCK
    IF (UPDATE(STOCK))
    BEGIN
        DECLARE @tipo_movimiento INT;
        SET @tipo_movimiento = 8; -- SERVER_STOCK

        -- Insertar en tabla actualizacion_web_local para posterior sincronización
        INSERT INTO actualizacion_web_local (fecha_transaccion, tipo, codigo_item, codigo_tienda, stock)
        SELECT GETDATE(), @tipo_movimiento, i.CODITM, i.CODTDA, i.STOCK 
        FROM inserted i
        INNER JOIN deleted d ON i.CODITM = d.CODITM AND i.CODTDA = d.CODTDA
        WHERE i.STOCK <> d.STOCK OR d.STOCK IS NULL;
    END
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
    SET @tipo_movimiento = 8; -- SERVER_STOCK

    -- Insertar en tabla actualizacion_web_local para posterior sincronización
    INSERT INTO actualizacion_web_local (fecha_transaccion, tipo, codigo_item, codigo_tienda, stock)
    SELECT GETDATE(), @tipo_movimiento, CODITM, CODTDA, STOCK 
    FROM inserted;
END;
GO


-- Tenemos la tabla TBPRODUC que se encarga de almacenar los productos
-- Tenemos la tabla TBPRODUCPRECIOS que se encarga de almacenar los precios de los productos
-- La tabla actualizacion_web_local se encarga de almacenar los cambios que se realizan en la base de datos para una posterior sincronización

-- Creamos el trigger TriggerProductInsert para insertar en la tabla actualizacion_web_local en caso de que se inserte un nuevo producto

IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TriggerProductInsert')
BEGIN
	DROP TRIGGER TriggerProductInsert;
END;

GO

CREATE TRIGGER TriggerProductInsert
ON [dbo].[TBPRODUC]
AFTER INSERT
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @tipo_movimiento INT;
	DECLARE @infojson NVARCHAR(MAX);
	
	SET @tipo_movimiento = 6; -- SERVER_PRODUCTO
	SELECT @infojson = 
			CONCAT(
				'{"fromtable":"TBPRODUC","descripcion":"', COALESCE(DESITM,''), '","precio":', COALESCE(CAST(COSTOACT AS NVARCHAR(MAX)),'null'), ',"unidad":"', COALESCE(UNIDAD,''), '","categoria":"', COALESCE(CODLIN, ''), '"}'
			)
		FROM inserted;
		
	-- La columna infojson almacenará la descripción del producto, el precio, la unidad, y la categoría
	INSERT INTO actualizacion_web_local (fecha_transaccion, tipo, codigo_item, infojson)
	SELECT GETDATE(), @tipo_movimiento, CODITM, @infojson
	FROM inserted;

END;

GO

-- También creamos el trigger TriggerProductUpdate para insertar en la tabla actualizacion_web_local en caso de que se actualice un producto

IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TriggerProductUpdate')
BEGIN
	DROP TRIGGER TriggerProductUpdate;
END;

GO

CREATE TRIGGER TriggerProductUpdate
ON [dbo].[TBPRODUC]
AFTER UPDATE
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @tipo_movimiento INT;
	DECLARE @infojson NVARCHAR(MAX);
	
	SET @tipo_movimiento = 6; -- SERVER_PRODUCTO
	SELECT @infojson = 
			CONCAT(
				'{"fromtable":"TBPRODUC","descripcion":"', COALESCE(DESITM, ''), '","unidad":"', COALESCE(UNIDAD, ''), '","categoria":"', COALESCE(CODLIN,''), '"}'
			)
		FROM inserted;

	-- La columna infojson almacenará la descripción del producto, el precio, la unidad, y la categoría
	INSERT INTO actualizacion_web_local (fecha_transaccion, tipo, codigo_item, infojson)
	SELECT GETDATE(), @tipo_movimiento, CODITM, @infojson
	FROM inserted;

END;

GO

-- Creamos el trigger TriggerPrecioInsert para insertar en la tabla actualizacion_web_local en caso de que se inserte un nuevo precio

IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TriggerPrecioInsert')
BEGIN
	DROP TRIGGER TriggerPrecioInsert;
END;

GO

CREATE TRIGGER TriggerPrecioInsert
ON [dbo].[TBPRODUCPRECIOS]
AFTER INSERT
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @tipo_movimiento INT;
	DECLARE @infojson NVARCHAR(MAX);
	
	SET @tipo_movimiento = 6; -- SERVER_PRODUCTO
	SELECT @infojson = 
			CONCAT(
				'{"fromtable":"TBPRODUCPRECIOS","precio":', COALESCE(CAST(PVENTA AS NVARCHAR(MAX)), 'null'), ',"unidad":"', COALESCE(UNIDADVTA, ''), '"}'
			)
		FROM inserted;

	-- La columna infojson almacenará el precio y la unidad
	INSERT INTO actualizacion_web_local (fecha_transaccion, tipo, codigo_item, infojson)
	SELECT GETDATE(), @tipo_movimiento, CODITM, @infojson
	FROM inserted;

END;

GO

-- Creamos el trigger TriggerPrecioUpdate para insertar en la tabla actualizacion_web_local en caso de que se actualice un precio

IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TriggerPrecioUpdate')
BEGIN
	DROP TRIGGER TriggerPrecioUpdate;
END;

GO

CREATE TRIGGER TriggerPrecioUpdate
ON [dbo].[TBPRODUCPRECIOS]
AFTER UPDATE
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @tipo_movimiento INT;
	DECLARE @infojson NVARCHAR(MAX);
	
	SET @tipo_movimiento = 6; -- SERVER_PRODUCTO
	SELECT @infojson = 
			CONCAT(
				'{"fromtable":"TBPRODUCPRECIOS","precio":', COALESCE(CAST(PVENTA AS NVARCHAR(MAX)), 'null'), ',"unidad":"', COALESCE(UNIDADVTA, ''), '"}'
			)
		FROM inserted;

	-- La columna infojson almacenará el precio y la unidad
	INSERT INTO actualizacion_web_local (fecha_transaccion, tipo, codigo_item, infojson)
	SELECT GETDATE(), @tipo_movimiento, CODITM, @infojson
	FROM inserted;

END;

GO

-- Cambiar tipo de movimiento para los triggers de TBPRODUC y TBPRODUCPRECIOS, para usar la misma función de sincronización en el front-end
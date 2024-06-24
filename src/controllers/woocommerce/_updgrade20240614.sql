-- Tipos sincronización:
-- SERVER_VENTA: 1,
-- SERVER_COMPRA: 2,
-- WEB_VENTA: 3,
-- WEB_COMPRA: 4,
-- WEB_PRODUCTO: 5,
-- SERVER_PRODUCTO: 6,
-- WEB_STOCK: 7,
-- SERVER_STOCK: 8
-- SERVER_PRECIO: 9

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

GO

-- Cambiar descripción de columna tipo

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
        @value = N'1: SERVER_VENTA, 2: SERVER_COMPRA, 3: WEB_VENTA, 4: WEB_COMPRA, 5: WEB_PRODUCTO, 6: SERVER_PRODUCTO, 7: WEB_STOCK, 8: SERVER_STOCK, 9: SERVER_PRECIO',
        @level0type = N'SCHEMA', @level0name = 'dbo', 
        @level1type = N'TABLE',  @level1name = 'actualizacion_web_local', 
        @level2type = N'COLUMN', @level2name = 'tipo';
END
ELSE
BEGIN
    -- Si no existe una descripción, agregar una nueva
    EXEC sp_addextendedproperty 
        @name = N'MS_Description', 
        @value = N'1: SERVER_VENTA, 2: SERVER_COMPRA, 3: WEB_VENTA, 4: WEB_COMPRA, 5: WEB_PRODUCTO, 6: SERVER_PRODUCTO, 7: WEB_STOCK, 8: SERVER_STOCK, 9: SERVER_PRECIO', 
        @level0type = N'SCHEMA', @level0name = 'dbo', 
        @level1type = N'TABLE',  @level1name = 'actualizacion_web_local', 
        @level2type = N'COLUMN', @level2name = 'tipo';
END;

-- Eliminar contenido de la tabla actualizacion_web_local

-- DELETE FROM actualizacion_web_local;

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

IF NOT EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'actualizacion_web_local' 
      AND COLUMN_NAME = 'crud'
)
BEGIN
    ALTER TABLE actualizacion_web_local
    ADD crud CHAR(1);
END;

GO

IF EXISTS (
    SELECT * 
    FROM sys.objects 
    WHERE object_id = OBJECT_ID(N'dbo.EscapeJsonString') 
    AND type = N'FN'
)
BEGIN
    DROP FUNCTION dbo.EscapeJsonString;
END;
GO

CREATE FUNCTION dbo.EscapeJsonString (@input NVARCHAR(MAX))
RETURNS NVARCHAR(MAX)
AS
BEGIN
    DECLARE @output NVARCHAR(MAX) = @input;
    SET @output = REPLACE(@output, '\', '\\');
    SET @output = REPLACE(@output, '"', '\"');
    SET @output = REPLACE(@output, CHAR(10), '\n');
    SET @output = REPLACE(@output, CHAR(13), '\r');
    SET @output = REPLACE(@output, CHAR(9), '\t');
    RETURN @output;
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
        INSERT INTO actualizacion_web_local (fecha_transaccion, tipo, codigo_item, codigo_tienda, stock, crud)
        SELECT GETDATE(), @tipo_movimiento, i.CODITM, i.CODTDA, i.STOCK, 'U' 
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
    INSERT INTO actualizacion_web_local (fecha_transaccion, tipo, codigo_item, codigo_tienda, stock, crud)
    SELECT GETDATE(), @tipo_movimiento, CODITM, CODTDA, STOCK, 'C' 
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
        '{' +
        '"descripcion":"' + LTRIM(RTRIM(dbo.EscapeJsonString(COALESCE(DESITM, '')))) + '",' +
        '"unidad":"' + LTRIM(RTRIM(dbo.EscapeJsonString(COALESCE(UNIDAD, '')))) + '",' +
        '"categoria":"' + LTRIM(RTRIM(dbo.EscapeJsonString(COALESCE(CODLIN, '')))) + '",' +
		'"stockmin":' + COALESCE(CAST(STOCKMIN AS NVARCHAR(MAX)), 'null') + ',' +
		'"activo":' + COALESCE(CAST(ACTIVO AS NVARCHAR(MAX)), '0') + ',' +
		'"codean":"' + LTRIM(RTRIM(dbo.EscapeJsonString(COALESCE(CODEAN, '')))) + '"' +
        '}'
    FROM inserted;
		
	-- La columna infojson almacenará la descripción del producto, el precio, la unidad, y la categoría
	INSERT INTO actualizacion_web_local (fecha_transaccion, tipo, codigo_item, infojson, crud)
	SELECT GETDATE(), @tipo_movimiento, CODITM, @infojson, 'C'
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

    -- Insertar en actualizacion_web_local solo si alguna de las columnas ha cambiado
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN deleted d ON i.CODITM = d.CODITM
        WHERE 
            ISNULL(i.DESITM, '') <> ISNULL(d.DESITM, '') OR
            ISNULL(i.UNIDAD, '') <> ISNULL(d.UNIDAD, '') OR
            ISNULL(i.CODLIN, '') <> ISNULL(d.CODLIN, '') OR
			ISNULL(i.STOCKMIN, '') <> ISNULL(d.STOCKMIN, '') OR
			ISNULL(i.ACTIVO, '') <> ISNULL(d.ACTIVO, '') OR
            ISNULL(i.CODEAN, '') <> ISNULL(d.CODEAN, '')
    )
    BEGIN
        SELECT @infojson = 
            '{' +
            '"descripcion":"' + LTRIM(RTRIM(dbo.EscapeJsonString(COALESCE(i.DESITM, '')))) + '",' +
            '"unidad":"' + LTRIM(RTRIM(dbo.EscapeJsonString(COALESCE(i.UNIDAD, '')))) + '",' +
            '"categoria":"' + LTRIM(RTRIM(dbo.EscapeJsonString(COALESCE(i.CODLIN, '')))) + '",' +
			'"stockmin":' + COALESCE(CAST(i.STOCKMIN AS NVARCHAR(MAX)), 'null') + ',' +
			'"activo":' + COALESCE(CAST(i.ACTIVO AS NVARCHAR(MAX)), '0') + ',' +
            '"codean":"' + LTRIM(RTRIM(dbo.EscapeJsonString(COALESCE(i.CODEAN, '')))) + '"' +
            '}'
        FROM inserted i;

        -- La columna infojson almacenará la descripción del producto, el precio, la unidad, y la categoría
        INSERT INTO actualizacion_web_local (fecha_transaccion, tipo, codigo_item, infojson, crud)
        SELECT GETDATE(), @tipo_movimiento, i.CODITM, @infojson, 'U'
        FROM inserted i;
    END;
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
    DECLARE @codigo_item INT;
    DECLARE @unidad_principal NVARCHAR(50);
    DECLARE @pventa DECIMAL(18,2);
    DECLARE @unidadvta NVARCHAR(50);
    DECLARE @tipounidad INT;

    SET @tipo_movimiento = 9; -- SERVER_PRECIO

    DECLARE PriceCursor CURSOR FOR
    SELECT i.CODITM, p.UNIDAD, i.PVENTA, i.UNIDADVTA, i.TIPOUNIDAD
    FROM inserted i
    JOIN TBPRODUC p ON i.CODITM = p.CODITM;

    OPEN PriceCursor;

    FETCH NEXT FROM PriceCursor INTO @codigo_item, @unidad_principal, @pventa, @unidadvta, @tipounidad;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        DECLARE @precio_final DECIMAL(18,2) = NULL;
        DECLARE @unidad_final NVARCHAR(50) = NULL;

        -- Buscar el precio y la unidad de venta según la lógica de prioridad
        SELECT TOP 1 
            @precio_final = PVENTA,
            @unidad_final = UNIDADVTA
        FROM TBPRODUCPRECIOS
        WHERE CODITM = @codigo_item
        ORDER BY 
            CASE 
                WHEN TIPOUNIDAD = 1 AND UNIDADVTA = @unidad_principal THEN 0
                WHEN TIPOUNIDAD = 1 THEN 1
                WHEN TIPOUNIDAD = 2 AND UNIDADVTA = @unidad_principal THEN 2
                ELSE 3 
            END;

        -- Asignar el precio y la unidad final si se encontró un resultado
        IF @precio_final IS NOT NULL
        BEGIN
            SET @pventa = @precio_final;
            SET @unidadvta = @unidad_final;
        END

        SET @infojson = 
        '{' +
        '"precio":' + COALESCE(CAST(@pventa AS NVARCHAR(MAX)), 'null') + ',' +
        '"unidad":"' + LTRIM(RTRIM(dbo.EscapeJsonString(COALESCE(@unidadvta, '')))) + '"' +
        '}';

        -- Insertar en la tabla de actualización
        INSERT INTO actualizacion_web_local (fecha_transaccion, tipo, codigo_item, infojson, crud)
        VALUES (GETDATE(), @tipo_movimiento, @codigo_item, @infojson, 'I');

        FETCH NEXT FROM PriceCursor INTO @codigo_item, @unidad_principal, @pventa, @unidadvta, @tipounidad;
    END

    CLOSE PriceCursor;
    DEALLOCATE PriceCursor;
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
    DECLARE @codigo_item INT;
    DECLARE @unidad_principal NVARCHAR(50);
    DECLARE @pventa DECIMAL(18,2);
    DECLARE @unidadvta NVARCHAR(50);
    DECLARE @tipounidad INT;

    SET @tipo_movimiento = 9; -- SERVER_PRECIO

    DECLARE PriceCursor CURSOR FOR
    SELECT i.CODITM, p.UNIDAD, i.PVENTA, i.UNIDADVTA, i.TIPOUNIDAD
    FROM inserted i
    JOIN TBPRODUC p ON i.CODITM = p.CODITM;

    OPEN PriceCursor;

    FETCH NEXT FROM PriceCursor INTO @codigo_item, @unidad_principal, @pventa, @unidadvta, @tipounidad;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        DECLARE @precio_final DECIMAL(18,2) = NULL;
        DECLARE @unidad_final NVARCHAR(50) = NULL;

        -- Buscar el precio y la unidad de venta según la lógica de prioridad
        SELECT TOP 1 
            @precio_final = PVENTA,
            @unidad_final = UNIDADVTA
        FROM TBPRODUCPRECIOS
        WHERE CODITM = @codigo_item
        ORDER BY 
            CASE 
                WHEN TIPOUNIDAD = 1 AND UNIDADVTA = @unidad_principal THEN 0
                WHEN TIPOUNIDAD = 1 THEN 1
                WHEN TIPOUNIDAD = 2 AND UNIDADVTA = @unidad_principal THEN 2
                ELSE 3 
            END;

        -- Asignar el precio y la unidad final si se encontró un resultado
        IF @precio_final IS NOT NULL
        BEGIN
            SET @pventa = @precio_final;
            SET @unidadvta = @unidad_final;
        END

        SET @infojson = 
        '{' +
        '"precio":' + COALESCE(CAST(@pventa AS NVARCHAR(MAX)), 'null') + ',' +
        '"unidad":"' + LTRIM(RTRIM(dbo.EscapeJsonString(COALESCE(@unidadvta, '')))) + '"' +
        '}';

        -- Insertar en la tabla de actualización
        INSERT INTO actualizacion_web_local (fecha_transaccion, tipo, codigo_item, infojson, crud)
        VALUES (GETDATE(), @tipo_movimiento, @codigo_item, @infojson, 'U');

        FETCH NEXT FROM PriceCursor INTO @codigo_item, @unidad_principal, @pventa, @unidadvta, @tipounidad;
    END

    CLOSE PriceCursor;
    DEALLOCATE PriceCursor;
END;

GO

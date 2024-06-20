import { WooProductExtend, WooProductMetaData } from '../interfaces.ts';
import CONSTANTS from "../constants.ts";

export const queryList = {
	productDetails: `SELECT CODITM, DESITM, UNIDAD, CODEAN, CODMAR, CODLIN, STOCKMIN, ACTIVO FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PRODUCTOS} WHERE CODITM IN ({skuList})`,
	realStock: `SELECT CODITM, STOCK FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PRODUCTOS_STOCKS} WHERE CODTDA = @codtda AND CODITM IN ({skuList})`,
	realPrice: `
	WITH PreciosOrdenados AS (
		SELECT
			pp.CODITM,
			pp.PVENTA,
			pr.COSTOACT,
			ROW_NUMBER() OVER (
				PARTITION BY pp.CODITM
				ORDER BY 
					CASE 
						WHEN pp.TIPOUNIDAD = 1 THEN 0 
						WHEN pp.UNIDADVTA = pr.UNIDAD THEN 1 
						ELSE 2 
					END
			) AS rn
		FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PRODUCTOS_PRECIOS} pp
		JOIN TBPRODUC pr ON pp.CODITM = pr.CODITM
		WHERE pp.CODITM IN ({skuList}) 
	),
	PreciosSeleccionados AS (
		SELECT
			CODITM,
			PVENTA,
			COSTOACT,
			rn
		FROM PreciosOrdenados
		WHERE rn = 1
	)
	SELECT
		ps.CODITM,
		COALESCE(ps.PVENTA, pr.COSTOACT) AS PRECIOFINAL
	FROM PreciosSeleccionados ps
	JOIN TBPRODUC pr ON ps.CODITM = pr.CODITM
	`
}

export const replaceQueryValues = (query: string, values: { [key: string]: any }): string => {
	return query.replace(/\{(\w+)\}/g, (match, p1) => {
		return values[p1] ?? match;
	});
}

export const productSetEan = (product: WooProductExtend, ean: string): Array<WooProductMetaData> => {
	if (!product.meta_data) product.meta_data = [];
	const ean_meta = product.meta_data.find((meta: WooProductMetaData) => meta.key === "_alg_ean");
	if (ean_meta) {
		ean_meta.value = ean;
	} else {
		product.meta_data.push({ id: 269384, key: "_alg_ean", value: ean });
	}
	return product.meta_data;
}

/*new_product.name = item_extended.descripcion || `Producto ${item.codigo_item}`;
new_product.sku = item.codigo_item;
new_product.stock_quantity = 0;
new_product.regular_price = parseFloat(String(item_extended.precio || 0));
new_product.status = "publish";
new_product.manage_stock = true;
new_product.short_description = item_extended.unidad || "";

if (!item_extended.regular_price) new_product.status = "private";
if (item_extended.codean) new_product.meta_data = productSetEan(item_extended, String(item_extended.codean || ""));*/

export const productSetFields = (fields: { [key: string]: any }): WooProductExtend => {

	const new_product: WooProductExtend = {};
	new_product.name = fields.name || `Producto ${fields.sku}`;
	new_product.sku = fields.sku;
	new_product.stock_quantity = fields.stock_quantity || 0;
	new_product.regular_price = parseFloat(String(fields.regular_price || 0));
	new_product.status = fields.status || "publish";
	new_product.manage_stock = fields.manage_stock ?? true;
	new_product.short_description = fields.unidad || "";
	new_product.low_stock_amount = fields.stockmin ? parseFloat(String(fields.stockmin || 0)) : null;

	if ('description' in fields) new_product.description = fields.description;

	if (!new_product.regular_price) new_product.status = "pending";
	new_product.meta_data = productSetEan(fields, String(fields.codean || ""));

	//low_stock_amount

	return new_product;
}
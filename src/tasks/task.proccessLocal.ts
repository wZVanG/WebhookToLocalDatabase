import logger from "logger";
///import { Transaction, Record } from 'npm:mssql@10.0.1';
import { executeQuery } from '../helpers/db.helper.ts';
import { WooProduct, WooProductLog, LocalProductStock } from '../interfaces.ts';
import Woo from "../controllers/woocommerce/index.ts";
import CONSTANTS from "../constants.ts";
import dbClient from "db";

// deno-lint-ignore require-await
export default async () => {

	let proccesing = false;

	return () => {

		if (proccesing) return;
		proccesing = true;

		(async () => {

			try {

				const db = dbClient();

				if (!db) throw new Error("No hay una conexión a la base de datos activa");

				//const tiposSincronizacion: Array<number> = [CONSTANTS.TIPO_SINCRONIZACION.SERVER_VENTA, CONSTANTS.TIPO_SINCRONIZACION.SERVER_COMPRA, CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRODUCTO, CONSTANTS.TIPO_SINCRONIZACION.SERVER_STOCK];
				const tiposSincronizacion: Array<number> = [CONSTANTS.TIPO_SINCRONIZACION.SERVER_STOCK];
				const query = await executeQuery(db, `SELECT t1.fecha_transaccion, t1.codigo_tienda, t1.codigo_item, t1.stock
					FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION} t1
					INNER JOIN (
						SELECT TOP 50 codigo_item, MAX(fecha_transaccion) AS ultima_fecha
						FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION}
						WHERE tipo IN (${tiposSincronizacion.join(",")}) AND fecha_actualizacion_stock IS NULL
						GROUP BY codigo_item
						ORDER BY ultima_fecha DESC
					) t2 ON t1.codigo_item = t2.codigo_item AND t1.fecha_transaccion = t2.ultima_fecha
					ORDER BY t1.fecha_transaccion DESC
				`);

				if (!query.recordset.length) {
					logger.debug(`No hay productos para sincronizar en WooCommerce`);
					return false;
				}

				const updated_items_to_log: Array<WooProductLog> = [];
				const local_items = query.recordset;

				const skus: Array<string> = local_items.map((row: LocalProductStock) => String(row.codigo_item).replace(/\D/g, ""));
				const skus_not_found: Array<string> = [];

				//Obtener los productos de WooCommerce: id
				const woo_items = await Woo.get("products_advanced", { skus: skus.join(",") });

				const woocommerce_batch_arr: Array<WooProduct> = local_items.reduce((arr: Array<WooProduct>, item: LocalProductStock) => {
					const woo_item_found = woo_items.find((woo_item: WooProduct) => String(woo_item.sku) === String(item.codigo_item));

					if (woo_item_found) {

						const new_item = {
							id: woo_item_found.id,
							stock_quantity: item.stock
						} as WooProduct;

						arr.push(new_item);
						updated_items_to_log.push({ ...new_item, sku: item.codigo_item, codigo_tienda: item.codigo_tienda });

					} else {
						skus.splice(skus.indexOf(String(item.codigo_item)), 1);
						skus_not_found.push(String(item.codigo_item));
					}
					return arr;
				}, []);

				//Eliminar filas de sincronización de productos no encontrados

				if (skus_not_found.length) {
					const skus_escape_not_found = skus_not_found.map((sku: string) => `'${sku}'`).join(",");
					await executeQuery(db, `DELETE FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION} WHERE codigo_item IN (${skus_escape_not_found}) AND tipo IN (${tiposSincronizacion.join(",")})`);
					logger.warn(`Productos no encontrados en WooCommerce: ${skus_not_found.length}, se eliminarán de la sincronización`, skus_not_found);
				}

				logger.debug(`SKUS a sincronizar: ${skus.length ? skus.join(",") : "Ninguno"}`);

				if (!woocommerce_batch_arr.length) return true;

				//Actualizar los productos en WooCommerce
				const result_batch = await Woo.post("products/batch", { update: woocommerce_batch_arr });

				if (!result_batch?.update?.length) return true;

				if (woocommerce_batch_arr.length !== result_batch?.update.length) throw new Error("No se pudo actualizar todos los productos");

				//Eliminar filas de sincronización de productos actualizados

				const skus_escape = skus.map((sku: string) => `'${sku}'`).join(",");

				const result_delete = await executeQuery(db, `DELETE FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION} WHERE codigo_item IN (${skus_escape}) AND tipo IN (${tiposSincronizacion.join(",")})`);

				if (result_delete?.rowsAffected[0] > 0) logger.info(`Productos actualizados: ${updated_items_to_log.length}`, updated_items_to_log);

				return true;

			} catch (error) {
				logger.error(`Error al ejecutar tarea: taskProccessLocal: ${error.message ? error.message : error.toString()}`);
			} finally {
				proccesing = false;
			}

		})();

	};

}
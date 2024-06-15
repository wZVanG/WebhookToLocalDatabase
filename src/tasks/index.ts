import logger, { fileHandler } from "logger";
///import { Transaction, Record } from 'npm:mssql@10.0.1';
import { executeQuery } from '../helpers/db.helper.ts';
import Woo from "../controllers/woocommerce/index.ts";
import { WooProduct, WooProductLog, LocalProductStock } from '../interfaces.ts';
import CONSTANTS from "../constants.ts";
import dbClient from "db";

//type WooCommerceOrderStatusKey = keyof typeof CONSTANTS.WOO_COMMERCE_ORDER_STATUS;

let proccesing = false;

const taskProccessLocal = () => {

	const db = dbClient();

	if (!db) return;

	(async () => {

		if (proccesing) return;

		logger.debug("Ejecutando tarea: taskProccessLocal");

		try {

			proccesing = true;

			//const tiposSincronizacion: Array<number> = [CONSTANTS.TIPO_SINCRONIZACION.SERVER_VENTA, CONSTANTS.TIPO_SINCRONIZACION.SERVER_COMPRA, CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRODUCTO, CONSTANTS.TIPO_SINCRONIZACION.SERVER_STOCK];
			const tiposSincronizacion: Array<number> = [CONSTANTS.TIPO_SINCRONIZACION.SERVER_STOCK];
			const query = await executeQuery(db, `SELECT codigo_tienda, codigo_item, stock FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION} WHERE tipo IN (${tiposSincronizacion.join(",")}) AND fecha_actualizacion_stock IS NULL`);

			if (!query.recordset.length) return false;

			const updated_items_to_log: Array<WooProductLog> = [];
			const local_items = query.recordset;
			const skus = local_items.map((row: LocalProductStock) => String(row.codigo_item));

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
				}
				return arr;
			}, []);

			logger.debug(`SKUS a sincronizar: ${skus.length ? skus.join(",") : "Ninguno"}`);

			//Actualizar los productos en WooCommerce
			const result_batch = await Woo.post("products/batch", { update: woocommerce_batch_arr });

			if (!result_batch?.update?.length) return true;

			if (woocommerce_batch_arr.length !== result_batch?.update.length) throw new Error("No se pudo actualizar todos los productos");

			//Eliminar filas de sincronización de productos actualizados

			const skus_escape = skus.map((sku: string) => `'${sku}'`).join(",");

			console.log("skus_escape", skus_escape);

			const result_delete = await executeQuery(db, `DELETE FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION} WHERE codigo_item IN (${skus_escape}) AND tipo IN (${tiposSincronizacion.join(",")})`);

			logger.debug(`Tareas taskProccessLocal ejecutada correctamente`);

			if (result_delete?.rowsAffected[0] > 0) logger.info(`Productos actualizados: ${updated_items_to_log.length}`, updated_items_to_log);

			return true;

		} catch (error) {
			logger.error(`Error al ejecutar tarea: taskProccessLocal: ${error.message ? error.message : error.toString()}`);
		} finally {
			proccesing = false;
		}

	})();

	fileHandler.flush();

}

export const initTasks = () => {

	logger.info("Tareas programadas iniciadas 🚀");

	setInterval(taskProccessLocal, 10000);

	// Deno.cron("Log a message", { minute: { every: 1 } }, () => {
	// 	console.log("Log a message every 1 minute");
	// });

	//fileHandler.flush();
}

import logger from "logger";
///import { Transaction, Record } from 'npm:mssql@10.0.1';
import { prompt } from "../helpers/index.ts";
import { executeQuery } from '../helpers/db.helper.ts';
import { WooProduct, WooProductLog, LocalProductStockTda, Task } from '../interfaces.ts';
import CONSTANTS from "../constants.ts";
import dbClient from "db";


export default async (task: Task) => {

	const minStockLimitToUpdate = 10;
	const defaultStockLimitToUpdate = 25;
	let stockLimitToUpdate: number = 0;

	while (true) {
		const stockLimitToUpdateInput = await prompt(`Ingrese la cantidad de productos a sincronizar por petición. Presione enter para colocar por defecto ${defaultStockLimitToUpdate}: `);
		if (!stockLimitToUpdateInput) {
			stockLimitToUpdate = defaultStockLimitToUpdate;
			break;
		}
		stockLimitToUpdate = Number(stockLimitToUpdateInput);
		if (stockLimitToUpdate >= minStockLimitToUpdate && stockLimitToUpdate <= 100) break;
		logger.warn(`La cantidad mínima de productos a sincronizar por petición es ${minStockLimitToUpdate} y la máxima es 100`);
	}

	const minTimeInterval = 1000;
	let timeInterval: number = 0;

	while (true) {
		const timeIntervalInput = await prompt(`Ingrese el tiempo de intervalo de la tarea en milisegundos. Presione enter para colocar por defecto ${task.interval}: `);
		if (!timeIntervalInput) {
			timeInterval = Number(task.interval);
			break;
		}
		timeInterval = Number(timeIntervalInput);

		if (timeInterval >= minTimeInterval) break;

		logger.warn(`El tiempo de intervalo mínimo es ${minTimeInterval}`);
	}

	task.interval = timeInterval;

	const fechaEjecucion = new Date().toISOString().split("T")[0].replace(/-/g, "_");
	const mapSkuAndId: { [key: string]: number } = {};

	let proccesing = false;

	let logFileValues: { [key: string]: number } = {};

	return () => {

		if (proccesing) return false;
		proccesing = true;

		(async () => {

			//Colección de sku => id

			if (!Object.keys(mapSkuAndId).length) {
				const csvFileMapSkuAndId = task?.flags?.stockfile ? await Deno.readTextFile(task.flags.stockfile) : null;

				//Cada línea del archivo tiene el formato: id,sku

				if (csvFileMapSkuAndId) {
					csvFileMapSkuAndId.split("\n").forEach((line: string) => {
						const [id, sku] = line.split(",");
						if (id && sku) mapSkuAndId[sku.trim()] = Number(id.trim());
					});
				}
			}

			const totalProductsToUpdate = Object.keys(mapSkuAndId).length;

			const logFile = `./src/tmp/${fechaEjecucion}_updated_products.json`;

			//Primero guardar el cuerpo del archivo si no existe, con todos los sku en 0 (false)

			if (Object.keys(logFileValues).length === 0) {

				try {
					const contentJsonFile = await Deno.readTextFile(logFile);
					logFileValues = JSON.parse(contentJsonFile);
				} catch (_) {
					for (const sku in mapSkuAndId) logFileValues[sku] = 0;
					await Deno.writeTextFile(logFile, JSON.stringify(logFileValues))
				}

			}

			try {

				//Obtener SKU de los productos a sincronizar en la tienda local
				//Solo selecionar los primeros 5 productos del logFileContent que no se hayan actualizado

				const skusSinActualizar = Object.keys(logFileValues).filter((sku: string) => !logFileValues[sku]);

				const skus: Array<string> = skusSinActualizar.slice(0, stockLimitToUpdate);

				const totalActualizados = totalProductsToUpdate - skusSinActualizar.length;

				//Mostrar porcentaje
				logger.info(`Sincronizando productos: ${totalActualizados} / ${totalProductsToUpdate} (✅ ${((totalActualizados / totalProductsToUpdate) * 100).toFixed(2)}%)`);

				if (!skus.length) {
					logger.info("No hay productos para sincronizar");
					clearInterval(task.intervalFn); //Detener la tarea
					await Deno.remove(logFile); //Eliminar el archivo de log
					(() => new Promise(() => { }))();
					return true;
				}

				const db = dbClient();
				if (!db) throw new Error("No hay una conexión a la base de datos activa");

				const skus_escape = skus.map((sku: string) => `'${sku}'`).join(",");

				const query = await executeQuery(db, `SELECT CODITM, STOCK 
					FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PRODUCTOS_STOCKS} WHERE CODTDA = @codtda AND CODITM IN (${skus_escape})`, {
					"codtda": Deno.env.get("LAN_COMMERCE_CODTDA") || "01"
				});

				const woocommerce_batch_arr: Array<WooProduct> = [];
				const updated_items_to_log: Array<WooProductLog> = [];
				const local_items = query.recordset;
				const skus_found: Array<string> = [];
				const skus_not_found: Array<string> = [];

				const local_items_obj: { [key: string]: LocalProductStockTda } = local_items.reduce((obj: { [key: string]: LocalProductStockTda }, item: LocalProductStockTda) => {
					obj[item.CODITM] = item;
					return obj;
				}, {})

				skus.forEach((sku) => {
					if (local_items_obj[sku]) {
						const new_item = {
							id: mapSkuAndId[sku],
							stock_quantity: local_items_obj[sku].STOCK
						} as WooProduct;

						woocommerce_batch_arr.push(new_item);
						updated_items_to_log.push({ ...new_item, sku: sku, codigo_tienda: Deno.env.get("LAN_COMMERCE_CODTDA") || "01" });
						skus_found.push(sku);
					} else {
						skus_not_found.push(sku);
					}
				})

				if (skus_not_found.length) {

					//Actualizar el archivo de log con los sku no encontrados
					for (const sku of skus_not_found) logFileValues[sku] = 1;
					await Deno.writeTextFile(logFile, JSON.stringify(logFileValues));

					logger.warn(`Productos no encontrados en WooCommerce (${skus_not_found.length}): Se omitirán de la sincronización`, skus_not_found);
				}

				logger.debug(`Sincronizando (${skus_found.length}) productos...`);

				if (!woocommerce_batch_arr.length) return false;

				//Actualizar el archivo de log con los sku actualizados
				for (const sku of skus_found) logFileValues[sku] = 1;

				await Deno.writeTextFile(logFile, JSON.stringify(logFileValues));

				logger.info(`Productos actualizados (${updated_items_to_log.length}): `, updated_items_to_log.reduce((acc: { [key: string]: number }, item: WooProduct) => {
					acc[item.sku] = item.stock_quantity;
					return acc;
				}, {}));

				//console.log("woocommerce_batch_arr", woocommerce_batch_arr);

				//Actualizar los productos en WooCommerce
				/*const result_batch = await Woo.post("products/batch", { update: woocommerce_batch_arr });

				if (!result_batch?.update?.length) return true;

				if (woocommerce_batch_arr.length !== result_batch?.update.length) throw new Error("No se pudo actualizar todos los productos");

				//Eliminar filas de sincronización de productos actualizados

				const skus_escape = skus.map((sku: string) => `'${sku}'`).join(",");

				const result_delete = await executeQuery(db, `DELETE FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION} WHERE codigo_item IN (${skus_escape}) AND tipo IN (${tiposSincronizacion.join(",")})`);

				if (result_delete?.rowsAffected[0] > 0) logger.info(`Productos actualizados: ${updated_items_to_log.length}`, updated_items_to_log);

				return true;*/

			} catch (error) {
				logger.error(`Error al ejecutar tarea: taskProccessLocal: ${error.message ? error.message : error.toString()}`);
			} finally {
				proccesing = false;
			}

			return false;

		})();

	};
}
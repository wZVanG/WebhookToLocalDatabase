import logger from "logger";
import { executeQuery } from '../helpers/db.helper.ts';
import { WooProduct, WooProductLog, LocalProductStock } from '../interfaces.ts';
import Woo from "../controllers/woocommerce/index.ts";
import CONSTANTS from "../constants.ts";
import dbClient from "db";

export default async () => {
	let processing = false;

	return () => {
		if (processing) return;
		processing = true;

		(async () => {
			try {
				const db = dbClient();
				if (!db) throw new Error("No hay una conexión a la base de datos activa");

				const tiposSincronizacion = [
					CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRECIO,
					CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRODUCTO,
					CONSTANTS.TIPO_SINCRONIZACION.SERVER_STOCK
				];

				const query = await executeQuery(db, `
					SELECT t1.tipo, t1.fecha_transaccion, t1.codigo_tienda, t1.codigo_item, t1.stock
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

				const enableForceCreateProducts = true;
				const updatedItemsToLog: Array<WooProductLog> = [];
				const localItems = query.recordset;
				const skus = localItems.map(row => String(row.codigo_item).replace(/\D/g, ""));
				const skusNotFound: Array<string> = [];
				const woocommerceBatchArr: Array<WooProduct> = [];
				const wooItems = await Woo.get("products_advanced", { skus: skus.join(",") });

				for (const item of localItems) {
					const newWooItem = {} as WooProduct;
					const wooItemFound = wooItems.find(wooItem => String(wooItem.sku) === String(item.codigo_item));

					let itemExtended: { [key: string]: string } = {};
					try {
						itemExtended = JSON.parse(item.infojson.trim() || "{}");
					} catch (error) {
						logger.error(`Error al parsear JSON de infojson: ${error.message}`);
					}

					if (!wooItemFound && enableForceCreateProducts) {
						let productEmpty = !itemExtended.descripcion;
						if (productEmpty) {
							const result = await executeQuery(db, `
								SELECT DESITM, CODLIN, COSTOACT 
								FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PRODUCTOS} 
								WHERE CODITM = '${item.codigo_item}'
							`);
							if (result.recordset.length) {
								const producto = result.recordset[0];
								itemExtended.descripcion = producto.DESITM;
								itemExtended.codlin = producto.CODLIN;
								itemExtended.precio = producto.COSTOACT;
							}
						}
						newWooItem.name = itemExtended.descripcion || `Producto ${item.codigo_item}`;
						newWooItem.sku = item.codigo_item;
						newWooItem.stock_quantity = 0;
						newWooItem.regular_price = parseFloat(itemExtended.precio) || 0;
					} else if (wooItemFound) {
						newWooItem.id = wooItemFound.id;
						switch (item.tipo) {
							case CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRODUCTO:
								newWooItem.name = itemExtended.descripcion || wooItemFound.name;
								break;
							case CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRECIO:
								newWooItem.regular_price = parseFloat(itemExtended.precio) || wooItemFound.regular_price;
								break;
							case CONSTANTS.TIPO_SINCRONIZACION.SERVER_STOCK:
								newWooItem.stock_quantity = item.stock;
								break;
						}
					}

					if (wooItemFound || enableForceCreateProducts) {
						woocommerceBatchArr.push(newWooItem);
						updatedItemsToLog.push({ ...newWooItem, sku: item.codigo_item, codigo_tienda: item.codigo_tienda });
					} else {
						skusNotFound.push(String(item.codigo_item));
					}
				}

				if (skusNotFound.length) {
					await executeQuery(db, `
						DELETE FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION}
						WHERE codigo_item IN (${skusNotFound.map(sku => `'${sku}'`).join(",")}) 
						AND tipo IN (${tiposSincronizacion.join(",")})
					`);
					logger.warn(`Productos no encontrados en WooCommerce: ${skusNotFound.length}, se eliminarán de la sincronización`, skusNotFound);
				}

				logger.debug(`SKUS a sincronizar: ${skus.length ? skus.join(",") : "Ninguno"}`);
				if (!woocommerceBatchArr.length) return true;

				const resultBatch = await Woo.post("products/batch", { update: woocommerceBatchArr });
				if (!resultBatch?.update?.length || woocommerceBatchArr.length !== resultBatch.update.length) {
					throw new Error("No se pudo actualizar todos los productos");
				}

				const skusToUpdate = skus.map(sku => `'${sku}'`).join(",");
				const resultDelete = await executeQuery(db, `
					DELETE FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION}
					WHERE codigo_item IN (${skusToUpdate}) 
					AND tipo IN (${tiposSincronizacion.join(",")})
				`);

				if (resultDelete?.rowsAffected[0] > 0) {
					logger.info(`Productos actualizados: ${updatedItemsToLog.length}`, updatedItemsToLog);
				}

				return true;
			} catch (error) {
				logger.error(`Error al ejecutar tarea: taskProccessLocal: ${error.message}`);
			} finally {
				processing = false;
			}
		})();
	};
}

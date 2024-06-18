import logger from "logger";
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

				const tiposSincronizacion: Array<number> = [
					CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRECIO,
					CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRODUCTO,
					CONSTANTS.TIPO_SINCRONIZACION.SERVER_STOCK
				];

				const query = await executeQuery(db, `
					SELECT t1.id, t1.tipo, t1.fecha_transaccion, t1.codigo_tienda, t1.codigo_item, t1.stock, t1.infojson, t1.crud
					FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION} t1
					INNER JOIN (
						SELECT codigo_item, tipo, crud, MAX(fecha_transaccion) AS ultima_fecha
						FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION}
						WHERE tipo IN (${tiposSincronizacion.join(",")}) AND fecha_actualizacion_stock IS NULL
						GROUP BY codigo_item, tipo, crud
					) t2 ON t1.codigo_item = t2.codigo_item AND t1.tipo = t2.tipo AND t1.crud = t2.crud AND t1.fecha_transaccion = t2.ultima_fecha
					ORDER BY t1.id ASC
				`);

				if (!query.recordset.length) {
					logger.debug(`No hay productos para sincronizar en WooCommerce`);
					return false;
				}

				//Crear productos si no existen en WooCommerce
				const enable_force_create_products = true;
				const updated_items_to_log: Array<WooProductLog> = [];
				const local_items = query.recordset;
				const skus: Array<string> = local_items.map((row: LocalProductStock) => String(row.codigo_item).replace(/\D/g, ""));
				const sync_ids_to_delete: Array<number> = [];

				//Obtener los productos de WooCommerce: id
				const woo_items = await Woo.get("products_advanced", { skus: skus.join(",") });
				const woocommerce_batch_arr: Array<WooProduct> = [];

				for (const item of local_items) {
					const new_woo_item = {} as WooProduct;
					const woo_item_found: WooProduct | undefined = woo_items.find((woo_item: WooProduct) => String(woo_item.sku) === String(item.codigo_item));
					const item_extended: { [key: string]: string } = {};

					try {

						item.infojson = typeof item.infojson === "string" ? (item.infojson.trim() || "{}") : "{}";
						const infojson = JSON.parse(item.infojson);

						Object.keys(infojson).forEach((key: string) => {
							const val = typeof infojson[key] === "string" ? infojson[key].trim() : infojson[key];
							item_extended[key] = val === "" ? null : val;
						});

					} catch (error) {
						logger.error(`Error al parsear JSON de infojson: ${error.message ? error.message : error.toString()}`);
					}

					logger.debug(`Item extendido:`, item_extended)

					//Si no se encuentra el producto en WooCommerce, vamos a insertar

					if (!woo_item_found) {

						const producto_ya_por_insertar = woocommerce_batch_arr.find((i: WooProduct) => String(i.sku) === String(item.codigo_item));

						if (producto_ya_por_insertar) {
							logger.debug(`Producto omitido: ${item.codigo_item}`);
							continue; //Si ya está en la lista de productos a insertar, se omite
						}

						if (enable_force_create_products) {
							//Producto nuevo para insertar en WooCommerce
							let product_empty = false;
							if (!item_extended.descripcion) product_empty = true;

							//Si no hay suficiente información para insertar el producto, se busca en la tabla de productos
							if (product_empty) {
								const query = `SELECT CODITM, DESITM, CODLIN, COSTOACT FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PRODUCTOS} WHERE CODITM = '${item.codigo_item}'`;
								const result = await executeQuery(db, query);
								if (result.recordset.length) {
									const producto = result.recordset[0];
									item_extended.descripcion = producto.DESITM;
									item_extended.codlin = producto.CODLIN;
									item_extended.precio = producto.COSTOACT;
								}
							}
							new_woo_item.name = item_extended.descripcion || `Producto ${item.codigo_item}`;
							new_woo_item.sku = item.codigo_item;
							new_woo_item.stock_quantity = 0;
							new_woo_item.regular_price = parseFloat(item_extended.precio) || 0;

						}

					} else {

						//Producto encontrado en WooCommerce para actualizar
						new_woo_item.id = woo_item_found.id;

						if (item.tipo === CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRODUCTO) {
							new_woo_item.name = item_extended.descripcion || woo_item_found.name;
						} else if (item.tipo === CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRECIO) {
							new_woo_item.regular_price = parseFloat(item_extended.precio) || woo_item_found.regular_price;
						} else if (item.tipo === CONSTANTS.TIPO_SINCRONIZACION.SERVER_STOCK) {
							new_woo_item.stock_quantity = item.stock;
						}
					}

					if (woo_item_found || enable_force_create_products) {
						sync_ids_to_delete.push(Number(item.id));
						woocommerce_batch_arr.push(new_woo_item);
						updated_items_to_log.push({ ...new_woo_item, sku: item.codigo_item, codigo_tienda: item.codigo_tienda });
					}

				}

				const productos_a_insertar = woocommerce_batch_arr.filter((item: WooProduct) => !item.id);

				if (productos_a_insertar.length) {
					const result_batch = await Woo.post("products/batch", { create: productos_a_insertar });

					if (!result_batch?.create?.length || result_batch.create.length !== productos_a_insertar.length) {
						logger.error(`No se pudo crear los productos en WooCommerce`, productos_a_insertar);
						return false;
					}

					logger.info(`Productos insertados: ${productos_a_insertar.length}`, productos_a_insertar);

				} else {
					//Actualizar los productos en WooCommerce
					const result_batch = await Woo.post("products/batch", { update: woocommerce_batch_arr });

					if (!result_batch?.update?.length || result_batch.update.length !== woocommerce_batch_arr.length) {
						logger.error(`No se pudo actualizar los productos en WooCommerce`, woocommerce_batch_arr);
						return false;
					}

					logger.info(`Productos actualizados: ${updated_items_to_log.length}`, updated_items_to_log);
				}

				//Eliminar filas de sincronización de ids que han sido sincronizados

				const result_delete = await executeQuery(db, `DELETE FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION} WHERE id IN (${sync_ids_to_delete.join(",")})`);
				if (result_delete.rowsAffected) {
					logger.debug(`Registros eliminados de sincronización: ${result_delete.rowsAffected}`);
				}
				return true;

			} catch (error) {
				logger.error(`Error al ejecutar tarea: taskProccessLocal: ${error.message ? error.message : error.toString()}`);
			} finally {
				proccesing = false;
			}

		})();

	};

}
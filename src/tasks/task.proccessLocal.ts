import logger from "logger";
import { executeQuery } from '../helpers/db.helper.ts';
import { WooProduct, WooProductLog, LocalProductStock, WooProductExtend } from '../interfaces.ts';
import { productSetEan, productSetFields } from './lib.sync.ts';
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
					SELECT TOP 100
						t1.id, t1.tipo, t1.fecha_transaccion, t1.codigo_tienda, t1.codigo_item, t1.stock, t1.infojson, t1.crud
					FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION} t1
					INNER JOIN (
						SELECT 
							codigo_item, tipo, crud, MAX(id) AS max_id
						FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION}
						WHERE tipo IN (${tiposSincronizacion.join(",")}) AND fecha_actualizacion_stock IS NULL
						GROUP BY codigo_item, tipo, crud
					) t2 ON t1.codigo_item = t2.codigo_item AND t1.tipo = t2.tipo AND t1.crud = t2.crud AND t1.id = t2.max_id
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

				logger.debug("LOCAL Items:", local_items);

				for (const item of local_items) {
					const new_woo_item = {} as WooProduct;
					const woo_item_found: WooProduct | undefined = woo_items.find((woo_item: WooProduct) => String(woo_item.sku) === String(item.codigo_item));
					const item_extended: WooProductExtend = {};

					try {

						item.infojson = typeof item.infojson === "string" ? (item.infojson.trim() || "{}") : "{}";
						const infojson = JSON.parse(item.infojson);

						Object.keys(infojson).forEach((key: string) => {
							const val = typeof infojson[key] === "string" ? infojson[key].trim() : infojson[key];
							item_extended[key] = val === "" ? null : val;
						});

					} catch (error) {
						logger.error(`Error al parsear JSON de infojson: ${error.message ? error.message : error.toString()}`, item.infojson);
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
								const productQuery = `SELECT CODITM, DESITM, CODLIN, UNIDAD, CODEAN, STOCKMIN FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PRODUCTOS} WHERE CODITM = '${item.codigo_item}'`;
								const productResult = await executeQuery(db, productQuery);
								if (productResult.recordset.length) {
									const producto = productResult.recordset[0];
									item_extended.descripcion = String(producto.DESITM).trim();
									item_extended.codlin = String(producto.CODLIN || "").trim();
									item_extended.unidad = String(producto.UNIDAD || "").trim();
									item_extended.precio = parseFloat(producto.COSTOACT || 0);
									item_extended.codean = String(producto.CODEAN || "").trim();
									item_extended.stockmin = parseFloat(producto.STOCKMIN || 0) ? parseFloat(producto.STOCKMIN || 0) : null;
								}

								// Obtener el precio correcto desde TBPRODUCPRECIOS
								const priceQuery = `
									SELECT TOP 1 PVENTA 
									FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PRODUCTOS_PRECIOS}
									WHERE CODITM = @coditm
									ORDER BY 
										CASE 
											WHEN TIPOUNIDAD = 1 THEN 0 
											WHEN UNIDADVTA = @unidadvta THEN 1 
											ELSE 2 
										END
								`;
								const priceResult = await executeQuery(db, priceQuery, { coditm: item.codigo_item, unidadvta: item_extended.unidad });
								if (priceResult.recordset.length) {
									const precio = priceResult.recordset[0].PVENTA;
									item_extended.precio = precio;
								}
							}

							/*new_woo_item.name = item_extended.descripcion || `Producto ${item.codigo_item}`;
							new_woo_item.sku = item.codigo_item;
							new_woo_item.stock_quantity = 0;
							new_woo_item.regular_price = parseFloat(String(item_extended.precio || 0));
							new_woo_item.status = "publish";
							new_woo_item.manage_stock = true;
							new_woo_item.short_description = item_extended.unidad || "";*/

							Object.assign(new_woo_item, productSetFields({
								name: item_extended.descripcion,
								sku: item.codigo_item,
								stock_quantity: 0,
								regular_price: item_extended.precio,
								status: "publish",
								manage_stock: true,
								unidad: item_extended.unidad,
								codean: item_extended.codean,
								stockmin: item_extended.stockmin
							}));


						}

					} else {

						//Producto encontrado en WooCommerce para actualizar
						new_woo_item.id = woo_item_found.id;

						//En cada condiciones se verifica si el valor es diferente al de WooCommerce para actualizar
						//Si no se omite y evitamos hacer una llamada innecesaria en el momento de la actualización

						if (item.tipo === CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRODUCTO) {

							if (item_extended.descripcion && item_extended.descripcion !== woo_item_found.name) new_woo_item.name = item_extended.descripcion;
							if (item_extended.codean !== woo_item_found.ean) new_woo_item.meta_data = productSetEan(item_extended, String(item_extended.codean || ""));
							if (item_extended.unidad !== woo_item_found.short_description) new_woo_item.short_description = String(item_extended.unidad || "");
							//if (item_extended.codlin) new_woo_item.categories = [String(item_extended.codlin)];
							if (item_extended.stockmin !== woo_item_found.low_stock_amount) new_woo_item.low_stock_amount = Number(item_extended.stockmin) || null;

							//new_woo_item.categories = ["DESCARTABLE"] // H E R E - Categorías pendiente

						} else if (item.tipo === CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRECIO) {

							const precio = parseFloat(String(item_extended.precio || 0));
							if (!isNaN(precio) && precio !== woo_item_found.regular_price) new_woo_item.regular_price = precio;

						} else if (item.tipo === CONSTANTS.TIPO_SINCRONIZACION.SERVER_STOCK) {

							if (item.stock !== woo_item_found.stock_quantity) new_woo_item.stock_quantity = item.stock;

						}
					}

					if (woo_item_found || enable_force_create_products) {
						sync_ids_to_delete.push(Number(item.id));

						//Si es una actualización (si el id está presente en woo_item_found) y no hay cambios en el producto, se omite
						if (woo_item_found && "id" in new_woo_item && Object.keys(new_woo_item).length === 1) {
							logger.debug(`Producto omitido a subir: ${item.codigo_item} - ${item.infojson}`);
							continue;
						}

						woocommerce_batch_arr.push(new_woo_item);
						updated_items_to_log.push({ ...new_woo_item, sku: item.codigo_item, codigo_tienda: item.codigo_tienda });
					}

				}

				const productos_a_insertar = woocommerce_batch_arr.filter((item: WooProduct) => !item.id);

				if (productos_a_insertar.length) {

					logger.debug("INSERT batch:", woocommerce_batch_arr);

					const result_batch = await Woo.post("products/batch", { create: productos_a_insertar });

					if (!result_batch?.create?.length || result_batch.create.length !== productos_a_insertar.length) {
						logger.error(`No se pudo crear los productos en WooCommerce`, productos_a_insertar);
						return false;
					}

					logger.info(`Productos insertados: ${productos_a_insertar.length}`, productos_a_insertar);

				} else {

					logger.debug("UPDATE batch:", woocommerce_batch_arr);

					//Actualizar los productos en WooCommerce

					if (woocommerce_batch_arr.length) {
						const result_batch = await Woo.post("products/batch", { update: woocommerce_batch_arr });

						if (!result_batch?.update?.length || result_batch.update.length !== woocommerce_batch_arr.length) {
							logger.error(`No se pudo actualizar los productos en WooCommerce`, woocommerce_batch_arr);
							return false;
						}

						logger.info(`Productos actualizados: ${updated_items_to_log.length}`, updated_items_to_log);
					}


				}

				//Eliminar filas de sincronización de ids que han sido sincronizados
				//Eliminar también registros similares de sincronización (registros con el mismo código de item y tipo de sincronización)

				const similar_items_query = await executeQuery(db, `
					SELECT id
					FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION}
					WHERE codigo_item IN (
						SELECT DISTINCT codigo_item
						FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION}
						WHERE id IN (${sync_ids_to_delete.join(',')})
					)
					AND tipo IN (${tiposSincronizacion.join(',')})
					AND crud IN (
						SELECT DISTINCT crud
						FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION}
						WHERE id IN (${sync_ids_to_delete.join(',')})
					)
				`);

				// Construir la lista completa de IDs a eliminar, incluyendo los registros similares
				const all_ids_to_delete: Array<number> = [];
				similar_items_query.recordset.forEach((row: { id: number }) => {
					all_ids_to_delete.push(row.id);
				});

				// Agregar los IDs originales de sync_ids_to_delete
				all_ids_to_delete.push(...sync_ids_to_delete);

				const result_delete = await executeQuery(db, `DELETE FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION} WHERE id IN (${all_ids_to_delete.join(",")})`);

				if (result_delete.rowsAffected) logger.debug(`Registros eliminados de sincronización: ${result_delete.rowsAffected}`);

				return true;

			} catch (error) {
				logger.error(`Error al ejecutar tarea: taskProccessLocal: ${error.message ? error.message : error.toString()}`);
			} finally {
				proccesing = false;
			}

		})();

	};

}
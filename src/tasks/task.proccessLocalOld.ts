import logger from "logger";
import { executeQuery } from '../helpers/db.helper.ts';
import { WooProduct, WooProductLog, LocalProductStock, WooProductExtend } from '../interfaces.ts';
import { productSetEan, productSetFields, queryList, replaceQueryValues } from './lib.sync.ts';
import Woo from "../controllers/woocommerce/index.ts";
import CONSTANTS from "../constants.ts";
import dbClient from "db";

const tiposSincronizacionProductos: Array<number> = [
	CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRODUCTO,
	CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRECIO,
	CONSTANTS.TIPO_SINCRONIZACION.SERVER_STOCK
]

const tiposSincronizacion: Array<number> = [
	...tiposSincronizacionProductos,
	CONSTANTS.TIPO_SINCRONIZACION.SERVER_CATEGORIA
];

// deno-lint-ignore require-await
export default async () => {

	let isProcessing = false;

	return () => {

		if (isProcessing) return;
		isProcessing = true;

		(async () => {

			try {

				const db = dbClient();
				if (!db) throw new Error("No hay una conexión a la base de datos activa");

				const codTda = String(Deno.env.get("LAN_COMMERCE_CODTDA")) || "01";

				const queryLocalSyncRows = await executeQuery(db, replaceQueryValues(queryList.localSyncRows, { "tiposList": tiposSincronizacion.join(",") }));

				if (!queryLocalSyncRows.recordset.length) {
					logger.debug(`No hay productos/categorias para sincronizar en WooCommerce`);
					return false;
				}

				//Crear productos si no existen en WooCommerce
				const enableProductForceCreation = true;
				const updatedItemLogs: Array<WooProductLog> = [];
				const localRecords = queryLocalSyncRows.recordset;
				const syncIdsToDelete: Array<number> = [];
				const skus: Array<string> = localRecords
					.filter((row: LocalProductStock) => tiposSincronizacionProductos.indexOf(Number(row.tipo)) > -1)
					.map((row: LocalProductStock) => String(row.codigo_item || "").trim())
					.filter((sku: string) => sku.length > 0);

				//Obtener los productos de WooCommerce: id
				const wooItems = await Woo.get("products_advanced", { skus: skus.join(",") });
				const wooBatchArray: Array<WooProduct> = [];

				for (const item of localRecords) {
					const wooProductToAdd = {} as WooProduct;
					const wooProductMatch: WooProduct | undefined = wooItems.find((woo_item: WooProduct) => String(woo_item.sku) === String(item.codigo_item));
					const extendedProduct: WooProductExtend = {};

					try {

						item.infojson = typeof item.infojson === "string" ? (item.infojson.trim() || "{}") : "{}";
						const infojson = JSON.parse(item.infojson);

						Object.keys(infojson).forEach((key: string) => {
							const val = typeof infojson[key] === "string" ? infojson[key].trim() : infojson[key];
							extendedProduct[key] = val === "" ? null : val;
						});

					} catch (error) {
						logger.error(`Error al parsear JSON de infojson: ${error.message ? error.message : error.toString()}`, item.infojson);
					}

					//Si no se encuentra el producto en WooCommerce, vamos a insertar

					if (!wooProductMatch) {

						const duplicateProductToInsert = wooBatchArray.find((i: WooProduct) => String(i.sku) === String(item.codigo_item));

						if (duplicateProductToInsert) {
							logger.debug(`Producto omitido: ${item.codigo_item}`);
							continue; //Si ya está en la lista de productos a insertar, se omite
						}

						if (enableProductForceCreation) {
							//Producto nuevo para insertar en WooCommerce
							let isProductEmpty = false;
							if (!extendedProduct.descripcion) isProductEmpty = true;

							//Si no hay suficiente información para insertar el producto, se busca en la tabla de productos
							if (isProductEmpty) {
								const productQuery = `SELECT CODITM, DESITM, CODLIN, UNIDAD, CODEAN, STOCKMIN, ACTIVO FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PRODUCTOS} WHERE CODITM = '${item.codigo_item}'`;
								const productResult = await executeQuery(db, productQuery);
								if (productResult.recordset.length) {
									const producto = productResult.recordset[0];
									extendedProduct.descripcion = String(producto.DESITM).trim();
									extendedProduct.codlin = String(producto.CODLIN || "").trim();
									extendedProduct.unidad = String(producto.UNIDAD || "").trim();
									extendedProduct.precio = parseFloat(producto.COSTOACT || 0);
									extendedProduct.codean = String(producto.CODEAN || "").trim();
									extendedProduct.stockmin = parseFloat(producto.STOCKMIN || 0) ? parseFloat(producto.STOCKMIN || 0) : null;
									extendedProduct.activo = !!(+producto.ACTIVO);
								}

								// Obtener el precio correcto desde TBPRODUCPRECIOS
								const priceQuery = `
									SELECT TOP 1 PVENTA 
									FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PRODUCTOS_PRECIOS}
									WHERE CODITM = @coditm
									ORDER BY 
										CASE 
											WHEN TIPOUNIDAD = 1 AND UNIDADVTA = @unidadvta THEN 0
											WHEN TIPOUNIDAD = 1 THEN 1 
											WHEN UNIDADVTA = @unidadvta THEN 2 
											ELSE 3 
										END
								`;
								const priceResult = await executeQuery(db, priceQuery, { coditm: item.codigo_item, unidadvta: extendedProduct.unidad });
								if (priceResult.recordset.length) {
									const precio = priceResult.recordset[0].PVENTA;
									extendedProduct.precio = precio;
								}
							}

							Object.assign(wooProductToAdd, productSetFields({
								name: extendedProduct.descripcion,
								sku: item.codigo_item,
								stock_quantity: 0,
								regular_price: extendedProduct.precio,
								//status: extendedProduct.activo ? "publish" : "private",
								activo: extendedProduct.activo,
								status: "publish",
								manage_stock: true,
								unidad: extendedProduct.unidad,
								codean: extendedProduct.codean,
								stockmin: extendedProduct.stockmin
							}));


						}

					} else {

						//Producto encontrado en WooCommerce para actualizar
						wooProductToAdd.id = wooProductMatch.id;

						//En cada condiciones se verifica si el valor es diferente al de WooCommerce para actualizar
						//Si no se omite y evitamos hacer una llamada innecesaria en el momento de la actualización

						if (item.tipo === CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRODUCTO) {

							if (extendedProduct.descripcion && extendedProduct.descripcion !== wooProductMatch.name) wooProductToAdd.name = extendedProduct.descripcion;
							if (extendedProduct.codean !== wooProductMatch.ean) wooProductToAdd.meta_data = productSetEan(extendedProduct, String(extendedProduct.codean || ""));
							if (extendedProduct.unidad !== wooProductMatch.short_description) wooProductToAdd.short_description = String(extendedProduct.unidad || "");
							//if (extendedProduct.codlin) wooProductToAdd.categories = [String(extendedProduct.codlin)];
							if (extendedProduct.stockmin !== wooProductMatch.low_stock_amount) wooProductToAdd.low_stock_amount = Number(extendedProduct.stockmin) || null;

							//wooProductToAdd.categories = ["DESCARTABLE"] // H E R E - Categorías pendiente

						} else if (item.tipo === CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRECIO) {

							const precio = parseFloat(String(extendedProduct.precio || 0));
							if (!isNaN(precio) && precio !== wooProductMatch.regular_price) wooProductToAdd.regular_price = precio;

						} else if (item.tipo === CONSTANTS.TIPO_SINCRONIZACION.SERVER_STOCK) {

							logger.debug(`${item.codigo_tienda} (${item.codigo_item}) - ${wooProductMatch.stock_quantity} :: ${item.stock} - ${item.infojson}`);

							//Validar si el stock es diferente y validar también la tienda
							if (item.codigo_tienda === codTda && item.stock !== wooProductMatch.stock_quantity) wooProductToAdd.stock_quantity = item.stock;

						}
					}

					if (wooProductMatch || enableProductForceCreation) {
						syncIdsToDelete.push(Number(item.id));

						//Si es una actualización (si el id está presente en wooProductMatch) y no hay cambios en el producto, se omite
						if (wooProductMatch && "id" in wooProductToAdd && Object.keys(wooProductToAdd).length === 1) {
							logger.debug(`Producto omitido a subir: ${item.codigo_item} - ${item.infojson}`);
							continue;
						}

						wooBatchArray.push(wooProductToAdd);
						updatedItemLogs.push({ ...wooProductToAdd, sku: item.codigo_item, codigo_tienda: item.codigo_tienda });
					}

				}

				const newProductsToInsert = wooBatchArray.filter((item: WooProduct) => !item.id);

				if (newProductsToInsert.length) {

					logger.debug("INSERT batch:", wooBatchArray);

					const productInsertionResult = await Woo.post("products/batch", { create: newProductsToInsert });

					if (!productInsertionResult?.create?.length || productInsertionResult.create.length !== newProductsToInsert.length) {
						logger.error(`No se pudo crear los productos en WooCommerce`, newProductsToInsert);
						return false;
					}

					logger.info(`Productos insertados: ${newProductsToInsert.length}`, newProductsToInsert);

				} else {

					logger.debug("UPDATE batch:", wooBatchArray);

					//Actualizar los productos en WooCommerce

					if (wooBatchArray.length) {
						const productUpdateResult = await Woo.post("products/batch", { update: wooBatchArray });

						if (!productUpdateResult?.update?.length || productUpdateResult.update.length !== wooBatchArray.length) {
							logger.error(`No se pudo actualizar los productos en WooCommerce`, wooBatchArray);
							return false;
						}

						logger.info(`Productos actualizados: ${updatedItemLogs.length}`, updatedItemLogs);
					}


				}

				//Eliminar filas de sincronización de ids que han sido sincronizados
				//Eliminar también registros similares de sincronización (registros con el mismo código de item y tipo de sincronización)

				const similarItemsQuery = await executeQuery(db, `
					SELECT id
					FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION}
					WHERE codigo_item IN (
						SELECT DISTINCT codigo_item
						FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION}
						WHERE id IN (${syncIdsToDelete.join(',')})
					)
					AND tipo IN (${tiposSincronizacion.join(',')})
					AND crud IN (
						SELECT DISTINCT crud
						FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION}
						WHERE id IN (${syncIdsToDelete.join(',')})
					)
				`);

				// Construir la lista completa de IDs a eliminar, incluyendo los registros similares
				const idsToDelete: Array<number> = [];
				similarItemsQuery.recordset.forEach((row: { id: number }) => {
					idsToDelete.push(row.id);
				});

				// Agregar los IDs originales de syncIdsToDelete
				idsToDelete.push(...syncIdsToDelete);

				const deleteQueryResult = await executeQuery(db, `DELETE FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION} WHERE id IN (${idsToDelete.join(",")})`);

				if (deleteQueryResult.rowsAffected) logger.debug(`Registros eliminados de sincronización: ${deleteQueryResult.rowsAffected}`);

				return true;

			} catch (error) {
				logger.error(`Error al ejecutar tarea: taskProccessLocal: ${error.message ? error.message : error.toString()}`);
			} finally {
				isProcessing = false;
			}

		})();

	};

}
import logger from "logger";
import { Transaction } from 'npm:mssql@10.0.1';
import { executeQuery } from '../helpers/db.helper.ts';
import { WooProduct, WooProductExtended, WooProductLog, LocalProductStock, LocalSyncExtend, WooProductCategogy, WooUpsertCategoryResponse, LocalSyncCategory } from '../interfaces.ts';
import { productSetEan, productSetFields, queryList, replaceQueryValues } from './lib.sync.ts';
import Woo from "../controllers/woocommerce/index.ts";
import CONSTANTS from "../constants.ts";
import dbClient from "db";

const tiposSincronizacionProductos: Array<number> = [
	CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRODUCTO,
	CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRECIO,
	CONSTANTS.TIPO_SINCRONIZACION.SERVER_STOCK
]

const tiposSincronizacionCategorias: Array<number> = [
	CONSTANTS.TIPO_SINCRONIZACION.SERVER_CATEGORIA
]

const tiposSincronizacion: Array<number> = [
	...tiposSincronizacionProductos,
	...tiposSincronizacionCategorias
];

const checkDbClient = () => {
	const db = dbClient();
	if (!db) throw new Error("No hay una conexión a la base de datos activa");

	return db;

}

const getLocalSyncRows = async (db: Transaction) => {

	const queryLocalSyncRows = await executeQuery(db, replaceQueryValues(queryList.localSyncRows, { "tiposList": tiposSincronizacion.join(",") }));

	if (!queryLocalSyncRows.recordset.length) throw new Error("MESSAGE_EMPTY");

	const localSyncRecords: LocalProductStock[] = queryLocalSyncRows.recordset;

	const skus: string[] = localSyncRecords
		.filter((row: LocalProductStock) => tiposSincronizacionProductos.indexOf(Number(row.tipo)) > -1)
		.map((row: LocalProductStock) => String(row.codigo_item || "").trim())
		.filter((sku: string) => sku.length > 0);
	const catIds: number[] = localSyncRecords
		.filter((row: LocalProductStock) => Number(row.tipo) === CONSTANTS.TIPO_SINCRONIZACION.SERVER_CATEGORIA)
		.map((row: LocalProductStock) => Number(row.codigo_item))
		.filter((catid: number) => catid > 0);

	return { localSyncRecords, skus, catIds };

}

const extendProductFields = async (db: Transaction, item: LocalProductStock, extendedProduct: LocalSyncExtend) => {
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
}

const parseInfoJson = (item: LocalProductStock) => {

	const extend: LocalSyncExtend = {};

	try {

		item.infojson = typeof item.infojson === "string" ? (item.infojson.trim() || "{}") : "{}";
		const infojson = JSON.parse(item.infojson);

		Object.keys(infojson).forEach((key: string) => {
			const val = typeof infojson[key] === "string" ? infojson[key].trim() : infojson[key];
			extend[key] = val === "" ? null : val;
		});

	} catch (error) {
		logger.error(`Error al parsear JSON de infojson: ${error.message ? error.message : error.toString()}`, item.infojson);
	}

	return extend;
}

const parseCategoriesBatch = async (db: Transaction, localSyncRecords: LocalProductStock[], wooItems: WooProduct[]) => {

	const wooCategoriesBatch: WooProductCategogy[] = [];
	const syncIdsCategoriesToDelete: number[] = [];
	const localCategoryRecords = localSyncRecords.filter((item: LocalProductStock) => Number(item.tipo) === CONSTANTS.TIPO_SINCRONIZACION.SERVER_CATEGORIA);

	//Llamar a la API de WooCommerce para actualizar o insertar categorías (upsert_categories)

	//Preparar lo que se enviará
	const payLoad = {
		categories: localCategoryRecords.map(item => {
			const extended = parseInfoJson(item);
			if (!extended?.descripcion || !String(extended.descripcion).trim()) return null;
			return {
				id: extended.woocommerce_id,
				name: extended.descripcion,
				cod_cat_local: item.codigo_item,
			}
		}).filter(item => !!item).slice(0, 100) //Limitar la cantidad de categorías a subir a 100
	}

	if (!payLoad.categories.length) return { wooCategoriesBatch, syncIdsCategoriesToDelete };

	//Llamar a la API de WooCommerce
	logger.debug(`UPDATE BATCH:`, payLoad);
	const wooUpserCategoriesResult: WooUpsertCategoryResponse[] = await Woo.post("upsert_categories", payLoad);

	//Agregar el id de Woocommerce a la tabla de categorías locales
	for (const categoryResult of wooUpserCategoriesResult) {
		if (categoryResult.status === "error") {
			logger.error(`Error al subir categoría a WooCommerce: [${categoryResult.cod_cat_local}] ${categoryResult.error}`);
			continue;
		}
		const localCategory = localCategoryRecords.find((record: LocalProductStock) => Number(record.codigo_item) === categoryResult.cod_cat_local);
		if (localCategory) {
			await executeQuery(db, `UPDATE ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_CATEGORIAS} SET woocommerce_id = ${categoryResult.id} WHERE codcat = ${categoryResult.cod_cat_local}`);
			syncIdsCategoriesToDelete.push(localCategory.id);
			logger.info(`Categoría actualizada en Ecommerce: [${categoryResult.cod_cat_local}] ${categoryResult.name} (${categoryResult.id})`);
		}
	}

	return { wooCategoriesBatch, syncIdsCategoriesToDelete };

}

const parseProductsBatch = async (db: Transaction, localSyncRecords: LocalProductStock[], wooItems: WooProduct[]) => {


	const enableProductForceCreation = true;
	const codTda = String(Deno.env.get("LAN_COMMERCE_CODTDA")) || "01";

	const wooProductsBatch: WooProduct[] = [];
	const syncIdsProductsToDelete: number[] = [];

	//Crear productos si no existen en WooCommerce

	for (const item of localSyncRecords) {

		//Verifica si item es producto
		if (tiposSincronizacionProductos.indexOf(Number(item.tipo)) === -1) continue;

		const wooProductToAdd = {} as WooProduct;
		const wooProductMatch = wooItems.find((woo_item: WooProduct) => String(woo_item.sku) === String(item.codigo_item));
		const extendedProduct = parseInfoJson(item);

		//Si no se encuentra el producto en WooCommerce, vamos a insertar

		if (!wooProductMatch) {

			const duplicateProductToInsert = wooProductsBatch.find((i: WooProduct) => String(i.sku) === String(item.codigo_item));

			if (duplicateProductToInsert) {
				logger.debug(`Producto omitido: ${item.codigo_item}`);
				continue; //Si ya está en la lista de productos a insertar, se omite
			}

			if (enableProductForceCreation) {

				await extendProductFields(db, item, extendedProduct);

				Object.assign(wooProductToAdd, productSetFields({
					name: extendedProduct.descripcion,
					sku: item.codigo_item,
					stock_quantity: 0,
					regular_price: extendedProduct.precio,
					activo: extendedProduct.activo,
					status: "publish",
					manage_stock: true,
					unidad: extendedProduct.unidad,
					codean: extendedProduct.codean,
					stockmin: extendedProduct.stockmin,
					categoria: extendedProduct.categoria,
					woocommerce_id_cat: extendedProduct.woocommerce_id_cat
				} as WooProductExtended));

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

				//Verificar usando some nueva categoría está en la lista de categorías de WooCommerce
				const existsCat = wooProductMatch.categories.some((cat: WooProductCategogy) => cat.id === Number(extendedProduct.woocommerce_id_cat));
				if (!existsCat) wooProductToAdd.categories = [{ id: Number(extendedProduct.woocommerce_id_cat) }];

			} else if (item.tipo === CONSTANTS.TIPO_SINCRONIZACION.SERVER_PRECIO) {

				const precio = parseFloat(String(extendedProduct.precio || 0));
				if (!isNaN(precio) && precio !== wooProductMatch.regular_price) wooProductToAdd.regular_price = precio;

			} else if (item.tipo === CONSTANTS.TIPO_SINCRONIZACION.SERVER_STOCK) {

				//logger.debug(`${item.codigo_tienda} (${item.codigo_item}) - ${wooProductMatch.stock_quantity} :: ${item.stock} - ${item.infojson}`);

				//Validar si el stock es diferente y validar también la tienda
				if (item.codigo_tienda === codTda && item.stock !== wooProductMatch.stock_quantity) wooProductToAdd.stock_quantity = item.stock;

			}
		}

		if (wooProductMatch || enableProductForceCreation) {
			syncIdsProductsToDelete.push(Number(item.id));

			//Si es una actualización (si el id está presente en wooProductMatch) y no hay cambios en el producto, se omite
			if (wooProductMatch && "id" in wooProductToAdd && Object.keys(wooProductToAdd).length === 1) {
				//logger.debug(`Producto omitido a subir: ${item.codigo_item} - ${item.infojson}`);
				continue;
			}

			wooProductsBatch.push(wooProductToAdd);
		}

	}

	return { wooProductsBatch, syncIdsProductsToDelete };
}

const handleError = (error: Error) => {
	if (error.message !== "MESSAGE_EMPTY") {
		//Evitar mostrar información sensible en el log
		const regex = /c(s|k)_\w+/g;
		if (error.message && regex.test(error.message)) error.message = error.message.replace(regex, "c$1_XXXXX");
		logger.error(`Error al ejecutar tarea: taskProccessLocal: ${error.message ? error.message : error.toString()}`);
	} else {
		//logger.debug(`No hay productos/categorias para sincronizar en WooCommerce`);
	}
}

// deno-lint-ignore require-await
export default async () => {

	let isProcessing = false;

	return () => {

		if (isProcessing) return;
		isProcessing = true;

		(async () => {

			try {

				const db = checkDbClient();
				const { localSyncRecords, skus, catIds } = await getLocalSyncRows(db);

				const { wooCategoriesBatch, syncIdsCategoriesToDelete } = await parseCategoriesBatch(db, localSyncRecords, []);

				let syncIdsToDelete = [];

				if (syncIdsCategoriesToDelete.length) {
					//Priorizar la eliminación de categorías antes de sincronizar productos
					syncIdsToDelete.push(...syncIdsCategoriesToDelete);

				} else {

					//Sincronizar productos

					if (!skus.length) throw new Error("MESSAGE_EMPTY");

					const wooItems = await Woo.get("products_advanced", { skus: skus.join(",") });

					let { wooProductsBatch, syncIdsProductsToDelete } = await parseProductsBatch(db, localSyncRecords, wooItems);

					syncIdsToDelete.push(...syncIdsProductsToDelete);

					const productsToInsert = wooProductsBatch.filter((item: WooProduct) => !item.id);
					const productsToUpdate = wooProductsBatch.filter((item: WooProduct) => !!item.id);

					if (productsToInsert.length) {

						logger.debug("INSERT BATCH:", productsToInsert);

						const productInsertionResult = await Woo.post("products/batch", { create: productsToInsert });

						if (!productInsertionResult?.create?.length || productInsertionResult.create.length !== productsToInsert.length) {
							logger.error(`No se pudo crear los productos en WooCommerce`, productsToInsert);
							return false;
						}

						logger.info(`Productos insertados: ${productsToInsert.length}`, productsToInsert);

						//Colocar en syncIdsProductsToDelete solo los productos insertados
						syncIdsProductsToDelete = localSyncRecords.filter((item: LocalProductStock) => productsToInsert.find((i: WooProduct) => String(i.sku) === String(item.codigo_item))).map((item: LocalProductStock) => item.id);

					} else if (productsToUpdate.length) {
						logger.debug("UPDATE BATCH:", productsToUpdate);

						const productUpdateResult = await Woo.post("products/batch", { update: productsToUpdate });

						if (!productUpdateResult?.update?.length || productUpdateResult.update.length !== productsToUpdate.length) {
							logger.error(`No se pudo actualizar los productos en WooCommerce`, productsToUpdate);
							return false;
						}

						logger.info(`Productos actualizados: ${productsToUpdate.length}`, productsToUpdate);
					}
				}

				if (!syncIdsToDelete.length) {
					logger.debug(`Alguno(a)s productos/categorias no se han sincronizado en WooCommerce`);
					return true;
				}

				//Eliminar filas de sincronización de ids que han sido sincronizados
				//Eliminar también registros similares de sincronización (registros con el mismo código de item y tipo de sincronización)
				//Si se ha insertado productos volver a sincronizar para obtener los IDs de los productos insertados

				const similarItemsQuery = await executeQuery(db, `
					SELECT id
					FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION}
					WHERE codigo_item IN (
						SELECT DISTINCT codigo_item
						FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION}
						WHERE id IN (${syncIdsToDelete.join(',')}) 
					)
					AND tipo IN (${(syncIdsCategoriesToDelete.length ? tiposSincronizacionCategorias : tiposSincronizacionProductos).join(',')})
					AND crud IN (
						SELECT DISTINCT crud
						FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION}
						WHERE id IN (${syncIdsToDelete.join(',')})
					)
				`);


				let idsToDelete: number[] = similarItemsQuery.recordset.map((row: { id: number }) => row.id); // Construir la lista completa de IDs a eliminar, incluyendo los registros similares
				idsToDelete.push(...syncIdsToDelete); // Agregar los IDs originales de syncIdsToDelete
				idsToDelete = idsToDelete.filter((value, index, self) => self.indexOf(value) === index); //Eliminar duplicados

				await executeQuery(db, `DELETE FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION} WHERE id IN (${idsToDelete.join(",")})`);

				logger.debug(`Registros eliminados de sincronización: ${idsToDelete.length}`);

				return true;

			} catch (error) {
				handleError(error)
			} finally {
				isProcessing = false;
			}

		})();

	};

}
import logger from "logger";
///import { Transaction, Record } from 'npm:mssql@10.0.1';
import { existsSync } from "fsmod";
import { prompt, pause, today } from "../helpers/index.ts";
import { executeQuery } from '../helpers/db.helper.ts';
import { WooProduct, WooProductLog, LocalProductStockTda, LocalProductPrice, Task } from '../interfaces.ts';
import { productSetFields, queryList, replaceQueryValues } from './lib.sync.ts';
import Woo from "../controllers/woocommerce/index.ts";
import CONSTANTS from "../constants.ts";
import dbClient from "db";

const STOCK_EMPTY_SOMEFIELDS = Number(Deno.env.get("LAN_COMMERCE_EMPTY_SOMEFIELDS_SINCRONIZACION")) === 1;

function productToArray(product: WooProduct) {
	const resultArray = CONSTANTS.PRODUCT_COLUMNS_TO_SYNC.map((column: string) => {
		const value = product[column as keyof WooProduct];
		return typeof value === "string" ? value.trim() : value;
	});
	return resultArray;
}

function productToObj(product: { [key: string]: any }) {
	return CONSTANTS.PRODUCT_COLUMNS_TO_SYNC.reduce((obj, column, index) => {
		// @ts-ignore TS7017
		obj[column] = product[index];
		return obj;
	}, {}) as WooProduct;
}

async function fetchProductsBySKUs(skus: string[]) {
	return await Woo.get("products_advanced", { skus: skus.join(",") });
}

async function fetchSKUsFromDatabase(db: any, pageNumber: number, rowsPerPage: number) {

	//Primero contar todos los productos sin paginar para saber cuántas páginas hay

	const countResult = await executeQuery(db, `
	  SELECT COUNT(CODITM) AS TOTAL
	  FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PRODUCTOS};
	`, {});

	const result = await executeQuery(db, `
	  SELECT CODITM
	  FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PRODUCTOS}
	  ORDER BY CODITM ASC
	  OFFSET (${pageNumber} - 1) * ${rowsPerPage} ROWS
	  FETCH NEXT ${rowsPerPage} ROWS ONLY;
	`, {});


	const countAllProducts: number = Number(countResult.recordset[0].TOTAL);
	const totalPages = Math.ceil(countAllProducts / rowsPerPage);
	const items = result.recordset.map((record: { CODITM: string }) => record.CODITM);

	return { items, totalPages, countAllProducts };
}

async function processSKUs(stateFilePath: string, db: any, BATCH_SIZE: number = 100) {

	let skusContent: { [key: string]: any } = {};
	let pageNumber = 1;
	let skus;
	let retryCount = 0;
	const maxRetries = 5; // Número máximo de reintentos permitidos
	const loggerStep = (str: string) => `Paso 1. ${str}`;

	// Función para cargar el estado anterior, si existe
	async function loadState() {
		if (existsSync(stateFilePath)) {
			logger.info(loggerStep(`Hay un archivo de estado anterior en ${stateFilePath}`));
			const continueState = String(await prompt("Presione 'n' para volver a empezar, o presione cualquier tecla para seguir en el estado anterior:"));

			if (continueState.toLowerCase() === "n") return;

			try {
				const data = await Deno.readTextFile(stateFilePath);
				const state = JSON.parse(data);
				pageNumber = state.pageNumber;
				skusContent = state.skusContent;
			} catch (error) {
				logger.error(loggerStep(`Error al cargar el estado anterior: ${error.message ? error.message : error.toString()}`));
				logger.debug(loggerStep(`Comenzando una nueva sincronización.`));
			}
		}
	}

	// Función para guardar el estado actual
	async function saveState() {
		try {
			await Deno.writeTextFile(stateFilePath, JSON.stringify({ pageNumber, skusContent }));
		} catch (error) {
			logger.error(loggerStep(`Error al guardar el estado: ${error.message ? error.message : error.toString()}`));
		}
	}

	// Cargar estado anterior si existe
	await loadState();

	while (retryCount <= maxRetries) {

		//Cortar si ya hemos procesado todos los productos

		try {

			const { items, totalPages } = await fetchSKUsFromDatabase(db, pageNumber, BATCH_SIZE);

			if (pageNumber > totalPages) break; // Cortar si ya hemos procesado todos los productos

			logger.info(loggerStep(`Identificación de SKUS: Lote ${pageNumber}/${totalPages} (${((pageNumber / totalPages) * 100).toFixed(2)}%)`));
			//if (pageNumber === 5) break; // Solo para pruebas			

			skus = items;

			if (skus.length === 0) break; // Salir del bucle si no hay más SKUs para procesar

			const products = await fetchProductsBySKUs(skus);

			const productsCollection = products.reduce((obj: { [key: string]: any }, product: any) => {
				obj[product.sku] = productToArray(product);
				return obj;
			}, {})

			for (const sku of skus) skusContent[sku] = productsCollection[sku] ?? null;

			pageNumber++; // Incrementar número de página para el siguiente lote de SKUs
			retryCount = 0; // Reiniciar contador de intentos exitosos si hay éxito

			// Guardar el estado después de cada página procesada
			await saveState();

			await new Promise((resolve) => setTimeout(resolve, 500)); // Esperar entre solicitudes

		} catch (error) {
			retryCount++;
			logger.error(loggerStep(`Error al procesar SKUs: ${error.message ? error.message : error.toString()}`));
			logger.debug(loggerStep(`Reintentando en 5 segundos...`));
			await new Promise((resolve) => setTimeout(resolve, 5000));
		}
	}

	if (retryCount > maxRetries) {
		logger.error(loggerStep(`Se excedió el número máximo de intentos (${maxRetries}) para recuperar SKUs.`));
	} else {
		//logger.info(`Archivo de estado guardado en ${stateFilePath}`);
		logger.info(loggerStep(`💾 Estado cargado con éxito. Hay ${Object.keys(skusContent).length} productos a sincronizar.`));
	}

	return skusContent;
}

export default async (task: Task) => {

	const minStockLimitToUpdate = 10;
	const defaultStockLimitToUpdate = 50;
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

	const fechaEjecucion = today();

	let mapSkuAndContent: any = {};
	let proccesing = false;
	let logFileValues: { [key: string]: number } = {};

	return () => {

		if (proccesing) return false;
		proccesing = true;

		(async () => {

			//Colección de sku => id

			const stateFilePath = `./src/tmp/${fechaEjecucion}_mapstate.json`; // Archivo para guardar el estado

			if (!Object.keys(mapSkuAndContent).length) {

				//Primero obtenemos los IDS de Woocommerce por cada 100 SKUS que le pase

				const db = dbClient();
				if (!db) {
					logger.error("Esperando conexión para definir el mapeo de ids");
					proccesing = false;
					return false;
				}

				//Obtener los productos de la tienda local
				mapSkuAndContent = (await processSKUs(stateFilePath, db, 100));

				//Convertir array de valores a objeto

				for (const sku in mapSkuAndContent) {
					//Convertir array a objeto si no es nulo
					mapSkuAndContent[sku] = Array.isArray(mapSkuAndContent[sku]) ? productToObj(mapSkuAndContent[sku]) : null;
				}

				if (!Object.keys(mapSkuAndContent).length) {
					logger.error("No se encontraron productos para sincronizar");
					proccesing = false;
					return false;
				}

			}

			const totalProductsToUpdate = Object.keys(mapSkuAndContent).length;

			const logFile = `./src/tmp/${fechaEjecucion}_updated_products.json`;

			//Primero guardar el cuerpo del archivo si no existe, con todos los sku en 0 (false)

			if (Object.keys(logFileValues).length === 0) {

				try {
					const contentJsonFile = await Deno.readTextFile(logFile);
					logFileValues = JSON.parse(contentJsonFile);
				} catch (_) {
					for (const sku in mapSkuAndContent) {
						//Comprobar hasOwnProperty para evitar propiedades heredadas
						logFileValues[sku] = 0;
					}
					await Deno.writeTextFile(logFile, JSON.stringify(logFileValues))
				}

			}

			try {

				//Obtener SKU de los productos a sincronizar en la tienda local
				//Solo selecionar los primeros 5 productos del logFileContent que no se hayan actualizado
				const firstItems = Object.keys(logFileValues);


				const skusSinActualizar = firstItems.filter((sku: string) => !logFileValues[sku]);

				const skus: Array<string> = skusSinActualizar.slice(0, stockLimitToUpdate);

				const totalActualizados = totalProductsToUpdate - skusSinActualizar.length;

				//Mostrar porcentaje
				logger.info(`Sincronizando productos: ${totalActualizados} / ${totalProductsToUpdate} (✅ ${((totalActualizados / totalProductsToUpdate) * 100).toFixed(2)}%)`);

				if (!skus.length) {
					logger.info("✅ Todos los productos han sido actualizados.");
					clearInterval(task.intervalFn); //Detener la tarea
					await Deno.remove(logFile); //Eliminar el archivo de log
					await Deno.remove(stateFilePath); // Eliminar el archivo de estado
					pause();
					return true;
				}

				const db = dbClient();
				if (!db) throw new Error("No hay una conexión a la base de datos activa");

				const skus_escape = skus.map((sku: string) => `'${sku}'`).join(",");

				//Busqueda de detalles de productos
				const queryDetails = await executeQuery(db, replaceQueryValues(queryList.productDetails, { "skuList": skus_escape }));

				const local_products_obj: { [key: string]: any } = queryDetails.recordset.reduce((obj: { [key: string]: any }, item: any) => {
					//Trimear valores de texto que son char en la base de datos
					['DESITM', 'UNIDAD', 'CODEAN', 'CODMAR', 'CODLIN'].forEach((key) => {
						item[key] = typeof item[key] === "string" ? item[key].trim() : null;
					});

					obj[item.CODITM] = item;
					return obj;
				}, {});

				//Busqueda de stocks y luego crear una colleción de cada sku con su stock
				const queryStocks = await executeQuery(db, replaceQueryValues(queryList.realStock, { "skuList": skus_escape }), {
					"codtda": Deno.env.get("LAN_COMMERCE_CODTDA") || "01"
				});

				const local_stocks_obj: { [key: string]: number } = queryStocks.recordset.reduce((obj: { [key: string]: number }, item: LocalProductStockTda) => {
					obj[item.CODITM] = Number(item.STOCK);
					return obj;
				}, {});

				//Busqueda de precios y luego crear una collección de cada sku con su precio
				const queryPrices = await executeQuery(db, replaceQueryValues(queryList.realPrice, { "skuList": skus_escape }));

				const local_prices_obj: { [key: string]: number } = queryPrices.recordset.reduce((obj: { [key: string]: number }, item: LocalProductPrice) => {
					obj[item.CODITM] = Number(item.PRECIOFINAL);
					return obj;
				}, {});

				const woocommerce_batch_arr: Array<WooProduct> = [];
				const updated_items_to_log: Array<WooProductLog> = [];
				const skus_found: Array<string> = [];
				const skus_not_found: Array<string> = [];

				skus.forEach((sku) => {

					const existsWoo = !!mapSkuAndContent[sku];
					const new_item = {} as WooProduct;

					Object.assign(new_item, productSetFields({
						name: local_products_obj[sku].DESITM,
						sku: sku,
						stock_quantity: local_stocks_obj[sku],
						regular_price: local_prices_obj[sku],
						status: "publish",
						manage_stock: true,
						unidad: local_products_obj[sku].UNIDAD,
						codean: local_products_obj[sku].CODEAN,
						stockmin: local_products_obj[sku].STOCKMIN
					}), STOCK_EMPTY_SOMEFIELDS ? {
						description: "",
						tags: [] //Vaciar etiquetas de Woo
					} : {});

					if (mapSkuAndContent[sku]) new_item.id = mapSkuAndContent[sku].id;

					woocommerce_batch_arr.push(new_item);
					updated_items_to_log.push(new_item);
					skus_found.push(sku);

				});

				/*
				if (skus_not_found.length) {

					//Actualizar el archivo de log con los sku no encontrados
					for (const sku of skus_not_found) logFileValues[sku] = 1;
					await Deno.writeTextFile(logFile, JSON.stringify(logFileValues));

					logger.warn(`Productos no encontrados en WooCommerce (${skus_not_found.length}): Se omitirán de la sincronización`, skus_not_found);
				}

				if (!woocommerce_batch_arr.length) return false;
				*/

				logger.debug(`Sincronizando (${skus_found.length}) productos...`);

				//Separar batchs de create y de update (cuando id está presente en woocommerce_batch_arr)

				const batch_create = woocommerce_batch_arr.filter((item: WooProduct) => !item.id);
				const batch_update = woocommerce_batch_arr.filter((item: WooProduct) => item.id);

				const result_batch = await Woo.postStream("products/batch", {
					create: batch_create,
					update: batch_update
				}, {}, (_) => {
					Deno.stdout.write(new TextEncoder().encode(`-`)); //Indeterminate progress
				});

				Deno.stdout.write(new TextEncoder().encode(`\n`));

				if (!result_batch || (!result_batch?.update?.length && !result_batch?.create?.length)) throw new Error("No se actualizó ninguna cola de productos en WooCommerce");

				const skus_updated = [...(result_batch.create || []), ...(result_batch.update || [])].map((item: WooProduct) => item.sku);

				//Actualizar el archivo de log con los sku actualizados
				//for (const sku of skus_found) logFileValues[sku] = 1;
				for (const sku of skus_updated) logFileValues[sku] = 1;

				await Deno.writeTextFile(logFile, JSON.stringify(logFileValues));

				logger.info(`Productos actualizados (${updated_items_to_log.length}): `, updated_items_to_log.reduce((acc: { [key: string]: unknown }, item: WooProduct) => {
					acc[item.sku] = {
						id: item.id,
						name: item.name,
						stock_quantity: item.stock_quantity,
						regular_price: item.regular_price
					};
					return acc;
				}, {}));


			} catch (error) {
				logger.error(`Error al ejecutar tarea: taskUpdateFullStock: ${error.message ? error.message : error.toString()}`);
			} finally {
				proccesing = false;
			}

			return false;

		})();

	};
}
import dbClient from "db";
import { Response } from "response";
import { Request } from "request";
import { errorRequestHandler } from "logger";
import { constructParams, jsonToSuperHtmlTable } from "../helpers/index.ts";
import CONSTANTS from "../constants.ts";

export default {
	"": async ({ response, request }: { response: Response, request: Request }) => {

		//Verificar si la conexión a LocalCommerce está activa

		try {
			const result = await dbClient().request().query(`SELECT @@VERSION`);

			response.body = {
				ok: 1,
				message: "Conexión a LocalCommerce activa 🚀",
				items: result.recordset
			};

		} catch (err) {
			errorRequestHandler(err.message, err, response, request);
		}
	},
	"productos": async ({ response, request }: { response: Response, request: Request }) => {

		try {

			const sql = `SELECT TOP 250 * FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PRODUCTOS} ORDER BY CODITM DESC`;

			const result = await dbClient().request()
				.input('codtda', '01')
				.query(sql);

			const items = result.recordset;

			response.body = jsonToSuperHtmlTable(items, ['CODITM', 'CODLIN', 'CODEAN', 'UNIDAD', 'DESITM', 'COSTOPRM', 'STOCK']);

		} catch (err) {
			errorRequestHandler(err.message, err, response, request);
		}

	},



	"ventas": async ({ response, request }: { response: Response, request: Request }) => {

		const params = Object.assign({ page: 1, per_page: 50 }, constructParams(request.url.searchParams));
		params.per_page = Math.min(params.per_page, 1000);

		try {
			const sql = `SELECT TOP ${params.per_page} * FROM  ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_VENTAS} WHERE CODTDA = @codtda AND FECHAPRO > CONVERT(smalldatetime, '2023-11-30 08:00:00', 120) ORDER BY FECHAPRO DESC `;

			const result = await dbClient().request()
				.input('codtda', '01')
				.query(sql);

			const items = result.recordset;

			response.body = jsonToSuperHtmlTable(items, ['FECHAPRO', 'NEGR', 'CODTDA', 'CODCLT', 'VVENTA', 'VIGV', 'PVENTA', 'TASAIGV', 'MONEDA', 'TCAMBIO', 'OBSERV', 'STATUSTRANS', 'CODPAGO', 'USUARIO', 'CODCONDI', 'FECHAPRO', 'NOMBREFAC'], params);

		} catch (err) {
			errorRequestHandler(err.message, err, response, request);
		}

	},

	//Proformas: (fecha, codtda, codclt, vventa, vigv, pventa, tasaigv, moneda, tcambio, observ, codpago, usuario, status, codcondi, fechapro, nombrefac, negrfac)
	//Proformas items: TBPROITM (codtda, coditm, unidad, cantidad, pventatot, cantegr, unidadegr, status, tasaigv, negr)
	//Columnas siempre son en mayúsculas

	"proformas": async ({ response, request }: { response: Response, request: Request }) => {

		const params = Object.assign({ page: 1, per_page: 50 }, constructParams(request.url.searchParams));
		params.per_page = Math.min(params.per_page, 1000);

		try {
			//const sql = `SELECT TOP ${params.per_page} * FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PROFORMA} WHERE CODTDA = @codtda AND CODCLT = @codclt ORDER BY FECHAPRO DESC `;
			const sql = `SELECT TOP ${params.per_page} * FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PROFORMA} WHERE CODTDA = @codtda ORDER BY FECHAPRO DESC `;

			const result = await dbClient().request()
				.input('codtda', '01')
				.query(sql);

			const items = result.recordset;

			response.body = jsonToSuperHtmlTable(items, ['FECHA', 'CODTDA', 'CODCLT', 'VVENTA', 'VIGV', 'PVENTA', 'TASAIGV', 'MONEDA', 'TCAMBIO', 'OBSERV', 'CODPAGO', 'USUARIO', 'STATUS', 'CODCONDI', 'FECHAPRO', 'NOMBREFAC', 'NEGRFAC'], params);

		} catch (err) {
			errorRequestHandler(err.message, err, response, request);
		}

	},

	"product_export_by_tda": async ({ response, request }: { response: Response, request: Request }) => {

		const params = constructParams(request.url.searchParams);

		try {

			if (!params.codtda) throw new Error('El parámetro codtda es requerido');

			const sql = `SELECT CODITM FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PRODUCTOS_STOCKS} WHERE CODTDA = @codtda AND STOCK > 0 ORDER BY CODITM ASC`;

			const result = await dbClient().request().input('codtda', params.codtda).query(sql);

			const items = result.recordset;

			//Genera un archivo csv con los resultados, y se descarga automáticamente

			response.headers.set('Content-Disposition', `attachment; filename=productos_${params.codtda}.csv`);
			response.headers.set('Content-Type', 'text/csv');
			response.body = items.map((item: any) => item.CODITM).join('\n');

		} catch (err) {
			errorRequestHandler(err.message, err, response, request);
		}
	},


	//SELECT TOP 1 OFICIAL FROM LAN_COMMERCE_TABLENAME_TIPOCAMBIO ORDER BY FECHA DESC

	"tipo_cambio": async ({ response, request }: { response: Response, request: Request }) => {

		const params = Object.assign({ page: 1, per_page: 50 }, constructParams(request.url.searchParams));
		params.per_page = Math.min(params.per_page, 1000);

		try {
			const sql = `SELECT TOP ${params.per_page} * FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_TIPOCAMBIO} ORDER BY FECHA DESC`;

			const result = await dbClient().request()
				.query(sql);

			const items = result.recordset;

			response.body = jsonToSuperHtmlTable(items, ['FECHA', 'PARALELO', 'OFICIAL'], params);

		} catch (err) {
			errorRequestHandler(err.message, err, response, request);
		}
	}
}
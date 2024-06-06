import dbClient from "db";
import { Response } from "response";
import { Request } from "request";
import { errorRequestHandler } from "logger";
import { constructParams, jsonToSuperHtmlTable } from "../helpers/index.ts";
import CONSTANTS from "./woocommerce/constants.ts";

export default {
	"": async ({ response, request }: { response: Response, request: Request }) => {

		//Verificar si la conexión a LocalCommerce está activa

		try {
			const result = await dbClient.request().query(`SELECT @@VERSION`);

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

			const result = await dbClient.request()
				.input('codtda', '01')
				.query(sql);

			const items = result.recordset;

			response.body = jsonToSuperHtmlTable(items, ['CODITM', 'CODLIN', 'CODEAN', 'UNIDAD', 'DESITM', 'COSTOPRM', 'STOCK']);

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
			const sql = `SELECT TOP ${params.per_page} * FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PROFORMA} WHERE CODTDA = @codtda AND CODCLT = @codclt ORDER BY FECHAPRO DESC `;

			const result = await dbClient.request()
				.input('codtda', '01')
				.input('codclt', '10001')
				.query(sql);

			const items = result.recordset;

			response.body = jsonToSuperHtmlTable(items, ['FECHA', 'CODTDA', 'CODCLT', 'VVENTA', 'VIGV', 'PVENTA', 'TASAIGV', 'MONEDA', 'TCAMBIO', 'OBSERV', 'CODPAGO', 'USUARIO', 'STATUS', 'CODCONDI', 'FECHAPRO', 'NOMBREFAC', 'NEGRFAC'], params);

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

			const result = await dbClient.request()
				.query(sql);

			const items = result.recordset;

			response.body = jsonToSuperHtmlTable(items, ['FECHA', 'PARALELO', 'OFICIAL'], params);

		} catch (err) {
			errorRequestHandler(err.message, err, response, request);
		}
	}
}
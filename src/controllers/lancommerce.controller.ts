import dbClient from "db";
import { Response } from "response";
import { Request } from "request";
import { errorRequestHandler } from "logger";
import { constructParams, jsonToSuperHtmlTable } from "../helpers/index.ts";


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
			/*const sql = `
			SELECT TOP 10 
				PROD.CODITM AS CODITM,
				PROD.DESITM AS DESITM,
				PROD.CODEAN AS CODEAN,
				STOCK.STOCK AS STOCK,
				STOCK.CODTDA AS CODTDA
			FROM TBPRODUC PROD
			INNER JOIN TBPRODUCSTOCKS STOCK ON PROD.CODITM = STOCK.CODITM
			WHERE STOCK.CODTDA = @codtda
			`;*/
			const sql = `SELECT TOP 100 * FROM TBPRODUC`;

			const result = await dbClient.request()
				.input('codtda', '01')
				.query(sql);

			const items = result.recordset;

			response.body = jsonToSuperHtmlTable(items, ['CODITM', 'DESITM', 'CODTDA', 'CODEAN', 'STOCK']);

		} catch (err) {
			errorRequestHandler(err.message, err, response, request);
		}

	},

	//Proformas: TBDOCPRO (fecha, codtda, codclt, vventa, vigv, pventa, tasaigv, moneda, tcambio, observ, codpago, usuario, status, codcondi, fechapro, nombrefac, negrfac)
	//Proformas items: TBPROITM (codtda, coditm, unidad, cantidad, pventatot, cantegr, unidadegr, status, tasaigv, negr)
	//Columnas siempre son en mayúsculas

	"proformas": async ({ response, request }: { response: Response, request: Request }) => {

		try {
			const sql = `SELECT TOP 100 * FROM TBDOCPRO ORDER BY FECHAPRO DESC`;

			const result = await dbClient.request()
				.query(sql);

			const items = result.recordset;

			response.body = jsonToSuperHtmlTable(items, ['FECHA', 'CODTDA', 'CODCLT', 'VVENTA', 'VIGV', 'PVENTA', 'TASAIGV', 'MONEDA', 'TCAMBIO', 'OBSERV', 'CODPAGO', 'USUARIO', 'STATUS', 'CODCONDI', 'FECHAPRO', 'NOMBREFAC', 'NEGRFAC']);

		} catch (err) {
			errorRequestHandler(err.message, err, response, request);
		}

	},
}
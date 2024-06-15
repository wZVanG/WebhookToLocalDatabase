import { ConnectionPool, IResult, Transaction } from 'npm:mssql@10.0.1';
import logger, { fileHandler } from "logger";

/**
 * Ejecuta una consulta con parámetros opcionales en una transacción.
 * @param transaction - La transacción en la que se ejecutará la consulta.
 * @param query - La consulta SQL.
 * @param params - Parámetros opcionales para la consulta.
 * @returns Un `Promise` que se resuelve con el resultado de la consulta.
 */
export const executeQuery = async (transaction: Transaction, query: string, params: any = {}, types: any | undefined = {}): Promise<IResult<any>> => {
	const request = transaction.request();
	for (const param in params) {
		console.log("types[param]", param, types[param], params[param]);
		if (types[param]) request.input(param, types[param], params[param]);
		else request.input(param, params[param]);
	}
	return await request.query(query);
};

/**
 * Maneja la transacción asegurando que se complete correctamente o se revierta en caso de error.
 * @param pool - La conexión de la base de datos.
 * @param callback - La función a ejecutar dentro de la transacción.
 */
export const handleTransaction = async (pool: ConnectionPool, callback: (transaction: Transaction) => Promise<void>) => {
	const transaction = pool.transaction();
	await transaction.begin();
	try {
		const result = await callback(transaction);
		await transaction.commit();
		return {
			ok: true,
			result
		}
	} catch (error) {
		await transaction.rollback();
		logger.error(error.message ? error.message : error.toString());
		fileHandler.flush();
		return {
			ok: false,
			error: error.message ? error.message : error.toString()
		};
	}

};

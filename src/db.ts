import sql from "npm:mssql@10.0.1";
import "dotenv";
import logger from "logger";

const config = {
	server: Deno.env.get("DATABASE_HOST") ?? "localhost",
	port: Number(Deno.env.get("DATABASE_PORT")) ?? 1433,
	user: Deno.env.get("DATABASE_USER"),
	password: Deno.env.get("DATABASE_PASSWORD"),
	database: Deno.env.get("DATABASE_NAME"),
	options: {
		encrypt: false, // Desactivar para no mostrar el error de conexión
		//trustServerCertificate: true, // Habilita la confianza en el certificado del servidor
		//enableArithAbort: true, // Habilita la terminación aritmética
	}
};

let client: sql.ConnectionPool | null = null;
let timeoutReconnect: number | undefined = undefined;

const connectToDatabase = () => {

	const pool = new sql.ConnectionPool(config);

	pool.connect((err: Error) => {
		if (err) {
			logger.warn(`Error de conexión: ${err.message || err.toString()} 🚨`);
			return reconnect();
		}
		client = pool;
		logger.info(`Conexión de la base de datos establecida ✅`);
	});

	pool.on("error", (err: Error) => {
		client = null;
		logger.warn(`Error de conexión: ${err.message || err.toString()} 🚨`);
		reconnect();
	});

};

const reconnect = () => {

	if (timeoutReconnect) clearTimeout(timeoutReconnect);

	logger.info(`Intentando reconectar en 3 segundo(s)...`)
	timeoutReconnect = setTimeout(connectToDatabase, 3000)

};

connectToDatabase()

export default () => {
	return client
};
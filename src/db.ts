import sql from "npm:mssql@10.0.1";
import "dotenv";
import logger from "logger";


const config = {
	server: (Deno.env.get("DATABASE_HOST") ?? "localhost"),
	port: +(Deno.env.get("DATABASE_PORT") ?? "1433"),
	user: Deno.env.get("DATABASE_USER"),
	password: Deno.env.get("DATABASE_PASSWORD"),
	database: Deno.env.get("DATABASE_NAME"),
	options: {
		encrypt: false, // Desactivar para no mostrar el error de conexión
		//trustServerCertificate: true, // Habilita la confianza en el certificado del servidor
		//enableArithAbort: true, // Habilita la terminación aritmética
	}
};

let client: sql.ConnectionPool;

const connectToDatabase = async () => {
	try {
		client = await sql.connect(config);
		logger.info(`Conexión de la base de datos exitosa 📦`);

	} catch (err) {
		logger.warn(`Error conectando a la base de datos: ${err.message || err.toString()} 🚨`)
	}
};

await connectToDatabase();

export default client;
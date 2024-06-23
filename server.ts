import "dotenv";
import { Application } from "oak";
import { oakCors } from "cors";
import indexRouter from "indexRouter";
import logger, { fileHandler } from "logger";
import { RateLimiter, MapStore } from "ratelimit";
import { initTasks } from "tasks";
import { pause } from "./src/helpers/index.ts";

const rateLimit: Promise<any> = RateLimiter({
	store: new MapStore(), // Using MapStore by default.
	windowMs: 5000, // Window for the requests that can be made in miliseconds.
	max: 20, // Max requests within the predefined window.
	headers: true, // Default true, it will add the headers X-RateLimit-Limit, X-RateLimit-Remaining.
	message: "Too many requests, please try again later.", // Default message if rate limit reached.
	statusCode: 429, // Default status code if rate limit reached.
	onRateLimit: (context) => {
		logger.warn(`Suficientes solicitudes de ${context.request.ip} para ${context.request.url.pathname}`);
	}
});

//Crear deniedService para rechazar solicitudes que no correspondan a la ruta woocommerce/nuevo_pedido_creado

const deniedService = async (context: any, next: any) => {
	if (context.request.url.pathname.includes("nuevo_pedido_creado")) {
		await next();
	} else {
		context.response.status = 403;
		context.response.body = "Acceso denegado";
	}
};


const app = new Application();
const port: number = +(Deno.env.get("SYNC_SERVER_PORT") ?? "8000");

app.use(await rateLimit);
app.use(deniedService);
app.use(indexRouter.routes());
app.use(indexRouter.allowedMethods());
app.use(oakCors({ origin: "*" }));
app.use(function () {
	fileHandler.flush();
});

app.addEventListener("listen", ({ secure, hostname, port }) => {
	const protocol = secure ? "https://" : "http://";
	const url = `${protocol}${hostname ?? "localhost"}:${port}`;

	logger.info(`Server iniciado: ${url}`);

	initTasks([
		{
			"name": "taskProccessLocal",
			"interval": Number(Deno.env.get("LAN_COMMERCE_SEGUNDOS_SINCRONIZACION") ?? 60) * 1000,
			"autostart": true,
			"requiredb": true
		}
	]);

	fileHandler.flush();

});

try {
	await app.listen({ port });
} catch (error) {
	logger.error(error instanceof Deno.errors.AddrInUse ? `El puerto ${port} para el servidor ya está en uso.` : `Fallo al iniciar el servidor ${error.message}`);
	pause();
} finally {
	fileHandler.flush();
}

export default app;
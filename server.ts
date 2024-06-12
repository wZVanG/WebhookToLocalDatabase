import "dotenv";
import { Application } from "oak";
import { oakCors } from "cors";
import indexRouter from "indexRouter";
import logger, { fileHandler } from "logger";
import { RateLimiter, MapStore } from "ratelimit";

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


const app = new Application();
const port: number = +(Deno.env.get("SYNC_SERVER_PORT") ?? "8000");

app.use(await rateLimit);
app.use(indexRouter.routes());
app.use(indexRouter.allowedMethods());
app.use(oakCors({ origin: "*" }));
app.use(function () {
	fileHandler.flush();
});

app.addEventListener("listen", ({ secure, hostname, port }) => {
	const protocol = secure ? "https://" : "http://";
	const url = `${protocol}${hostname ?? "localhost"}:${port}`;
	fileHandler.flush();
	logger.info(`Listening on: ${url}`);


});

await app.listen({ port });
export default app
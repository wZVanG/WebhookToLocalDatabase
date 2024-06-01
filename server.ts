import "dotenv";
import { Application } from "oak";
import { oakCors } from "cors";
import indexRouter from "indexRouter";
import logger, { fileHandler } from "logger";


const app = new Application();
const port: number = +(Deno.env.get("SYNC_SERVER_PORT") ?? "8000");

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
export default app;

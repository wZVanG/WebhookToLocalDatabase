import "dotenv";
import { Application } from "oak";
import { oakCors } from "cors";
import indexRouter from "indexRouter";

const app = new Application();
const port: number = +(Deno.env.get("SYNC_SERVER_PORT") ?? "8000");

app.use(indexRouter.routes());
app.use(indexRouter.allowedMethods());
app.use(oakCors({ origin: "*" }));

app.addEventListener("listen", ({ secure, hostname, port }) => {
	const protocol = secure ? "https://" : "http://";
	const url = `${protocol}${hostname ?? "localhost"}:${port}`;
	console.log(`Listening on: ${url}`);
});

await app.listen({ port });
export default app;

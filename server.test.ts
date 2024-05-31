import "https://deno.land/x/dotenv@v3.2.2/load.ts";
import { assertEquals } from "https://deno.land/std@0.151.0/testing/asserts.ts";

const port: number = +(Deno.env.get("SYNC_SERVER_PORT") ?? "8000");

const baseUrl = `http://localhost:${port}/`;

Deno.test("Nuevo Pedido Creado", async () => {
	const response = await fetch(baseUrl + "woocommerce/nuevo_pedido_creado")
	await response.body?.cancel()
	assertEquals(response.status, 200)
})
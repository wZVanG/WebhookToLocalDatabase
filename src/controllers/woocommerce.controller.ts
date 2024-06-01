import dbClient from "db";
import { Response } from "response";
import { Request } from "request";
import { errorRequestHandler } from "logger";
import Woo from "./woocommerce/index.ts";
import { constructParams, jsonToSuperHtmlTable } from "../helpers/index.ts";


export default {
	"": async ({ response, request }: { response: Response, request: Request }) => {

		//Verificar si la conexión a WooCommerce está activa

		try {
			const result = await Woo.get("webhooks", Object.assign({ page: 1, per_page: 1 }));

			response.body = {
				ok: 1,
				message: "Conexión a WooCommerce activa 🚀",
				webhooks: result.map((item: any) => {
					return Object.keys(item).reduce((acc: any, key: string) => {
						if (['status', 'topic', 'resource', 'event', 'hooks', 'date_created', 'date_modified'].includes(key)) acc[key] = item[key];
						return acc;
					}, {} as any)
				})
			};

		} catch (err) {
			errorRequestHandler(err.message, err, response);
		}
	},
	"productos": async ({ response, request }: { response: Response, request: Request }) => {

		try {
			const items = await Woo.get("products", Object.assign({ page: 1, per_page: 10 }, constructParams(request.url.searchParams)));

			response.body = jsonToSuperHtmlTable(items, ['id', 'name', 'date_created', 'sku', 'price', 'stock_quantity', 'categories']);

		} catch (err) {
			errorRequestHandler(err.message, err, response, request);
		}

	},

	"categorias": async ({ response, request }: { response: Response, request: Request }) => {

		try {
			const items = await Woo.get("products/categories", Object.assign({ page: 1, per_page: 10 }, constructParams(request.url.searchParams)))

			response.body = jsonToSuperHtmlTable(items, ['id', 'name', 'slug', 'count']);

		} catch (err) {
			errorRequestHandler(err.message, err, response, request);
		}

	},

	"pedidos": async ({ response, request }: { response: Response, request: Request }) => {

		try {
			const items = await Woo.get("orders", Object.assign({ page: 1, per_page: 10 }, constructParams(request.url.searchParams)))

			response.body = jsonToSuperHtmlTable(items, ['id', 'number', 'status', 'date_created', 'date_modified', 'date_completed', 'customer_id', 'customer_ip_address', 'total', 'created_via', 'line_items']);

		} catch (err) {
			errorRequestHandler(err.message, err, response, request);
		}

	},

	"clientes": async ({ response, request }: { response: Response, request: Request }) => {

		try {
			const items = await Woo.get("customers", Object.assign({ page: 1, per_page: 10 }, constructParams(request.url.searchParams)))

			response.body = jsonToSuperHtmlTable(items, ['id', 'first_name', 'last_name', 'email', 'username', 'date_created', 'billing', 'shipping']);

		} catch (err) {
			errorRequestHandler(err.message, err, response, request);
		}

	},

	"nuevo_pedido": async ({ response, request }: { response: Response, request: Request }) => {

		try {

			throw new Error("No se puede crear un pedido en este momento");

			const items = await Woo.post("orders", {
				payment_method: "bacs",
				payment_method_title: "Transferencia bancaria",
				set_paid: true,
				billing: {
					first_name: "John",
					last_name: "Doe",
					address_1: "969 Market",
					address_2: "",
					city: "San Francisco",
					state: "CA",
					postcode: "94103",
					country: "US",
					email: ""
				},
				line_items: [
					{
						product_id: 93,
						quantity: 2
					}
				],
				customer_id: 1,
				status: "processing",
			});

			response.body = items;

		} catch (err) {
			errorRequestHandler(err.message, err, response, request);
		}

	},

	"nuevo_pedido_creado": async ({ response, request }: { response: Response, request: Request }) => {
		try {
			const result = await dbClient.request()
				.input('codtda', '21')
				.query(`SELECT TOP 250 CODTDA, CODITM, STOCK FROM TBPRODUCSTOCKS WHERE CODTDA = @codtda`);

			response.body = {
				ok: 1,
				items: result.recordset
			};


		} catch (err) {

			errorRequestHandler(null, err, response, request);

		}
	}

};

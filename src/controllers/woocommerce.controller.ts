import dbClient from "db";
import { Response } from "response";
import { Request } from "request";
import { errorRequestHandler } from "logger";
import Woo from "./woocommerce/index.ts";
import processWooOrder from "./woocommerce/processWooOrder.ts";
import mockOrder from "./woocommerce/mockOrder.ts";
import { constructParams, jsonToSuperHtmlTable } from "../helpers/index.ts";
import { Order } from './woocommerce/interfaces.ts';
import CONSTANTS from "./woocommerce/constants.ts";

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

			response.body = jsonToSuperHtmlTable(items, ['id', 'name', 'date_created', 'sku', 'short_description', 'price', 'stock_quantity', 'categories']);

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

	"test_pedido": async ({ response, request }: { response: Response, request: Request }) => {

		try {

			const item: Order = mockOrder;

			//processWooOrder([item], dbClient);
			//Ejecutar la función processWooOrder con el item de tipo Order y el cliente de base de datos 
			const result = await processWooOrder([item], dbClient);

			response.body = result;

			//response.body = jsonToSuperHtmlTable(items, ['id', 'number', 'status', 'date_created', 'date_modified', 'date_completed', 'customer_id', 'customer_ip_address', 'total', 'created_via', 'line_items']);

		} catch (err) {
			errorRequestHandler(err.message, err, response, request);
		}

	},

	"pedidos": async ({ response, request }: { response: Response, request: Request }) => {

		try {
			const items = await Woo.get("orders", Object.assign({ page: 1, per_page: 10 }, constructParams(request.url.searchParams)))

			//Coleccionar ids de pedidos
			const ids = items.map((item: any) => item.id);
			//Consultar procesos de la base de datos (tabla: [actualizacion_web_local]) según los ids
			const procesosConsulta = await await dbClient.request()
				.input('tipo', CONSTANTS.TIPO_SINCRONIZACION.WEB_VENTA)
				.query(`SELECT id_venta FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION} WHERE tipo = @tipo AND id_venta IN (${ids.join(',')})`);

			const idsProcesos = procesosConsulta.recordset.map((proceso: any) => proceso.id_venta);

			//Agregar la propiedad sincronizado a cada pedido según la consulta de procesos
			items.forEach((item: any) => {
				item.sincronizado = idsProcesos.includes(item.id) ? '✅' : 'No';
			});

			//procesarWooPedidos(items, dbClient, 'nombre_de_tu_tabla');

			response.body = jsonToSuperHtmlTable(items, ['id', 'sincronizado', 'status', 'date_created', 'date_modified', 'date_completed', 'customer_id', 'customer_ip_address', 'total', 'created_via', 'line_items'], {}, {
				callbacks: {
					trCreated: (row: any) => {
						return row.sincronizado === 'No' ? '<tr">' : '<tr style="background-color: #33463c;">';
					}
				}
			});

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

	"POST nuevo_pedido_creado": async ({ response, request }: { response: Response, request: Request }) => {

		const secret = Deno.env.get("WOOCOMMERCE_CONSUMER_SECRET");
		const signature = response.headers.get('x-wc-webhook-signature');


		response.body = {
			ok: 1,
			message: "(Prueba) Nuevo pedido sincronizado 🚀"
		}

		return;

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

	"nuevo_pedido_creado_old": async ({ response, request }: { response: Response, request: Request }) => {
		try {
			const result = await dbClient.request()
				.input('codtda', '21')
				.query(`SELECT TOP 250 CODTDA, CODITM, STOCK FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PRODUCTOS_STOCKS} WHERE CODTDA = @codtda`);

			response.body = {
				ok: 1,
				items: result.recordset
			};


		} catch (err) {

			errorRequestHandler(null, err, response, request);

		}
	}

};

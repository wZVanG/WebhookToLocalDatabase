import dbClient from "db";
import { Response } from "response";
import { Request } from "request";
import { errorRequestHandler } from "logger";
import Woo from "./woocommerce/index.ts";
import processWooOrder from "./woocommerce/processWooOrder.ts";
import mockOrder from "./woocommerce/mockOrder.ts";
import { constructParams, jsonToSuperHtmlTable } from "../helpers/index.ts";
import { Order, WooWebhook } from '../interfaces.ts';
import CONSTANTS from "../constants.ts";
import processWebhook from "./woocommerce/processWebhook.ts";

export default {
	"": async ({ response }: { response: Response }) => {

		//Verificar si la conexión a WooCommerce está activa;

		try {
			const result = await Woo.get("webhooks", Object.assign({ page: 1, per_page: 1 }));

			response.body = {
				ok: 1,
				message: "Conexión a WooCommerce activa 🚀",
				webhooks: result.map((item: WooWebhook) => {
					return Object.keys(item).reduce((acc: WooWebhook, key: string) => {
						if (['status', 'topic', 'resource', 'event', 'hooks', 'date_created', 'date_modified'].includes(key)) acc[key] = item[key];
						return acc;
					}, {} as WooWebhook)
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

			//processWooOrder([item], dbClient());
			//Ejecutar la función processWooOrder con el item de tipo Order y el cliente de base de datos 
			const result = await processWooOrder([item], dbClient());

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
			const ids = items.map((item: { id: number }) => item.id);
			//Consultar procesos de la base de datos (tabla: [actualizacion_web_local]) según los ids
			const procesosConsulta = await await dbClient().request()
				.input('tipo', CONSTANTS.TIPO_SINCRONIZACION.WEB_VENTA)
				.query(`SELECT id_venta FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION} WHERE tipo = @tipo AND id_venta IN (${ids.join(',')})`);

			const idsProcesos = procesosConsulta.recordset.map((proceso: { id_venta: number }) => proceso.id_venta);

			//Agregar la propiedad sincronizado a cada pedido según la consulta de procesos
			items.forEach((item: { id: number, sincronizado: string }) => {
				item.sincronizado = idsProcesos.includes(item.id) ? '✅' : 'No';
			});

			//procesarWooPedidos(items, dbClient(), 'nombre_de_tu_tabla');

			response.body = jsonToSuperHtmlTable(items, ['id', 'sincronizado', 'status', 'date_created', 'date_modified', 'date_completed', 'customer_id', 'customer_ip_address', 'total', 'created_via', 'line_items'], {}, {
				callbacks: {
					trCreated: (row: { sincronizado: string }) => {
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

		let webhookResult;

		try {
			webhookResult = await processWebhook({ request });

			if (!webhookResult.success) {
				response.body = webhookResult.body;
				return;
			}

		} catch (err) {
			return errorRequestHandler(err.message, err, response, request);
		}

		const { body } = webhookResult;

		const Item: Order = body;

		const result = await processWooOrder([Item], dbClient());

		response.body = result;


	}

};

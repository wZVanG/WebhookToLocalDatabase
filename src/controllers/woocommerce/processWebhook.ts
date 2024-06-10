import { Request } from "request";
import validateWebhookSignature from "./validateWebhookSignature.ts";
import logger from "logger";

export default async ({ request }: { request: Request }) => {

	try {
		const secret = Deno.env.get("WOOCOMMERCE_WEBHOOK_SECRET");

		if (!secret) throw new Error("No ha definido la variable de entorno WOOCOMMERCE_WEBHOOK_SECRET");

		const webhook = {
			id: request.headers.get('x-wc-webhook-id'),
			topic: request.headers.get('x-wc-webhook-topic'),
			resource: request.headers.get('x-wc-webhook-resource'),
			event: request.headers.get('x-wc-webhook-event'),
			signature: request.headers.get('x-wc-webhook-signature') || '',
			delivery_id: request.headers.get('x-wc-webhook-delivery-id')
		}

		if (!request.hasBody) throw new Error("La petición no tiene contenido");

		const requestBody = request.body;
		const requestBodyType = requestBody.type();

		const body = await requestBody.text();

		//Cuando WooCommerce envía un webhook de prueba, el cuerpo de la solicitud es de tipo form, no lo devolvemos como error
		if (requestBodyType === "form") {

			//Verificar si se ha configurado un webhook, es decir si body tiene un formato de esta forma: webhook_id=1
			const matchWebhookId = body.match(/webhook_id=(\d+)/);
			if (matchWebhookId) {
				const msgLog = `Recibiendo PONG: Configurado Webhook con ID: ${matchWebhookId[1]} en WooCommerce`;
				logger.info(msgLog);
				return { body: { message: msgLog }, success: false };
			}
		}

		//El payload del webhook debe ser JSON
		if (requestBodyType !== "json") throw new Error(`El tipo de contenido no es JSON: ${requestBodyType}`);

		//Verificamos el secreto del webhook configurado en cada Webhook de WooCommerce y el secreto almacenado en la variable de entorno
		//Se valida el body tal como se recibe en la petición, no se parsea a JSON

		const validateWebhook = await validateWebhookSignature(secret, body, webhook.signature);
		const parteDelCuerpo = body.slice(0, 100);

		if (!validateWebhook) throw new Error(`La clave del webhook no es válida, se recibió la petición de (${request.ip}@${JSON.stringify(request.userAgent)}): ${parteDelCuerpo}...`);

		//Cómo ya hemos procesado y validado correctamente el webhook, devolvemos el cuerpo en formato JSON
		return { body: JSON.parse(body), webhook, success: true };

	} catch (err) {
		throw new Error(err.message);
	}

}
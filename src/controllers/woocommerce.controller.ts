import dbClient from "db";
import { Response } from "response";
import { Request } from "request";

export default {
	"": ({ response }: { response: Response }) => {
		response.body = {
			result: "Ok 🚀",
		}
	},
	":action": async ({ params, response, request }: { params: { action: string }; response: Response; request: Request }) => {
		const action = params.action;


		switch (action) {
			case "nuevo_pedido_creado": {
				const result = await dbClient.request().query(`select * from frutas`);
				//const result = await dbClient.query("select * from ?? where id = ?", ["todos", id]);
				const items = result.recordset;

				console.log(`Acción ${action} [${Date.now()}] -->`, request);

				response.body = {
					ok: 1,
					items: items
				};

				break;
			}
			default: {
				response.body = {
					error: "Acción no encontrada"
				};
				break;
			}
		}
	},
};

import dbClient from "db";
import { Response } from "response";
import { Request } from "request";
import { errorRequestHandler } from "logger";

export default {
	"": async ({ response, request }: { response: Response; request: Request }) => {

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

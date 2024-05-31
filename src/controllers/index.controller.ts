import { Response } from "response";

export default {
	"": ({ response }: { response: Response }) => {
		response.body = 'wZVanG está listo! 🚀';
	},

	"GET saludo": ({ response }: { response: Response }) => {
		response.body = 'Hola, soy wZVanG! 🚀';
	}
};
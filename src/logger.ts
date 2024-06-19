import * as log from "stdlog";
import { Response } from "response";
import { Request } from "request";

const fileHandlerCallback = new log.FileHandler('ERROR', {
	filename: './logs/error.log',
	formatter: rec => JSON.stringify({ r: rec.loggerName, t: rec.datetime, l: rec.levelName, d: rec.msg, a: rec.args })
})

log.setup({

	handlers: {
		console: new log.ConsoleHandler("DEBUG", {
			formatter: (rec) => {
				return `[${rec.levelName}] ${rec.msg} ${JSON.stringify(rec.args)}`
			}
		}),
		file: fileHandlerCallback
	},

	loggers: {
		default: {
			level: "DEBUG",
			handlers: ["console", "file"],
		}
	},
});

export const errorRequestHandler = (customError: string | null, err: Error, response: Response, request?: Request) => {

	const errorType = err.name || 'Unknown';
	const codeGenerated = Math.floor(Math.random() * 1000000);

	let error_str = `🚨 ${customError ? customError : 'Error inesperado'}:`;
	error_str = error_str.includes("reading 'request'") ? `No hay instancia de conexión a la base de datos: ${error_str}` : error_str;
	error_str += ` ${errorType} (${codeGenerated})`

	const obj = {
		error: true,
		message: log.getLogger().error(error_str, Object.assign({ url: request?.url, code: codeGenerated }, errDetailed(err)))
	}

	response.body = obj;

	fileHandlerCallback.flush();

	return obj;

}

export const errDetailed = (err: Error) => {

	return {
		message: err.message,
		file: err.stack?.match(/at file[:/]+(.+)\n/)?.[1] || "",
		name: err.name,
	};
};
export const fileHandler = fileHandlerCallback;
export default log.getLogger();

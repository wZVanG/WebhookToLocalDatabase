import * as log from "stdlog";
import { Response } from "response";
import { Request } from "request";

/*log.setup({
	handlers: {
		default: new log.ConsoleHandler("DEBUG", {
			formatter: log.formatters.jsonFormatter,
			useColors: true,
		}),
	},
});*/

//applicationLoggerHandler();

const fileHandlerCallback = new log.FileHandler('ERROR', {
	filename: './src/logs/server.log',
	formatter: rec => JSON.stringify({ r: rec.loggerName, t: rec.datetime, l: rec.levelName, d: rec.msg, a: rec.args })
})

log.setup({
	//define handlers
	handlers: {
		console: new log.ConsoleHandler("DEBUG", {
			formatter: (rec) => {
				return `[${rec.levelName}] ${rec.msg} ${JSON.stringify(rec.args)}`
			}
		}),
		file: fileHandlerCallback
	},

	//assign handlers to loggers  
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

	const error_message = log.getLogger().error(`🚨 ${customError ? customError : 'Error inesperado'}: ${errorType} (${codeGenerated})`, Object.assign({ url: request?.url, code: codeGenerated }, errDetailed(err)));

	const obj = {
		error: true,
		message: error_message
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

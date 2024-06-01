import { Router } from "https://deno.land/x/oak@v16.0.0/mod.ts";
import * as path from "https://deno.land/std@0.224.0/path/mod.ts";
import logger from "logger";

type HttpMethod = 'get' | 'post' | 'put' | 'delete';

const CONTROLLERS_PATH = path.join(Deno.cwd(), "src/controllers");
const router = new Router();

type ControllerType = (ctx: any) => void;

logger.debug("CONTROLLERS_PATH: ", CONTROLLERS_PATH)

const addRoute = (controllerName: string, key: string, controller: ControllerType) => {
	let [method, route_str] = key.split(" ")
	if (!route_str) {
		route_str = method
		method = "GET"
	}
	const route_name = `/${controllerName}${route_str ? "/" + route_str : ""}`.replace(/\/+/g, "/")
	const method_name_fn: HttpMethod = method.toLowerCase() as HttpMethod
	router[method_name_fn](route_name, controller)

	logger.debug(`Se agregó la ruta [${method}] ${route_name}`)
}

const importController = async (fileName: string) => {
	const controllerPath = "../controllers/" + fileName;
	const module = await import(controllerPath);
	return module.default;
};


const addRoutesFromController = (controllerName: string, controller: ControllerType) => {
	for (const [key, value] of Object.entries(controller)) {
		addRoute(controllerName, key, value as ControllerType);
	}
};

for await (const dirEntry of Deno.readDir(CONTROLLERS_PATH)) {
	if (dirEntry.isFile && dirEntry.name.endsWith(".controller.ts")) {
		const controllerName = dirEntry.name.replace(".controller.ts", "");
		if (controllerName === "index") continue;
		const controller = await importController(dirEntry.name);
		await addRoutesFromController(controllerName, controller);
	}
}

const indexController = await importController("index.controller.ts");
addRoutesFromController("", indexController);

export default router;
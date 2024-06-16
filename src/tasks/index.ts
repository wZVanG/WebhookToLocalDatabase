import logger, { fileHandler } from "logger";
import { Task, TaskProccess } from '../interfaces.ts';
import dbClient from "db";
import taskProccessLocal from "./task.proccessLocal.ts";
import taskUpdateFullStock from "./task.updateFullStock.ts";

const ProjectTasks: { [key: string]: TaskProccess } = {
	"taskProccessLocal": {
		"callback": taskProccessLocal
	},
	"updateFullStock": {
		"callback": taskUpdateFullStock
	}
}

export const initTasks = (tasks: Array<Task>) => {

	logger.info("Tareas programadas iniciadas 🚀")

	tasks.forEach(async (task: Task) => {

		if (ProjectTasks[task.name]) {

			if (ProjectTasks[task.name].started) {
				logger.warn(`La tarea ${task.name} ya está en ejecución`)
				return;
			}

			ProjectTasks[task.name].started = true

			logger.info(`Tarea ${task.name} iniciada correctamente`)

			const callback = await ProjectTasks[task.name].callback(task)

			if (task.autostart) {
				if (task.requiredb) {
					if (dbClient()) callback()
					else logger.warn(`La tarea ${task.name} requiere una conexión a la base de datos`)
				} else {
					callback()
				}
				fileHandler.flush();
			}

			if (task.interval) task.intervalFn = setInterval(() => {

				if (task.requiredb) {
					if (dbClient()) callback()
					else logger.warn(`Esperando conexión a la base de datos para la tarea ${task.name}`)
				} else {
					callback();
				}
				fileHandler.flush();
			}, task.interval);

		} else {
			logger.warn(`La tarea ${task.name} no está definida`);
		}

	})

	// Deno.cron("Log a message", { minute: { every: 1 } }, () => {
	// 	console.log("Log a message every 1 minute");
	// });

	//fileHandler.flush();
}

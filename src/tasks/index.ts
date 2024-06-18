import logger, { fileHandler } from "logger";
import { Task, TaskProccess } from '../interfaces.ts';
import dbClient from "db";
import taskProccessLocal from "./task.proccessLocal.ts";
import taskUpdateFullStock from "./task.updateFullStock.ts";
import { prompt } from "../helpers/index.ts";

const ProjectTasks: { [key: string]: TaskProccess } = {
	"taskProccessLocal": {
		"callback": taskProccessLocal
	},
	"updateFullStock": {
		"callback": taskUpdateFullStock
	}
}

export const initTasks = async (tasks: Array<Task>) => {

	if (!tasks.length) {

		//Mostramos la lista de tareas disponibles al usuario para elegir

		let i = 1;
		const tareasPositions: { [key: string]: string } = {};
		const options: Array<string> = [];

		Object.keys(ProjectTasks).forEach((task: string) => {

			if (task === "taskProccessLocal") return; //Ocultamos la tarea taskProccessLocal

			options.push(`${i}. ${task}`);
			tareasPositions[String(i++)] = task;
		})

		while (true) {
			let taskSelected = "1";

			if (options.length > 1) {
				taskSelected = await prompt(`\nEscribe el número de la tarea a ejecutar:\n${options.join("\n")}\n`)
				if (!tareasPositions[taskSelected]) continue;
			}

			tasks.push({
				"name": tareasPositions[taskSelected],
				"autostart": true,
				"requiredb": true,
				"interval": 10000,
				"flags": {}
			})
			break;
		}


	}

	//logger.info("Iniciando tareas 🚀");

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
					else logger.warn(`La tarea ${task.name} requiere una conexión a la base de datos. Esperando conexión...`)
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

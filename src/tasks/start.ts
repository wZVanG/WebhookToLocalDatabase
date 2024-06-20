import { initTasks } from "tasks";
import { Task } from "../interfaces.ts";
import { parseArgs } from "jsr:@std/cli@0.224.6/parse-args";

const flags = parseArgs(Deno.args, {
	string: ["task", "stockfile"],
});

//deno task task --task="updateFullStock(3000,1,1);"
//deno task task --task="taskProccessLocal(10000,1,1);"

const tasks = flags.task ? String(flags.task).split(";") : []

const taskToInit: Array<Task> = []

tasks.forEach((taskObj: string) => {

	const taskArgs = taskObj.match(/(\w+)\((.*)\)/)
	const taskName = taskArgs ? taskArgs[1] : taskObj

	if (!taskName.length) return;

	const taskParams = taskArgs ? taskArgs[2].split(",").map((param: string) => /^\d+$/.test(param) ? +param.trim() : param.trim()) : []

	const [interval, autostart, requiredb] = taskParams

	const defaultOptions = {
		"interval": interval ?? 10000,
		"autostart": autostart ?? true,
		"requiredb": requiredb ?? true,
		"flags": flags
	}

	taskToInit.push({
		"name": taskName,
		...defaultOptions
	} as unknown as Task);

})

initTasks(taskToInit)
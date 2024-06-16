import { ensureDir, copy } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";
import { OutputMode, exec } from "https://deno.land/x/exec@0.0.5/mod.ts";
import AdmZip from "npm:adm-zip@0.5.14";

const srcDir = "./src";
const distName = "_dist";
const distDir = `./${distName}`;

// 1. Crea el directorio "dist" en la carpeta raíz del proyecto
await ensureDir(distDir);

const date = new Date();
const distDirDate = `${distDir}/${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

let sequence = 1, distDirLastVersion = `${distDirDate}_${sequence}`;

//Si el subdirectorio ya existe, coloca al final un número de secuencia
while (await Deno.stat(distDirLastVersion).catch(() => null)) distDirLastVersion = `${distDirDate}_${++sequence}`;

console.log(`Creando el directorio ${distDirLastVersion}...`);
await ensureDir(distDirLastVersion);

const controllersDir = "./src/controllers";


// 2. Copia el contenido de la carpeta "src/" (menos la carpeta logs) a "dist".
console.log(`Copiando la carpeta src a la carpeta ${distName}...`);
await copy(srcDir, distDirLastVersion + "/src", { overwrite: true });

const controllerFiles = [];
for await (const entry of walk(controllersDir)) {
	//Solo archivos que terminan en .controller.ts
	if (entry.isFile && entry.name.endsWith(".controller.ts")) {
		controllerFiles.push(entry.name);
	}
}

//Copiar el archivo .env.example a la carpeta dist
console.log(`Copiando archivo .env.example a la carpeta ${distName}...`);
await copy(".env.example", distDirLastVersion + "/.env.example", { overwrite: true });

//Copiar todos los archivos de la carpeta utils a la carpeta dist sin tomar la carpeta
console.log(`Copiando la carpeta utils a la carpeta ${distName}...`);
await copy("utils", distDirLastVersion, { overwrite: true });



// 4. Genera los parámetros para el comando ssh
const includeParams = controllerFiles.map((file) => `--include src/controllers/${file}`).join(" ");

// 5. Ejecuta el comando ssh
//--no-terminal --no-prompt --quiet
const command = `deno compile --allow-read --allow-write=./server.log --allow-env --allow-net --allow-sys --unstable-cron ${includeParams} --output ${distDirLastVersion}/ChangEcommerceSync.exe server.ts`;
//const command = `deno compile -A --output ${distDirLastVersion}/ChangEcommerceSync.exe simple.ts`;

//Escribir en console Ejecutando comando de color verde
console.log(`\x1b[32mEjecutando comando:\x1b[0m`);

//Mostrar el comando en console de colo celeste
console.log(`\x1b[36m${command}\x1b[0m`);

const execute = await exec(command, { output: OutputMode.Capture });


if (execute.status.success) {
	console.log(execute.output);
	console.log(`\x1b[32mCompilación exitosa ChangEcommerceSync.exe 🚀: ${distDirLastVersion}\x1b[0m`);

} else {
	console.log(`\x1b[31mError al ejecutar el comando 🚨\x1b[0m`);
	console.log(execute);
}

const command2 = `deno compile --allow-read --allow-write --allow-env --allow-net --allow-sys --no-check --output ${distDirLastVersion}/ActualizarStockMasivo.exe ./src/tasks/start.ts`;

//Escribir en console Ejecutando comando de color verde
console.log(`\x1b[32mEjecutando comando:\x1b[0m`);

//Mostrar el comando en console de colo celeste
console.log(`\x1b[36m${command2}\x1b[0m`);

const execute2 = await exec(command2, { output: OutputMode.Capture });

if (execute2.status.success) {
	console.log(execute2.output);
	console.log(`\x1b[32mCompilación exitosa ActualizarStockMasivo.exe 🚀: ${distDirLastVersion}\x1b[0m`);
	console.log(`\x1b[32mModifica la configuración de tu base de datos en el archivo .env\x1b[0m`);
}

//Comprimir el directorio dist con await compress()
var zip = new AdmZip();
console.log(`Comprimiendo el directorio ${distDirLastVersion}...`);
zip.addLocalFolder(distDirLastVersion);
zip.writeZip(`${distDirLastVersion}.zip`);

//await compress(distDirLastVersion, `${distDirLastVersion}.zip`, { overwrite: true });

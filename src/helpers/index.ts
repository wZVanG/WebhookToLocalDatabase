export const pause = () => {
	const buffer = new Uint8Array(1024);
	console.log("Presione Enter para salir...");
	Deno.stdin.readSync(buffer);
}

export const prompt = async (question: string): Promise<string> => {

	const buf = new Uint8Array(1024); // Buffer para almacenar la entrada
	await Deno.stdout.write(new TextEncoder().encode(question + "\n")); // Muestra la pregunta en la consola
	const n = <number>await Deno.stdin.read(buf); // Lee la entrada del usuario
	const answer = new TextDecoder().decode(buf.subarray(0, n)).trim(); // Decodifica y recorta la entrada
	return answer;
}

export const constructParams = (searchParams: URLSearchParams) => {
	const params: any = {};

	for (const [key, value] of searchParams) {
		params[key] = value;
	}

	return params;
}

export const today = () => {
	const date = new Date();
	const day = date.getDate().toString().padStart(2, '0');
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	const year = date.getFullYear();
	return `${year}_${month}_${day}`;
}

const escapeHtml = (unsafe: string) => {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

export const jsonToSuperHtmlTable = (json: any, columns: Array<any>, params?: any, options?: any) => {

	if (params?.format === 'json') return json;

	let html = '<table border="1" style="border-collapse: collapse;">';

	//create table header
	html += '<thead><tr>';
	columns.forEach((column) => {
		html += `<th>${column}</th>`;
	});
	html += '</tr></thead>';

	//create table rows
	json.forEach((row: any) => {
		html += options?.callbacks?.trCreated ? options.callbacks.trCreated(row) : `<tr>`;
		let firstColumn = false;
		columns.forEach((column) => {
			const onclick = !firstColumn ? ` onClick='console.log(${JSON.stringify(row)})'` : '';
			const isObject = typeof row[column] === 'object';
			const value = isObject ? JSON.stringify(row[column]) : escapeHtml(String(row[column]));
			const wrapLink = !firstColumn && row['permalink'] ? `<a target="_blank" href="${row['permalink']}" target="_blank">${value}</a>` : value;
			html += `<td${onclick}>${wrapLink}</td>`;
			firstColumn = true;
		});
		html += '</tr>';
	});


	html += '</table>';

	//return with html tag and amazing style

	const style = `
	<style>
	body {
		padding: 0;
		margin: 0;
	}
	* {
	box-sizing: border-box;
	font-family: Arial, sans-serif;
	font-size: 10px;
	color: white;
	}
	body, th{
		background-color: #333;
	}
		table {
			width: 100%;
			border-collapse: collapse;
		}
		th, td {
			padding: 10px;
			border: 1px solid black;
		}
		th {
			background-color: #777;
		}
		thead th {
			position:sticky;
			top:0
		}
	</style>`;

	return `
	<html>
		<head>
			${style}
		</head>
		<body>
			${html}
		</body>
	</html>
	`;


}
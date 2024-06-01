import "dotenv";

interface WooCommerceConfig {
	url: string | undefined;
	consumerKey: string | undefined;
	consumerSecret: string | undefined;
	timeout?: number | undefined;
	version?: string | undefined;
}

class WooCommerce {
	private url: string;
	private consumerKey: string;
	private consumerSecret: string;
	private timeout: number;
	private version: string;

	constructor({ url, consumerKey, consumerSecret, timeout, version }: WooCommerceConfig) {
		this.url = url || '';
		this.consumerKey = consumerKey || '';
		this.consumerSecret = consumerSecret || '';
		this.timeout = timeout || 5000;
		this.version = version || 'wc/v3';
	}

	// Método para construir la URL con los parámetros necesarios
	private _buildUrl(endpoint: string, params: { [key: string]: any } = {}): URL {
		const url = new URL(`${this.url}/wp-json/${this.version}/${endpoint}`);
		url.searchParams.append('consumer_key', this.consumerKey);
		url.searchParams.append('consumer_secret', this.consumerSecret);
		Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
		return url;
	}

	// Método genérico para realizar peticiones con timeout
	private async _fetchWithTimeout(resource: URL, options: RequestInit): Promise<any> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			const response = await fetch(resource.toString(), {
				...options,
				signal: controller.signal
			});
			clearTimeout(timeoutId);
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(`Error ${response.status}: ${errorData.message}`);
			}
			return await response.json();
		} catch (error: any) {
			if (error.name === 'AbortError') {
				throw new Error('Request timed out');
			}
			throw error;
		}
	}

	// Método para realizar una petición GET
	async get(endpoint: string, params: { [key: string]: any } = {}): Promise<any> {

		const url = this._buildUrl(endpoint, params);
		return await this._fetchWithTimeout(url, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			}
		});
	}

	// Método para realizar una petición POST
	async post(endpoint: string, data: any, params: { [key: string]: any } = {}): Promise<any> {
		const url = this._buildUrl(endpoint, params);
		return await this._fetchWithTimeout(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(data)
		});
	}

	// Método para realizar una petición PUT
	async put(endpoint: string, data: any, params: { [key: string]: any } = {}): Promise<any> {
		const url = this._buildUrl(endpoint, params);
		return await this._fetchWithTimeout(url, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(data)
		});
	}

	// Método para realizar una petición DELETE
	async delete(endpoint: string, params: { [key: string]: any } = {}): Promise<any> {
		const url = this._buildUrl(endpoint, params);
		return await this._fetchWithTimeout(url, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
			}
		});
	}
}

// Ejemplo de uso:
const Woo = new WooCommerce({
	url: Deno.env.get("WOOCOMMERCE_URL"),
	consumerKey: Deno.env.get("WOOCOMMERCE_CONSUMER_KEY"),
	consumerSecret: Deno.env.get("WOOCOMMERCE_CONSUMER_SECRET"),
	timeout: 30000,
	version: Deno.env.get("WOOCOMMERCE_VERSION")
});


export default Woo;
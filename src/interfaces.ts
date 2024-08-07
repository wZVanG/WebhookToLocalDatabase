export interface Order {
	id: number
	parent_id: number
	status: string
	currency: string
	version: string
	prices_include_tax: boolean
	date_created: string
	date_modified: string | null
	discount_total: string
	discount_tax: string
	shipping_total: string
	shipping_tax: string
	cart_tax: string
	total: string
	total_tax: string
	customer_id: number
	order_key: string
	billing: Billing
	shipping: Shipping
	payment_method: string
	payment_method_title: string
	transaction_id: string
	customer_ip_address: string
	customer_user_agent: string
	created_via: string
	customer_note: string
	date_completed: string | null
	date_paid: string | null
	cart_hash: string
	number: string
	meta_data: MetaDaum[]
	line_items: OrderItem[]
	tax_lines: number[]
	shipping_lines: ShippingLine[]
	fee_lines: number[]
	coupon_lines: number[]
	refunds: number[]
	date_created_gmt: string | null
	date_modified_gmt: string | null
	date_completed_gmt: string | null
	date_paid_gmt: string | null
	currency_symbol: string
	_links: Links
}

export interface Billing {
	first_name: string
	last_name: string
	company: string
	address_1: string
	address_2: string
	city: string
	state: string
	postcode: string
	country: string
	email: string
	phone: string
	departamento: string
	provincia: string
	distrito: string
}

export interface Shipping {
	first_name: string
	last_name: string
	company: string
	address_1: string
	address_2: string
	city: string
	state: string
	postcode: string
	country: string
	phone: string
	departamento: string
	provincia: string
	distrito: string
}

export interface MetaDaum {
	id: number
	key: string
	value: string
}

export interface OrderItem {
	id: number
	name: string
	product_id: number
	variation_id: number
	quantity: number
	tax_class: string
	subtotal: string
	subtotal_tax: string
	total: string
	total_tax: string
	taxes: number[]
	meta_data: MetaDaum2[]
	sku: string
	price: number
	parent_name: string | null
}

export interface MetaDaum2 {
	id: number
	key: string
	value: string
	display_key: string
	display_value: string
}

export interface ShippingLine {
	id: number
	method_title: string
	method_id: string
	instance_id: string
	total: string
	total_tax: string
	taxes: number[]
	meta_data: MetaDaum3[]
}

export interface MetaDaum3 {
	id: number
	key: string
	value: string
	display_key: string
	display_value: string
}

export interface Links {
	self: Self[]
	collection: Collection[]
}

export interface Self {
	href: string
}

export interface Collection {
	href: string
}

export interface WooWebhook {
	status: string;
	topic: string;
	resource: string;
	event: string;
	hooks: string[];
	date_created: string;
	date_modified: string;
	[key: string]: Array<string> | string; // Add index signature
}

export interface WooProductMetaData {
	id: number;
	key: string;
	value: string;
}

export interface LocalSyncExtend {
	descripcion?: string | null;
	meta_data?: Array<WooProductMetaData> | null;
	codlin?: string | null;
	unidad?: string | null;
	precio?: number | null;
	codean?: string | null | undefined;
	activo?: boolean;
	catalog_visibility?: "visible" | "hidden" | "search" | "catalog";
	[key: string]: Array<WooProductMetaData> | string | null | number | boolean | undefined;
}

export interface LocalSyncCategory {
	descripcion: string | null;
	woocommerce_id: number | null;
	activo?: number;
}

export interface WooUpsertCategory {
	id: number;
	name?: string;
}

export interface WooUpsertCategoryResponse {
	id: number;
	name: string;
	cod_cat_local: number;
	status: "updated" | "created" | "exists" | "error";
	error?: string | null;
}

export interface WooProductCategogy {
	id: number;
	name?: string;
	cod_cat_local?: null | string;
}

export interface WooProduct {
	id?: number;
	name: string;
	sku: string;
	stock_quantity: number;
	regular_price: number;
	status: string;
	manage_stock: boolean;
	short_description: string;
	categories: WooProductCategogy[];
	description?: string | null;
	low_stock_amount?: number | null;
	ean?: string;
	meta_data?: Array<WooProductMetaData> | null;
}

export interface WooProductExtended extends WooProduct {
	unidad?: string;
	codean?: string;
	stockmin?: number;
	activo?: number;
	categoria?: number[];
	woocommerce_id_cat?: number | null;
}

export interface WooProductLog extends WooProduct {
	codigo_tienda?: string;
}

export interface LocalProductStock {
	id: number;
	codigo_tienda: string;
	codigo_item: string;
	stock: number;
	tipo: number;
	infojson: string;
	crud: string;
}

export interface LocalProductStockTda {
	CODTDA: string;
	CODITM: string;
	STOCK: number
}

export interface LocalProductPrice {
	CODITM: string,
	PRECIOFINAL: number
}

export interface Task {
	name: string;
	interval: number | null;
	intervalFn?: number;
	autostart: boolean;
	requiredb: boolean;
	flags?: { [key: string]: string };
}

export interface TaskProccess {
	callback: (arg0: Task) => Promise<() => void>;
	started?: boolean;
}
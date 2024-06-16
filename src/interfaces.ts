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

export interface WooProduct {
	id: number;
	name: string;
	sku: string;
	stock_quantity: number;
	stock_status: string;
}

export interface WooProductLog extends WooProduct {
	codigo_tienda: string;
}

export interface LocalProductStock {
	codigo_tienda: string;
	codigo_item: string;
	stock: number
}

export interface LocalProductStockTda {
	CODTDA: string;
	CODITM: string;
	STOCK: number
}

export interface Task {
	name: string;
	interval: number | null;
	intervalFn?: number;
	autostart: boolean;
	requiredb: boolean;
	stopiffinish?: boolean;
	flags?: { [key: string]: string };
}

export interface TaskProccess {
	callback: (arg0: Task) => Promise<() => void>;
	started?: boolean;
}
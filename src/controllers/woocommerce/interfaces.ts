export interface Order {
	id: number
	parent_id: number
	status: string
	currency: string
	version: string
	prices_include_tax: boolean
	date_created: string
	date_modified: string
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
	date_completed: any
	date_paid: any
	cart_hash: string
	number: string
	meta_data: MetaDaum[]
	line_items: OrderItem[]
	tax_lines: any[]
	shipping_lines: ShippingLine[]
	fee_lines: any[]
	coupon_lines: any[]
	refunds: any[]
	date_created_gmt: string
	date_modified_gmt: string
	date_completed_gmt: any
	date_paid_gmt: any
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
	taxes: any[]
	meta_data: MetaDaum2[]
	sku: string
	price: number
	parent_name: any
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
	taxes: any[]
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

export interface Order {
	id: number;
	date_created: string;
	date_completed: string;
	status: string;
	billing: {
		company: string;
		first_name: string;
		last_name: string;
	};
	line_items: {
		product_id: number;
		sku: string;
		quantity: number;
		price: number;
	}[];
	meta_data: {
		key: string;
		value: string;
	}[];
	shipping_lines: {
		method_title: string;
		total: string;
	}[];
	total: string;
}

export interface OrderItem {
	id: number;
	name: string;
	product_id: number;
	variation_id: number;
	quantity: number;
	tax_class: string;
	subtotal: string;
	subtotal_tax: string;
	total: string;
	total_tax: string;
	taxes: any[];
	meta_data: {
		id: number;
		key: string;
		value: string;
		display_key: string;
		display_value: string;
	}[];
	sku: string;
	price: number;
	parent_name: string;
}

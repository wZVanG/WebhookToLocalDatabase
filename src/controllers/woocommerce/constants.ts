interface SyncTypes {
	SERVER_VENTA: number;
	SERVER_COMPRA: number;
	WEB_VENTA: number;
	WEB_COMPRA: number;
	WEB_PRODUCTO: number;
	SERVER_PRODUCTO: number;
	WEB_STOCK: number;
	SERVER_STOCK: number;
}

interface WooCommerceOrderStatusKeys {
	PENDING: string;
	PROCESSING: string;
	ON_HOLD: string;
	COMPLETED: string;
	CANCELLED: string;
	REFUNDED: string;
	FAILED: string;
}

interface WooCommerceOrderStatus {
	pending: number;
	processing: number;
	'on-hold': number;
	completed: number;
	cancelled: number;
	refunded: number;
	failed: number;
}

interface TableNames {
	LAN_COMMERCE_TABLENAME_SINCRONIZACION: string | undefined;
	LAN_COMMERCE_TABLENAME_PROFORMA_ITEM: string | undefined;
	LAN_COMMERCE_TABLENAME_PROFORMA: string | undefined;
	LAN_COMMERCE_TABLENAME_TIPOCAMBIO: string | undefined;
	LAN_COMMERCE_TABLENAME_PRODUCTOS_PRECIOS: string | undefined;
	LAN_COMMERCE_TABLENAME_PRODUCTOS: string | undefined;
	LAN_COMMERCE_TABLENAME_PRODUCTOS_STOCKS: string | undefined;
	LAN_COMMERCE_TABLENAME_VENTAS: string | undefined;
}

interface Config {
	TIPO_SINCRONIZACION: SyncTypes;
	WOO_COMMERCE_ORDER_STATUS_KEYS: WooCommerceOrderStatusKeys;
	WOO_COMMERCE_ORDER_STATUS: WooCommerceOrderStatus;
	TABLENAMES: TableNames;
}

const config: Config = {
	TIPO_SINCRONIZACION: {
		SERVER_VENTA: 1,
		SERVER_COMPRA: 2,
		WEB_VENTA: 3,
		WEB_COMPRA: 4,
		WEB_PRODUCTO: 5,
		SERVER_PRODUCTO: 6,
		WEB_STOCK: 7,
		SERVER_STOCK: 8
	},
	WOO_COMMERCE_ORDER_STATUS_KEYS: {
		PENDING: 'pending',
		PROCESSING: 'processing',
		ON_HOLD: 'on-hold',
		COMPLETED: 'completed',
		CANCELLED: 'cancelled',
		REFUNDED: 'refunded',
		FAILED: 'failed',
	},
	WOO_COMMERCE_ORDER_STATUS: {
		'pending': 1,
		'processing': 2,
		'on-hold': 3,
		'completed': 4,
		'cancelled': 5,
		'refunded': 6,
		'failed': 7,
	},
	TABLENAMES: {
		LAN_COMMERCE_TABLENAME_SINCRONIZACION: Deno.env.get('LAN_COMMERCE_TABLENAME_SINCRONIZACION'),
		LAN_COMMERCE_TABLENAME_PROFORMA_ITEM: Deno.env.get('LAN_COMMERCE_TABLENAME_PROFORMA_ITEM'),
		LAN_COMMERCE_TABLENAME_PROFORMA: Deno.env.get('LAN_COMMERCE_TABLENAME_PROFORMA'),
		LAN_COMMERCE_TABLENAME_TIPOCAMBIO: Deno.env.get('LAN_COMMERCE_TABLENAME_TIPOCAMBIO'),
		LAN_COMMERCE_TABLENAME_PRODUCTOS_PRECIOS: Deno.env.get('LAN_COMMERCE_TABLENAME_PRODUCTOS_PRECIOS'),
		LAN_COMMERCE_TABLENAME_PRODUCTOS: Deno.env.get('LAN_COMMERCE_TABLENAME_PRODUCTOS'),
		LAN_COMMERCE_TABLENAME_PRODUCTOS_STOCKS: Deno.env.get('LAN_COMMERCE_TABLENAME_PRODUCTOS_STOCKS'),
		LAN_COMMERCE_TABLENAME_VENTAS: Deno.env.get('LAN_COMMERCE_TABLENAME_VENTAS')
	}
}

export default config;
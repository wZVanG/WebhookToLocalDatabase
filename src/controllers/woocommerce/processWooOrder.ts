import { ConnectionPool } from 'npm:mssql@10.0.1';
import { executeQuery, handleTransaction } from '../../helpers/db.helper.ts';
import { Order, OrderItem } from './interfaces.ts';
import logger from "logger";
import CONSTANTS from "./constants.ts";

export default async (ventas: Order[], pool: ConnectionPool) => {
	return await handleTransaction(pool, async (transaction) => {

		let totalRowsAffected = 0;

		for (const order of ventas) {
			const { id: orderId, date_created: dateCreated, date_completed: dateCompleted, status: orderStatus, billing, line_items, meta_data, shipping_lines, total } = order;

			const tipoSincronizacion = CONSTANTS.TIPO_SINCRONIZACION.WEB_VENTA;

			// Verificar si la orden ya está almacenada en la base de datos
			const existingOrder = await executeQuery(transaction, `SELECT * FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION} WHERE id_venta = @orderId AND tipo = @tipoSincronizacion`, { orderId, tipoSincronizacion });

			if (existingOrder.recordset.length > 0) throw new Error(`La proforma ECommerce ya ha sido sincronizada: N° ${orderId}`);

			logger.info(`Procesando proforma ECommerce: N° ${orderId}`);

			// Obtener el tipo de cambio más reciente
			const tipoCambioConsulta = await executeQuery(transaction, `SELECT TOP 1 OFICIAL FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_TIPOCAMBIO} ORDER BY FECHA DESC`);

			if (tipoCambioConsulta.recordset.length === 0) throw new Error('No se encontró el tipo de cambio más reciente');

			const tcambio = tipoCambioConsulta.recordset[0].OFICIAL;


			// Obtener el valor de la tasa de IGV. Tabla: TBDOCPRO (Obtener último registro de la tabla y obtener el valor de la columna TASAIGV)

			const fields = {
				id_venta: orderId,
				fecha: new Date(dateCreated).toISOString(),
				razon_social: billing.company,
				nombres: `${billing.first_name} ${billing.last_name}`,
				ruc: meta_data.find((meta) => meta.key === 'billing_ruc')?.value || '',
				dni: meta_data.find((meta) => meta.key === 'billing_dni')?.value || '',
				tipo_comprobante: meta_data.find((meta) => meta.key === 'billing_comprobante')?.value || '',
				total: parseFloat(total),
				estado: orderStatus,
				tipo_cambio: tcambio,
				codigo_tienda: Deno.env.get('LAN_COMMERCE_CODTDA') || '01',
				codigo_cliente: Deno.env.get('LAN_COMMERCE_CODCLT') || '10001',
				codigo_producto_envio: +(Deno.env.get('LAN_COMMERCE_CODPRODENVIO') || '0'),
				tasa_igv: parseFloat(Deno.env.get('LAN_COMMERCE_TASAIGV') || "18.00"),
			};

			const observ = `VENTA ECOMMERCE - TIPO:${fields.tipo_comprobante} - RUC: ${fields.ruc} - RazonSocial: ${fields.razon_social} - DNI: ${fields.dni} - NOMBRES: ${fields.nombres}`;

			logger.debug(observ);

			const fecha = fields.fecha;
			const codtda = fields.codigo_tienda;
			const codclt = fields.codigo_cliente;
			const codprodenvio = fields.codigo_producto_envio;

			const tasaigv = fields.tasa_igv;
			const tasaigv2 = 1 + (tasaigv / 100);
			const pventa = parseFloat(total);
			const vigv = parseFloat((pventa - (pventa / tasaigv2)).toFixed(2));
			const vventa = parseFloat((pventa / tasaigv2).toFixed(2));
			const moneda = 'S';
			const codpago = '01';
			const usuario = 'ERINSON';
			const status = ' ';
			const codcondi = '00';
			//const fechapro = new Date(dateCompleted).toISOString();
			const fechapro = fields.fecha;
			const nombrefac = 'CClientes Varios Venta Online';
			const negrfac = '0';

			// AGREGAR PROFORMA
			const prof1Query = `INSERT INTO ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PROFORMA} 
          (fecha, codtda, codclt, vventa, vigv, pventa, tasaigv, moneda, tcambio, observ, codpago, usuario, status, codcondi, fechapro, nombrefac, negrfac)
          VALUES (@fecha, @codtda, @codclt, @vventa, @vigv, @pventa, @tasaigv, @moneda, @tcambio, @observ, @codpago, @usuario, @status, @codcondi, @fechapro, @nombrefac, @negrfac)`;

			const agregarProformaConsulta = await executeQuery(transaction, prof1Query, {
				fecha, codtda, codclt, vventa, vigv, pventa, tasaigv, moneda, tcambio, observ, codpago, usuario, status, codcondi, fechapro, nombrefac, negrfac
			});

			if (agregarProformaConsulta.rowsAffected[0] === 0) throw new Error(`Error al agregar proforma de venta ECommerce: N° ${orderId}`);

			// Obtener el último ID insertado
			const lastInsertedConsulta = await executeQuery(transaction, `SELECT IDENT_CURRENT('${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PROFORMA}') as lastId`);

			// Si no se pudo obtener el último ID insertado, omitimos los siguientes pasos
			if (lastInsertedConsulta.recordset.length === 0) throw new Error(`Error al obtener último ID insertado de proforma de venta ECommerce: N° ${orderId}`);

			const ultimoIdInsertado = lastInsertedConsulta.recordset[0].lastId;

			logger.debug(`Último ID insertado de proforma de venta ECommerce: N° ${orderId} - ID: ${ultimoIdInsertado}`);

			//Buscar unidad de de line_items en tabla TBPRODUCPRECIOS y obtener el valor de la columna UNIDADVTA
			const line_items_skus = line_items.map((item: OrderItem) => item.sku);

			const productosUnidadQuery = `SELECT CODITM, UNIDADVTA, TIPOUNIDAD FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PRODUCTOS_PRECIOS} WHERE CODITM IN (${line_items_skus.map((_, i) => `@sku${i}`).join(',')})`;

			const productosUnidadResult = await executeQuery(transaction, productosUnidadQuery, Object.fromEntries(line_items_skus.map((sku, i) => [`sku${i}`, sku])));

			//Buscar en local la unidad, anteriormente se buscaba en WooCommerce creando una petición por cada sku
			const findUnidadVta = (sku: string) => {
				if (!productosUnidadResult) return 'UND';
				const item = productosUnidadResult.recordset.find((item: any) => item.CODITM === sku && item.TIPOUNIDAD === 1) || productosUnidadResult.recordset.find((item: any) => item.CODITM === sku);
				return item ? item.UNIDADVTA.trim() : 'UND';
			}

			// Insertar detalles de la proforma
			for (const item of line_items) {
				const { sku, quantity, price, name } = item;
				const preciofinal = quantity * price;
				const unidad = findUnidadVta(sku);

				const prof2Query = `INSERT INTO ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PROFORMA_ITEM} 
					(codtda, coditm, unidad, cantidad, pventatot, cantegr, unidadegr, status, tasaigv, negr)
            		VALUES 
					(@codtda, @sku, @unidad, @quantity, @preciofinal, @quantity, @unidad, ' ', @tasaigv, @ultimoIdInsertado)
				`;

				logger.debug(`Agregando producto de venta ECommerce: N° ${orderId} - SKU: ${sku} Cant: ${quantity} Pre: ${preciofinal} Desc: (${name})`);

				const consultaProductoLinea = await executeQuery(transaction, prof2Query, {
					codtda, sku, unidad, quantity, preciofinal, tasaigv, ultimoIdInsertado
				});

				if (consultaProductoLinea.rowsAffected[0] === 0) throw new Error(`Error al agregar producto de venta ECommerce: N° ${orderId} - SKU: ${sku} Cant: ${quantity} Pre: ${preciofinal} Desc: (${name})`);

				// Actualizar stock
				// await executeQuery(transaction, `UPDATE TBPRODUCSTOCKS SET EGRESOS = EGRESOS + @quantity, STOCK = STOCK - @quantity WHERE CODTDA = '01' AND CODITM = @sku`, { quantity, sku });
				// await executeQuery(transaction, `UPDATE TBPRODUC SET EGRESOS = EGRESOS + @quantity, STOCK = STOCK - @quantity WHERE CODITM = @sku`, { quantity, sku });
			}

			// Agregar registro de que ya se procesó la proforma
			const idProforma = ultimoIdInsertado;
			const ecommerceStatusCode = CONSTANTS.WOO_COMMERCE_ORDER_STATUS[orderStatus] || CONSTANTS.WOO_COMMERCE_ORDER_STATUS['pending'];
			const agregaProceso = await executeQuery(transaction, `INSERT INTO ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION} (id_venta, id_proforma, ecommerce_status, fecha_transaccion, fecha_actualizacion_stock, tipo) VALUES (@orderId, @idProforma, @ecommerceStatusCode, GETDATE(), null, @tipoSincronizacion)`, {
				orderId, idProforma, ecommerceStatusCode, tipoSincronizacion
			});

			// Si no se pudo agregar el proceso de proforma, omitimos los siguientes pasos
			if (agregaProceso.rowsAffected[0] === 0) throw new Error(`Error al agregar proceso de proforma ECommerce: N° ${orderId}`);

			// Si eligió envío a domicilio (Cargo por envío)
			for (const shippingLine of shipping_lines) {

				if (!shippingLine.method_title.match(/recogida.+local/i)) {

					const tarifa = parseFloat(shippingLine.total);
					const prof3Query = `INSERT INTO ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_PROFORMA_ITEM} (codtda, coditm, unidad, cantidad, pventatot, cantegr, unidadegr, status, tasaigv, negr)
              VALUES (@codtda, @codprodenvio, 'UND', '1', @tarifa, '1', 'UND', '', @tasaigv, @ultimoIdInsertado)`;

					logger.debug(`Agregando producto de venta ECommerce (ENVÍO): N° ${orderId} - SKU: ${codprodenvio} Pre: ${tarifa} Desc: ${shippingLine.method_title}`);

					const consultaAgregaProductoShipping = await executeQuery(transaction, prof3Query, { codtda, codprodenvio, tarifa, tasaigv, ultimoIdInsertado });

					if (consultaAgregaProductoShipping.rowsAffected[0] === 0) throw new Error(`Error al agregar producto de venta ECommerce (ENVÍO): N° ${orderId} - SKU: ${codprodenvio} Pre: ${tarifa} Desc: ${shippingLine.method_title}`);
				}
			}

			logger.info(`Orden de ECommerce procesada: N° orden: ${orderId} a N° proforma: ${idProforma}`);

			totalRowsAffected++;

		}

		logger.debug(`Actualización de Stock en server local completado. Registro de venta ECommerce: ${totalRowsAffected} registros afectados.`);

		return `Sincronización de ventas (${ventas.map((venta) => venta.id).join(', ')}) proformas ECommerce completado 🚀`

	});
};
const category_ids: Array<string> = local_items
	.filter(
		(row: LocalProductStock) =>
			row.tipo === CONSTANTS.TIPO_SINCRONIZACION.SERVER_CATEGORIA
	)
	.map((row: LocalProductStock) => Number(row.codigo_item) || 0);

//Primero priorizamos las categorías, si hay registros no se sigue con los productos
if (category_ids.length) {
	logger.debug(
		`Hay categorías a sincronizar. Buscando categorías: ${category_ids.join(
			","
		)}`
	);
	const categories = await Woo.get("categories_by_local_code", {
		cod_cat_locals: category_ids.join(","),
	});
	console.log("categories", categories);
	/*const categories_to_insert = category_ids.filter((id: number) => !categories.find((cat: any) => cat.id === id));
if (categories_to_insert.length) {
	const result_batch = await Woo.post("products/categories/batch", { create: categories_to_insert.map((id: number) => ({ name: `Categoría ${id}`, parent: 0 })) });
	if (!result_batch?.create?.length || result_batch.create.length !== categories_to_insert.length) {
		logger.error(`No se pudo crear las categorías en WooCommerce`, categories_to_insert);
		return false;
	}
	logger.info(`Categorías insertadas: ${categories_to_insert.length}`, categories_to_insert);
}
//Eliminar las categorías sincronizadas
const result_delete = await executeQuery(db, `DELETE FROM ${CONSTANTS.TABLENAMES.LAN_COMMERCE_TABLENAME_SINCRONIZACION} WHERE id IN (${category_ids.join(",")})`);
if (result_delete.rowsAffected) logger.debug(`Categorías eliminadas de sincronización: ${result_delete.rowsAffected}`);*/
	return true;
}

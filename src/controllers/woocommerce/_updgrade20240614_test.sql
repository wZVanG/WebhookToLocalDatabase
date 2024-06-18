INSERT INTO TBPRODUC (DESITM, UNIDAD) VALUES ('Producto A', 'UND');
SELECT SCOPE_IDENTITY() AS CODITM;

INSERT INTO TBPRODUCPRECIOS (CODITM, UNIDADVTA, PVENTA) VALUES ('26953', 'UND', 25);

INSERT INTO TBPRODUC (DESITM, UNIDAD) VALUES ('Producto M', 'UND');
UPDATE TBPRODUC SET DESITM = 'Producto M upd' WHERE CODITM = '26960';
INSERT INTO TBPRODUCPRECIOS (CODITM, UNIDADVTA, PVENTA) VALUES ('26960', 'UND', 50);
UPDATE TBPRODUC SET DESITM = 'Producto M updated!!' WHERE CODITM = '26960';
UPDATE TBPRODUCPRECIOS SET PVENTA = 60 WHERE CODITM = '26960' AND UNIDADVTA = 'UND';
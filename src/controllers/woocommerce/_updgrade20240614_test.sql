INSERT INTO TBPRODUC (DESITM, UNIDAD) VALUES ('Producto A', 'UND');
SELECT SCOPE_IDENTITY() AS CODITM;

INSERT INTO TBPRODUCPRECIOS (CODITM, UNIDADVTA, PVENTA) VALUES ('26953', 'UND', 25);

INSERT INTO TBPRODUC (DESITM, UNIDAD) VALUES ('Producto M', 'UND');
UPDATE TBPRODUC SET DESITM = 'Producto M upd' WHERE CODITM = '26960';
INSERT INTO TBPRODUCPRECIOS (CODITM, UNIDADVTA, PVENTA) VALUES ('26960', 'UND', 50);
UPDATE TBPRODUC SET DESITM = 'Producto M updated!!' WHERE CODITM = '26960';


SELECT * FROM TBPRODUC WHERE CODITM = '18818';
UPDATE TBPRODUC SET DESITM = 'BLIST PLUMON STABILO RESALTADOR BOSS AMARILLOO PAST. X1' WHERE CODITM = '18818';

INSERT INTO TBPRODUC (DESITM, UNIDAD) VALUES ('Producto N', 'UND');

---

SELECT * FROM TBPRODUC WHERE CODITM = '10021'

UPDATE TBPRODUC SET DESITM = 'TIZA ARTESCO COLOR  X 50', CODEAN = '7750082048294' WHERE CODITM = '10021'

UPDATE TBPRODUC SET STOCKMIN = 11 WHERE CODITM = '10001';

UPDATE TBPRODUCPRECIOS SET PVENTA = 2.1 WHERE CODITM = '10001' AND UNIDADVTA = 'UND';
INSERT INTO TBPRODUCPRECIOS (CODITM, UNIDADVTA, PVENTA) VALUES ('10001', 'GLP', 50);

-- SELECT * FROM TBPRODUC WHERE CODITM = '25525';

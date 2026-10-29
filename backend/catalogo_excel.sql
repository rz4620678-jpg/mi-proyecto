ALTER TABLE productos MODIFY nombre VARCHAR(500) NOT NULL;

UPDATE productos
SET nombre = TRIM(REPLACE(REPLACE(nombre, CHAR(13), ''), CHAR(10), ' '))
WHERE INSTR(nombre, CHAR(10)) > 0 OR INSTR(nombre, CHAR(13)) > 0;

UPDATE productos
SET unidad = '60/40'
WHERE nombre LIKE 'FUNDENTE PARA SOLDADURA%'
  AND marca = 'SM'
  AND unidad = 'UNIDAD';

UPDATE productos
SET unidad = 'GALLON'
WHERE nombre = 'DESENGRASANTE FORTE'
  AND marca = 'DARYZA'
  AND unidad = 'GALON';

UPDATE productos
SET nombre = 'KIT DE COMPRESA FRIA (CERVICAL DE 53 CM DE LARGO/ 1/2 ESTANDAR 15 CM X 28 CM / ESTANDAR 25 CM X 34 CM /DORSOLUMBAR 23 CM X 47 CM)'
WHERE marca = 'KB'
  AND unidad = 'UNIDAD'
  AND nombre LIKE 'KIT DE COMPRESA FRIA (CERVICAL DE 53 CM DE LARGO/ 1/2 ESTANDAR 15 CM X 28 CM / ESTANDAR 25 CM X 34%';

SELECT 'Catálogo adaptado a las descripciones y unidades del Excel' AS resultado;

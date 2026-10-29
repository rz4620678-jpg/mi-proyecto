START TRANSACTION;

SET @factor_precio_con_igv = IF(
    COALESCE(
        (SELECT CAST(valor AS UNSIGNED) FROM configuracion WHERE clave = 'precios_con_igv_aplicado'),
        0
    ) = 1,
    1,
    1 + COALESCE(
        (SELECT CAST(valor AS DECIMAL(8,4)) FROM configuracion WHERE clave = 'igv'),
        18
    ) / 100
);

UPDATE productos p
SET p.precio = ROUND((
    SELECT d.precio
    FROM factura_detalle d
    JOIN facturas f ON f.id = d.factura_id
    WHERE d.producto_id = p.id
      AND f.anulada = 0
    ORDER BY f.emision DESC, f.id DESC, d.id DESC
    LIMIT 1
) * @factor_precio_con_igv, 2)
WHERE p.es_ajuste = 0
  AND EXISTS (
      SELECT 1
      FROM factura_detalle d
      JOIN facturas f ON f.id = d.factura_id
      WHERE d.producto_id = p.id
        AND f.anulada = 0
  );

COMMIT;

SELECT p.id, p.nombre, p.marca, p.unidad, p.precio AS precio_catalogo_con_igv,
       ROUND(p.precio / (1 + COALESCE(
           (SELECT CAST(valor AS DECIMAL(8,4)) FROM configuracion WHERE clave = 'igv'),
           18
       ) / 100), 2) AS precio_catalogo_sin_igv
FROM productos p
WHERE p.es_ajuste = 0
ORDER BY p.nombre;

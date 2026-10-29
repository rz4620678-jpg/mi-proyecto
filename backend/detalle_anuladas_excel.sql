START TRANSACTION;

INSERT INTO factura_detalle(factura_id, producto_id, cantidad, precio, descuento, total, costo_unit)
SELECT f.id, p.id, 9000, 4.00, 0, 30508.47, NULL
FROM facturas f
JOIN productos p ON p.id = (
    SELECT MIN(id) FROM productos
    WHERE nombre = 'CHAQUETA Y PANTALON DESCARTABLE TALLA L'
      AND marca = 'MP' AND unidad = 'UNIDAD' AND es_ajuste = 0
)
WHERE f.numero = 'E001-52' AND f.anulada = 1
  AND NOT EXISTS (
      SELECT 1 FROM factura_detalle d
      WHERE d.factura_id = f.id AND d.producto_id = p.id
  );

INSERT INTO factura_detalle(factura_id, producto_id, cantidad, precio, descuento, total, costo_unit)
SELECT f.id, p.id, 30, 89.50, 0, 2275.42, NULL
FROM facturas f
JOIN productos p ON p.id = (
    SELECT MIN(id) FROM productos
    WHERE nombre = 'DETERGENTE GRANULADO X 15KG'
      AND marca = 'SOLMATIC' AND unidad = 'UNIDAD' AND es_ajuste = 0
)
WHERE f.numero = 'E001-57' AND f.anulada = 1
  AND NOT EXISTS (
      SELECT 1 FROM factura_detalle d
      WHERE d.factura_id = f.id AND d.producto_id = p.id
  );

COMMIT;

SELECT f.numero, COUNT(d.id) AS lineas_restauradas
FROM facturas f
LEFT JOIN factura_detalle d ON d.factura_id = f.id
WHERE f.numero IN ('E001-52', 'E001-57')
GROUP BY f.numero
ORDER BY f.numero;

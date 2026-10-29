ALTER TABLE productos
    ADD COLUMN IF NOT EXISTS es_ajuste TINYINT(1) NOT NULL DEFAULT 0;

UPDATE productos SET costo = NULL;
UPDATE facturas SET vencimiento = NULL, utilidad = NULL;
UPDATE factura_detalle SET costo_unit = NULL;

INSERT INTO productos(nombre, marca, presentacion, unidad, precio, costo, es_ajuste)
SELECT 'AJUSTE DE CONCILIACION - NO ES PRODUCTO', 'SISTEMA', NULL, 'AJUSTE', 0, NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE es_ajuste = 1);

INSERT INTO factura_detalle(factura_id, producto_id, cantidad, precio, descuento, total, costo_unit)
SELECT f.id, p.id, 1, ROUND(f.subtotal - COALESCE(SUM(d.total), 0), 2), 0,
       ROUND(f.subtotal - COALESCE(SUM(d.total), 0), 2), NULL
FROM facturas f
JOIN productos p ON p.es_ajuste = 1
LEFT JOIN factura_detalle d ON d.factura_id = f.id
WHERE f.anulada = 0 AND f.subtotal > 0
GROUP BY f.id, f.subtotal, p.id
HAVING ROUND(f.subtotal - COALESCE(SUM(d.total), 0), 2) <> 0
   AND SUM(CASE WHEN d.producto_id = p.id THEN 1 ELSE 0 END) = 0;

CREATE OR REPLACE VIEW v_facturas AS
SELECT *, YEAR(emision) AS anio FROM facturas;

CREATE OR REPLACE VIEW v_facturas_completo AS
SELECT t.*,
       GREATEST(t.total_neto - t.cobrado, 0) AS saldo,
       GREATEST(t.cobrado - t.total_neto, 0) AS excedente,
       CONVERT(CASE
           WHEN t.anulada = 1 THEN 'ANULADA'
           WHEN t.cobrado >= t.total_neto - 0.10 THEN 'COBRADA'
           WHEN t.cobrado > 0 THEN 'PARCIAL'
           WHEN t.vencimiento < CURDATE() THEN 'VENCIDA'
           ELSE 'PENDIENTE'
       END USING utf8mb4) COLLATE utf8mb4_unicode_ci AS estado
FROM (
    SELECT f.*, YEAR(f.emision) AS anio,
           COALESCE(c.razon_social, 'SIN DATOS') AS cliente,
           c.ruc,
           (SELECT COALESCE(SUM(o.monto), 0) FROM cobros o WHERE o.factura_id = f.id) AS cobrado,
           DATEDIFF(f.vencimiento, CURDATE()) AS dias,
           (SELECT o.banco FROM cobros o WHERE o.factura_id = f.id ORDER BY o.id DESC LIMIT 1) AS banco
    FROM facturas f
    LEFT JOIN clientes c ON c.id = f.cliente_id
) AS t;

SELECT f.numero,
       f.subtotal AS subtotal_oficial,
       ROUND(COALESCE(SUM(d.total), 0), 2) AS detalle_conciliado,
       ROUND(SUM(CASE WHEN p.es_ajuste = 1 THEN d.total ELSE 0 END), 2) AS ajuste_no_producto
FROM facturas f
JOIN factura_detalle d ON d.factura_id = f.id
JOIN productos p ON p.id = d.producto_id
GROUP BY f.id, f.numero, f.subtotal
HAVING SUM(CASE WHEN p.es_ajuste = 1 THEN 1 ELSE 0 END) > 0
ORDER BY f.id;

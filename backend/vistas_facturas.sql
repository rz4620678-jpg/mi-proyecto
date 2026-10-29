CREATE OR REPLACE VIEW v_facturas AS
SELECT *, YEAR(emision) AS anio
FROM facturas;

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

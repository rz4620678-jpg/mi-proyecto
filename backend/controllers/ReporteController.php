<?php
class ReporteController {
    const SQL = [
        'general' => "SELECT numero factura,emision,cliente,total,total_neto,cobrado,excedente,saldo,estado,utilidad FROM v_facturas_completo WHERE estado<>'ANULADA' ORDER BY id DESC",
        // El conteo de ventas y sus importes excluyen facturas anuladas.
        'ventas_anio' => "SELECT YEAR(f.emision) anio,SUM(CASE WHEN f.anulada=0 THEN 1 ELSE 0 END) facturas,
            SUM(CASE WHEN f.anulada=0 THEN f.subtotal ELSE 0 END) subtotal,
            SUM(CASE WHEN f.anulada=0 THEN f.igv ELSE 0 END) igv,
            SUM(CASE WHEN f.anulada=0 THEN f.total ELSE 0 END) total,
            SUM(CASE WHEN f.anulada=0 THEN v.cobrado ELSE 0 END) cobrado,
            SUM(CASE WHEN f.anulada=0 THEN v.saldo ELSE 0 END) saldo
            FROM facturas f JOIN v_facturas_completo v ON v.id=f.id
            WHERE f.emision IS NOT NULL GROUP BY YEAR(f.emision) ORDER BY anio DESC",
        'cobranza' => "SELECT DATE_FORMAT(o.fecha,'%Y-%m') periodo,COUNT(*) cobros,SUM(o.monto) total
            FROM cobros o JOIN facturas f ON f.id=o.factura_id
            WHERE f.anulada=0 GROUP BY periodo ORDER BY periodo DESC",
        'clientes' => "SELECT cliente,COUNT(*) facturas,SUM(total_neto) facturado,SUM(cobrado) cobrado,SUM(saldo) deuda FROM v_facturas_completo WHERE estado<>'ANULADA' GROUP BY cliente ORDER BY deuda DESC",
        'vencidas' => "SELECT numero factura,cliente,vencimiento,total_neto,saldo,-dias dias_vencida FROM v_facturas_completo WHERE estado='VENCIDA' ORDER BY dias",
        'banco' => "SELECT o.banco,COUNT(*) cobros,SUM(o.monto) total
            FROM cobros o JOIN facturas f ON f.id=o.factura_id
            WHERE f.anulada=0 GROUP BY o.banco ORDER BY total DESC",
        'utilidad' => "SELECT DATE_FORMAT(emision,'%Y-%m') periodo,SUM(subtotal) ventas,SUM(utilidad) utilidad FROM facturas WHERE anulada=0 GROUP BY periodo ORDER BY periodo DESC",
        'productos' => "SELECT p.nombre producto,p.marca,SUM(d.cantidad) cantidad,SUM(d.total) monto FROM factura_detalle d JOIN productos p ON p.id=d.producto_id JOIN facturas f ON f.id=d.factura_id WHERE f.anulada=0 AND p.es_ajuste=0 GROUP BY p.id ORDER BY cantidad DESC",
        'precios' => "SELECT p.nombre producto,MIN(d.precio) minimo,MAX(d.precio) maximo,ROUND(AVG(d.precio),2) promedio FROM factura_detalle d JOIN productos p ON p.id=d.producto_id WHERE p.es_ajuste=0 GROUP BY p.id",
    ];
    static function generar($in = []) {
        $t = $_GET['tipo'] ?? '';
        if (!isset(self::SQL[$t])) Res::fail('Reporte no existe', 404);
        if ($t === 'precios') {
            $factor = factorIgvPrecio();
            $expresion = detalleTienePreciosConIgv() ? 'd.precio' : 'ROUND(d.precio * ?, 2)';
            $sql = "SELECT p.nombre producto,MIN($expresion) minimo,MAX($expresion) maximo,
                    ROUND(AVG($expresion),2) promedio
                FROM factura_detalle d JOIN productos p ON p.id=d.producto_id
                JOIN facturas f ON f.id=d.factura_id
                WHERE p.es_ajuste=0 AND f.anulada=0 GROUP BY p.id";
            $parametros = detalleTienePreciosConIgv() ? [] : [$factor, $factor, $factor];
            Res::json(q($sql, $parametros)->fetchAll());
        }
        Res::json(q(self::SQL[$t], [])->fetchAll());
    }
}

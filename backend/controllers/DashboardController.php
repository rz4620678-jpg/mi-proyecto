<?php
class DashboardController {
    static function resumen($in = []) {
        $anio = trim((string)($_GET['anio'] ?? ''));
        $todos = $anio === '' || strtolower($anio) === 'todos';
        if (!$todos && (!ctype_digit($anio) || strlen($anio) !== 4)) Res::fail('El año no es válido');
        $mes = trim((string)($_GET['mes'] ?? ''));
        if ($mes !== '' && strtolower($mes) !== 'todos' && (!ctype_digit($mes) || (int)$mes < 1 || (int)$mes > 12))
            Res::fail('El mes no es válido');
        $filtraMes = $mes !== '' && strtolower($mes) !== 'todos';
        $filtroEmision = ($todos ? '' : ' AND YEAR(emision)=?') . ($filtraMes ? ' AND MONTH(emision)=?' : '');
        $filtroParametros = [];
        if (!$todos) $filtroParametros[] = (int)$anio;
        if ($filtraMes) $filtroParametros[] = (int)$mes;

        $k = q("SELECT IFNULL(SUM(total),0) facturado,IFNULL(SUM(cobrado),0) cobrado,IFNULL(SUM(saldo),0) pendiente,
                IFNULL(SUM(utilidad),0) utilidad,IFNULL(SUM(total_neto),0) neto,
                IFNULL(SUM(estado='VENCIDA'),0) vencidas
            FROM v_facturas_completo
            WHERE estado<>'ANULADA'$filtroEmision", $filtroParametros)->fetch();

        $filtroFecha = ($todos ? '' : ' AND YEAR(f.emision)=?') . ($filtraMes ? ' AND MONTH(f.emision)=?' : '');
        $k['anuladas'] = q("SELECT COUNT(*) FROM facturas f WHERE f.anulada=1$filtroFecha", $filtroParametros)->fetchColumn();

        $filtroCobrosFecha = ($todos ? '' : ' AND YEAR(o.fecha)=?') . ($filtraMes ? ' AND MONTH(o.fecha)=?' : '');
        $k['cobros_mes'] = q("SELECT IFNULL(SUM(o.monto),0)
            FROM cobros o JOIN facturas f ON f.id=o.factura_id
            WHERE f.anulada=0$filtroCobrosFecha", $filtroParametros)->fetchColumn();

        $k['clientes'] = q("SELECT COUNT(DISTINCT cliente_id)
            FROM v_facturas_completo WHERE estado<>'ANULADA'$filtroEmision", $filtroParametros)->fetchColumn();
        $filtroDetalle = ($todos ? '' : ' AND YEAR(f.emision)=?') . ($filtraMes ? ' AND MONTH(f.emision)=?' : '');
        $k['unidades_vendidas'] = q("SELECT IFNULL(SUM(d.cantidad),0)
            FROM factura_detalle d JOIN facturas f ON f.id=d.factura_id JOIN productos p ON p.id=d.producto_id
            WHERE f.anulada=0 AND p.es_ajuste=0$filtroDetalle", $filtroParametros)->fetchColumn();
        $k['lineas_venta'] = q("SELECT COUNT(*)
            FROM factura_detalle d JOIN facturas f ON f.id=d.factura_id JOIN productos p ON p.id=d.producto_id
            WHERE f.anulada=0 AND p.es_ajuste=0$filtroDetalle", $filtroParametros)->fetchColumn();
        $k['productos_distintos'] = q("SELECT COUNT(DISTINCT d.producto_id)
            FROM factura_detalle d JOIN facturas f ON f.id=d.factura_id JOIN productos p ON p.id=d.producto_id
            WHERE f.anulada=0 AND p.es_ajuste=0$filtroDetalle", $filtroParametros)->fetchColumn();
        $k['productos_catalogo'] = q("SELECT COUNT(*) FROM productos WHERE es_ajuste=0")->fetchColumn();
        $k['estados'] = q("SELECT estado,COUNT(*) n FROM v_facturas_completo
            WHERE estado<>'ANULADA'$filtroEmision GROUP BY estado", $filtroParametros)->fetchAll();

        $mesesFiltro = $todos ? '' : ' WHERE YEAR(o.fecha)=?';
        $mesesParametros = $todos ? [] : [(int)$anio];
        if ($filtraMes) {
            $mesesFiltro .= $mesesFiltro === '' ? ' WHERE MONTH(o.fecha)=?' : ' AND MONTH(o.fecha)=?';
            $mesesParametros[] = (int)$mes;
        }
        $k['meses'] = q("SELECT MONTH(o.fecha) m,SUM(o.monto) t
            FROM cobros o JOIN facturas f ON f.id=o.factura_id
            $mesesFiltro" . ($mesesFiltro === '' ? ' WHERE ' : ' AND ') .
            "f.anulada=0 GROUP BY m ORDER BY m", $mesesParametros)->fetchAll();
        $k['top'] = q("SELECT cliente,SUM(saldo) deuda FROM v_facturas_completo
            WHERE estado NOT IN('ANULADA','COBRADA')$filtroEmision GROUP BY cliente ORDER BY deuda DESC LIMIT 5",
            $filtroParametros)->fetchAll();
        $k['anios'] = q("SELECT DISTINCT anio FROM v_facturas WHERE emision IS NOT NULL ORDER BY anio DESC")->fetchAll(PDO::FETCH_COLUMN);
        Res::json($k);
    }
}

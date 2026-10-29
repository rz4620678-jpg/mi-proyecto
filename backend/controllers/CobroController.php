<?php
class CobroController {
    static function listar($in = []) {
        $w = ['f.anulada=0'];
        $p = [];
        $anio = trim((string)($_GET['anio'] ?? ''));
        if ($anio !== '' && strtolower($anio) !== 'todos') {
            if (!ctype_digit($anio) || strlen($anio) !== 4) Res::fail('El año no es válido');
            $w[] = 'YEAR(o.fecha)=?';
            $p[] = (int)$anio;
        }
        $mes = trim((string)($_GET['mes'] ?? ''));
        if ($mes !== '' && strtolower($mes) !== 'todos') {
            if (!ctype_digit($mes) || (int)$mes < 1 || (int)$mes > 12) Res::fail('El mes no es válido');
            $w[] = 'MONTH(o.fecha)=?';
            $p[] = (int)$mes;
        }
        $banco = trim((string)($_GET['banco'] ?? ''));
        if ($banco !== '' && strtolower($banco) !== 'todos') {
            if ($banco === '__sin_banco__') {
                $w[] = "(o.banco IS NULL OR TRIM(o.banco)='')";
            } else {
                $w[] = 'o.banco=?';
                $p[] = $banco;
            }
        }
        if (!empty($_GET['q'])) {
            $query = trim((string)$_GET['q']);
            $l = '%' . $query . '%';
            $sapExacto = q("SELECT COUNT(*) FROM clientes WHERE codigo_sap=?", [$query])->fetchColumn();
            if ($sapExacto) {
                $w[] = 'c.codigo_sap=?';
                $p[] = $query;
            } else {
                $w[] = '(f.numero LIKE ? OR c.razon_social LIKE ? OR c.ruc LIKE ? OR o.banco LIKE ?)';
                array_push($p, $l, $l, $l, $l);
            }
        }
        $rows = q("SELECT o.*,f.numero factura,c.razon_social cliente
            FROM cobros o
            JOIN facturas f ON f.id=o.factura_id
            JOIN clientes c ON c.id=f.cliente_id
            WHERE " . implode(' AND ', $w) . " ORDER BY o.fecha DESC,o.id DESC", $p)->fetchAll();
        $factor = 1.18;
        foreach ($rows as &$row) {
            $row['subtotal'] = round((float)$row['monto'] / $factor, 2);
            $row['igv'] = round((float)$row['monto'] - $row['subtotal'], 2);
        }
        unset($row);
        Res::json($rows);
    }

    static function anios($in = []) {
        Res::json(q("SELECT DISTINCT YEAR(o.fecha) anio
            FROM cobros o JOIN facturas f ON f.id=o.factura_id
            WHERE o.fecha IS NOT NULL AND f.anulada=0
            ORDER BY anio DESC")->fetchAll(PDO::FETCH_COLUMN));
    }

    static function guardar($in = []) {
        $facturaId = (int)($in['factura_id'] ?? 0);
        $factura = q("SELECT saldo,estado FROM v_facturas_completo WHERE id=?", [$facturaId])->fetch();
        if (!$factura || $factura['estado'] === 'ANULADA') Res::fail('Factura inválida');
        $banco = trim((string)($in['banco'] ?? ''));
        if ($banco === '') Res::fail('El banco es obligatorio');
        $fecha = (string)($in['fecha'] ?? '');
        $date = DateTime::createFromFormat('!Y-m-d', $fecha);
        if (!$date || $date->format('Y-m-d') !== $fecha) Res::fail('Ingresa una fecha de cobro válida');
        $m = (float)($in['monto'] ?? 0);
        $montoAnterior = 0;
        if (!empty($in['id'])) {
            $anterior = q("SELECT factura_id,monto FROM cobros WHERE id=?", [(int)$in['id']])->fetch();
            if (!$anterior) Res::fail('El cobro ya no existe', 404);
            if ((int)$anterior['factura_id'] === $facturaId) $montoAnterior = (float)$anterior['monto'];
        }
        $saldo = (float)$factura['saldo'] + $montoAnterior;
        if ($m <= 0 || $m > $saldo + 0.001) Res::fail('Monto inválido. Saldo disponible: ' . number_format($saldo, 2));
        $v = [$facturaId, $fecha, round($m, 2), $banco, trim((string)($in['forma_pago'] ?? '')),
            trim((string)($in['observaciones'] ?? ''))];
        if (!empty($in['id']))
            q("UPDATE cobros SET factura_id=?,fecha=?,monto=?,banco=?,forma_pago=?,observaciones=? WHERE id=?", [...$v, (int)$in['id']]);
        else q("INSERT INTO cobros(factura_id,fecha,monto,banco,forma_pago,observaciones,registrado_por) VALUES(?,?,?,?,?,?,?)", [...$v, 'PUBLICO']);
        Res::json(['ok' => 1]);
    }

    static function eliminar($in = []) {
        q("DELETE FROM cobros WHERE id=?", [$in['id'] ?? 0]);
        Res::json(['ok' => 1]);
    }
}

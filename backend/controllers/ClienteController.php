<?php
class ClienteController {
    static function listar($in = []) {
        $query = trim((string)($_GET['q'] ?? ''));
        $l = '%' . $query . '%';
        $codigoExacto = $query !== '' && q("SELECT COUNT(*) FROM clientes
            WHERE codigo_sap=? AND UPPER(TRIM(razon_social)) <> 'FACTURA ANULADA'", [$query])->fetchColumn();
        $filtro = $codigoExacto
            ? 'c.codigo_sap=?'
            : '(c.razon_social LIKE ? OR c.ruc LIKE ?)';
        $params = $codigoExacto ? [$query] : [$l, $l];
        $clientes = q("SELECT c.*,
                (SELECT IFNULL(SUM(saldo),0) FROM v_facturas_completo v
                 WHERE v.cliente_id=c.id AND v.estado<>'ANULADA') saldo,
                (SELECT COUNT(*) FROM facturas f WHERE f.cliente_id=c.id AND f.anulada=0) facturas,
                (SELECT MAX(f.emision) FROM facturas f WHERE f.cliente_id=c.id) ultima_factura
            FROM clientes c
            WHERE UPPER(TRIM(c.razon_social)) <> 'FACTURA ANULADA'
              AND $filtro
            ORDER BY c.razon_social", $params)->fetchAll();
        $ids = array_column($clientes, 'id');
        if ($ids) {
            $marks = implode(',', array_fill(0, count($ids), '?'));
            $pendientes = q("SELECT cliente_id,numero,emision,vencimiento,saldo
                FROM v_facturas_completo
                WHERE cliente_id IN ($marks) AND estado NOT IN ('ANULADA','COBRADA') AND saldo > 0
                ORDER BY vencimiento,id", $ids)->fetchAll();
            $porCliente = [];
            foreach ($pendientes as $pendiente) $porCliente[$pendiente['cliente_id']][] = $pendiente;
            foreach ($clientes as &$cliente) $cliente['pendientes'] = $porCliente[$cliente['id']] ?? [];
            unset($cliente);
        }
        Res::json($clientes);
    }

    static function duplicados($in = []) {
        $grupos = q("SELECT ruc,COUNT(*) cantidad
            FROM clientes
            WHERE ruc IS NOT NULL AND TRIM(ruc)<>'' AND UPPER(TRIM(razon_social)) <> 'FACTURA ANULADA'
            GROUP BY ruc HAVING COUNT(*) > 1 ORDER BY cantidad DESC,ruc")->fetchAll();
        foreach ($grupos as &$grupo)
            $grupo['clientes'] = q("SELECT id,razon_social FROM clientes WHERE ruc=? ORDER BY razon_social,id", [$grupo['ruc']])->fetchAll();
        unset($grupo);
        Res::json($grupos);
    }

    static function guardar($in = []) {
        $nombre = trim((string)($in['razon_social'] ?? ''));
        $ruc = trim((string)($in['ruc'] ?? ''));
        if ($nombre === '' || $ruc === '') Res::fail('Razón social y RUC son obligatorios');
        if (!preg_match('/^\d{11}$/', $ruc)) Res::fail('El RUC debe tener 11 dígitos');
        $sap = trim((string)($in['codigo_sap'] ?? ''));
        $contacto = trim((string)($in['contacto_nombre'] ?? ''));
        if ($sap !== '' && q("SELECT COUNT(*) FROM clientes WHERE codigo_sap=? AND id<>?",
            [$sap, (int)($in['id'] ?? 0)])->fetchColumn())
            Res::fail('Ese código SAP ya pertenece a otro cliente', 409);
        if (mb_strlen($nombre, 'UTF-8') > 160 || mb_strlen($sap, 'UTF-8') > 40 ||
            mb_strlen($contacto, 'UTF-8') > 120 || mb_strlen((string)($in['telefono'] ?? ''), 'UTF-8') > 30 ||
            mb_strlen((string)($in['email'] ?? ''), 'UTF-8') > 120 || mb_strlen((string)($in['direccion'] ?? ''), 'UTF-8') > 200)
            Res::fail('Uno o más campos exceden el largo permitido');
        $email = trim((string)($in['email'] ?? ''));
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) Res::fail('El correo no tiene un formato válido');
        if (mb_strtoupper($nombre, 'UTF-8') === 'FACTURA ANULADA') Res::fail('Ese texto no puede registrarse como cliente');
        $v = [mb_strtoupper($nombre, 'UTF-8'), $ruc, $sap, trim((string)($in['telefono'] ?? '')),
            $email, trim((string)($in['direccion'] ?? '')), $contacto];
        if (!empty($in['id'])) q("UPDATE clientes SET razon_social=?,ruc=?,codigo_sap=?,telefono=?,email=?,direccion=?,contacto_nombre=? WHERE id=?", [...$v, (int)$in['id']]);
        else q("INSERT INTO clientes(razon_social,ruc,codigo_sap,telefono,email,direccion,contacto_nombre) VALUES(?,?,?,?,?,?,?)", $v);
        Res::json(['ok' => 1]);
    }

    static function guardarCodigoSap($in = []) {
        $clienteId = (int)($in['cliente_id'] ?? 0);
        $codigo = trim((string)($in['codigo_sap'] ?? ''));
        if ($clienteId < 1 || mb_strlen($codigo, 'UTF-8') > 40)
            Res::fail('Cliente o código SAP inválido');
        if (!q("SELECT COUNT(*) FROM clientes WHERE id=?", [$clienteId])->fetchColumn())
            Res::fail('El cliente no existe', 404);
        if ($codigo !== '' && q("SELECT COUNT(*) FROM clientes WHERE codigo_sap=? AND id<>?",
            [$codigo, $clienteId])->fetchColumn())
            Res::fail('Ese código SAP ya pertenece a otro cliente', 409);
        q("UPDATE clientes SET codigo_sap=? WHERE id=?", [$codigo === '' ? null : $codigo, $clienteId]);
        Res::json(['ok' => 1]);
    }

    static function unir($in = []) {
        $origenId = (int)($in['origen_id'] ?? 0);
        $destinoId = (int)($in['destino_id'] ?? 0);
        if ($origenId < 1 || $destinoId < 1 || $origenId === $destinoId) Res::fail('Selecciona dos clientes distintos');
        $db = Database::get();
        $db->beginTransaction();
        try {
            $clientes = q("SELECT id,ruc FROM clientes WHERE id IN (?,?) FOR UPDATE", [$origenId, $destinoId])->fetchAll();
            if (count($clientes) !== 2 || $clientes[0]['ruc'] !== $clientes[1]['ruc'])
                Res::fail('Solo se pueden unir clientes con el mismo RUC', 409);
            q("INSERT IGNORE INTO producto_codigos(producto_id,cliente_id,codigo,tipo)
                SELECT producto_id,?,codigo,tipo FROM producto_codigos WHERE cliente_id=?", [$destinoId, $origenId]);
            q("DELETE FROM producto_codigos WHERE cliente_id=?", [$origenId]);
            q("UPDATE facturas SET cliente_id=? WHERE cliente_id=?", [$destinoId, $origenId]);
            q("UPDATE clientes destino JOIN clientes origen ON origen.id=?
                SET destino.codigo_sap=COALESCE(NULLIF(destino.codigo_sap,''),origen.codigo_sap),
                    destino.telefono=COALESCE(NULLIF(destino.telefono,''),origen.telefono),
                    destino.email=COALESCE(NULLIF(destino.email,''),origen.email),
                    destino.direccion=COALESCE(NULLIF(destino.direccion,''),origen.direccion),
                    destino.contacto_nombre=COALESCE(NULLIF(destino.contacto_nombre,''),origen.contacto_nombre)
                WHERE destino.id=?", [$origenId, $destinoId]);
            q("DELETE FROM clientes WHERE id=?", [$origenId]);
            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }
        Res::json(['ok' => 1]);
    }

    static function eliminar($in = []) {
        if (q("SELECT COUNT(*) FROM facturas WHERE cliente_id=?", [$in['id'] ?? 0])->fetchColumn())
            Res::fail('No se puede eliminar: el cliente tiene facturas');
        q("DELETE FROM clientes WHERE id=?", [$in['id'] ?? 0]);
        Res::json(['ok' => 1]);
    }
}

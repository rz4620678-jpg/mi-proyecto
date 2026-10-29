<?php
// Productos, listas (bancos, formas de pago, motivos), historial de precios y datos iniciales
class CatalogoController {
    static function bootstrap($in = []) {
        $l = ['banco' => [], 'forma_pago' => [], 'motivo' => []];
        foreach (q("SELECT * FROM listas ORDER BY nombre")->fetchAll() as $r) $l[$r['tipo']][] = $r;
        $productos = q("SELECT p.id,p.nombre,p.marca,p.presentacion,p.unidad,
                    (SELECT d.precio
                     FROM factura_detalle d
                     JOIN facturas f ON f.id = d.factura_id
                     WHERE d.producto_id = p.id AND f.anulada = 0
                     ORDER BY f.emision DESC, f.id DESC, d.id DESC
                     LIMIT 1) AS precio,
                    p.costo,p.es_ajuste
                FROM productos p
                WHERE p.es_ajuste=0
                ORDER BY p.nombre")->fetchAll();
        foreach ($productos as &$producto)
            $producto['precio'] = precioUnitarioConIgv($producto['precio']);
        unset($producto);
        Res::json([
            'clientes' => q("SELECT id,razon_social,codigo_sap FROM clientes ORDER BY razon_social")->fetchAll(),
            'productos' => $productos,
            'listas' => $l, 'config' => Config::all(),
        ]);
    }
    static function precios($in = []) {
        $productoId = trim((string)($_GET['producto_id'] ?? ''));
        if ($productoId === '' || !ctype_digit($productoId) || (int)$productoId < 1)
            Res::fail('Selecciona un producto válido');
        $where = ['d.producto_id=?', 'f.anulada=0'];
        $params = [(int)$productoId];
        $clienteId = trim((string)($_GET['cliente_id'] ?? ''));
        if ($clienteId !== '') {
            if (!ctype_digit($clienteId)) Res::fail('El cliente no es válido');
            $where[] = 'f.cliente_id=?';
            $params[] = (int)$clienteId;
        }
        $anio = trim((string)($_GET['anio'] ?? ''));
        if ($anio !== '' && strtolower($anio) !== 'todos') {
            if (!ctype_digit($anio) || strlen($anio) !== 4) Res::fail('El año no es válido');
            $where[] = 'YEAR(f.emision)=?';
            $params[] = (int)$anio;
        }
        $mes = trim((string)($_GET['mes'] ?? ''));
        if ($mes !== '' && strtolower($mes) !== 'todos') {
            if (!ctype_digit($mes) || (int)$mes < 1 || (int)$mes > 12) Res::fail('El mes no es válido');
            $where[] = 'MONTH(f.emision)=?';
            $params[] = (int)$mes;
        }
        $rows = q("SELECT f.emision fecha,f.numero factura,c.razon_social cliente,d.cantidad,d.precio,d.total
            FROM factura_detalle d JOIN facturas f ON f.id=d.factura_id JOIN clientes c ON c.id=f.cliente_id
            WHERE " . implode(' AND ', $where) . " ORDER BY f.emision DESC", $params)->fetchAll();
        foreach ($rows as &$row) $row['precio'] = precioUnitarioConIgv($row['precio']);
        unset($row);
        Res::json($rows);
    }
    static function porCodigo($in = []) {
        $codigo = trim((string)($_GET['codigo'] ?? ''));
        $clienteId = trim((string)($_GET['cliente_id'] ?? ''));
        if ($codigo === '' || mb_strlen($codigo, 'UTF-8') > 80) Res::fail('Ingresa un código válido');
        if ($clienteId !== '' && !ctype_digit($clienteId)) Res::fail('El cliente no es válido');
        if ($clienteId !== '' && !q("SELECT COUNT(*) FROM clientes WHERE id=?", [(int)$clienteId])->fetchColumn())
            Res::fail('El cliente no existe', 404);
        $row = q("SELECT p.id,p.nombre,p.marca,p.presentacion,p.unidad,
                    (SELECT d.precio FROM factura_detalle d
                     JOIN facturas f ON f.id=d.factura_id
                     WHERE d.producto_id=p.id AND f.anulada=0
                     ORDER BY f.emision DESC,f.id DESC,d.id DESC LIMIT 1) AS precio,
                    c.codigo,c.tipo
                FROM producto_codigos c
                JOIN productos p ON p.id=c.producto_id
                WHERE c.codigo=? AND p.es_ajuste=0
                  AND (c.cliente_id IS NULL OR c.cliente_id=?)
                ORDER BY (c.cliente_id IS NULL),c.id DESC
                LIMIT 1", [$codigo, $clienteId === '' ? null : (int)$clienteId])->fetch();
        if (!$row) Res::fail('Código no encontrado', 404);
        $row['precio'] = precioUnitarioConIgv($row['precio']);
        Res::json($row);
    }
    static function guardarCodigo($in = []) {
        $productoId = (int)($in['producto_id'] ?? 0);
        $clienteId = isset($in['cliente_id']) && $in['cliente_id'] !== '' ? (int)$in['cliente_id'] : null;
        $codigo = trim((string)($in['codigo'] ?? ''));
        $tipo = (string)($in['tipo'] ?? 'interno');
        if ($productoId < 1 || $codigo === '' || mb_strlen($codigo, 'UTF-8') > 80 || !in_array($tipo, ['sap', 'interno'], true))
            Res::fail('Producto, código o tipo inválido');
        if (!q("SELECT COUNT(*) FROM productos WHERE id=? AND es_ajuste=0", [$productoId])->fetchColumn())
            Res::fail('El producto no existe', 404);
        if ($clienteId !== null && !q("SELECT COUNT(*) FROM clientes WHERE id=?", [$clienteId])->fetchColumn())
            Res::fail('El cliente no existe', 404);
        $existente = q("SELECT id,producto_id FROM producto_codigos
            WHERE cliente_id <=> ? AND codigo=? LIMIT 1", [$clienteId, $codigo])->fetch();
        if ($existente && (int)$existente['producto_id'] !== $productoId)
            Res::fail('Ese código ya está asociado a otro producto', 409);
        if (!$existente)
            q("INSERT INTO producto_codigos(producto_id,cliente_id,codigo,tipo) VALUES(?,?,?,?)", [$productoId, $clienteId, $codigo, $tipo]);
        Res::json(['ok' => 1]);
    }
    static function listaGuardar($in = []) {
        if (!in_array($in['tipo'] ?? '', ['banco', 'forma_pago', 'motivo']) || empty($in['nombre'])) Res::fail('Datos inválidos');
        q("INSERT INTO listas(tipo,nombre) VALUES(?,?)", [$in['tipo'], $in['nombre']]); Res::json(['ok' => 1]);
    }
    static function listaEliminar($in = []) { q("DELETE FROM listas WHERE id=?", [$in['id'] ?? 0]); Res::json(['ok' => 1]); }
    static function productoGuardar($in = []) {
        if (empty($in['nombre'])) Res::fail('Falta el nombre');
        $costo = $in['costo'] ?? '';
        if ($costo !== '' && !is_numeric($costo)) Res::fail('El costo debe ser numérico');
        q("INSERT INTO productos(nombre,marca,presentacion,unidad,costo) VALUES(?,?,?,?,?)",
            [strtoupper($in['nombre']), $in['marca'] ?? '', $in['presentacion'] ?? '', $in['unidad'] ?? 'UND', $costo === '' ? null : $costo]);
        Res::json(['ok' => 1]);
    }
    static function productoEliminar($in = []) {
        if (q("SELECT COUNT(*) FROM factura_detalle WHERE producto_id=?", [$in['id'] ?? 0])->fetchColumn()) Res::fail('El producto ya se usó en facturas');
        q("DELETE FROM producto_codigos WHERE producto_id=?", [$in['id'] ?? 0]);
        q("DELETE FROM productos WHERE id=?", [$in['id']]); Res::json(['ok' => 1]);
    }
}

<?php
class FacturaController {
    private static function rutaDocumento(string $ruta): ?string {
        if (!preg_match('/^uploads\\/[a-f0-9]{32}\\.pdf$/', $ruta)) return null;
        $base = realpath(__DIR__ . '/../uploads');
        $path = realpath(__DIR__ . '/../' . $ruta);
        if (!$base || !$path || !str_starts_with(strtolower($path), strtolower($base . DIRECTORY_SEPARATOR)) || !is_file($path))
            return null;
        return $path;
    }

    private static function normalizarGuias(array $in): array {
        if (array_key_exists('guias', $in) && !is_array($in['guias'])) Res::fail('La lista de guías no es válida');
        $guias = $in['guias'] ?? null;
        if (!is_array($guias)) $guias = explode('/', (string)($in['nro_guia'] ?? ''));
        $guias = array_values(array_unique(array_filter(array_map(
            static fn($guia) => trim((string)$guia),
            $guias
        ), static fn($guia) => $guia !== '')));
        foreach ($guias as $guia) {
            if (mb_strlen($guia, 'UTF-8') > 80) Res::fail('Cada número de guía admite hasta 80 caracteres');
        }
        return $guias;
    }

    private static function sincronizarPreciosCatalogo(array $productoIds): void {
        foreach (array_unique(array_map('intval', $productoIds)) as $productoId) {
            if ($productoId < 1) continue;
            $precio = q("SELECT d.precio
                FROM factura_detalle d
                JOIN facturas f ON f.id = d.factura_id
                WHERE d.producto_id = ? AND f.anulada = 0
                ORDER BY f.emision DESC, f.id DESC, d.id DESC
                LIMIT 1", [$productoId])->fetchColumn();
            if ($precio !== false)
                q("UPDATE productos SET precio=? WHERE id=? AND es_ajuste=0",
                    [precioUnitarioConIgv($precio), $productoId]);
        }
    }
    static function listar($in = []) {
        $w = '1'; $p = [];
        if (!empty($_GET['anio'])) {
            if (strtolower((string)$_GET['anio']) !== 'todos') {
                if (!ctype_digit((string)$_GET['anio']) || strlen((string)$_GET['anio']) !== 4) Res::fail('El año no es válido');
                $w .= ' AND anio=?'; $p[] = (int)$_GET['anio'];
            }
        }
        if (!empty($_GET['mes']) && strtolower((string)$_GET['mes']) !== 'todos') {
            if (!ctype_digit((string)$_GET['mes']) || (int)$_GET['mes'] < 1 || (int)$_GET['mes'] > 12)
                Res::fail('El mes no es válido');
            $w .= ' AND MONTH(emision)=?';
            $p[] = (int)$_GET['mes'];
        }
        if (!empty($_GET['cliente_id'])) { $w .= ' AND cliente_id=?'; $p[] = (int)$_GET['cliente_id']; }
        if (!empty($_GET['estado'])) { $w .= ' AND estado=?'; $p[] = $_GET['estado']; }
        if (!empty($_GET['q'])) {
            $query = trim((string)$_GET['q']);
            $sapExacto = q("SELECT COUNT(*) FROM clientes WHERE codigo_sap=?", [$query])->fetchColumn();
            if ($sapExacto) {
                $w .= ' AND EXISTS (SELECT 1 FROM clientes sap WHERE sap.id=v.cliente_id AND sap.codigo_sap=?)';
                $p[] = $query;
            } else {
                $l = '%' . $query . '%';
                $w .= ' AND (numero LIKE ? OR nro_guia LIKE ? OR nro_oc LIKE ? OR cliente LIKE ? OR ruc LIKE ?
                    OR EXISTS (SELECT 1 FROM factura_guias fg WHERE fg.factura_id=v.id AND fg.numero_guia LIKE ?))';
                array_push($p, $l, $l, $l, $l, $l, $l);
            }
        }
        $rows = q("SELECT v.*,cl.codigo_sap,
                (SELECT MAX(o.fecha) FROM cobros o WHERE o.factura_id=v.id) AS fecha_pago,
                (SELECT d.id FROM factura_documentos d WHERE d.factura_id=v.id AND d.tipo='factura_original' LIMIT 1) AS factura_original_id,
                (SELECT d.id FROM factura_documentos d WHERE d.factura_id=v.id AND d.tipo='factura_sellada' LIMIT 1) AS factura_sellada_id,
                (SELECT d.archivo_path FROM factura_documentos d WHERE d.factura_id=v.id AND d.tipo='factura_original' LIMIT 1) AS factura_original_path,
                (SELECT d.archivo_path FROM factura_documentos d WHERE d.factura_id=v.id AND d.tipo='factura_sellada' LIMIT 1) AS factura_sellada_path
            FROM v_facturas_completo v
            LEFT JOIN clientes cl ON cl.id=v.cliente_id
            WHERE $w ORDER BY v.id DESC", $p)->fetchAll();
        foreach ($rows as &$row) {
            if (!self::rutaDocumento((string)($row['factura_original_path'] ?? ''))) $row['factura_original_id'] = null;
            if (!self::rutaDocumento((string)($row['factura_sellada_path'] ?? ''))) $row['factura_sellada_id'] = null;
            unset($row['factura_original_path'], $row['factura_sellada_path']);
        }
        unset($row);
        $ids = array_column($rows, 'id');
        if ($ids) {
            $marks = implode(',', array_fill(0, count($ids), '?'));
            $guias = q("SELECT id,factura_id,numero_guia,fecha,
                    doc_original_path,doc_sellada_path
                FROM factura_guias WHERE factura_id IN ($marks) ORDER BY factura_id,id", $ids)->fetchAll();
            $porFactura = [];
            foreach ($guias as $guia) {
                $guia['has_doc_original'] = self::rutaDocumento((string)($guia['doc_original_path'] ?? '')) !== null;
                $guia['has_doc_sellada'] = self::rutaDocumento((string)($guia['doc_sellada_path'] ?? '')) !== null;
                unset($guia['doc_original_path'], $guia['doc_sellada_path']);
                $porFactura[$guia['factura_id']][] = $guia;
            }
            foreach ($rows as &$row) $row['guias'] = $porFactura[$row['id']] ?? [];
            unset($row);
        }
        Res::json($rows);
    }
    static function anios($in = []) {
        Res::json(q("SELECT DISTINCT YEAR(emision) anio FROM facturas
            WHERE emision IS NOT NULL ORDER BY anio DESC")->fetchAll(PDO::FETCH_COLUMN));
    }
    static function detalle($in = []) {
        $w = '1'; $p = [];
        if (!empty($_GET['factura_id'])) { $w .= ' AND d.factura_id=?'; $p[] = $_GET['factura_id']; }
        if (!empty($_GET['cliente_id'])) { $w .= ' AND f.cliente_id=?'; $p[] = (int)$_GET['cliente_id']; }
        $clienteSap = trim((string)($_GET['cliente_sap'] ?? ''));
        if ($clienteSap !== '') {
            if (mb_strlen($clienteSap, 'UTF-8') > 40) Res::fail('El código SAP del cliente no es válido');
            $w .= ' AND c.codigo_sap=?';
            $p[] = $clienteSap;
        }
        $anio = trim((string)($_GET['anio'] ?? ''));
        if ($anio !== '' && strtolower($anio) !== 'todos') {
            if (!ctype_digit($anio) || strlen($anio) !== 4) Res::fail('El año no es válido');
            $w .= ' AND YEAR(f.emision)=?'; $p[] = (int)$anio;
        }
        $mes = trim((string)($_GET['mes'] ?? ''));
        if ($mes !== '' && strtolower($mes) !== 'todos') {
            if (!ctype_digit($mes) || (int)$mes < 1 || (int)$mes > 12) Res::fail('El mes no es válido');
            $w .= ' AND MONTH(f.emision)=?'; $p[] = (int)$mes;
        }
        if (!empty($_GET['q'])) {
            $l = '%' . trim((string)$_GET['q']) . '%';
            $w .= " AND (p.nombre LIKE ? OR EXISTS (
                SELECT 1 FROM producto_codigos pc
                WHERE pc.producto_id=p.id AND (pc.cliente_id IS NULL OR pc.cliente_id=f.cliente_id)
                  AND pc.codigo=?
            ))";
            array_push($p, $l, trim((string)$_GET['q']));
        }
        $rows = q("SELECT d.*,f.numero factura,YEAR(f.emision) anio,p.nombre producto,p.marca,p.presentacion,p.unidad,p.es_ajuste,
                (SELECT pc.codigo FROM producto_codigos pc
                 WHERE pc.producto_id=p.id AND (pc.cliente_id=f.cliente_id OR pc.cliente_id IS NULL)
                 ORDER BY (pc.cliente_id=f.cliente_id) DESC,pc.id DESC LIMIT 1) codigo
            FROM factura_detalle d JOIN facturas f ON f.id=d.factura_id JOIN productos p ON p.id=d.producto_id
            LEFT JOIN clientes c ON c.id=f.cliente_id
            WHERE $w ORDER BY f.emision DESC,d.factura_id DESC,d.id", $p)->fetchAll();
        foreach ($rows as &$row) $row['precio'] = precioUnitarioConIgv($row['precio']);
        unset($row);
        Res::json($rows);
    }
    static function pendientes($in = []) {
        $exists = q("SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema=DATABASE() AND table_name='pendientes_importacion'")->fetchColumn();
        if (!$exists) Res::fail('Falta instalar la migración backend/pendientes_importacion.sql para consultar los registros incompletos.', 409);
        Res::json(q("SELECT id,numero,anio,subtotal_excel,igv_excel,total_excel,fuente,nota,creado_en
            FROM pendientes_importacion ORDER BY numero")->fetchAll());
    }

    static function subirDocumento($in = []) {
        $facturaId = (int)($_POST['factura_id'] ?? 0);
        $tipo = (string)($_POST['tipo'] ?? '');
        $guiaId = (int)($_POST['guia_id'] ?? 0);
        $esGuia = in_array($tipo, ['guia_original', 'guia_sellada'], true);
        if ($facturaId < 1 || !in_array($tipo, ['factura_original', 'factura_sellada', 'guia_original', 'guia_sellada'], true))
            Res::fail('Factura o tipo de documento inválido');
        $file = $_FILES['archivo'] ?? null;
        if (!is_array($file) || !isset($file['error'], $file['size'], $file['name'], $file['tmp_name']) ||
            is_array($file['name']) || is_array($file['tmp_name']))
            Res::fail('Selecciona un archivo PDF');
        if ((int)$file['error'] !== UPLOAD_ERR_OK) Res::fail('No se pudo recibir el PDF (código ' . (int)$file['error'] . ')');
        if ((int)$file['size'] < 1 || (int)$file['size'] > 10 * 1024 * 1024) Res::fail('El PDF debe pesar como máximo 10 MB');
        if (strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION)) !== 'pdf')
            Res::fail('El archivo debe tener extensión .pdf');
        $tmp = (string)$file['tmp_name'];
        if (!is_uploaded_file($tmp)) Res::fail('La carga del archivo no es válida');
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        if ($finfo->file($tmp) !== 'application/pdf' || file_get_contents($tmp, false, null, 0, 5) !== '%PDF-')
            Res::fail('El archivo debe ser un PDF válido');
        if (!q("SELECT COUNT(*) FROM facturas WHERE id=?", [$facturaId])->fetchColumn())
            Res::fail('La factura no existe', 404);
        if ($esGuia && !q("SELECT COUNT(*) FROM factura_guias WHERE id=? AND factura_id=?", [$guiaId, $facturaId])->fetchColumn())
            Res::fail('La guía no pertenece a esta factura', 404);

        $uploadDir = __DIR__ . '/../uploads';
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0750, true) && !is_dir($uploadDir))
            Res::fail('No se pudo preparar el almacenamiento de documentos', 500);
        if (!is_writable($uploadDir)) Res::fail('El almacenamiento de documentos no permite escritura', 500);
        $nombreArchivo = bin2hex(random_bytes(16)) . '.pdf';
        $rutaRelativa = 'uploads/' . $nombreArchivo;
        $destino = $uploadDir . '/' . $nombreArchivo;
        $nombreOriginal = mb_substr(basename((string)$file['name']), 0, 255, 'UTF-8');
        if (!move_uploaded_file($tmp, $destino)) Res::fail('No se pudo guardar el PDF', 500);

        try {
            if ($esGuia) {
                $columna = $tipo === 'guia_original' ? 'doc_original_path' : 'doc_sellada_path';
                q("UPDATE factura_guias SET $columna=? WHERE id=? AND factura_id=?", [$rutaRelativa, $guiaId, $facturaId]);
            } else {
                q("INSERT INTO factura_documentos(factura_id,tipo,archivo_path,nombre_original)
                    VALUES(?,?,?,?)
                    ON DUPLICATE KEY UPDATE archivo_path=VALUES(archivo_path),
                        nombre_original=VALUES(nombre_original),subido_en=CURRENT_TIMESTAMP",
                    [$facturaId, $tipo, $rutaRelativa, $nombreOriginal]);
            }
        } catch (Throwable $e) {
            if (is_file($destino)) unlink($destino);
            throw $e;
        }
        Res::json(['ok' => 1]);
    }

    static function documento($in = []) {
        $id = (int)($_GET['id'] ?? 0);
        if ($id > 0) {
            $documento = q("SELECT archivo_path,nombre_original
                FROM factura_documentos WHERE id=?", [$id])->fetch();
        } else {
            $guiaId = (int)($_GET['guia_id'] ?? 0);
            $tipo = (string)($_GET['tipo'] ?? '');
            if ($guiaId < 1 || !in_array($tipo, ['guia_original', 'guia_sellada'], true))
                Res::fail('Documento no válido', 404);
            $columna = $tipo === 'guia_original' ? 'doc_original_path' : 'doc_sellada_path';
            $documento = q("SELECT $columna AS archivo_path,numero_guia AS nombre_original
                FROM factura_guias WHERE id=?", [$guiaId])->fetch();
        }
        $path = $documento ? self::rutaDocumento((string)$documento['archivo_path']) : null;
        if (!$path)
            Res::fail('Documento no encontrado', 404);
        $nombre = preg_replace('/[^A-Za-z0-9._-]/', '_', (string)$documento['nombre_original']);
        header_remove('Content-Type');
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="' . ($nombre !== '' ? $nombre : 'documento.pdf') . '"');
        header('X-Content-Type-Options: nosniff');
        header('Content-Length: ' . filesize($path));
        readfile($path);
        exit;
    }

    // Crea o edita (si viene id) una factura con sus ítems
    static function guardar($in = []) {
        $items = array_values(array_filter($in['items'] ?? [], fn($i) => !empty($i['producto_id']) && ($i['cantidad'] ?? 0) > 0));
        if (empty($in['cliente_id']) || !$items) Res::fail('Elige un cliente y al menos un producto');
        $clienteId = (int)$in['cliente_id'];
        $codigoSapCliente = trim((string)($in['codigo_sap_cliente'] ?? ''));
        if (mb_strlen($codigoSapCliente, 'UTF-8') > 40) Res::fail('El código SAP del cliente admite hasta 40 caracteres');
        foreach ($items as $item) {
            if (!isset($item['precio']) || !is_numeric($item['precio']) || (float)$item['precio'] < 0)
                Res::fail('Ingresa un precio unitario válido para cada producto');
            if (mb_strlen(trim((string)($item['codigo'] ?? '')), 'UTF-8') > 80)
                Res::fail('El código de producto admite hasta 80 caracteres');
        }
        if (!q("SELECT COUNT(*) FROM clientes WHERE id=?", [$clienteId])->fetchColumn())
            Res::fail('El cliente no existe', 404);
        $emision = $in['emision'] ?? '';
        $fecha = DateTime::createFromFormat('!Y-m-d', $emision);
        if (!$fecha || $fecha->format('Y-m-d') !== $emision) Res::fail('Ingresa una fecha de emisión válida');
        // Valida los campos opcionales antes de guardar en la base del cliente.
        $guias = self::normalizarGuias($in);
        $guia = mb_substr($guias[0] ?? '', 0, 40, 'UTF-8');
        $orden = trim((string)($in['nro_oc'] ?? ''));
        if (mb_strlen($orden, 'UTF-8') > 60) Res::fail('La orden admite hasta 60 caracteres');
        if (!array_key_exists('retencion', $in) || !in_array($in['retencion'], [true, false, 1, 0, '1', '0'], true))
            Res::fail('Indica si esta factura tiene retención');
        $pendiente = null;
        if (!empty($in['pendiente_id'])) {
            if (!empty($in['id'])) Res::fail('Una factura pendiente solo puede completarse como nueva');
            $pendiente = q("SELECT * FROM pendientes_importacion WHERE id=?", [(int)$in['pendiente_id']])->fetch();
            if (!$pendiente) Res::fail('La factura pendiente ya no existe', 404);
            if (q("SELECT COUNT(*) FROM facturas WHERE numero=?", [$pendiente['numero']])->fetchColumn())
                Res::fail('El número de factura pendiente ya está registrado');
        }
        $igvP = (float)Config::get('igv', 18) / 100; $retP = (float)Config::get('retencion', 3) / 100;
        $db = Database::get(); $db->beginTransaction();
        try {
            if ($codigoSapCliente !== '')
                q("UPDATE clientes SET codigo_sap=? WHERE id=?", [$codigoSapCliente, $clienteId]);
            foreach ($items as $item) {
                $codigoProducto = trim((string)($item['codigo'] ?? ''));
                if ($codigoProducto === '') continue;
                $existente = q("SELECT producto_id FROM producto_codigos
                    WHERE cliente_id IS NULL AND codigo=? LIMIT 1", [$codigoProducto])->fetchColumn();
                if ($existente !== false && (int)$existente !== (int)$item['producto_id']) {
                    $db->rollBack();
                    Res::fail('Ese código de producto ya está asociado a otro producto', 409);
                }
                if ($existente === false)
                    q("INSERT INTO producto_codigos(producto_id,cliente_id,codigo,tipo) VALUES(?,NULL,?,'sap')",
                        [(int)$item['producto_id'], $codigoProducto]);
            }
            $sub = 0; $costo = 0; $rows = [];
            $productosAActualizar = array_column($items, 'producto_id');
            foreach ($items as $i) {
                $c = q("SELECT costo FROM productos WHERE id=?", [$i['producto_id']])->fetchColumn();
                if ($c === false || $c === null) $costo = null;
                else {
                    $c = (float)$c;
                    if ($costo !== null) $costo += $i['cantidad'] * $c;
                }
                $precioNeto = (float)$i['precio'] / (1 + $igvP);
                $t = round($i['cantidad'] * $precioNeto * (1 - ($i['descuento'] ?? 0) / 100), 2);
                $sub += $t; $rows[] = [$i, $t, $c, precioUnitarioParaGuardar($i['precio'])];
            }
            $igv = round($sub * $igvP, 2);
            $tot = round($sub + $igv, 2);
            $ret = !empty($in['retencion']) ? round($tot * $retP, 2) : 0;
            $penalidadIndicada = $in['aplica_penalidad'] ?? false;
            if (!in_array($penalidadIndicada, [true, false, 1, 0, '1', '0'], true))
                Res::fail('El indicador de penalidad no es válido');
            $aplicaPenalidad = in_array($penalidadIndicada, [true, 1, '1'], true);
            $porcentajePenalidad = $in['porcentaje_penalidad'] ?? 10;
            if (!is_numeric($porcentajePenalidad)) Res::fail('El porcentaje de penalidad debe ser numérico');
            $porcentajePenalidad = (float)$porcentajePenalidad;
            if ($porcentajePenalidad < 0 || $porcentajePenalidad > 100) Res::fail('El porcentaje de penalidad debe estar entre 0 y 100');
            $montoPenalidad = $aplicaPenalidad ? round($tot * $porcentajePenalidad / 100, 2) : 0;
            if ($pendiente) {
                $subExcel = round((float)$pendiente['subtotal_excel'], 2);
                $igvExcel = round((float)$pendiente['igv_excel'], 2);
                $totalExcel = round((float)$pendiente['total_excel'], 2);
                if (abs(round($sub, 2) - $subExcel) > 0.01 ||
                    abs($igv - $igvExcel) > 0.01 || abs($tot - $totalExcel) > 0.01) {
                    $db->rollBack();
                    Res::fail('El detalle ingresado no coincide con los importes originales de Excel. Revisa cantidades, precios e IGV.');
                }
            }
            $dias = $in['dias'] ?? Config::get('dias_credito', 30);
            if ($dias === '') $dias = Config::get('dias_credito', 30);
            if (!is_numeric($dias) || (int)$dias < 0 || (int)$dias > 3650)
                Res::fail('Los días de crédito deben estar entre 0 y 3650');
            $ven = date('Y-m-d', strtotime($emision . ' +' . (int)$dias . ' days'));
            $utilidad = $costo === null ? null : $sub - $costo;
            $neto = max(0, round($tot - $ret - $montoPenalidad, 2));
            $v = [$in['cliente_id'], $emision, $ven, $sub, $igv, $tot, $ret, $aplicaPenalidad ? 1 : 0, $porcentajePenalidad, $montoPenalidad, $neto, $utilidad];
            if (!empty($in['id'])) {
                $id = $in['id'];
                $productosAnteriores = q("SELECT DISTINCT producto_id FROM factura_detalle WHERE factura_id=?", [$id])->fetchAll(PDO::FETCH_COLUMN);
                $productosAActualizar = array_merge($productosAActualizar, $productosAnteriores);
                q("UPDATE facturas SET cliente_id=?,emision=?,vencimiento=?,subtotal=?,igv=?,total=?,retencion=?,aplica_penalidad=?,porcentaje_penalidad=?,monto_penalidad=?,total_neto=?,utilidad=?,nro_guia=?,nro_oc=? WHERE id=?", [...$v, $guia, $orden, $id]);
                q("DELETE FROM factura_detalle WHERE factura_id=?", [$id]);
            } else {
                if ($pendiente) $numero = $pendiente['numero'];
                else {
                    // Continúa la serie E001 con números sin ceros a la izquierda.
                    $n = (int)q("SELECT IFNULL(MAX(n),0)+1 FROM (
                        SELECT CAST(SUBSTRING(numero,6) AS UNSIGNED) n FROM facturas WHERE numero LIKE ?
                        UNION ALL
                        SELECT CAST(SUBSTRING(numero,6) AS UNSIGNED) n FROM pendientes_importacion WHERE numero LIKE ?
                    ) numeros", ['E001-%', 'E001-%'])->fetchColumn();
                    $numero = 'E001-' . $n;
                }
                q("INSERT INTO facturas(cliente_id,emision,vencimiento,subtotal,igv,total,retencion,aplica_penalidad,porcentaje_penalidad,monto_penalidad,total_neto,utilidad,numero,nro_guia,nro_oc) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    [...$v, $numero, $guia, $orden]);
                $id = $db->lastInsertId();
            }
            if ($guias) {
                $marks = implode(',', array_fill(0, count($guias), '?'));
                q("DELETE FROM factura_guias WHERE factura_id=? AND numero_guia NOT IN ($marks)", [$id, ...$guias]);
                foreach ($guias as $numeroGuia)
                    q("INSERT INTO factura_guias(factura_id,numero_guia) VALUES(?,?)
                        ON DUPLICATE KEY UPDATE numero_guia=VALUES(numero_guia)", [$id, $numeroGuia]);
            } else {
                q("DELETE FROM factura_guias WHERE factura_id=?", [$id]);
            }
            foreach ($rows as [$i, $t, $c, $precio])
                q("INSERT INTO factura_detalle(factura_id,producto_id,cantidad,precio,descuento,total,costo_unit) VALUES(?,?,?,?,?,?,?)",
                    [$id, $i['producto_id'], $i['cantidad'], $precio, $i['descuento'] ?? 0, $t, $c]);
            self::sincronizarPreciosCatalogo($productosAActualizar);
            if ($pendiente) q("DELETE FROM pendientes_importacion WHERE id=?", [$pendiente['id']]);
            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            Res::fail($e->getMessage(), 500);
        }
        $guiasGuardadas = q("SELECT id,numero_guia FROM factura_guias WHERE factura_id=? ORDER BY id", [$id])->fetchAll();
        Res::json(['ok' => 1, 'id' => $id, 'guias' => $guiasGuardadas]);
    }
    static function anular($in = []) {
        $productos = q("SELECT DISTINCT producto_id FROM factura_detalle WHERE factura_id=?", [$in['id'] ?? 0])->fetchAll(PDO::FETCH_COLUMN);
        q("UPDATE facturas SET anulada=1,motivo=? WHERE id=?", [$in['motivo'] ?? 'Anulada', $in['id'] ?? 0]);
        self::sincronizarPreciosCatalogo($productos);
        Res::json(['ok' => 1]);
    }
}

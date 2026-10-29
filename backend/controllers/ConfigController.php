<?php
class ConfigController {
    const KEYS = ['empresa_nombre','empresa_ruc','empresa_direccion','empresa_telefono','empresa_email','igv','retencion','dias_credito','color'];
    static function guardar($in = []) {
        foreach (($in['valores'] ?? []) as $k => $v) if (in_array($k, self::KEYS)) Config::set($k, $v);
        Res::json(['ok' => 1]);
    }
    static function respaldoEstado($in = []) {
        Res::json(['ultimo_respaldo' => Config::get('ultimo_respaldo')]);
    }
    // Respaldo de datos: descarga un .sql con los INSERT de todas las tablas
    static function respaldo($in = []) {
        $db = Database::get();
        $sql = ["SET FOREIGN_KEY_CHECKS=0;\n"];
        $tables = ['clientes','productos','listas','configuracion'];
        if (q("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?", ['pendientes_importacion'])->fetchColumn()) $tables[] = 'pendientes_importacion';
        $tables = array_merge($tables, ['facturas','factura_detalle','cobros']);
        foreach (['factura_guias','factura_documentos','producto_codigos'] as $table) {
            if (q("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?", [$table])->fetchColumn())
                $tables[] = $table;
        }
        foreach ($tables as $t) {
            $sql[] = "DELETE FROM `$t`;\n";
            foreach (q("SELECT * FROM `$t`")->fetchAll() as $r)
                $sql[] = "INSERT INTO `$t`(`" . implode('`,`', array_keys($r)) . "`) VALUES(" .
                    implode(',', array_map(fn($v) => $v === null ? 'NULL' : $db->quote($v), $r)) . ");\n";
        }
        $fechaRespaldo = date('c');
        Config::set('ultimo_respaldo', $fechaRespaldo);
        $sql[] = "INSERT INTO `configuracion`(`clave`,`valor`) VALUES('ultimo_respaldo'," .
            $db->quote($fechaRespaldo) . ") ON DUPLICATE KEY UPDATE `valor`=VALUES(`valor`);\n";
        $sql[] = "SET FOREIGN_KEY_CHECKS=1;\n";
        header('Content-Type: application/sql; charset=utf-8');
        header('Content-Disposition: attachment; filename="respaldo_' . date('Ymd_His') . '.sql"');
        echo implode('', $sql);
        exit;
    }
}

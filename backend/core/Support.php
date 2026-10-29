<?php
// Utilidades comunes: respuestas JSON, consulta rápida y configuración.
class Res {
    static function json($d, $c = 200) { http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }
    static function fail($m, $c = 422) { self::json(['error' => $m], $c); }
    static function body(): array { return json_decode(file_get_contents('php://input'), true) ?? []; }
}
function q($sql, $p = []) { $s = Database::get()->prepare($sql); $s->execute($p); return $s; }
class Config {
    static function get($k, $d = null) { $v = q("SELECT valor FROM configuracion WHERE clave=?", [$k])->fetchColumn(); return $v === false ? $d : $v; }
    static function all() { return q("SELECT clave,valor FROM configuracion")->fetchAll(PDO::FETCH_KEY_PAIR); }
    static function set($k, $v) { q("INSERT INTO configuracion(clave,valor) VALUES(?,?) ON DUPLICATE KEY UPDATE valor=VALUES(valor)", [$k, $v]); }
}
function detalleTienePreciosConIgv(): bool {
    static $convertido = null;
    if ($convertido === null) $convertido = Config::get('precios_con_igv_aplicado') === '1';
    return $convertido;
}
function factorIgvPrecio(): float {
    static $factor = null;
    if ($factor === null) $factor = 1 + (float)Config::get('igv', 18) / 100;
    return $factor;
}
function precioUnitarioConIgv($precio) {
    if ($precio === null) return null;
    return detalleTienePreciosConIgv() ? (float)$precio : round((float)$precio * factorIgvPrecio(), 2);
}
function precioUnitarioParaGuardar($precio): float {
    return detalleTienePreciosConIgv() ? (float)$precio : round((float)$precio / factorIgvPrecio(), 4);
}

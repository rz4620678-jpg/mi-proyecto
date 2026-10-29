<?php
// Único punto de entrada: api.php?r=<ruta>  ->  Controlador::método
header('Content-Type: application/json; charset=utf-8');
foreach (['config/database', 'core/Support', 'controllers/FacturaController', 'controllers/ClienteController',
    'controllers/CobroController', 'controllers/DashboardController', 'controllers/CatalogoController', 'controllers/ConfigController',
    'controllers/ReporteController'] as $f) require __DIR__ . "/$f.php";

$routes = [
    'bootstrap' => ['CatalogoController', 'bootstrap'], 'dashboard' => ['DashboardController', 'resumen'],
    'facturas' => ['FacturaController', 'listar'], 'factura_anios' => ['FacturaController', 'anios'],
    'detalle' => ['FacturaController', 'detalle'],
    'pendientes_importacion' => ['FacturaController', 'pendientes'],
    'factura_guardar' => ['FacturaController', 'guardar'], 'factura_anular' => ['FacturaController', 'anular'],
    'clientes' => ['ClienteController', 'listar'], 'cliente_guardar' => ['ClienteController', 'guardar'],
    'cliente_codigo_sap_guardar' => ['ClienteController', 'guardarCodigoSap'], 'cliente_eliminar' => ['ClienteController', 'eliminar'],
    'cliente_duplicados' => ['ClienteController', 'duplicados'], 'cliente_unir' => ['ClienteController', 'unir'],
    'cobros' => ['CobroController', 'listar'], 'cobro_anios' => ['CobroController', 'anios'],
    'cobro_guardar' => ['CobroController', 'guardar'], 'cobro_eliminar' => ['CobroController', 'eliminar'],
    'precios' => ['CatalogoController', 'precios'], 'lista_guardar' => ['CatalogoController', 'listaGuardar'], 'lista_eliminar' => ['CatalogoController', 'listaEliminar'],
    'producto_guardar' => ['CatalogoController', 'productoGuardar'], 'producto_eliminar' => ['CatalogoController', 'productoEliminar'],
    'catalogo_por_codigo' => ['CatalogoController', 'porCodigo'],
    'codigo_guardar' => ['CatalogoController', 'guardarCodigo'],
    'documento_subir' => ['FacturaController', 'subirDocumento'], 'documento' => ['FacturaController', 'documento'],
    'reporte' => ['ReporteController', 'generar'],
    'config_guardar' => ['ConfigController', 'guardar'], 'respaldo' => ['ConfigController', 'respaldo'],
    'respaldo_estado' => ['ConfigController', 'respaldoEstado'],
];
$r = $_GET['r'] ?? '';
if (!isset($routes[$r])) Res::fail('Ruta no existe', 404);
try { [$c, $m] = $routes[$r]; $c::$m(Res::body()); }
catch (Throwable $e) { Res::fail($e->getMessage(), 500); }

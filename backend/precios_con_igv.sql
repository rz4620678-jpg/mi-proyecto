SELECT
    COALESCE(
        (SELECT valor FROM configuracion WHERE clave = 'precios_con_igv_aplicado'),
        '0'
    ) AS detalle_ya_guardado_con_igv,
    (SELECT COUNT(*) FROM factura_detalle) AS lineas_historicas,
    'Consulta informativa: la aplicacion adapta la lectura de precios sin reescribir el detalle historico' AS nota;

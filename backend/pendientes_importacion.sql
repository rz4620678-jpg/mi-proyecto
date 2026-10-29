CREATE TABLE IF NOT EXISTS pendientes_importacion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero VARCHAR(20) NOT NULL UNIQUE,
    anio SMALLINT NULL,
    subtotal_excel DECIMAL(16,6) NULL,
    igv_excel DECIMAL(16,6) NULL,
    total_excel DECIMAL(16,6) NULL,
    fuente VARCHAR(120) NOT NULL,
    nota VARCHAR(250) NOT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO pendientes_importacion(numero, anio, subtotal_excel, igv_excel, total_excel, fuente, nota)
SELECT 'E001-121', 2026, 20917.7966, 3765.203388, 24682.999988,
       'PAGOS DE FACTURAS Y DISGREGADO.xlsx',
       'Completar fecha, cliente, guía, orden de compra, estado de retención y detalle antes de registrar la factura'
WHERE NOT EXISTS (SELECT 1 FROM facturas WHERE numero = 'E001-121')
  AND NOT EXISTS (SELECT 1 FROM pendientes_importacion WHERE numero = 'E001-121');

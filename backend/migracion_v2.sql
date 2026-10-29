-- Migracion v2 para Sistema de Facturas por Cobrar.
-- Compatible con MySQL/MariaDB; no elimina tablas, columnas ni datos.
-- Se puede ejecutar nuevamente sin duplicar columnas ni guias migradas.

CREATE TABLE IF NOT EXISTS factura_guias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    factura_id INT NOT NULL,
    numero_guia VARCHAR(80) NOT NULL,
    fecha DATE NULL,
    doc_original_path VARCHAR(255) NULL,
    doc_sellada_path VARCHAR(255) NULL,
    CONSTRAINT fk_factura_guias_factura
        FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE,
    UNIQUE KEY uq_factura_guia (factura_id, numero_guia),
    INDEX idx_factura_guias_factura (factura_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS factura_documentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    factura_id INT NOT NULL,
    tipo ENUM('factura_original','factura_sellada') NOT NULL,
    archivo_path VARCHAR(255) NOT NULL,
    nombre_original VARCHAR(255) NOT NULL,
    subido_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_factura_documentos_factura
        FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE,
    UNIQUE KEY uq_factura_documento_tipo (factura_id, tipo),
    INDEX idx_factura_documentos_factura (factura_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS producto_codigos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    producto_id INT NOT NULL,
    cliente_id INT NULL,
    codigo VARCHAR(80) NOT NULL,
    tipo ENUM('sap','interno') NOT NULL DEFAULT 'interno',
    CONSTRAINT fk_producto_codigos_producto
        FOREIGN KEY (producto_id) REFERENCES productos(id),
    CONSTRAINT fk_producto_codigos_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    UNIQUE KEY uq_producto_codigo_cliente (cliente_id, codigo),
    INDEX idx_producto_codigos_codigo (codigo),
    INDEX idx_producto_codigos_producto (producto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO listas (tipo, nombre)
SELECT 'banco', 'CONTINENTAL'
WHERE NOT EXISTS (
    SELECT 1 FROM listas WHERE tipo='banco' AND UPPER(nombre)='CONTINENTAL'
);

UPDATE configuracion
SET valor='#0a2a6b'
WHERE clave='color' AND valor='#0b2a6b';

SET @v2_sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clientes' AND COLUMN_NAME = 'codigo_sap') = 0,
    'ALTER TABLE clientes ADD COLUMN codigo_sap VARCHAR(40) NULL AFTER ruc',
    'SELECT 1'
);
PREPARE v2_stmt FROM @v2_sql;
EXECUTE v2_stmt;
DEALLOCATE PREPARE v2_stmt;

SET @v2_sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clientes' AND COLUMN_NAME = 'contacto_nombre') = 0,
    'ALTER TABLE clientes ADD COLUMN contacto_nombre VARCHAR(120) NULL AFTER direccion',
    'SELECT 1'
);
PREPARE v2_stmt FROM @v2_sql;
EXECUTE v2_stmt;
DEALLOCATE PREPARE v2_stmt;

SET @v2_sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'facturas' AND COLUMN_NAME = 'aplica_penalidad') = 0,
    'ALTER TABLE facturas ADD COLUMN aplica_penalidad TINYINT(1) NOT NULL DEFAULT 0 AFTER retencion',
    'SELECT 1'
);
PREPARE v2_stmt FROM @v2_sql;
EXECUTE v2_stmt;
DEALLOCATE PREPARE v2_stmt;

SET @v2_sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'facturas' AND COLUMN_NAME = 'porcentaje_penalidad') = 0,
    'ALTER TABLE facturas ADD COLUMN porcentaje_penalidad DECIMAL(5,2) NOT NULL DEFAULT 10.00 AFTER aplica_penalidad',
    'SELECT 1'
);
PREPARE v2_stmt FROM @v2_sql;
EXECUTE v2_stmt;
DEALLOCATE PREPARE v2_stmt;

SET @v2_sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'facturas' AND COLUMN_NAME = 'monto_penalidad') = 0,
    'ALTER TABLE facturas ADD COLUMN monto_penalidad DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER porcentaje_penalidad',
    'SELECT 1'
);
PREPARE v2_stmt FROM @v2_sql;
EXECUTE v2_stmt;
DEALLOCATE PREPARE v2_stmt;

-- Conserva nro_guia como dato legado y también separa cada guía en su fila.
INSERT IGNORE INTO factura_guias (factura_id, numero_guia)
WITH RECURSIVE partes_guia AS (
    SELECT id AS factura_id,
           TRIM(SUBSTRING_INDEX(nro_guia, '/', 1)) AS numero_guia,
           CASE WHEN LOCATE('/', nro_guia) > 0
                THEN SUBSTRING(nro_guia, LOCATE('/', nro_guia) + 1)
                ELSE '' END AS restantes
    FROM facturas
    WHERE nro_guia IS NOT NULL AND TRIM(nro_guia) <> ''
    UNION ALL
    SELECT factura_id,
           TRIM(SUBSTRING_INDEX(restantes, '/', 1)),
           CASE WHEN LOCATE('/', restantes) > 0
                THEN SUBSTRING(restantes, LOCATE('/', restantes) + 1)
                ELSE '' END
    FROM partes_guia
    WHERE restantes <> ''
)
SELECT factura_id, numero_guia
FROM partes_guia
WHERE numero_guia <> '';

-- Completa vencimientos previamente desconocidos sin cambiar los ya informados.
UPDATE facturas f
LEFT JOIN configuracion c ON c.clave = 'dias_credito'
SET f.vencimiento = DATE_ADD(
        f.emision,
        INTERVAL CASE
            WHEN c.valor REGEXP '^[0-9]+$' THEN CAST(c.valor AS UNSIGNED)
            ELSE 30
        END DAY
    )
WHERE f.vencimiento IS NULL;

-- Mantiene el neto coherente con los campos nuevos; las facturas históricas
-- conservan su total neto cuando no tienen penalidad aplicada.
UPDATE facturas
SET monto_penalidad = CASE
        WHEN aplica_penalidad = 1 THEN ROUND(total * porcentaje_penalidad / 100, 2)
        ELSE 0
    END,
    total_neto = CASE
        WHEN aplica_penalidad = 1 THEN GREATEST(
            total - retencion - ROUND(total * porcentaje_penalidad / 100, 2),
            0
        )
        ELSE total_neto
    END;

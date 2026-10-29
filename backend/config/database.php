<?php
// Conexión PDO. Cambia aquí tus credenciales de MySQL.
class Database {
    private static ?PDO $pdo = null;
    static function get(): PDO {
        if (self::$pdo === null) {
            $host = getenv('FACTURAS_DB_HOST') ?: '127.0.0.1';
            $port = (int)(getenv('FACTURAS_DB_PORT') ?: 3306);
            $name = getenv('FACTURAS_DB_NAME') ?: 'facturas_cobrar';
            $user = getenv('FACTURAS_DB_USER') ?: 'root';
            $pass = getenv('FACTURAS_DB_PASSWORD');
            if ($pass === false) $pass = '';
            if (str_starts_with($host, 'CAMBIAR_') || str_starts_with($name, 'CAMBIAR_') || str_starts_with($user, 'CAMBIAR_') || str_starts_with($pass, 'CAMBIAR_')) {
                throw new RuntimeException('Configura las credenciales MySQL en backend/config/database.php o en el entorno del servidor.');
            }
            self::$pdo = new PDO(
                "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4",
                $user,
                $pass,
                [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci',
                ]
            );
        }
        return self::$pdo;
    }
}

-- =====================================================
-- schema.sql
-- Script para crear la estructura de la Base de Datos
-- para la aplicación Win98 Simulator
-- (Versión CORREGIDA para sintaxis de FOREIGN KEY)
-- =====================================================

-- Crear la base de datos si no existe, asegurando UTF8mb4
CREATE DATABASE IF NOT EXISTS win98sim_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- Seleccionar la base de datos para usarla
USE win98sim_db;

-- -----------------------------------------------------
-- Tabla: users
-- Almacena la información de los usuarios registrados.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único del usuario',
    username VARCHAR(50) NOT NULL UNIQUE COMMENT 'Nombre de usuario para login (único)',
    password_hash VARCHAR(255) NOT NULL COMMENT 'Contraseña hasheada con bcrypt',
    storage_used BIGINT NOT NULL DEFAULT 0 COMMENT 'Almacenamiento usado por el usuario en bytes',
    storage_quota BIGINT NOT NULL DEFAULT 5368709120 COMMENT 'Cuota total de almacenamiento en bytes (Default: 5GB)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro del usuario'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tabla de usuarios del simulador';


-- -----------------------------------------------------
-- Tabla: filesystem_items
-- Almacena la información de carpetas, archivos y
-- accesos directos virtuales de cada usuario.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS filesystem_items (
    -- Columnas principales
    id INT AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT 'ID del usuario propietario (FK a users.id)',
    parent_id INT NULL COMMENT 'ID del item padre (carpeta). NULL para la raíz/escritorio (FK a filesystem_items.id)',
    item_type ENUM('FOLDER', 'FILE', 'SHORTCUT') NOT NULL COMMENT 'Tipo de item',
    name VARCHAR(255) NOT NULL COMMENT 'Nombre visible del item (carpeta, archivo, etc.)',

    -- Campos específicos para tipo 'FILE'
    file_path VARCHAR(512) NULL COMMENT 'Ruta relativa al archivo físico en el servidor (ej: user_123/files/video.mp4)',
    mime_type VARCHAR(100) NULL COMMENT 'Tipo MIME del archivo (ej: video/mp4, text/plain)',
    original_name VARCHAR(255) NULL COMMENT 'Nombre original del archivo cuando fue subido',
    size BIGINT NULL DEFAULT 0 COMMENT 'Tamaño en bytes (para tipo FILE y para iconos de SHORTCUT)',

    -- Campos específicos para tipo 'SHORTCUT'
    target_url VARCHAR(2048) NULL COMMENT 'URL completa a la que apunta el acceso directo',
    icon_path VARCHAR(512) NULL COMMENT 'Ruta relativa al icono personalizado del shortcut (ej: user_123/icons/myicon.png)',

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del item',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la última modificación',

    -- Definición de Claves y Constraints
    PRIMARY KEY (id),

    -- Índices para optimizar consultas comunes (Separados por comas)
    INDEX idx_user_items (user_id),
    INDEX idx_folder_contents (parent_id),
    INDEX idx_user_parent_name (user_id, parent_id, name) COMMENT 'Índice para verificar duplicados rápidamente', -- Coma aquí

    -- Definición de Claves Foráneas (Separadas por comas, SIN comments inline)
    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE, -- Coma aquí

    FOREIGN KEY (parent_id)
        REFERENCES filesystem_items(id)
        ON DELETE CASCADE -- SIN coma aquí (última definición)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tabla de items del sistema de archivos virtual';

-- --- Fin del script ---
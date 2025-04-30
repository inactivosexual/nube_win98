// src/config/db.js

const mysql = require('mysql2/promise'); // Usar la versión con promesas de mysql2
require('dotenv').config(); // Cargar variables de entorno desde .env

// Configuración del pool de conexiones
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',       // Host de la BD (default: localhost)
    user: process.env.DB_USER || 'root',       // Usuario de la BD (default: win98user)
    password: process.env.DB_PASSWORD || '', // Contraseña de la BD (default: password)
    database: process.env.DB_NAME || 'win98sim_db', // Nombre de la BD (default: win98sim_db)
    waitForConnections: true,                       // Esperar si todas las conexiones están en uso
    connectionLimit: 10,                            // Máximo número de conexiones en el pool
    queueLimit: 0,                                  // Sin límite de cola (esperarán indefinidamente)
    charset: 'utf8mb4'                              // Asegurar codificación para soportar emojis, etc.
});

// --- Prueba de Conexión Opcional (se ejecuta al iniciar el servidor) ---
// Intenta obtener una conexión del pool para verificar la configuración
pool.getConnection()
    .then(connection => {
        console.log(`[DB] Conexión a MySQL (${process.env.DB_NAME || 'win98sim_db'}) establecida exitosamente.`);
        connection.release(); // ¡Importante liberar la conexión después de probarla!
    })
    .catch(error => {
        console.error('[DB] ¡Error al conectar con la base de datos MySQL!');
        console.error(`[DB] Código: ${error.code}`);
        console.error(`[DB] Mensaje: ${error.message}`);
        // Considera terminar el proceso si la BD es esencial para el arranque
        // process.exit(1);
    });

// Exportar el pool para que otros módulos (controladores) puedan usarlo
module.exports = pool;
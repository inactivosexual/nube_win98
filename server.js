// server.js - Punto de entrada principal de la aplicación backend

// Cargar variables de entorno (.env) al inicio
require('dotenv').config();

// Importar módulos necesarios
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs'); // Necesario para verificar existencia de archivos subidos

// Importar middleware y rutas
const checkAuth = require('./src/middleware/checkAuth'); // Middleware de autenticación
const authRoutes = require('./src/routes/auth');         // Rutas de autenticación
const filesystemRoutes = require('./src/routes/filesystem'); // Rutas del sistema de archivos

// Crear instancia de la aplicación Express
const app = express();

// Configuración del puerto
const PORT = process.env.PORT || 3000;

// --- Configuración de Middleware Esencial ---

// Parsear cuerpos de petición JSON
app.use(express.json());
// Parsear cuerpos de petición URL-encoded (formularios HTML)
app.use(express.urlencoded({ extended: true }));

// Configuración de Sesiones de Usuario
app.use(session({
    secret: process.env.SESSION_SECRET, // Clave secreta para firmar la cookie de sesión (¡IMPORTANTE!)
    resave: false,                     // No guardar la sesión si no se modifica
    saveUninitialized: false,          // No crear sesión hasta que algo se almacene
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Usar cookies seguras (HTTPS) en producción
        httpOnly: true,                   // Prevenir acceso a la cookie desde JS en el cliente
        maxAge: 1000 * 60 * 60 * 24 * 7,  // Duración de la cookie (ej: 7 días)
        sameSite: 'lax'                   // Protección CSRF básica
    }
}));

// Servir archivos estáticos del frontend (HTML, CSS, JS, imágenes) desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- Configuración de Rutas API ---

// Montar rutas de autenticación bajo /api/auth
app.use('/api/auth', authRoutes);
// Montar rutas del sistema de archivos bajo /api/filesystem
app.use('/api/filesystem', filesystemRoutes); // Estas rutas ya usan checkAuth internamente

// --- Ruta Segura para Servir Archivos Subidos ---
// Esta ruta maneja el acceso a /uploads/user_XXX/files/* y /uploads/user_XXX/icons/*
app.get('/uploads/*', checkAuth, (req, res) => {
    const requestedPath = req.params[0]; // Obtiene la parte de la ruta después de '/uploads/'
    const userId = req.userId; // Obtenido de la sesión por checkAuth

    console.log(`[Serve Upload] User ${userId} solicitando: /uploads/${requestedPath}`);

    // --- Validaciones de Seguridad CRUCIALES ---
    // 1. Evitar Path Traversal (no permitir '..' para salir de la carpeta uploads)
    const absoluteBasePath = path.resolve(__dirname, 'uploads');
    const absoluteRequestedPath = path.resolve(absoluteBasePath, requestedPath);

    if (!absoluteRequestedPath.startsWith(absoluteBasePath)) {
        console.warn(`[Serve Upload] Bloqueado Path Traversal: User ${userId}, Path ${requestedPath}`);
        return res.status(403).send('Acceso prohibido (Ruta inválida).');
    }

    // 2. Asegurar que la ruta solicitada pertenezca al usuario logueado
    //    La ruta debe empezar con 'user_<userId>/...'
    const userSpecificPrefix = `user_${userId}/`;
    if (!requestedPath.startsWith(userSpecificPrefix)) {
        // Excepción: Podrías tener archivos públicos/compartidos en una carpeta diferente
        // if (!requestedPath.startsWith('public/')) { ... }
        console.warn(`[Serve Upload] Bloqueado acceso a recurso de otro usuario: User ${userId}, Path ${requestedPath}`);
        return res.status(403).send('Acceso prohibido (Permiso denegado).');
    }

    // --- Servir el Archivo ---
    // Verificar si el archivo existe y es legible ANTES de enviarlo
    fs.access(absoluteRequestedPath, fs.constants.R_OK, (err) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.warn(`[Serve Upload] Archivo no encontrado: ${absoluteRequestedPath}`);
                return res.status(404).send('Archivo no encontrado.');
            } else {
                console.error(`[Serve Upload] Error de acceso al archivo ${absoluteRequestedPath}:`, err);
                return res.status(403).send('Acceso prohibido o error leyendo archivo.'); // Error de permisos u otro
            }
        }

        // Si todo está bien, enviar el archivo
        console.log(`[Serve Upload] Sirviendo archivo: ${absoluteRequestedPath}`);
        res.sendFile(absoluteRequestedPath, (sendFileErr) => {
            if (sendFileErr) {
                // --- Manejo Mejorado ---
                if (sendFileErr.code === 'ECONNABORTED') {
                     // Si el error es porque el cliente abortó, es menos grave
                     console.warn(`[Serve Upload] Envío abortado por cliente para ${absoluteRequestedPath}: ${sendFileErr.message}`);
                } else {
                     // Otros errores de envío sí pueden ser importantes
                     console.error(`[Serve Upload] Error enviando archivo ${absoluteRequestedPath}:`, sendFileErr);
                }
                // No intentar enviar otra respuesta aquí, la conexión ya está cerrada/abortada.
           } else {
                console.log(`[Serve Upload] Envío completo para: ${absoluteRequestedPath}`);
           }
        });
    });
});


// --- Ruta Catch-all para la Single Page Application (SPA) ---
// Sirve el index.html principal para cualquier ruta GET no reconocida anteriormente.
// Esto permite que el enrutamiento del lado del cliente (si lo hubiera) funcione.
app.get('*', (req, res) => {
    // Podríamos añadir checkAuth aquí si queremos forzar login antes de cargar el HTML,
    // pero es más común manejarlo en el frontend al verificar /api/auth/status.
    console.log(`[Serve Frontend] Sirviendo index.html para ruta: ${req.path}`);
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Manejador de Errores Global (Opcional pero recomendado) ---
app.use((err, req, res, next) => {
  console.error("[Error Handler Global] Error no capturado:", err);
  // Evitar enviar detalles del error en producción por seguridad
  const message = process.env.NODE_ENV === 'production' ? 'Ocurrió un error inesperado.' : err.message;
  res.status(err.status || 500).json({ message: message });
});


// --- Iniciar el Servidor ---
app.listen(PORT, () => {
    console.log(`=====================================================`);
    console.log(`  Servidor Win98 Simulator iniciado en MODO ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Escuchando en http://localhost:${PORT}`);
    console.log(`=====================================================`);
});
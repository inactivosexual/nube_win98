// src/middleware/checkAuth.js

/**
 * Middleware para verificar si el usuario está autenticado a través de la sesión.
 * Si está autenticado, añade req.userId y pasa al siguiente middleware/ruta.
 * Si no, responde con un error 401 Unauthorized.
 */
function checkAuth(req, res, next) {
    if (req.session && req.session.userId) {
        // Añadir userId a la petición para fácil acceso en controladores
        req.userId = req.session.userId;
        return next(); // Usuario autenticado, continuar
    } else {
        // Usuario no autenticado
        console.warn("[Auth] Acceso no autorizado denegado para:", req.originalUrl);
        return res.status(401).json({ message: 'No autorizado. Por favor, inicie sesión.' });
    }
}

module.exports = checkAuth;
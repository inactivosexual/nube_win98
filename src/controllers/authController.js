// src/controllers/authController.js

const bcrypt = require('bcrypt');
const db = require('../config/db'); // Pool de conexiones a la BD

const saltRounds = 10; // Cost factor para bcrypt (10-12 es un buen balance)

/** Controlador para registrar un nuevo usuario. */
exports.register = async (req, res) => {
    const { username, password } = req.body;

    // Validaciones básicas
    if (!username || !password) {
        return res.status(400).json({ message: 'Nombre de usuario y contraseña son requeridos.' });
    }
    if (username.length < 3) {
         return res.status(400).json({ message: 'Nombre de usuario debe tener al menos 3 caracteres.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    try {
        // Verificar si el nombre de usuario ya existe
        const [existingUsers] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'El nombre de usuario ya está en uso. Por favor, elige otro.' }); // 409 Conflict
        }

        // Hashear la contraseña
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insertar el nuevo usuario en la base de datos
        // Los valores por defecto para storage_used y storage_quota se aplicarán automáticamente
        const [result] = await db.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
        const newUserId = result.insertId;

        console.log(`[Auth] Usuario registrado: ${username} (ID: ${newUserId})`);
        res.status(201).json({ message: 'Usuario registrado exitosamente.' }); // 201 Created

    } catch (error) {
        console.error("[Auth] Error en el registro:", error);
        res.status(500).json({ message: 'Error interno del servidor durante el registro.' });
    }
};

/** Controlador para iniciar sesión. */
exports.login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Nombre de usuario y contraseña son requeridos.' });
    }

    try {
        // Buscar usuario por nombre de usuario
        const [users] = await db.query('SELECT id, username, password_hash FROM users WHERE username = ?', [username]);

        if (users.length === 0) {
            // Usuario no encontrado (mensaje genérico por seguridad)
            return res.status(401).json({ message: 'Credenciales inválidas.' }); // 401 Unauthorized
        }

        const user = users[0];

        // Comparar la contraseña proporcionada con el hash almacenado
        const match = await bcrypt.compare(password, user.password_hash);

        if (match) {
            // Contraseña correcta - Iniciar sesión creando la sesión
            req.session.userId = user.id;
            req.session.username = user.username;

            console.log(`[Auth] Inicio de sesión exitoso: ${user.username} (ID: ${user.id})`);
            // Devolver información básica del usuario (sin el hash!)
            res.status(200).json({
                message: 'Inicio de sesión exitoso.',
                user: {
                    id: user.id,
                    username: user.username
                    // No incluir password_hash aquí!
                }
            });
        } else {
            // Contraseña incorrecta (mensaje genérico)
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

    } catch (error) {
        console.error("[Auth] Error en el login:", error);
        res.status(500).json({ message: 'Error interno del servidor durante el inicio de sesión.' });
    }
};

/** Controlador para cerrar sesión. */
exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("[Auth] Error al destruir la sesión:", err);
            return res.status(500).json({ message: 'No se pudo cerrar la sesión correctamente.' });
        }
        // Limpiar la cookie de sesión en el navegador
        // El nombre 'connect.sid' es el default de express-session, podría variar si se configura diferente
        res.clearCookie('connect.sid');
        console.log(`[Auth] Sesión cerrada para el usuario ID: ${req.userId || 'desconocido'}.`); // req.userId ya no estará disponible aquí usualmente
        res.status(200).json({ message: 'Sesión cerrada exitosamente.' });
    });
};

/** Controlador para verificar el estado de la sesión actual. */
exports.status = (req, res) => {
    // checkAuth middleware ya ha verificado la sesión y añadido req.userId
    // También necesitamos el username que guardamos en la sesión durante el login
    if (req.session && req.session.userId && req.session.username) {
        res.status(200).json({
            loggedIn: true,
            user: {
                id: req.session.userId,
                username: req.session.username
            }
        });
    } else {
        // Esto no debería ocurrir si checkAuth está aplicado, pero como fallback:
        res.status(401).json({ loggedIn: false, message: 'No autenticado.' });
    }
};

/** Controlador para obtener información de almacenamiento del usuario. */
exports.getStorageInfo = async (req, res) => {
    // req.userId es añadido por el middleware checkAuth
    const userId = req.userId;

    try {
        const [users] = await db.query('SELECT storage_used, storage_quota FROM users WHERE id = ?', [userId]);

        if (users.length === 0) {
            // Usuario no encontrado en la BD, aunque tenga sesión (raro, pero posible)
            return res.status(404).json({ message: 'Información de usuario no encontrada.' });
        }

        res.status(200).json({
            storage_used: users[0].storage_used,
            storage_quota: users[0].storage_quota
        });

    } catch (error) {
        console.error("[Auth] Error obteniendo información de almacenamiento:", error);
        res.status(500).json({ message: 'Error interno del servidor al obtener información de almacenamiento.' });
    }
};
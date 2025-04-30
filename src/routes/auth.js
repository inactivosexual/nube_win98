// src/routes/auth.js

const express = require('express');
const authController = require('../controllers/authController');
const checkAuth = require('../middleware/checkAuth'); // Middleware para proteger rutas

const router = express.Router();

// --- Rutas Públicas ---
router.post('/register', authController.register); // Registro de nuevo usuario
router.post('/login', authController.login);     // Inicio de sesión

// --- Rutas Protegidas (Requieren sesión activa) ---
router.post('/logout', checkAuth, authController.logout);    // Cierre de sesión (POST es semántico)
router.get('/status', checkAuth, authController.status);     // Verificar estado de sesión actual
router.get('/storage', checkAuth, authController.getStorageInfo); // Obtener info de almacenamiento

module.exports = router;
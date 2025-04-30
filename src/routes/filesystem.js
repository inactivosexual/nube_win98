// src/routes/filesystem.js

const express = require('express');
const filesystemController = require('../controllers/filesystemController');
const checkAuth = require('../middleware/checkAuth'); // Middleware de autenticación
const upload = require('../middleware/multerConfig'); // Middleware de subida (Multer)

const router = express.Router();

// --- Aplicar Autenticación a TODAS las rutas de este archivo ---
router.use(checkAuth);

// --- Rutas del Sistema de Archivos Virtual ---

// Obtener items de una carpeta o escritorio
router.get('/items', filesystemController.getItems);

// Crear una nueva carpeta
router.post('/folder', filesystemController.createFolder);

// Crear un acceso directo (maneja subida de icono opcional)
// 'icon' debe ser el 'name' del <input type="file"> en el frontend
router.post('/shortcut', upload.single('icon'), filesystemController.createShortcut);

// Subir un archivo (video, audio, texto, etc.)
// 'file' debe ser el 'name' del <input type="file"> en el frontend
router.post('/file', upload.single('file'), filesystemController.uploadFile);

// Eliminar un item (carpeta, archivo, acceso directo)
router.delete('/item/:id', filesystemController.deleteItem);


/* --- Rutas Opcionales (Descomentar e implementar si se necesitan) ---

// Renombrar un item
router.put('/item/:id/rename', filesystemController.renameItem);

// Obtener contenido de un archivo de texto
router.get('/item/:id/content', filesystemController.getFileContent);

// Guardar contenido de un archivo de texto
router.put('/item/:id/content', filesystemController.saveFileContent);

*/

module.exports = router;
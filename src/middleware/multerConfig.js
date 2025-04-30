// src/middleware/multerConfig.js

const multer = require('multer');
const path = require('path');
const fs = require('fs');

/** Crea una carpeta si no existe. */
const createFolderIfNotExists = (folderPath) => {
    if (!fs.existsSync(folderPath)) {
        try {
            fs.mkdirSync(folderPath, { recursive: true });
            console.log(`[Multer] Directorio creado: ${folderPath}`);
        } catch (error) {
             console.error(`[Multer] Error creando directorio ${folderPath}:`, error);
             throw new Error(`No se pudo crear el directorio de subida: ${error.message}`); // Lanzar para detener
        }
    }
};

// Configuración de almacenamiento en disco
const storage = multer.diskStorage({
    /** Define dónde guardar los archivos subidos. */
    destination: function (req, file, cb) {
        // Obtener userId de la sesión (checkAuth debe haberse ejecutado antes)
        const userId = req.session.userId;
        if (!userId) {
            // Esto no debería ocurrir si checkAuth se aplica antes
            return cb(new Error('Usuario no autenticado para la subida'), false);
        }

        let targetSubFolder = 'files'; // Carpeta por defecto para archivos generales
        // Diferenciar destino si es un icono para un acceso directo
        if (file.fieldname === 'icon') {
             targetSubFolder = 'icons';
        }
        // Podrías añadir más fieldnames si es necesario

        // Construir ruta completa: uploads/user_XXX/files ó uploads/user_XXX/icons
        const userUploadsPath = path.join(__dirname, '..', '..', 'uploads', `user_${userId}`, targetSubFolder);

        try {
            createFolderIfNotExists(userUploadsPath); // Asegurarse de que el directorio existe
            cb(null, userUploadsPath); // Indicar a multer dónde guardar
        } catch (error) {
             cb(error, false); // Pasar error a multer si no se pudo crear directorio
        }
    },
    /** Define cómo nombrar los archivos subidos. */
    filename: function (req, file, cb) {
        // Generar un nombre único para evitar colisiones y problemas con caracteres especiales
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        // Sanitizar nombre original (quitar extensión y caracteres no deseados)
        const safeOriginalNameBase = path.basename(file.originalname, extension)
                                       .toLowerCase()
                                       .replace(/[^a-z0-9._-]/g, '_') // Permitir letras, números, ., _, -
                                       .substring(0, 50); // Limitar longitud base del nombre original

        const finalFilename = `${safeOriginalNameBase}-${uniqueSuffix}${extension}`;
        cb(null, finalFilename);
    }
});

// Filtro para tipos de archivo permitidos
const fileFilter = (req, file, cb) => {
    // Definir extensiones y tipos MIME permitidos (ser más explícito es más seguro)
    const allowedExtensions = /\.(jpg|jpeg|png|gif|mp4|mkv|avi|mov|webm|mp3|wav|ogg|flac|aac|txt|json|md|pdf)$/i;
    const allowedMimeTypes = /image\/|video\/|audio\/|text\/plain|application\/json|application\/pdf/i;

    const fileExtension = path.extname(file.originalname);
    const isMimeAllowed = allowedMimeTypes.test(file.mimetype);
    const isExtensionAllowed = allowedExtensions.test(fileExtension);

    if (isMimeAllowed && isExtensionAllowed) {
        cb(null, true); // Aceptar el archivo
    } else {
        console.warn(`[Multer] Archivo rechazado por tipo/extensión: ${file.originalname} (MIME: ${file.mimetype}, Ext: ${fileExtension})`);
        // Rechazar el archivo (no guardarlo)
        cb(new Error('Tipo de archivo no permitido.'), false);
    }
};

// Configuración de Multer
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB (Ajustar según necesidad y recursos)

const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE_BYTES // Límite de tamaño del archivo
    },
    fileFilter: fileFilter // Aplicar el filtro de tipos
 });

module.exports = upload; // Exportar la instancia configurada de multer
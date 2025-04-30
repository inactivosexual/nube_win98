// src/controllers/filesystemController.js

const db = require('../config/db');      // Pool de conexiones MySQL
const fs = require('fs').promises;     // Módulo FileSystem con promesas
const path = require('path');          // Módulo Path para manejar rutas

// Directorio base donde se guardan los archivos de los usuarios
const UPLOADS_BASE_DIR = path.join(__dirname, '..', '..', 'uploads');

/**
 * Convierte una ruta absoluta del servidor a una ruta relativa a la carpeta 'uploads'.
 * Utilizada para almacenar en la BD. Normaliza a slashes '/'.
 * @param {string} absolutePath - Ruta absoluta del archivo en el servidor.
 * @returns {string} - Ruta relativa (ej: 'user_123/files/myfile.txt').
 */
function getRelativePath(absolutePath) {
    return path.relative(UPLOADS_BASE_DIR, absolutePath).replace(/\\/g, '/');
}

/**
 * Convierte una ruta relativa (desde la BD) a una ruta absoluta en el servidor.
 * @param {string} relativePath - Ruta relativa almacenada en la BD.
 * @returns {string} - Ruta absoluta en el sistema de archivos del servidor.
 */
function getAbsolutePath(relativePath) {
    // Validar que relativePath no intente salirse de uploads (seguridad básica)
    const safeRelativePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
     if (safeRelativePath !== relativePath) {
          console.warn(`[FS Controller] Posible intento de Path Traversal bloqueado en getAbsolutePath: ${relativePath}`);
          // Podrías lanzar un error aquí o devolver una ruta inválida
          // throw new Error("Ruta relativa inválida detectada.");
     }
    return path.join(UPLOADS_BASE_DIR, safeRelativePath);
}

/** Obtiene información de almacenamiento del usuario (helper). */
async function getUserStorageInfo(userId, connection = db) { // Permite pasar una conexión de transacción
    const [users] = await connection.query('SELECT storage_used, storage_quota FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
        throw new Error(`Usuario con ID ${userId} no encontrado para verificar cuota.`);
    }
    return users[0];
}

/** Controlador para obtener los items dentro de una carpeta o el escritorio. */
exports.getItems = async (req, res) => {
    const userId = req.userId; // Añadido por checkAuth
    // Obtener parentId del query string, convertir a número o null
    let parentId = req.query.parentId === 'null' || req.query.parentId === undefined ? null : parseInt(req.query.parentId, 10);

    // Validar que si no es null, sea un número válido
    if (req.query.parentId !== 'null' && req.query.parentId !== undefined && isNaN(parentId)) {
       console.warn(`[FS GetItems] Parent ID inválido recibido: ${req.query.parentId}. Tratando como escritorio.`);
       parentId = null; // O devolver error 400 Bad Request
       // return res.status(400).json({ message: 'Parent ID inválido.' });
    }

    console.log(`[FS GetItems] Solicitud para User ID: ${userId}, Parent ID: ${parentId}`);

    try {
        let query;
        let params = [userId];
    
        if (parentId === null) {
            // Consulta para el escritorio (parentId IS NULL) - CORREGIDA
            query = `SELECT
                         id, user_id, parent_id, item_type, name,
                         file_path,      
                         mime_type,
                         original_name,
                         size,
                         target_url,
                         icon_path,
                         created_at,
                         updated_at
                     FROM filesystem_items
                     WHERE user_id = ? AND parent_id IS NULL
                     ORDER BY item_type, name`;
        } else {
            // Consulta para una carpeta específica
            const [parentCheck] = await db.query('SELECT id FROM filesystem_items WHERE id = ? AND user_id = ? AND item_type = "FOLDER"', [parentId, userId]);
            if (parentCheck.length === 0) {
                // ... (manejo de error 404) ...
                return res.status(404).json({ message: 'Carpeta no encontrada o acceso denegado.' });
            }
            // Consulta para contenido de carpeta - CORREGIDA
            query = `SELECT
                         id, user_id, parent_id, item_type, name,
                         file_path,       
                         mime_type,
                         original_name,
                         size,
                         target_url,
                         icon_path,
                         created_at,
                         updated_at
                     FROM filesystem_items
                     WHERE user_id = ? AND parent_id = ?
                     ORDER BY item_type, name`;
            params.push(parentId);
        }

        // Ejecutar la consulta principal
        const [items] = await db.query(query, params);

        // Procesar resultados para añadir URLs completas para el frontend
        const itemsWithUrls = items.map(item => {
            // Construir URLs relativas al servidor raíz para archivos e iconos
            const filePathUrl = (item.item_type === 'FILE' && item.file_path) ? `/uploads/${item.file_path}` : null;
            const iconPathUrl = (item.item_type === 'SHORTCUT' && item.icon_path) ? `/uploads/${item.icon_path}` : null;

            console.log(`[getItems Map] Procesando Item ID ${item.id}: type=${item.item_type}, file_path=${item.file_path}, filePathUrl=${filePathUrl}`);

            return {
                ...item, // Mantener todos los datos originales
                filePathUrl: filePathUrl, // URL para acceder al archivo (si es FILE)
                iconPathUrl: iconPathUrl  // URL para acceder al icono (si es SHORTCUT con icono)
            };
        });

        res.status(200).json(itemsWithUrls);

    } catch (error) {
        console.error(`[FS GetItems] Error obteniendo items para User ID: ${userId}, Parent ID: ${parentId}`, error);
        res.status(500).json({ message: 'Error interno del servidor al obtener items.' });
    }
};


/** Controlador para crear una nueva carpeta. */
exports.createFolder = async (req, res) => {
    const userId = req.userId;
    const { name, parentId: parentIdStr } = req.body;

    // 1. Validar Nombre
    if (!name || name.trim() === '') {
        return res.status(400).json({ message: 'El nombre de la carpeta es requerido.' });
    }
    // Sanitizar nombre (ejemplo básico: reemplazar caracteres inválidos en Windows)
    const sanitizedName = name.replace(/[<>:"/\\|?*]/g, '_').trim().substring(0, 250); // Limitar longitud
    if (sanitizedName === '') {
         return res.status(400).json({ message: 'Nombre de carpeta inválido después de sanitizar.' });
    }

    // 2. Validar Parent ID
    const parentId = parentIdStr === 'null' || parentIdStr === undefined || parentIdStr === null ? null : parseInt(parentIdStr, 10);
    if (parentIdStr && isNaN(parentId)) {
         return res.status(400).json({ message: 'Parent ID inválido.' });
    }

     console.log(`[FS CreateFolder] Solicitud User: ${userId}, Name: ${sanitizedName}, Parent: ${parentId}`);

    const connection = await db.getConnection(); // Usar conexión para posible transacción

    try {
        await connection.beginTransaction();

        // 3. (Opcional pero recomendado) Verificar nombre duplicado en la misma carpeta/escritorio
        let checkQuery = 'SELECT id FROM filesystem_items WHERE user_id = ? AND name = ? AND parent_id ';
        checkQuery += (parentId === null) ? 'IS NULL' : '= ?';
        const checkParams = (parentId === null) ? [userId, sanitizedName] : [userId, sanitizedName, parentId];
        const [existing] = await connection.query(checkQuery, checkParams);
        if (existing.length > 0) {
            await connection.rollback();
            return res.status(409).json({ message: `Ya existe un item llamado '${sanitizedName}' en esta ubicación.` }); // 409 Conflict
        }

        // 4. Si tiene padre, verificar que el padre exista, sea carpeta y pertenezca al usuario
        if (parentId !== null) {
            const [parentFolder] = await connection.query('SELECT id FROM filesystem_items WHERE id = ? AND user_id = ? AND item_type = "FOLDER"', [parentId, userId]);
            if (parentFolder.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'La carpeta contenedora no existe o no tienes permiso.' });
            }
        }

        // 5. Insertar la nueva carpeta
        const insertQuery = 'INSERT INTO filesystem_items (user_id, parent_id, item_type, name) VALUES (?, ?, "FOLDER", ?)';
        const [result] = await connection.query(insertQuery, [userId, parentId, sanitizedName]);
        const newItemId = result.insertId;

        await connection.commit(); // Confirmar transacción

        console.log(`[FS CreateFolder] Carpeta creada: ID ${newItemId}, Name: ${sanitizedName}, Parent: ${parentId}`);
        // Devolver el item recién creado
        res.status(201).json({
            message: 'Carpeta creada exitosamente.',
            newItem: {
                id: newItemId,
                user_id: userId,
                parent_id: parentId,
                item_type: 'FOLDER',
                name: sanitizedName,
                // Añadir otros campos con valores por defecto si el frontend los espera
                size: 0,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

    } catch (error) {
        await connection.rollback(); // Revertir en caso de error
        console.error(`[FS CreateFolder] Error creando carpeta para User ID: ${userId}`, error);
        res.status(500).json({ message: 'Error interno del servidor al crear la carpeta.' });
    } finally {
        connection.release(); // Liberar la conexión
    }
};

/** Controlador para crear un acceso directo. */
exports.createShortcut = async (req, res) => {
    const userId = req.userId;
    const { name, targetUrl, parentId: parentIdStr } = req.body;
    const iconFile = req.file; // Archivo del icono subido por multer (si existe)

    // 1. Validar Inputs
    if (!name || name.trim() === '' || !targetUrl || targetUrl.trim() === '') {
        return res.status(400).json({ message: 'Nombre y URL de destino son requeridos.' });
    }
    const sanitizedName = name.replace(/[<>:"/\\|?*]/g, '_').trim().substring(0, 250);
    if (sanitizedName === '') {
        return res.status(400).json({ message: 'Nombre de acceso directo inválido.' });
    }
    // Validar URL (básica)
    try { new URL(targetUrl); } catch (_) { return res.status(400).json({ message: 'La URL de destino no es válida.' }); }

    const parentId = parentIdStr === 'null' || parentIdStr === undefined || parentIdStr === null ? null : parseInt(parentIdStr, 10);
    if (parentIdStr && isNaN(parentId)) {
         // Si se subió un icono, borrarlo porque la petición es inválida
         if (iconFile) await fs.unlink(iconFile.path).catch(e => console.error("Error borrando icono tras parentId inválido:", e));
         return res.status(400).json({ message: 'Parent ID inválido.' });
    }

    console.log(`[FS CreateShortcut] Solicitud User: ${userId}, Name: ${sanitizedName}, Parent: ${parentId}, Icono: ${iconFile ? 'Sí' : 'No'}`);

    let iconRelativePath = null;
    let iconSize = 0;

    if (iconFile) {
        iconRelativePath = getRelativePath(iconFile.path);
        iconSize = iconFile.size;
        // Validar tamaño del icono si es necesario (aparte del filtro de multer)
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 2. (Opcional) Verificar cuota si el icono ocupa espacio significativo
        if (iconSize > 0) {
             const { storage_used, storage_quota } = await getUserStorageInfo(userId, connection);
             if (storage_used + iconSize > storage_quota) {
                 await connection.rollback();
                 await fs.unlink(iconFile.path).catch(e => console.error("Error borrando icono tras exceso de cuota:", e));
                 return res.status(413).json({ message: 'No se pudo crear el acceso directo por falta de espacio para el icono.' });
             }
        }

        // 3. Verificar duplicados y existencia del padre (similar a createFolder)
        let checkQuery = 'SELECT id FROM filesystem_items WHERE user_id = ? AND name = ? AND parent_id ';
        checkQuery += (parentId === null) ? 'IS NULL' : '= ?';
        const checkParams = (parentId === null) ? [userId, sanitizedName] : [userId, sanitizedName, parentId];
        const [existing] = await connection.query(checkQuery, checkParams);
        if (existing.length > 0) {
            await connection.rollback();
            if (iconFile) await fs.unlink(iconFile.path).catch(e => console.error("Error borrando icono tras nombre duplicado:", e));
            return res.status(409).json({ message: `Ya existe un item llamado '${sanitizedName}' en esta ubicación.` });
        }
        if (parentId !== null) {
            const [parentFolder] = await connection.query('SELECT id FROM filesystem_items WHERE id = ? AND user_id = ? AND item_type = "FOLDER"', [parentId, userId]);
            if (parentFolder.length === 0) {
                await connection.rollback();
                 if (iconFile) await fs.unlink(iconFile.path).catch(e => console.error("Error borrando icono tras padre no encontrado:", e));
                return res.status(404).json({ message: 'La carpeta contenedora no existe o no tienes permiso.' });
            }
        }

        // 4. Insertar el Acceso Directo
        const insertQuery = `INSERT INTO filesystem_items
                             (user_id, parent_id, item_type, name, target_url, icon_path, size)
                             VALUES (?, ?, "SHORTCUT", ?, ?, ?, ?)`;
        const [result] = await connection.query(insertQuery, [userId, parentId, sanitizedName, targetUrl, iconRelativePath, iconSize]);
        const newItemId = result.insertId;

        // 5. Actualizar cuota si se añadió icono
        if (iconSize > 0) {
            await connection.query('UPDATE users SET storage_used = storage_used + ? WHERE id = ?', [iconSize, userId]);
        }

        await connection.commit();

        console.log(`[FS CreateShortcut] Shortcut creado: ID ${newItemId}, Name: ${sanitizedName}, Icon: ${iconRelativePath || 'Ninguno'}`);
        res.status(201).json({
            message: 'Acceso directo creado exitosamente.',
            newItem: { // Devolver datos completos para el frontend
                id: newItemId, user_id: userId, parent_id: parentId, item_type: 'SHORTCUT',
                name: sanitizedName, target_url: targetUrl, icon_path: iconRelativePath, size: iconSize,
                iconPathUrl: iconRelativePath ? `/uploads/${iconRelativePath}` : null,
                created_at: new Date(), updated_at: new Date()
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error(`[FS CreateShortcut] Error creando shortcut para User ID: ${userId}`, error);
        // Intentar borrar el icono subido si algo falló
        if (iconFile) {
            await fs.unlink(iconFile.path).catch(unlinkErr => console.error("Error borrando icono subido tras fallo de BD:", unlinkErr));
        }
        res.status(500).json({ message: 'Error interno del servidor al crear el acceso directo.' });
    } finally {
        connection.release();
    }
};

/** Controlador para subir un archivo. */
exports.uploadFile = async (req, res) => {
    const userId = req.userId;
    const { parentId: parentIdStr } = req.body;
    const uploadedFile = req.file; // Archivo subido por multer (ya está en disco temporalmente)

    // 1. Verificar que se subió un archivo
    if (!uploadedFile) {
        return res.status(400).json({ message: 'No se ha subido ningún archivo.' });
    }

    const fileSize = uploadedFile.size;
    const originalName = uploadedFile.originalname;
    const mimeType = uploadedFile.mimetype;
    const tempFilePath = uploadedFile.path; // Ruta temporal donde multer lo dejó

    console.log(`[FS UploadFile] Solicitud User: ${userId}, File: ${originalName}, Size: ${fileSize}, MIME: ${mimeType}, Parent: ${parentIdStr}`);


    // 2. Validar Parent ID
    const parentId = parentIdStr === 'null' || parentIdStr === undefined || parentIdStr === null ? null : parseInt(parentIdStr, 10);
    if (parentIdStr && isNaN(parentId)) {
         await fs.unlink(tempFilePath).catch(e => console.error("Error borrando archivo subido tras parentId inválido:", e));
         return res.status(400).json({ message: 'Parent ID inválido.' });
    }

    // 3. Determinar nombre final del item (sanitizado)
    let itemName = (req.body.name || originalName).replace(/[<>:"/\\|?*]/g, '_').trim().substring(0, 250);
    if (itemName === '') itemName = `archivo_${Date.now()}`; // Nombre por defecto si queda vacío

    // Obtener ruta relativa final (basada en el nombre generado por multer)
    const fileRelativePath = getRelativePath(tempFilePath);

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 4. VERIFICAR CUOTA DE ALMACENAMIENTO
        const { storage_used, storage_quota } = await getUserStorageInfo(userId, connection);
        if (storage_used + fileSize > storage_quota) {
            await connection.rollback();
            await fs.unlink(tempFilePath).catch(e => console.error("Error borrando archivo subido tras exceso de cuota:", e));
            const quotaMB = (storage_quota / (1024*1024)).toFixed(1);
            console.warn(`[FS UploadFile] Rechazado por cuota. User: ${userId}, Necesita: ${fileSize}, Usado: ${storage_used}, Cuota: ${storage_quota}`);
            return res.status(413).json({ // 413 Payload Too Large
                message: `No se pudo subir "${originalName}". Excederías tu cuota de ${quotaMB} MB.`,
                details: `Archivo (${formatBytes(fileSize)}) demasiado grande.` // Usar formatBytes de ui.js? No, mejor no depender.
             });
        }

        // 5. Verificar duplicados y existencia del padre (similar a createFolder)
        let checkQuery = 'SELECT id FROM filesystem_items WHERE user_id = ? AND name = ? AND parent_id ';
        checkQuery += (parentId === null) ? 'IS NULL' : '= ?';
        const checkParams = (parentId === null) ? [userId, itemName] : [userId, itemName, parentId];
        const [existing] = await connection.query(checkQuery, checkParams);
        if (existing.length > 0) {
            await connection.rollback();
            await fs.unlink(tempFilePath).catch(e => console.error("Error borrando archivo subido tras nombre duplicado:", e));
            return res.status(409).json({ message: `Ya existe un item llamado '${itemName}' en esta ubicación.` });
        }
        if (parentId !== null) {
            const [parentFolder] = await connection.query('SELECT id FROM filesystem_items WHERE id = ? AND user_id = ? AND item_type = "FOLDER"', [parentId, userId]);
            if (parentFolder.length === 0) {
                await connection.rollback();
                await fs.unlink(tempFilePath).catch(e => console.error("Error borrando archivo subido tras padre no encontrado:", e));
                return res.status(404).json({ message: 'La carpeta contenedora no existe o no tienes permiso.' });
            }
        }

        // 6. Insertar el registro del archivo en la BD
        const insertQuery = `INSERT INTO filesystem_items
                             (user_id, parent_id, item_type, name, file_path, mime_type, original_name, size)
                             VALUES (?, ?, "FILE", ?, ?, ?, ?, ?)`;
        const [result] = await connection.query(insertQuery, [userId, parentId, itemName, fileRelativePath, mimeType, originalName, fileSize]);
        const newItemId = result.insertId;

        // 7. Actualizar el espacio usado por el usuario
        await connection.query('UPDATE users SET storage_used = storage_used + ? WHERE id = ?', [fileSize, userId]);

        // 8. Confirmar transacción (¡el archivo ya está en disco gracias a multer!)
        await connection.commit();

        console.log(`[FS UploadFile] Archivo subido y registrado: ID ${newItemId}, Name: ${itemName}, Size: ${fileSize}`);
        res.status(201).json({
            message: 'Archivo subido exitosamente.',
            newItem: { // Devolver datos completos para el frontend
                id: newItemId, user_id: userId, parent_id: parentId, item_type: 'FILE',
                name: itemName, file_path: fileRelativePath, mime_type: mimeType, original_name: originalName, size: fileSize,
                filePathUrl: `/uploads/${fileRelativePath}`, // URL relativa al servidor
                created_at: new Date(), updated_at: new Date()
            }
        });

        // Opcional: Iniciar extracción de metadatos aquí (ej. duración video, tags mp3) en segundo plano

    } catch (error) {
        await connection.rollback();
        console.error(`[FS UploadFile] Error subiendo archivo para User ID: ${userId}`, error);
        // Importante: Intentar borrar el archivo físico que multer ya guardó si falló la BD
        await fs.unlink(tempFilePath).catch(unlinkErr => console.error("Error borrando archivo subido tras fallo de BD:", unlinkErr));
        res.status(500).json({ message: 'Error interno del servidor al procesar el archivo subido.' });
    } finally {
        connection.release();
    }
};


/** Controlador para eliminar un item. */
exports.deleteItem = async (req, res) => {
    const userId = req.userId;
    const itemId = parseInt(req.params.id, 10);

    // 1. Validar ID
    if (isNaN(itemId)) {
        return res.status(400).json({ message: 'ID de item inválido.' });
    }
    console.log(`[FS DeleteItem] Solicitud User: ${userId}, Item ID: ${itemId}`); // LOG D1

    const connection = await db.getConnection();
    console.log("[FS DeleteItem] Conexión DB obtenida."); // LOG D2

    try {
        await connection.beginTransaction();
        console.log("[FS DeleteItem] Transacción iniciada."); // LOG D3

        // 2. Obtener información del item y verificar propiedad
        console.log("[FS DeleteItem] Obteniendo información del item..."); // LOG D4
        const [items] = await connection.query(
            'SELECT id, user_id, item_type, file_path, icon_path, size FROM filesystem_items WHERE id = ?',
            [itemId]
         );

        if (items.length === 0) {
            await connection.rollback();
             console.warn(`[FS DeleteItem] Item ${itemId} no encontrado.`); // LOG D5a
            return res.status(404).json({ message: 'Item no encontrado.' });
        }
        const itemToDelete = items[0];
        console.log("[FS DeleteItem] Item encontrado:", JSON.stringify(itemToDelete)); // LOG D5b

        // Verificar propiedad
        if (itemToDelete.user_id !== userId) {
            await connection.rollback();
            console.warn(`[FS DeleteItem] Intento no autorizado. User: ${userId}, Item Owner: ${itemToDelete.user_id}`); // LOG D6
            return res.status(403).json({ message: 'No tienes permiso para borrar este item.' });
        }
         console.log("[FS DeleteItem] Verificación de propiedad OK."); // LOG D7

        // 3. Si es Carpeta, verificar si está vacía
        if (itemToDelete.item_type === 'FOLDER') {
             console.log(`[FS DeleteItem] Verificando si carpeta ${itemId} está vacía...`); // LOG D8a
            const [children] = await connection.query('SELECT id FROM filesystem_items WHERE parent_id = ? LIMIT 1', [itemId]);
            if (children.length > 0) {
                await connection.rollback();
                 console.log(`[FS DeleteItem] Intento de borrar carpeta no vacía: ${itemId}`); // LOG D8b
                return res.status(400).json({ message: 'No se puede borrar una carpeta que contiene elementos.' });
            }
             console.log(`[FS DeleteItem] Carpeta ${itemId} está vacía.`); // LOG D8c
        }

        // 4. Determinar rutas y tamaño a restar
        let sizeToDecrease = itemToDelete.size || 0;
        let fileToDeletePath = null;
        let iconToDeletePath = null;
        if (itemToDelete.item_type === 'FILE' && itemToDelete.file_path) fileToDeletePath = getAbsolutePath(itemToDelete.file_path);
        if (itemToDelete.item_type === 'SHORTCUT' && itemToDelete.icon_path) iconToDeletePath = getAbsolutePath(itemToDelete.icon_path);
        // (Podrías añadir lógica para obtener tamaño de icono si no está en 'size')
        console.log(`[FS DeleteItem] Tamaño a decrementar: ${sizeToDecrease}. Archivo a borrar: ${fileToDeletePath}. Icono a borrar: ${iconToDeletePath}`); // LOG D9

        // 5. Borrar el registro de la base de datos
        console.log(`[FS DeleteItem] Intentando DELETE FROM filesystem_items WHERE id = ${itemId}...`); // LOG D10
        const [deleteResult] = await connection.query('DELETE FROM filesystem_items WHERE id = ?', [itemId]);
        console.log("[FS DeleteItem] Resultado DELETE:", deleteResult); // LOG D11

        if (deleteResult.affectedRows === 0) {
            await connection.rollback();
            console.warn(`[FS DeleteItem] No se borró ninguna fila para Item ID: ${itemId}`); // LOG D12
            return res.status(404).json({ message: 'Item no encontrado al intentar borrar.' });
        }

        // 6. Actualizar la cuota de almacenamiento del usuario
        if (sizeToDecrease > 0) {
             console.log(`[FS DeleteItem] Intentando UPDATE users SET storage_used = GREATEST(0, storage_used - ${sizeToDecrease}) WHERE id = ${userId}...`); // LOG D13
            const [updateResult] = await connection.query('UPDATE users SET storage_used = GREATEST(0, storage_used - ?) WHERE id = ?', [sizeToDecrease, userId]);
             console.log("[FS DeleteItem] Resultado UPDATE quota:", updateResult); // LOG D14
             if (updateResult.affectedRows === 0) console.warn(`[FS DeleteItem] No se actualizó la cuota para el usuario ${userId}`); // Advertencia si no se actualiza
        } else {
             console.log("[FS DeleteItem] No se requiere actualización de cuota (tamaño 0)."); // LOG D15
        }

        // 7. Confirmar la transacción
        console.log("[FS DeleteItem] Intentando COMMIT..."); // LOG D16
        await connection.commit();
        console.log(`[FS DeleteItem] COMMIT exitoso. Item ${itemId} borrado de la BD.`); // LOG D17

        // 8. Borrar archivos físicos (DESPUÉS del commit)
        let unlinkError = null; // Para capturar errores de borrado físico
        try {
            if (fileToDeletePath) {
                 console.log(`[FS DeleteItem] Intentando fs.unlink(${fileToDeletePath})...`); // LOG D18
                await fs.unlink(fileToDeletePath);
                console.log(`[FS DeleteItem] Archivo físico borrado: ${fileToDeletePath}`); // LOG D19
            }
            if (iconToDeletePath) {
                 console.log(`[FS DeleteItem] Intentando fs.unlink(${iconToDeletePath})...`); // LOG D20
                await fs.unlink(iconToDeletePath);
                console.log(`[FS DeleteItem] Icono físico borrado: ${iconToDeletePath}`); // LOG D21
            }
        } catch (err) {
            unlinkError = err; // Guardar error para loggear pero no fallar la respuesta
            console.error(`[FS DeleteItem] Error durante fs.unlink para item ${itemId}:`, unlinkError); // LOG D22
        }

        // Enviar respuesta exitosa al cliente
        res.status(200).json({
             message: `Item ${itemId} borrado exitosamente.` + (unlinkError ? ' (Error borrando archivo físico)' : ''),
             deletedItemId: itemId
        });

    } catch (error) {
        console.error(`[FS DeleteItem] ¡ERROR en bloque TRY! Reverting transacción para item ${itemId}:`, error); // LOG D_ERR
        await connection.rollback();
        res.status(500).json({ message: 'Error interno del servidor al borrar el item.' });
    } finally {
         console.log("[FS DeleteItem] Liberando conexión DB."); // LOG D_FIN
        connection.release();
    }
};

// --- Controladores Opcionales (Implementar si es necesario) ---

// exports.renameItem = async (req, res) => { /* ... */ };
// exports.getFileContent = async (req, res) => { /* ... */ };
// exports.saveFileContent = async (req, res) => { /* ... */ };
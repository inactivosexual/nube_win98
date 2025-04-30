// =============================================
// public/js/api.js
// Cliente para la API del Backend (Win98 Simulator)
// =============================================

(function() { // Usar una IIFE para evitar contaminar el scope global innecesariamente, excepto lo que asignemos a window

    const API_BASE_URL = '/api'; // Ruta base para todas las llamadas API

    /**
     * Realiza una petición fetch a un endpoint de la API.
     * Maneja la configuración por defecto, el cuerpo (JSON o FormData),
     * y el parseo de respuestas JSON y errores.
     * @param {string} endpoint - El endpoint de la API (ej: '/auth/login').
     * @param {object} [options={}] - Opciones de configuración para fetch.
     * @param {string} [options.method] - Método HTTP (GET, POST, PUT, DELETE, etc.).
     * @param {object|FormData} [options.body] - Cuerpo de la petición.
     * @param {object} [options.headers] - Cabeceras adicionales.
     * @returns {Promise<any>} - Promesa que resuelve con los datos JSON de la respuesta o null.
     * @throws {Error} - Lanza un error estructurado si la petición falla.
     */
    async function request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const isFormData = options.body instanceof FormData;

        // Configuración por defecto para fetch
        const config = {
            method: options.method || (options.body ? 'POST' : 'GET'), // Default POST si hay body, sino GET
            headers: {
                // No añadir Content-Type si es FormData, el navegador lo hace con el boundary correcto
                ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
                'Accept': 'application/json', // Esperamos respuestas JSON
                ...options.headers, // Permitir sobrescribir o añadir cabeceras
            },
            // Añadir cuerpo solo si existe
            ...(options.body && { body: isFormData ? options.body : JSON.stringify(options.body) })
        };

        console.log(`[API Request] ${config.method} ${url}`, options.body instanceof FormData ? '(FormData)' : options.body || '');

        try {
            const response = await fetch(url, config);

            // --- Manejo de Errores HTTP ---
            if (!response.ok) {
                let errorData = { message: `Error HTTP ${response.status}: ${response.statusText}` };
                try {
                    // Intentar parsear el cuerpo del error, puede contener más detalles
                    const errorJson = await response.json();
                    // Combinar mensaje del servidor con el estado HTTP si existe
                    errorData = {
                         ...errorJson, // Incluir detalles del servidor (ej: { message: '...', details: '...' })
                         message: errorJson.message || errorData.message // Priorizar mensaje del servidor
                        };
                } catch (e) {
                    // Si el cuerpo del error no es JSON, usar el mensaje HTTP por defecto
                    console.warn(`[API Error] Respuesta de error no es JSON para ${config.method} ${url}. Status: ${response.status}`);
                }

                // Crear un objeto Error estándar pero con propiedades adicionales
                const error = new Error(errorData.message);
                error.status = response.status; // Añadir código de estado HTTP al error
                error.data = errorData;         // Añadir datos completos del error si se parsearon
                console.error(`[API Error] ${config.method} ${url} falló (${error.status}):`, error.message, error.data);
                throw error; // Lanzar el error para que sea capturado por el llamador
            }

            // --- Manejo de Respuestas Exitosas ---

            // Si la respuesta es 204 No Content (ej. DELETE exitoso sin cuerpo)
            if (response.status === 204) {
                console.log(`[API Response] ${config.method} ${url} - 204 No Content`);
                return null; // Devolver null o un objeto vacío indicando éxito sin datos
            }

            // Si la respuesta es exitosa y se espera contenido JSON
            try {
                const data = await response.json();
                console.log(`[API Response] ${config.method} ${url} - OK`, data);
                return data;
            } catch (e) {
                 console.error(`[API Error] Error parseando JSON para ${config.method} ${url}:`, e);
                 throw new Error("Respuesta inválida recibida del servidor."); // Lanzar error si el parseo falla
            }

        } catch (error) {
            // Capturar errores de red (ej. servidor caído) o los errores lanzados arriba
            console.error(`[API Fatal Error] Fallo en la petición ${config.method} ${url}:`, error);
            // Re-lanzar para que el código que llamó a 'request' pueda manejarlo
            // Asegurarse de que el error tenga un mensaje usable
            if (!(error instanceof Error)) { // Si no es ya un objeto Error
                 throw new Error(error || 'Error de red o petición desconocida');
            }
            throw error;
        }
    }

    // --- Objeto API de Autenticación ---
    const authAPI = {
        /** Inicia sesión de un usuario. */
        login: (username, password) => request('/auth/login', { body: { username, password } }),

        /** Registra un nuevo usuario. */
        register: (username, password) => request('/auth/register', { body: { username, password } }),

        /** Cierra la sesión del usuario actual. */
        logout: () => request('/auth/logout', { method: 'POST' }), // POST es más apropiado para cambiar estado

        /** Verifica si hay una sesión activa y devuelve datos del usuario. */
        checkStatus: () => request('/auth/status'),

        /** Obtiene información de almacenamiento (usado/cuota) del usuario logueado. */
        getStorageInfo: () => request('/auth/storage'),
    };

    // --- Objeto API del Sistema de Archivos ---
    const fsAPI = {
        /**
         * Obtiene los items (archivos/carpetas/shortcuts) dentro de una carpeta o del escritorio.
         * @param {number | null} [parentId=null] - ID de la carpeta padre, o null para el escritorio.
         */
        getItems: (parentId = null) => {
            const endpoint = `/filesystem/items${parentId !== null ? `?parentId=${encodeURIComponent(parentId)}` : ''}`;
            return request(endpoint);
        },

        /**
         * Crea una nueva carpeta.
         * @param {string} name - Nombre de la nueva carpeta.
         * @param {number | null} [parentId=null] - ID de la carpeta padre, o null para el escritorio.
         */
        createFolder: (name, parentId = null) => request('/filesystem/folder', {
            body: { name, parentId }
        }),

        /**
         * Crea un nuevo acceso directo.
         * @param {FormData} formData - Objeto FormData que debe contener 'name', 'targetUrl', opcionalmente 'parentId', y opcionalmente 'icon' (archivo).
         */
        createShortcut: (formData) => request('/filesystem/shortcut', {
            method: 'POST', // Asegurar POST
            body: formData // Pasar FormData directamente
            // No incluir header 'Content-Type' aquí
        }),

        /**
         * Sube un nuevo archivo.
         * @param {FormData} formData - Objeto FormData que debe contener 'file', y opcionalmente 'parentId' y 'name'.
         */
        uploadFile: (formData) => request('/filesystem/file', {
            method: 'POST', // Asegurar POST
            body: formData // Pasar FormData directamente
             // No incluir header 'Content-Type' aquí
        }),

        /**
         * Elimina un item (archivo, carpeta, shortcut) por su ID.
         * @param {number} itemId - ID del item a eliminar.
         */
        deleteItem: (itemId) => request(`/filesystem/item/${itemId}`, {
            method: 'DELETE'
        }),

        /* --- Opcionales (Descomentar e implementar si se necesitan) --- */

        /**
         * Renombra un item.
         * @param {number} itemId - ID del item a renombrar.
         * @param {string} newName - Nuevo nombre para el item.
         */
        // renameItem: (itemId, newName) => request(`/filesystem/item/${itemId}/rename`, {
        //     method: 'PUT',
        //     body: { newName }
        // }),

        /**
         * Obtiene el contenido textual de un archivo.
         * @param {number} itemId - ID del archivo de texto.
         * @returns {Promise<string>} - Promesa que resuelve con el contenido del archivo.
         */
        // getFileContent: async (itemId) => {
        //     // Nota: Esta API podría devolver texto plano, no JSON. Ajustar 'request' o manejar aquí.
        //     const response = await fetch(`${API_BASE_URL}/filesystem/item/${itemId}/content`);
        //     if (!response.ok) {
        //         // Manejo de error similar a 'request'
        //         const errorText = await response.text();
        //         const error = new Error(errorText || `Error ${response.status}`);
        //         error.status = response.status;
        //         throw error;
        //     }
        //     return await response.text();
        // },

        /**
         * Guarda (sobrescribe) el contenido textual de un archivo.
         * @param {number} itemId - ID del archivo de texto.
         * @param {string} content - Nuevo contenido para el archivo.
         */
        // saveFileContent: (itemId, content) => request(`/filesystem/item/${itemId}/content`, {
        //     method: 'PUT',
        //     headers: { 'Content-Type': 'text/plain' }, // Enviar como texto plano
        //     body: content // Enviar el string directamente
        // }),

    };

    // --- Exponer APIs Globalmente ---
    // Asignar los objetos al objeto window para que sean accesibles desde otros scripts (main.js, ui.js)
    window.authAPI = authAPI;
    window.fsAPI = fsAPI;

    console.log("api.js cargado. APIs disponibles en window.authAPI y window.fsAPI.");

})(); // Fin de la IIFE
// =============================================
// public/js/ui.js
// Funciones para manipular la Interfaz de Usuario (DOM)
// =============================================

// --- Variables Globales de Estado UI ---
let activeWindow = null;            // Referencia al elemento de la ventana activa
let highestZIndex = 10;             // Para traer ventanas al frente
const openWindows = new Map();      // Almacena ventanas abiertas: Map<windowId, { element: HTMLElement, item?: object, type: string, state: 'normal'|'minimized' }>
const openDialogs = new Map();      // Almacena diálogos modales abiertos (subconjunto de openWindows)
let currentContextMenu = {          // Información sobre el menú contextual actual
    targetItem: null,
    targetType: null, // 'desktop', 'item', 'folder-view'
    parentId: null    // Para contexto de 'folder-view'
};
let selectedIconElement = null; // Referencia al icono seleccionado actualmente


// --- Elementos Globales Frecuentes ---
const desktopElement = document.getElementById('desktop');
const taskbarWindowsContainer = document.getElementById('taskbar-windows');
const contextMenuElement = document.getElementById('context-menu');
const clockElement = document.getElementById('clock');
const storageTextElement = document.getElementById('storage-text');
const storageIndicatorElement = document.getElementById('storage-indicator');
const startMenuElement = document.getElementById('start-menu');
const startButtonElement = document.getElementById('start-button');

// --- Funciones Auxiliares (Helpers) ---

/**
 * Determina la ruta del icono a mostrar para un item del sistema de archivos.
 * @param {object} item - El objeto del item del filesystem.
 * @returns {string} - La ruta relativa a la imagen del icono.
 */
function getIconPath(item) {
    // Prioridad 1: Icono personalizado del Acceso Directo
    if (item.item_type === 'SHORTCUT' && item.iconPathUrl) {
        return item.iconPathUrl; // URL ya preparada por el backend (ej: /uploads/user_1/icons/...)
    }

    // Prioridad 2: Basado en el tipo de item
    switch (item.item_type) {
        case 'FOLDER':
            return 'images/folder.png'; // Icono genérico carpeta
        case 'FILE':
            // Lógica basada en mime_type (simplificada)
            const mime = item.mime_type || '';
            if (mime.startsWith('video/')) return 'images/video_file.png'; // Necesitas 'video_file.png'
            if (mime.startsWith('audio/')) return 'images/audio_file.png'; // Necesitas 'audio_file.png'
            if (mime.startsWith('image/')) return 'images/image_file.png'; // Necesitas 'image_file.png'
            if (mime === 'text/plain') return 'images/text_file.png';   // Necesitas 'text_file.png'
            if (mime === 'application/pdf') return 'images/pdf_file.png';     // Necesitas 'pdf_file.png'
            // Puedes añadir más tipos (zip, doc, etc.)
            return 'images/file.png'; // Icono genérico archivo por defecto
        case 'SHORTCUT':
            return 'images/shortcut.png'; // Icono genérico shortcut si no tiene personalizado
        default:
            return 'images/unknown.png'; // Icono para tipos desconocidos
    }
}

/**
 * Formatea un número de bytes a una cadena legible (KB, MB, GB).
 * @param {number} bytes - Número de bytes.
 * @param {number} [decimals=1] - Número de decimales a mostrar.
 * @returns {string} - Cadena formateada (ej: "1.5GB").
 */
function formatBytes(bytes, decimals = 1) {
    if (bytes === 0 || typeof bytes !== 'number' || isNaN(bytes)) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']; // Añadir más si es necesario
    // Calcular índice, limitado por el array sizes
    let i = Math.max(0, Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1));
    // Evitar mostrar 0.0 GB si es menos de 1 GB
    if (i > 2 && bytes < Math.pow(k, i)) {
        i--;
    }
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + sizes[i];
}
function toggleStartMenu() {
    if (!startMenuElement || !startButtonElement) return;

    const isVisible = startMenuElement.style.display !== 'none';
    if (isVisible) {
        hideStartMenu();
    } else {
        // Calcular posición justo encima del botón Inicio
        const taskbarHeight = document.getElementById('taskbar')?.offsetHeight || 28;
        startMenuElement.style.bottom = `${taskbarHeight}px`;
        startMenuElement.style.left = '2px'; // Pequeño margen izquierdo
        startMenuElement.style.display = 'flex'; // Usar flex por el banner
        startButtonElement.classList.add('active'); // Marcar botón como presionado

        // Opcional: Poner foco en el primer item (si es necesario)
        // startMenuElement.querySelector('.start-menu-items button')?.focus();
    }
}

/** Oculta el Menú Inicio. */
function hideStartMenu() {
    if (startMenuElement) {
        startMenuElement.style.display = 'none';
    }
    if (startButtonElement) {
         startButtonElement.classList.remove('active'); // Quitar estado activo del botón
    }
}

// --- Fondos de Pantalla (Ejemplo Básico) ---
const wallpapers = [
    { type: 'color', value: '#008080' }, // Teal (Default)
    { type: 'color', value: '#000000' }, // Negro
    { type: 'color', value: '#5a7edc' }, // Azul XP (por variar)
    { type: 'image', value: 'url("images/wallpaper_1.png")' }, // Necesitas 'wallpaper_clouds.png'
    { type: 'image', value: 'url("images/wallpaper_2.png")' }, // Necesitas 'wallpaper_bliss.png' (Estilo XP)
];
let currentWallpaperIndex = 0;

/** Cambia al siguiente fondo de pantalla de la lista. */
function handleChangeWallpaper() {
    if (!desktopElement) return;

    currentWallpaperIndex = (currentWallpaperIndex + 1) % wallpapers.length; // Ciclar índice
    const nextWallpaper = wallpapers[currentWallpaperIndex];

    console.log("Cambiando fondo a:", nextWallpaper);

    // Limpiar estilos anteriores
    desktopElement.style.backgroundColor = '';
    desktopElement.style.backgroundImage = '';

    // Aplicar nuevo estilo
    if (nextWallpaper.type === 'color') {
        desktopElement.style.backgroundColor = nextWallpaper.value;
    } else if (nextWallpaper.type === 'image') {
        desktopElement.style.backgroundImage = nextWallpaper.value;
        desktopElement.style.backgroundSize = 'cover'; // Ajustar imagen
        desktopElement.style.backgroundPosition = 'center';
    }

    // TODO (Opcional Avanzado): Guardar preferencia del usuario en BD/LocalStorage
}

/**
 * Establece una ventana como activa, actualizando estilos y z-index.
 * @param {HTMLElement | null} windowElement - El elemento de la ventana a activar, o null para desactivar todas.
 */
function setActiveWindow(windowElement) {
    // Desactivar la ventana anteriormente activa
    if (activeWindow && activeWindow !== windowElement) {
        activeWindow.classList.remove('active');
        activeWindow.querySelector('.title-bar')?.classList.add('inactive');
        const oldTaskbarButton = document.getElementById(`task-${activeWindow.dataset.windowId}`);
        oldTaskbarButton?.classList.remove('active');
    }

    function applyWallpaper(preference) {
        if (!desktopElement) return;
        console.log("Aplicando preferencia de fondo:", preference);
    
        let wallpaperToApply = wallpapers[0]; // Default: Teal
    
        if (preference) {
             const found = wallpapers.find(w => w.saveValue === preference);
             if (found) {
                 wallpaperToApply = found;
                 // Actualizar índice actual para que el próximo cambio sea el siguiente
                 currentWallpaperIndex = wallpapers.findIndex(w => w.saveValue === preference);
             } else {
                  console.warn(`Fondo guardado '${preference}' no encontrado en la lista local. Usando default.`);
             }
        }
    
         // Limpiar estilos anteriores
         desktopElement.style.backgroundColor = '';
         desktopElement.style.backgroundImage = '';
         desktopElement.style.backgroundSize = '';
         desktopElement.style.backgroundPosition = '';
    
         // Aplicar nuevo estilo
         if (wallpaperToApply.type === 'color') {
             desktopElement.style.backgroundColor = wallpaperToApply.value;
         } else if (wallpaperToApply.type === 'image') {
             desktopElement.style.backgroundImage = wallpaperToApply.value;
             desktopElement.style.backgroundSize = 'cover';
             desktopElement.style.backgroundPosition = 'center';
         }
    }
    // Activar la nueva ventana
    if (windowElement && openWindows.has(windowElement.dataset.windowId)) {
        highestZIndex++;
        windowElement.style.zIndex = highestZIndex;
        windowElement.classList.add('active');
        windowElement.querySelector('.title-bar')?.classList.remove('inactive');
        activeWindow = windowElement;

        // Activar su botón en la barra de tareas
        const newTaskbarButton = document.getElementById(`task-${windowElement.dataset.windowId}`);
        newTaskbarButton?.classList.add('active');

        // Opcional: Poner foco en algún elemento dentro de la ventana si es apropiado
        // windowElement.focus(); // El div principal puede no ser enfocable
    } else {
        activeWindow = null; // Ninguna ventana activa
    }
}


// --- Renderizado de Iconos ---

/**
 * Limpia un contenedor y renderiza los iconos de los items proporcionados.
 * @param {Array<object>} items - Array de objetos de items del filesystem.
 * @param {HTMLElement} containerElement - El elemento DOM donde renderizar los iconos (ej. #desktop o .folder-content).
 * @param {boolean} [isDesktop=false] - Indica si se está renderizando en el escritorio (afecta estilo de texto).
 */
function renderIcons(items, containerElement, isDesktop = false) {
    if (!containerElement) {
        console.error("[renderIcons] Error: containerElement es nulo.");
        return;
    }
    console.log(`[renderIcons] Renderizando ${items?.length || 0} items en ${isDesktop ? 'Escritorio' : 'Carpeta'}. Contenedor:`, containerElement);
    containerElement.innerHTML = ''; // Limpiar contenido anterior

    if (!items || items.length === 0) {
        if (!isDesktop) {
            // Mostrar mensaje "Carpeta Vacía" solo dentro de carpetas
            containerElement.innerHTML = '<i class="empty-folder-indicator">Esta carpeta está vacía.</i>';
        }
        return;
    }

    const iconTemplate = document.getElementById('icon-template');
    if (!iconTemplate) {
        console.error("[renderIcons] Error: Template '#icon-template' no encontrado.");
        containerElement.innerHTML = '<i class="error-indicator">Error de plantilla de icono</i>';
        return;
    }

    // Crear fragmento para mejorar rendimiento al añadir muchos iconos
    const fragment = document.createDocumentFragment();

    items.forEach(item => {
        try {
            const clone = iconTemplate.content.cloneNode(true);
            const iconDiv = clone.querySelector('.desktop-icon');
            const img = iconDiv.querySelector('img');
            const span = iconDiv.querySelector('.icon-text');

            // Configurar datos y atributos
            iconDiv.dataset.itemId = item.id;
            iconDiv.dataset.itemType = item.item_type;
            iconDiv.dataset.itemName = item.name; // Guardar nombre para posible renombrado
            // Guardar datos adicionales necesarios para abrir el item
            if (item.item_type === 'FILE') {
                iconDiv.dataset.filePathUrl = item.filePathUrl || ''; // URL servida segura
                iconDiv.dataset.mimeType = item.mime_type || '';
                iconDiv.dataset.originalName = item.original_name || item.name; // Para descarga
            } else if (item.item_type === 'SHORTCUT') {
                iconDiv.dataset.targetUrl = item.target_url || '';
            }

            img.src = getIconPath(item);
            img.alt = item.name;
            img.onerror = () => { img.src = 'images/unknown.png'; }; // Fallback si el icono falla
            span.textContent = item.name;
            iconDiv.title = item.name; // Tooltip básico

            // Añadir clase si no es escritorio (para estilo de texto/fondo)
            if (!isDesktop) {
                iconDiv.classList.add('folder-icon');
            }
            console.log(`[renderIcons] Item para listener dblclick (ID: ${item.id}):`, JSON.stringify(item)); // LOG ADICIONAL

            // --- Event Listeners para cada Icono ---
            iconDiv.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                handleOpenItem(item);
            });

            iconDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                // Deseleccionar otros iconos y seleccionar este
                deselectAllIcons();
                iconDiv.classList.add('selected');
                selectedIconElement = iconDiv;
                // iconDiv.focus(); // Dar foco al icono
            });

            iconDiv.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                deselectAllIcons(); // Deseleccionar otros
                iconDiv.classList.add('selected'); // Seleccionar este
                selectedIconElement = iconDiv;
                // iconDiv.focus();
                showContextMenu(e.clientX, e.clientY, 'item', item); // Mostrar menú para este item
            });

            iconDiv.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleOpenItem(item);
                }
                if (e.key === 'Delete') {
                    e.preventDefault();
                     // Asegurarse que el item está seleccionado visualmente
                    if (!iconDiv.classList.contains('selected')) {
                        deselectAllIcons();
                        iconDiv.classList.add('selected');
                        selectedIconElement = iconDiv;
                    }
                    handleDeleteItem(item);
                }
                // Añadir más navegación por teclado si se desea (F2 para renombrar, flechas)
            });

            fragment.appendChild(iconDiv);

        } catch (error) {
            console.error("[renderIcons] Error procesando item:", item, error);
            // Opcional: añadir un elemento de error al fragmento
        }
    });

    // Añadir todos los iconos al contenedor de una vez
    containerElement.appendChild(fragment);

    // Limpiar selección si se hace clic fuera de un icono, dentro del contenedor
    containerElement.addEventListener('click', (e) => {
        if (e.target === containerElement) {
            deselectAllIcons();
        }
    });
}

/** Deselecciona todos los iconos actualmente seleccionados. */
function deselectAllIcons() {
    document.querySelectorAll('.desktop-icon.selected').forEach(el => el.classList.remove('selected'));
    selectedIconElement = null;
}


// --- Manejo de Ventanas ---

let windowIdCounter = 0; // Contador simple para IDs únicos de ventana

/**
 * Crea y muestra una nueva ventana en el escritorio.
 * @param {object} options - Opciones de configuración de la ventana.
 * @param {string} [options.title='Ventana'] - Título de la ventana.
 * @param {HTMLElement} [options.contentElement=null] - Elemento DOM a insertar en el cuerpo.
 * @param {number} [options.width=400] - Ancho inicial.
 * @param {number} [options.height=300] - Alto inicial.
 * @param {number} [options.x] - Posición X inicial (si no, se centra).
 * @param {number} [options.y] - Posición Y inicial (si no, se centra).
 * @param {string} [options.type='generic'] - Tipo de ventana ('folder', 'file', 'dialog', etc.).
 * @param {object} [options.associatedItem=null] - El item del filesystem asociado a esta ventana.
 * @param {string} [options.icon='images/unknown.png'] - Icono para la barra de título (opcional).
 * @returns {HTMLElement | null} El elemento de la ventana creada o null si falla.
 */
function createWindow(options = {}) {
    const {
        title = 'Ventana',
        contentElement = null,
        width = 400,
        height = 300,
        x,
        y,
        type = 'generic',
        associatedItem = null,
        icon = null // Ruta al icono de la barra de título
    } = options;

    // --- Evitar Duplicados (si aplica y se desea) ---
    // Si es una ventana asociada a un item (ej. una carpeta), no abrir duplicados.
     if (associatedItem && associatedItem.id && type !== 'dialog') { // No aplicar a diálogos
         for (const [id, winData] of openWindows.entries()) {
              // Comprobar si ya hay una ventana abierta para el mismo item Y del mismo tipo
              if (winData.item?.id === associatedItem.id && winData.type === type) {
                   console.log(`Ventana para item ${associatedItem.id} (tipo ${type}) ya existe. Activando.`);
                   // Si está minimizada, restaurar, sino solo activar.
                   if (winData.state === 'minimized') {
                       restoreWindow(id);
                   } else {
                       setActiveWindow(winData.element);
                   }
                   return winData.element; // Devolver la ventana existente
              }
         }
     }

    // --- Crear Ventana desde Template ---
    const windowTemplate = document.getElementById('window-template');
    if (!windowTemplate) {
        console.error("¡Error crítico! No se encontró la plantilla '#window-template'.");
        showErrorMessage('Error interno: Falta la plantilla de ventana.');
        return null;
    }

    const templateContent = windowTemplate.content.cloneNode(true);
    const windowElement = templateContent.querySelector('.win98-window');
    if (!windowElement) {
         console.error("¡Error crítico! El template de ventana no contiene '.win98-window'.");
         showErrorMessage('Error interno: Plantilla de ventana inválida.');
         return null;
    }

    // --- Configurar Ventana ---
    windowIdCounter++;
    const windowId = `win-${windowIdCounter}`;
    windowElement.id = windowId;
    windowElement.dataset.windowId = windowId; // Guardar ID para referencia futura
    windowElement.style.width = `${width}px`;
    windowElement.style.height = `${height}px`;

    // Posición inicial: Centrada si no se especifican X/Y
    const taskbarHeight = document.getElementById('taskbar')?.offsetHeight || 30;
    const desktopWidth = desktopElement.offsetWidth;
    const desktopHeight = desktopElement.offsetHeight;

    let initialX = x !== undefined ? x : Math.max(5, (desktopWidth - width) / 2);
    let initialY = y !== undefined ? y : Math.max(5, (desktopHeight - height) / 3); // Un poco más arriba

    // Asegurar que no empiece fuera de pantalla
    initialX = Math.min(initialX, desktopWidth - 50); // Dejar al menos 50px visibles
    initialY = Math.min(initialY, desktopHeight - 30); // Dejar al menos 30px visibles

    windowElement.style.left = `${initialX}px`;
    windowElement.style.top = `${initialY}px`;

    // Configurar Barra de Título
    const titleBarText = windowElement.querySelector('.title-bar-text');
    if (titleBarText) titleBarText.textContent = title;
    // Añadir icono a barra de título (opcional)
    if (icon) {
        const titleBar = windowElement.querySelector('.title-bar');
        const iconElement = document.createElement('img');
        iconElement.src = icon;
        iconElement.alt = '';
        iconElement.className = 'title-bar-icon'; // Necesita estilo CSS
        iconElement.width = 16; iconElement.height = 16;
        titleBar?.insertBefore(iconElement, titleBarText); // Insertar antes del texto
    }


    // Añadir Contenido
    const windowBody = windowElement.querySelector('.window-body');
    if (windowBody && contentElement) {
        windowBody.appendChild(contentElement);
    } else if (!windowBody) {
         console.warn(`Ventana ${windowId} no tiene .window-body`);
    }

    // Añadir al DOM (dentro del escritorio)
    desktopElement.appendChild(windowElement);

    // Registrar Ventana Abierta
    const windowData = {
        element: windowElement,
        item: associatedItem,
        type: type,
        state: 'normal' // Estado inicial
    };
    openWindows.set(windowId, windowData);
    if (type === 'dialog') {
        openDialogs.set(windowId, windowData); // Registrar también como diálogo modal
    }

    // Hacerla Activa y Añadir a Barra de Tareas
    setActiveWindow(windowElement); // Ponerla al frente
    createTaskbarButton(windowId, title, icon || getIconPath(associatedItem) || 'images/unknown.png'); // Usar icono si existe

    // --- Listeners de la Ventana ---
    windowElement.addEventListener('mousedown', (e) => {
        // Activar ventana al hacer clic en cualquier parte de ella (excepto botones de control)
        if (!e.target.closest('.title-bar-controls')) {
             setActiveWindow(windowElement);
        }
    }, true); // Usar captura para asegurar que se active antes que otros listeners internos

    // Botones de Control (Cerrar, Minimizar, Maximizar)
    const closeButton = windowElement.querySelector('.btn-close');
    closeButton?.addEventListener('click', (e) => {
        e.stopPropagation(); // Evitar que el mousedown active la ventana justo antes de cerrar
        closeWindow(windowId);
    });

    const minimizeButton = windowElement.querySelector('.btn-minimize');
    minimizeButton?.addEventListener('click', (e) => {
         e.stopPropagation();
         minimizeWindow(windowId);
    });

    const maximizeButton = windowElement.querySelector('.btn-maximize');
   // maximizeButton?.addEventListener('click', (e) => {
    //     e.stopPropagation();
         // TODO: Implementar lógica de maximizar/restaurar
    //     showErrorMessage('Maximizar aún no está implementado.');
   // });

    // Hacer la ventana arrastrable
    makeDraggable(windowElement);

    console.log(`Ventana ${windowId} ('${title}') creada.`);
    return windowElement; // Devolver el elemento de la ventana
}

/** Cierra una ventana, eliminándola del DOM y de los registros. */
function closeWindow(windowId) {
    const windowData = openWindows.get(windowId);
    if (!windowData) {
        console.warn(`Intento de cerrar ventana inexistente: ${windowId}`);
        return;
    }

    console.log(`Cerrando ventana ${windowId} ('${windowData.element.querySelector('.title-bar-text')?.textContent}')`);
    windowData.element.remove(); // Eliminar del DOM
    openWindows.delete(windowId); // Eliminar del registro general
    if (openDialogs.has(windowId)) {
         openDialogs.delete(windowId); // Eliminar del registro de diálogos
    }
    removeTaskbarButton(windowId); // Eliminar de la barra de tareas

    // Si la ventana cerrada era la activa, buscar la siguiente para activar
    if (activeWindow === windowData.element) {
        activeWindow = null; // Limpiar la activa
        // Encontrar la ventana con el z-index más alto restante
        let nextActiveWindow = null;
        let maxZ = 0;
        for (const [id, data] of openWindows.entries()) {
            if (data.state === 'normal') { // Solo considerar ventanas visibles
                 const currentZ = parseInt(data.element.style.zIndex || '0', 10);
                 if (currentZ > maxZ) {
                     maxZ = currentZ;
                     nextActiveWindow = data.element;
                 }
            }
        }
        if (nextActiveWindow) {
            setActiveWindow(nextActiveWindow); // Activar la siguiente
        }
    }
}

/** Minimiza una ventana (la oculta y actualiza su estado). */
function minimizeWindow(windowId) {
     const windowData = openWindows.get(windowId);
     if (windowData && windowData.state !== 'minimized') {
         console.log(`Minimizando ventana ${windowId}`);
         windowData.element.style.display = 'none'; // Ocultar
         windowData.state = 'minimized';
         // Desactivar visualmente botón en taskbar
         const taskbarButton = document.getElementById(`task-${windowId}`);
         taskbarButton?.classList.remove('active');

         // Si era la ventana activa, activar la siguiente (misma lógica que en closeWindow)
         if (activeWindow === windowData.element) {
             activeWindow = null;
             let nextActiveWindow = null;
             let maxZ = 0;
              for (const [id, data] of openWindows.entries()) {
                if (data.state === 'normal') {
                     const currentZ = parseInt(data.element.style.zIndex || '0', 10);
                     if (currentZ > maxZ) {
                         maxZ = currentZ;
                         nextActiveWindow = data.element;
                     }
                }
             }
             if (nextActiveWindow) setActiveWindow(nextActiveWindow);
         }
     }
}

/** Restaura una ventana minimizada (la muestra y activa). */
function restoreWindow(windowId) {
     const windowData = openWindows.get(windowId);
     if (windowData && windowData.state === 'minimized') {
         console.log(`Restaurando ventana ${windowId}`);
         windowData.element.style.display = 'flex'; // Mostrar (asumiendo flex)
         windowData.state = 'normal';
         setActiveWindow(windowData.element); // Hacerla activa
     } else if (windowData && windowData.state === 'normal') {
          // Si ya está normal pero no activa, solo activarla
          setActiveWindow(windowData.element);
     }
}

/** Añade un botón a la barra de tareas para una ventana. */
function createTaskbarButton(windowId, title, iconSrc = 'images/unknown.png') {
     if (!taskbarWindowsContainer) return;

     const button = document.createElement('button');
     button.id = `task-${windowId}`;
     button.className = 'win98-button taskbar-button';
     button.title = title; // Tooltip

     // Añadir icono al botón de taskbar
     const icon = document.createElement('img');
     icon.src = iconSrc;
     icon.alt = '';
     icon.width = 16; icon.height = 16;
     icon.style.marginRight = '4px';
     icon.onerror = () => { icon.src = 'images/unknown.png'; }; // Fallback
     button.appendChild(icon);

     // Añadir texto
     const textSpan = document.createElement('span');
     textSpan.textContent = title;
     button.appendChild(textSpan);

     // Lógica de Clic en Taskbar Button:
     button.addEventListener('click', () => {
         const windowData = openWindows.get(windowId);
         if (windowData) {
             if (windowData.state === 'minimized') {
                 restoreWindow(windowId); // Si minimizada, restaurar y activar
             } else { // Si visible
                 if (activeWindow === windowData.element) {
                     minimizeWindow(windowId); // Si ya activa, minimizar
                 } else {
                     setActiveWindow(windowData.element); // Si no activa, activar
                 }
             }
         }
     });
     taskbarWindowsContainer.appendChild(button);

     // Marcar como activo si la ventana recién creada es la activa
     const windowData = openWindows.get(windowId);
     if (windowData && activeWindow === windowData.element) {
        button.classList.add('active');
     }
}

/** Elimina el botón de una ventana de la barra de tareas. */
function removeTaskbarButton(windowId) {
     const button = document.getElementById(`task-${windowId}`);
     if (button) button.remove();
}


// --- Funcionalidad Arrastrar Ventanas ---
function makeDraggable(element) {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    // El "handle" es el elemento que inicia el arrastre (la barra de título)
    const handle = element.querySelector('.draggable-handle') || element;

    const onMouseDown = (e) => {
        // Solo arrastrar con botón izquierdo y sobre el handle
        if (e.button !== 0 || !handle.contains(e.target)) return;

        isDragging = true;
        // Coordenadas iniciales del ratón
        startX = e.clientX;
        startY = e.clientY;
        // Posición inicial del elemento (respecto a su offsetParent)
        initialX = element.offsetLeft;
        initialY = element.offsetTop;

        element.classList.add('dragging'); // Estilo visual mientras se arrastra
        // Añadir listeners al documento para capturar movimiento fuera del handle
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        // Prevenir selección de texto durante arrastre
        document.body.style.userSelect = 'none';
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault(); // Prevenir comportamiento por defecto (selección)

        // Calcular nueva posición
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let newX = initialX + dx;
        let newY = initialY + dy;

        // --- Limitar movimiento dentro del escritorio ---
        const desktopRect = desktopElement.getBoundingClientRect();
        const taskbarHeight = document.getElementById('taskbar')?.offsetHeight || 0;
        const windowRect = element.getBoundingClientRect();

        // No permitir que la barra de título se salga por arriba
        newY = Math.max(0, newY);
        // No permitir que la ventana se vaya completamente por la izquierda/derecha
        newX = Math.max(-(element.offsetWidth - 40), newX); // Dejar 40px visibles a la izq
        newX = Math.min(desktopRect.width - 40, newX);      // Dejar 40px visibles a la der

        // No permitir que se meta demasiado debajo de la taskbar
        // (Considerar el alto de la ventana)
        const maxY = desktopRect.height - taskbarHeight - (handle.offsetHeight || 20); // Evitar que la barra de título se oculte
        newY = Math.min(maxY, newY);

        element.style.left = `${newX}px`;
        element.style.top = `${newY}px`;
    };

    const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        element.classList.remove('dragging');
        // Quitar listeners del documento
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        // Restaurar selección de texto
        document.body.style.userSelect = '';
    };

    // Añadir listener al handle
    handle.addEventListener('mousedown', onMouseDown);

    // Guardar función para posible limpieza futura si la ventana se destruye
    element.cleanupDraggable = () => {
         handle.removeEventListener('mousedown', onMouseDown);
         // Asegurar que los listeners globales se quitan si el mouseup ocurre fuera
         document.removeEventListener('mousemove', onMouseMove);
         document.removeEventListener('mouseup', onMouseUp);
    };
}


// --- Menú Contextual ---

/**
 * Muestra el menú contextual en las coordenadas dadas, con opciones
 * basadas en el tipo de elemento clickeado.
 * @param {number} x - Posición X del menú.
 * @param {number} y - Posición Y del menú.
 * @param {'desktop' | 'item' | 'folder-view'} type - El tipo de contexto.
 * @param {object | null} [item=null] - El item del filesystem si type es 'item'.
 * @param {number | null} [folderItemId=null] - El ID de la carpeta si type es 'folder-view'.
 */
function showContextMenu(x, y, type, item = null, folderItemId = null) {
    if (!contextMenuElement) return;

    contextMenuElement.innerHTML = ''; // Limpiar opciones anteriores
    currentContextMenu = { targetItem: item, targetType: type, parentId: folderItemId }; // Guardar contexto

    let options = [];

    // Definir opciones según el contexto
    if (type === 'desktop') {
        options = [
            // { label: 'Ver', subMenu: [...] }, // Submenús requieren más lógica
            // { type: 'separator' },
            { label: 'Crear Carpeta', action: () => showCreateFolderDialog(null) },
            { label: 'Crear Acceso Directo', action: () => showCreateShortcutDialog(null) },
            // { type: 'separator' },
            // { label: 'Propiedades', action: () => alert('Propiedades del Escritorio') },
        ];
    } else if (type === 'item' && item) {
        options.push({ label: 'Abrir', action: () => handleOpenItem(item), isDefault: true }); // Opción por defecto (negrita?)
         if (item.item_type === 'FOLDER') {
              options.push({ label: 'Explorar', action: () => handleOpenItem(item) });
         }
        // Opciones comunes para todos los items
        options.push({ type: 'separator' });
        // options.push({ label: 'Enviar a', subMenu: [...] });
        // options.push({ label: 'Cortar', action: () => handleCutItem(item), disabled: false }); // TODO
        // options.push({ label: 'Copiar', action: () => handleCopyItem(item), disabled: false }); // TODO
        // options.push({ type: 'separator' });
        options.push({ label: 'Eliminar', action: () => handleDeleteItem(item) });
        // options.push({ label: 'Renombrar', action: () => handleRenameItem(item) }); // TODO
        // options.push({ type: 'separator' });
        // options.push({ label: 'Propiedades', action: () => handleShowProperties(item) }); // TODO

    } else if (type === 'folder-view') { // Clic en el fondo de una carpeta
        options = [
            // { label: 'Ver', subMenu: [...] },
            // { type: 'separator' },
            { label: 'Crear Carpeta', action: () => showCreateFolderDialog(folderItemId) },
            { label: 'Crear Acceso Directo', action: () => showCreateShortcutDialog(folderItemId) },
            // { label: 'Pegar', action: () => handlePasteItem(folderItemId), disabled: !clipboardHasItem() }, // TODO
            // { label: 'Pegar Acceso Directo', action: () => handlePasteShortcut(folderItemId), disabled: !clipboardHasItem() }, // TODO
            { type: 'separator' },
            { label: 'Subir Archivo', action: () => showUploadFileDialog(folderItemId) },
            // { type: 'separator' },
            // { label: 'Propiedades', action: () => handleShowProperties({id: folderItemId, type:'FOLDER'}) }, // TODO
        ];
    }

    // Crear elementos del menú
    options.forEach(opt => {
        const li = document.createElement('li');
        if (opt.type === 'separator') {
            li.className = 'separator';
        } else {
            const button = document.createElement('button');
            button.textContent = opt.label;
            if (opt.disabled) {
                button.disabled = true;
            }
            if (opt.isDefault) {
                button.style.fontWeight = 'bold'; // Marcar opción por defecto
            }
            button.onclick = (e) => {
                e.stopPropagation();
                hideContextMenu();
                if (opt.action && !opt.disabled) {
                    opt.action();
                }
            };
            li.appendChild(button);
        }
        contextMenuElement.appendChild(li);
    });

    // Posicionar y Mostrar Menú
    contextMenuElement.style.display = 'block'; // Mostrar primero para calcular tamaño
    const menuRect = contextMenuElement.getBoundingClientRect();
    const bodyWidth = document.body.clientWidth;
    const bodyHeight = document.body.clientHeight;

    // Ajustar posición para que no se salga de pantalla
    let finalX = x;
    let finalY = y;
    if (x + menuRect.width > bodyWidth) {
        finalX = Math.max(0, bodyWidth - menuRect.width - 5); // Dejar un margen
    }
    if (y + menuRect.height > bodyHeight) {
        finalY = Math.max(0, bodyHeight - menuRect.height - 5); // Dejar un margen
    }

    contextMenuElement.style.left = `${finalX}px`;
    contextMenuElement.style.top = `${finalY}px`;
}

/** Oculta el menú contextual. */
function hideContextMenu() {
    if (contextMenuElement) {
        contextMenuElement.style.display = 'none';
    }
    currentContextMenu = { targetItem: null, targetType: null, parentId: null }; // Limpiar contexto
}


// --- Diálogos Modales (Simplificados) ---

/**
 * Muestra una ventana con contenido de un template, actuando como diálogo.
 * @param {string} title - Título de la ventana del diálogo.
 * @param {string} contentTemplateId - ID del <template> HTML con el contenido.
 * @param {number} [width=300] - Ancho del diálogo.
 * @param {number | string} [height='auto'] - Alto del diálogo ('auto' o un número).
 * @returns {HTMLElement | null} El elemento de la ventana del diálogo o null si falla.
 */
function showDialog(title, contentTemplateId, width = 300, height = 'auto') {
     const dialogTemplate = document.getElementById(contentTemplateId);
     if (!dialogTemplate) {
         console.error(`Template de diálogo no encontrado: ${contentTemplateId}`);
         showErrorMessage(`Error interno: Falta la plantilla ${contentTemplateId}.`);
         return null;
     }
     // Clonar contenido del template
     const contentClone = dialogTemplate.content.cloneNode(true);

     // Crear la ventana usando createWindow
     const dialogWindow = createWindow({
         title: title,
         contentElement: contentClone, // Pasar el contenido clonado
         width: width,
         height: height,
         type: 'dialog', // Marcar como tipo diálogo
         icon: 'images/dialog_icon.png' // Icono genérico para diálogos (Necesitas 'dialog_icon.png')
         // Posición se centrará por defecto
     });

     if (!dialogWindow) {
          console.error("No se pudo crear la ventana para el diálogo:", title);
          return null; // Falló la creación de la ventana base
     }

     // Podrías añadir lógica para hacerlo más "modal" (deshabilitar otras ventanas)
     // pero por ahora, solo lo registramos en openDialogs
     console.log(`Diálogo ${dialogWindow.id} ('${title}') mostrado.`);
     return dialogWindow; // Devolver el elemento de la ventana
}

/** Muestra diálogo para crear una nueva carpeta. */
function showCreateFolderDialog(parentId) {
     const dialogWindow = showDialog('Crear Carpeta', 'create-folder-dialog-template', 300); // Alto auto
     if (!dialogWindow) return;

     // Obtener elementos DENTRO del diálogo específico
     const input = dialogWindow.querySelector('#new-folder-name');
     const okButton = dialogWindow.querySelector('.btn-ok');
     const cancelButton = dialogWindow.querySelector('.btn-cancel');
     const errorMessage = dialogWindow.querySelector('.error-message');

     if (!input || !okButton || !cancelButton || !errorMessage) {
          console.error("Elementos internos del diálogo 'Crear Carpeta' no encontrados.");
          closeWindow(dialogWindow.id); // Cerrar si está mal formado
          return;
     }

     input.focus(); // Poner foco inicial

     const handleSubmit = async () => {
         const name = input.value.trim();
         if (!name) {
             errorMessage.textContent = 'El nombre de la carpeta no puede estar vacío.';
             errorMessage.style.display = 'block';
             input.focus();
             return;
         }

         okButton.disabled = true; // Prevenir doble clic
         cancelButton.disabled = true;
         errorMessage.style.display = 'none';

         try {
             console.log(`Intentando crear carpeta '${name}' en parentId: ${parentId}`);
             await fsAPI.createFolder(name, parentId);
             // showSuccessMessage(`Carpeta "${name}" creada.`); // Opcional: notificación
             closeWindow(dialogWindow.id);
             // IMPORTANTE: Llamar a la función de refresco correcta
             refreshCurrentView(parentId);
             // Actualizar info de almacenamiento (carpetas no ocupan mucho, pero por consistencia)
             updateStorageIndicator();

         } catch (error) {
             console.error("Error al crear carpeta:", error);
             errorMessage.textContent = error.message || 'Error desconocido al crear carpeta.';
             errorMessage.style.display = 'block';
             okButton.disabled = false; // Re-habilitar en caso de error
             cancelButton.disabled = false;
             input.focus(); input.select();
         }
     };

     // Asignar listeners
     okButton.onclick = handleSubmit;
     input.onkeydown = (e) => {
         if (e.key === 'Enter') handleSubmit();
         else if (e.key === 'Escape') closeWindow(dialogWindow.id);
     };
     cancelButton.onclick = () => closeWindow(dialogWindow.id);
}

/** Muestra diálogo para crear un acceso directo. */
function showCreateShortcutDialog(parentId) {
    const dialogWindow = showDialog('Crear Acceso Directo', 'create-shortcut-dialog-template', 350);
     if (!dialogWindow) return;

     const form = dialogWindow.querySelector('#shortcut-form');
     const nameInput = dialogWindow.querySelector('#shortcut-name');
     const urlInput = dialogWindow.querySelector('#shortcut-url');
     const iconInput = dialogWindow.querySelector('#shortcut-icon');
     const okButton = dialogWindow.querySelector('.btn-ok');
     const cancelButton = dialogWindow.querySelector('.btn-cancel');
     const errorMessage = dialogWindow.querySelector('.error-message');

     if (!form || !nameInput || !urlInput || !iconInput || !okButton || !cancelButton || !errorMessage) {
          console.error("Elementos internos del diálogo 'Crear Acceso Directo' no encontrados.");
          closeWindow(dialogWindow.id); return;
     }

     nameInput.focus();

     form.onsubmit = async (e) => {
         e.preventDefault(); // Prevenir envío HTML normal
         errorMessage.style.display = 'none'; // Limpiar error previo

         // Validar URL básica en frontend
         try {
             new URL(urlInput.value.trim());
         } catch (_) {
              errorMessage.textContent = 'La URL de destino no parece válida.';
              errorMessage.style.display = 'block';
              urlInput.focus(); urlInput.select();
              return;
         }

         okButton.disabled = true;
         cancelButton.disabled = true;

         // Crear FormData para enviar (necesario para el icono)
         const formData = new FormData();
         formData.append('name', nameInput.value.trim());
         formData.append('targetUrl', urlInput.value.trim());
         if (parentId !== null) {
             formData.append('parentId', parentId);
         }
         if (iconInput.files.length > 0) {
             formData.append('icon', iconInput.files[0]); // 'icon' debe coincidir con upload.single()
         }

         try {
             console.log(`Intentando crear shortcut '${nameInput.value.trim()}' en parentId: ${parentId}`);
             await fsAPI.createShortcut(formData);
             // showSuccessMessage(`Acceso directo "${nameInput.value.trim()}" creado.`);
             closeWindow(dialogWindow.id);
             refreshCurrentView(parentId);
             updateStorageIndicator(); // Actualizar si el icono ocupa espacio

         } catch (error) {
             console.error("Error al crear acceso directo:", error);
             errorMessage.textContent = error.message || 'Error desconocido al crear acceso directo.';
             errorMessage.style.display = 'block';
             okButton.disabled = false;
             cancelButton.disabled = false;
             nameInput.focus(); nameInput.select();
         }
     };

     cancelButton.onclick = () => closeWindow(dialogWindow.id);
}

/** Muestra diálogo para subir un archivo. */
function showUploadFileDialog(parentId) {
    const dialogWindow = showDialog('Subir Archivo', 'upload-file-dialog-template', 350);
     if (!dialogWindow) return;

     const form = dialogWindow.querySelector('#upload-form');
     const fileInput = dialogWindow.querySelector('#file-upload-input');
     // const nameInput = dialogWindow.querySelector('#file-upload-name'); // Si se habilita renombrar
     const okButton = dialogWindow.querySelector('.btn-ok');
     const cancelButton = dialogWindow.querySelector('.btn-cancel');
     const errorMessage = dialogWindow.querySelector('.error-message');
     const progressBarFill = dialogWindow.querySelector('.progress-bar-fill'); // Para feedback
     const progressBar = dialogWindow.querySelector('.progress-bar');

      if (!form || !fileInput || !okButton || !cancelButton || !errorMessage || !progressBar || !progressBarFill) {
          console.error("Elementos internos del diálogo 'Subir Archivo' no encontrados.");
          closeWindow(dialogWindow.id); return;
     }

     form.onsubmit = async (e) => {
         e.preventDefault();
         if (fileInput.files.length === 0) {
             errorMessage.textContent = 'Debes seleccionar un archivo para subir.';
             errorMessage.style.display = 'block';
             return;
         }

         const file = fileInput.files[0];
         errorMessage.style.display = 'none';
         okButton.disabled = true;
         cancelButton.disabled = true;
         progressBar.style.display = 'block'; // Mostrar barra
         progressBarFill.style.width = '0%'; // Reiniciar progreso

         const formData = new FormData();
         formData.append('file', file); // 'file' debe coincidir con upload.single()
         if (parentId !== null) {
             formData.append('parentId', parentId);
         }
         // if (nameInput && nameInput.value.trim()) { // Si se permite renombrar
         //     formData.append('name', nameInput.value.trim());
         // }

         try {
             console.log(`Intentando subir archivo '${file.name}' (${formatBytes(file.size)}) en parentId: ${parentId}`);
             // TODO: Implementar progreso de subida real si es necesario (más complejo)
             progressBarFill.style.width = '50%'; // Simulación básica

             await fsAPI.uploadFile(formData);

             progressBarFill.style.width = '100%'; // Simulación completada
             // showSuccessMessage(`Archivo "${file.name}" subido.`);
             // Dar un pequeño tiempo para ver la barra completa antes de cerrar
             setTimeout(() => {
                closeWindow(dialogWindow.id);
                refreshCurrentView(parentId);
                updateStorageIndicator(); // Actualizar uso de disco
             }, 300);

         } catch (error) {
             console.error("Error al subir archivo:", error);
             let displayMessage = error.message || 'Error desconocido al subir archivo.';
             // Mostrar detalles del error de cuota si existen
             if (error.status === 413 && error.data?.details) {
                displayMessage = `${error.message} (${error.data.details})`;
             }
             errorMessage.textContent = displayMessage;
             errorMessage.style.display = 'block';
             okButton.disabled = false;
             cancelButton.disabled = false;
             progressBar.style.display = 'none'; // Ocultar barra en error
             fileInput.value = ''; // Limpiar input de archivo
         }
     };

     cancelButton.onclick = () => closeWindow(dialogWindow.id);
}


// --- Mensajes y Feedback Visual ---

/** Muestra un mensaje de éxito (consola por ahora). */
function showSuccessMessage(message) {
    console.info("ÉXITO:", message);
    // TODO: Implementar notificación visual estilo Win98 (Toast?)
}

/** Muestra un mensaje de error (consola por ahora). */
function showErrorMessage(message) {
     console.error("ERROR UI:", message);
     // TODO: Implementar diálogo de error visual estilo Win98
     alert(`Error: ${message}`); // Fallback temporal
}

// TODO: Implementar showAlertDialog(title, message, type = 'info' | 'warning' | 'error')
// TODO: Implementar showConfirmDialog(title, message, onConfirmCallback)


// --- Manejo de Acciones sobre Items ---

/**
 * Abre un item (carpeta, archivo, acceso directo) según su tipo.
 * @param {object} item - El item del filesystem a abrir.
 */
async function handleOpenItem(item) {
    console.log("[handleOpenItem] Item recibido:", JSON.stringify(item));
    if (!item || !item.item_type) {
        console.error("handleOpenItem: item inválido", item);
        return;
    }
    console.log(`Abriendo item: ${item.name} (Tipo: ${item.item_type}, ID: ${item.id})`);
    hideContextMenu(); // Ocultar menú si estaba abierto

    switch (item.item_type) {
        case 'FOLDER':
            openFolderWindow(item);
            break;
        case 'FILE':
            openFileViewer(item);
            break;
        case 'SHORTCUT':
            if (item.target_url) {
                 console.log(`Redirigiendo a shortcut: ${item.target_url}`);
                 // Abrir en nueva pestaña por seguridad y simplicidad
                 window.open(item.target_url, '_blank');
                 // Deseleccionar icono después de abrir
                 deselectAllIcons();
            } else {
                 showErrorMessage(`El acceso directo "${item.name}" no tiene una URL de destino.`);
            }
            break;
        default:
            showErrorMessage(`No se puede abrir este tipo de item: ${item.item_type}`);
    }
}

/**
 * Abre una nueva ventana para explorar el contenido de una carpeta.
 * @param {object} folderItem - El item de la carpeta a abrir.
 */
async function openFolderWindow(folderItem) {
    console.log(`Abriendo ventana para carpeta: ${folderItem.name} (ID: ${folderItem.id})`);

    // Crear contenedor de la vista de carpeta desde el template
    const folderViewTemplate = document.getElementById('folder-view-template');
    if (!folderViewTemplate) { showErrorMessage("Error: Falta plantilla de vista de carpeta."); return; }
    const contentClone = folderViewTemplate.content.cloneNode(true);
    const folderContentElement = contentClone.querySelector('.folder-content');
    const toolbarElement = contentClone.querySelector('.folder-toolbar');
    const statusBarItems = contentClone.querySelector('.num-items-field');
    // const statusBarSpace = contentClone.querySelector('.free-space-field'); // Para espacio libre

    if (!folderContentElement || !toolbarElement || !statusBarItems) {
         showErrorMessage("Error: Plantilla de vista de carpeta incompleta."); return;
    }

    // Crear la ventana base ANTES de cargar contenido
    const windowTitle = folderItem.name || 'Explorador';
    const windowElement = createWindow({
        title: windowTitle,
        contentElement: contentClone, // Añadir el contenido del template
        width: 550,
        height: 400,
        type: 'folder',
        associatedItem: folderItem, // Asociar con el item carpeta
        icon: getIconPath(folderItem) // Usar icono de carpeta
    });

     // Si createWindow devolvió una ventana existente, no continuar con la carga/listeners
     const windowData = openWindows.get(windowElement?.id);
     if (!windowData || windowData.element !== windowElement) {
         // Esto significa que la ventana ya existía y fue activada, no creada.
         console.log("La ventana de carpeta ya estaba abierta, no se recarga.");
         return;
     }

     // --- Configurar Listeners para la Nueva Ventana de Carpeta ---

     // Clic derecho en el fondo de la carpeta
     folderContentElement.addEventListener('contextmenu', (e) => {
         if (e.target === folderContentElement) { // Solo si el clic es en el fondo
             e.preventDefault();
             e.stopPropagation();
             showContextMenu(e.clientX, e.clientY, 'folder-view', null, folderItem.id); // Pasar ID de carpeta
         }
     });

     // Botones de la barra de herramientas
     toolbarElement.querySelector('.btn-create-folder')?.addEventListener('click', () => showCreateFolderDialog(folderItem.id));
     toolbarElement.querySelector('.btn-create-shortcut')?.addEventListener('click', () => showCreateShortcutDialog(folderItem.id));
     toolbarElement.querySelector('.btn-upload-file')?.addEventListener('click', () => showUploadFileDialog(folderItem.id));
     // TODO: Lógica para botones Atrás/Subir (necesita historial de navegación)


    // --- Cargar Contenido de la Carpeta ---
    folderContentElement.innerHTML = '<i class="loading-indicator">Cargando...</i>'; // Feedback
    statusBarItems.textContent = 'Cargando...';

    try {
        const items = await fsAPI.getItems(folderItem.id);
        renderIcons(items, folderContentElement, false); // false = no es escritorio
        // Actualizar barra de estado
        statusBarItems.textContent = `${items.length} objeto(s)`;
        // Podrías calcular el tamaño total si la API lo devuelve o lo sumas aquí
    } catch (error) {
        console.error(`Error al cargar contenido de carpeta ${folderItem.id}:`, error);
        folderContentElement.innerHTML = `<i class="error-indicator">Error al cargar: ${error.message}</i>`;
        statusBarItems.textContent = 'Error';
        // Considerar cerrar la ventana si la carga inicial falla? O permitir reintentar?
        // closeWindow(windowElement.id);
    }
}

/**
 * Abre un visor/reproductor adecuado para un archivo.
 * @param {object} fileItem - El item del archivo a abrir.
 */
function openFileViewer(fileItem) {
    console.log("Datos recibidos en openFileViewer:", JSON.stringify(fileItem)); // LOG CLAVE
    const mimeType = fileItem.mime_type || '';
    console.log(`Abriendo visor para archivo: ${fileItem.name} (MIME: ${mimeType})`);

    if (!fileItem.filePathUrl) {
        console.error("¡FALLO! fileItem NO tiene filePathUrl. Datos recibidos:", fileItem); // Log extra en fallo
        showErrorMessage(`El archivo "${fileItem.name}" no tiene una ruta válida.`);
        return;
    }

    let viewerTemplateId = null;
    let windowOptions = {
        title: fileItem.name,
        width: 640, height: 480, // Defaults
        type: 'file',
        associatedItem: fileItem,
        icon: getIconPath(fileItem)
    };

    // Determinar qué visor usar
    if (mimeType.startsWith('video/')) {
        viewerTemplateId = 'video-player-template';
        windowOptions.width = 720; // Tamaño más adecuado para video
        windowOptions.height = 540;
    } else if (mimeType.startsWith('audio/')) {
        viewerTemplateId = 'audio-player-template';
        windowOptions.width = 400;
        windowOptions.height = 180; // Más pequeño para audio
    } else if (mimeType.startsWith('image/')) {
        // viewerTemplateId = 'image-viewer-template'; // TODO: Crear este template
        // Por ahora, abrir en nueva pestaña
        window.open(fileItem.filePathUrl, '_blank');
        return; // Salir, no crear ventana interna
    } else if (mimeType === 'text/plain' || mimeType === 'application/json') { // Añadir otros tipos de texto si se desea
        viewerTemplateId = 'text-editor-template'; // Usar editor/visor de texto
        windowOptions.title = `Bloc de notas - ${fileItem.name}`;
        windowOptions.width = 600;
        windowOptions.height = 450;
    } else {
        // Tipo no soportado directamente, ofrecer descarga
        if (confirm(`No hay un visor integrado para "${fileItem.name}" (${mimeType}).\n¿Quieres intentar descargarlo?`)) {
            try {
                const link = document.createElement('a');
                link.href = fileItem.filePathUrl;
                // Usar nombre original para la descarga si está disponible
                link.download = fileItem.original_name || fileItem.name;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                 showSuccessMessage(`Descarga de "${link.download}" iniciada...`);
            } catch (e) {
                showErrorMessage(`No se pudo iniciar la descarga: ${e.message}`);
            }
        }
        return; // Salir, no se abre ventana
    }

    // --- Crear Ventana con el Contenido del Visor ---
    const viewerTemplate = document.getElementById(viewerTemplateId);
    if (!viewerTemplate) { showErrorMessage(`Error: Falta plantilla de visor '${viewerTemplateId}'.`); return; }
    const contentClone = viewerTemplate.content.cloneNode(true);

    // Configurar contenido específico del visor
    if (mimeType.startsWith('video/')) {
        contentClone.querySelector('source').src = fileItem.filePathUrl;
        contentClone.querySelector('source').type = mimeType;
    } else if (mimeType.startsWith('audio/')) {
        contentClone.querySelector('source').src = fileItem.filePathUrl;
        contentClone.querySelector('source').type = mimeType;
        // Opcional: Cargar metadatos si los tienes
        contentClone.querySelector('.audio-title').textContent = fileItem.name; // Usar nombre por defecto
        // contentClone.querySelector('.audio-artist').textContent = fileItem.artist || '';
        // contentClone.querySelector('.audio-album').textContent = fileItem.album || '';
    } else if (mimeType === 'text/plain' || mimeType === 'application/json') {
        const textArea = contentClone.querySelector('.text-editor-area');
        const saveButton = contentClone.querySelector('.btn-save-text'); // Asumiendo botón de guardar
        textArea.value = 'Cargando contenido...';
        textArea.readOnly = true; // Hacer readonly mientras carga
        saveButton?.parentNode.remove(); // Ocultar menú/botón guardar por defecto (visor)

        // Llamar a API para obtener contenido (NECESITA RUTA EN BACKEND)
        /*
        fsAPI.getFileContent(fileItem.id) // Necesitas crear fsAPI.getFileContent
            .then(content => {
                textArea.value = content;
                textArea.readOnly = false; // Hacer editable si se quiere
                 // Mostrar botón guardar si es editor
                 // saveButton?.parentNode.style.display = 'block';
                 // saveButton.onclick = () => handleSaveTextFile(fileItem.id, textArea);
            })
            .catch(error => {
                 textArea.value = `Error al cargar contenido: ${error.message}`;
                 textArea.readOnly = true;
            });
        */
         // *** Placeholder mientras no hay API de contenido ***
         textArea.value = `Contenido de "${fileItem.name}" no se puede mostrar aún (API no implementada).`;
         // ****************************************************
    }

    // Crear la ventana
    createWindow({ ...windowOptions, contentElement: contentClone });
}


/**
 * Maneja la eliminación de un item (con confirmación).
 * @param {object} item - El item del filesystem a eliminar.
 */
async function handleDeleteItem(item) {
    if (!item || !item.id) return;
    hideContextMenu(); // Ocultar menú

    // Usar diálogo de confirmación personalizado si existe
    const performDelete = async () => {
        console.log(`Intentando eliminar item: ${item.name} (ID: ${item.id})`);
        try {
            await fsAPI.deleteItem(item.id);
            // showSuccessMessage(`"${item.name}" eliminado.`); // Notificación opcional
            // Refrescar la vista donde estaba el item
            refreshCurrentView(item.parent_id);
            // Actualizar uso de almacenamiento
            updateStorageIndicator();

            // Si el item eliminado tenía una ventana abierta asociada, cerrarla
             for (const [id, winData] of openWindows.entries()) {
                 if (winData.item?.id === item.id) {
                     console.log(`Cerrando ventana ${id} asociada al item eliminado.`);
                     closeWindow(id);
                     break; // Asumir solo una ventana por item
                 }
             }

        } catch (error) {
            console.error(`Error al eliminar "${item.name}":`, error);
            showErrorMessage(`No se pudo eliminar "${item.name}": ${error.message}`);
        }
    };

    if (window.ui && typeof window.ui.showConfirmDialog === 'function') {
        window.ui.showConfirmDialog(
            'Confirmar Eliminación',
            `¿Estás seguro de que quieres eliminar "${item.name}"?${item.item_type === 'FOLDER' ? ' (Las carpetas deben estar vacías)' : ''}`,
            performDelete // Callback si confirma
        );
    } else {
        // Fallback al confirm nativo
        if (confirm(`¿Estás seguro de que quieres eliminar "${item.name}"?${item.item_type === 'FOLDER' ? ' (Las carpetas deben estar vacías)' : ''}`)) {
            performDelete();
        } else {
             console.log("Eliminación cancelada por el usuario.");
             deselectAllIcons(); // Quitar selección si cancela
        }
    }
}

// TODO: Implementar handleRenameItem(item)
// TODO: Implementar handleShowProperties(item)
// TODO: Implementar handleCutItem, handleCopyItem, handlePasteItem (Clipboard virtual)


// --- Actualización de Vistas ---

/**
 * Refresca la vista del escritorio o de una ventana de carpeta abierta.
 * @param {number | null} parentId - ID de la carpeta a refrescar, o null para el escritorio.
 */
async function refreshCurrentView(parentId) {
    console.log(`[refreshCurrentView] Solicitado refresco para parentId: ${parentId}`);

    if (parentId === null || parentId === undefined) {
        // --- Actualizar Escritorio ---
        console.log("[refreshCurrentView] Refrescando Escritorio...");
        // Llamar a la función de main.js a través del objeto global ui
        if (window.ui && typeof window.ui.loadDesktopItems === 'function') {
            try {
                await window.ui.loadDesktopItems();
                 console.log("[refreshCurrentView] Refresco de escritorio completado.");
            } catch (error) {
                 console.error("[refreshCurrentView] Error durante llamada a ui.loadDesktopItems:", error);
                 showErrorMessage(`No se pudo refrescar el escritorio: ${error.message}`);
            }
        } else {
             console.error("[refreshCurrentView] Error: ui.loadDesktopItems no está disponible para refrescar escritorio.");
        }
    } else {
        // --- Actualizar Ventana de Carpeta Específica ---
        console.log(`[refreshCurrentView] Buscando ventana de carpeta abierta para parentId: ${parentId}`);
        let foundWindow = false;
        for (const [windowId, winData] of openWindows.entries()) {
            // Asegurar comparación de tipos si parentId viene como string
            const currentItemId = winData.item?.id;
            if (winData.type === 'folder' && currentItemId !== undefined && currentItemId == parentId) { // Usar == para comparar número y string si es necesario, o convertir parentId a número
                foundWindow = true;
                console.log(`[refreshCurrentView] Refrescando contenido de ventana ${windowId}`);
                const folderContentElement = winData.element.querySelector('.folder-content');
                const statusBarItems = winData.element.querySelector('.num-items-field');

                if (folderContentElement) {
                    folderContentElement.innerHTML = '<i class="loading-indicator">Actualizando...</i>'; // Feedback
                    if (statusBarItems) statusBarItems.textContent = 'Actualizando...';
                    try {
                        const items = await fsAPI.getItems(parentId);
                        renderIcons(items, folderContentElement, false); // Renderizar nuevos iconos
                        if (statusBarItems) statusBarItems.textContent = `${items.length} objeto(s)`; // Actualizar contador
                         console.log(`[refreshCurrentView] Contenido de carpeta ${parentId} actualizado.`);
                    } catch (error) {
                        console.error(`[refreshCurrentView] Error al recargar carpeta ${parentId}:`, error);
                        folderContentElement.innerHTML = `<i class="error-indicator">Error al recargar: ${error.message}</i>`;
                         if (statusBarItems) statusBarItems.textContent = 'Error';
                    }
                } else {
                     console.error(`[refreshCurrentView] No se encontró .folder-content en ventana ${windowId}`);
                }
                break; // Salir del bucle, solo refrescar una ventana
            }
        }
        if (!foundWindow) {
            console.log(`[refreshCurrentView] No hay ventana abierta para carpeta ${parentId}, no se necesita refresco visual.`);
        }
    }
}


// --- Actualización de Elementos UI Fijos ---

/** Actualiza el reloj en la barra de tareas. */
function updateClock() {
    if (clockElement) {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        clockElement.textContent = `${hours}:${minutes}`;
    }
}

/** Actualiza el indicador de uso de almacenamiento en la barra de tareas. */
async function updateStorageIndicator() {
    if (!storageTextElement || !storageIndicatorElement) return; // Salir si los elementos no existen

    storageTextElement.textContent = '...'; // Indicador de carga
    storageIndicatorElement.title = 'Calculando almacenamiento...';

    try {
        const storageInfo = await authAPI.getStorageInfo(); // Llama a la API definida en api.js
        if (storageInfo && typeof storageInfo.storage_used === 'number' && typeof storageInfo.storage_quota === 'number') {
            const usedFormatted = formatBytes(storageInfo.storage_used);
            const quotaFormatted = formatBytes(storageInfo.storage_quota);
            storageTextElement.textContent = `${usedFormatted} / ${quotaFormatted}`;
            storageIndicatorElement.title = `Almacenamiento Usado: ${formatBytes(storageInfo.storage_used, 2)} / ${formatBytes(storageInfo.storage_quota, 2)}`;
             console.log(`Indicador de almacenamiento actualizado: ${usedFormatted} / ${quotaFormatted}`);
        } else {
             throw new Error("Respuesta de API de almacenamiento inválida.");
        }
    } catch (error) {
        console.error("Error al actualizar indicador de almacenamiento:", error);
        storageTextElement.textContent = 'Error';
        storageIndicatorElement.title = `Error al obtener información: ${error.message}`;
    }
}


// --- Configuración Inicial de Listeners Globales ---

/** Configura los listeners de eventos globales para la UI principal. */
function setupGlobalListeners() {
    console.log("Configurando listeners globales...");

    // Listener para cerrar menú contextual al hacer clic fuera
    document.addEventListener('click', (e) => {
        // Si el menú está visible y el clic NO fue dentro de él
        if (contextMenuElement && contextMenuElement.style.display === 'block' && !contextMenuElement.contains(e.target)) {
            hideContextMenu();
        }
        if (startMenuElement && startMenuElement.style.display !== 'none' && !startMenuElement.contains(e.target) && e.target !== startButtonElement && !startButtonElement.contains(e.target)) {
            hideStartMenu();
        }
        // Si el clic fue directamente en el escritorio, deseleccionar iconos
         if (desktopElement && e.target === desktopElement) {
             deselectAllIcons();
         }
         
    }, true); // Usar captura para asegurar que se ejecute antes que otros clicks

     // Listener para menú contextual del escritorio
     desktopElement?.addEventListener('contextmenu', (e) => {
         // Solo si el clic es directamente en el escritorio, no en un icono dentro
         if (e.target === desktopElement) {
             e.preventDefault();
             deselectAllIcons(); // Deseleccionar antes de mostrar menú
             showContextMenu(e.clientX, e.clientY, 'desktop');
         }
         // Si el clic fue en un icono, su propio listener de contextmenu se encargará
     });

     // Listener para tecla Escape (cerrar menú/diálogo superior)
     document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            console.log("Tecla Escape presionada.");
            if (contextMenuElement && contextMenuElement.style.display === 'block') {
                hideContextMenu();
            } else if (startMenuElement && startMenuElement.style.display !== 'none') { // <-- Añadir esto
                hideStartMenu();
            } else if (openDialogs.size > 0) { /* ... (cerrar diálogo) ... */ }
        }
    });
    // --- Listeners para Items del Menú Inicio ---
    const logoutButton = document.getElementById('start-menu-logout');
    const wallpaperButton = document.getElementById('start-menu-wallpaper');

    logoutButton?.addEventListener('click', () => {
        hideStartMenu(); // Ocultar menú primero
        // Llamar a la función de logout exportada por main.js
        if (window.ui && typeof window.ui.handleLogout === 'function') {
            window.ui.handleLogout();
        } else {
            console.error("Error: window.ui.handleLogout no está disponible.");
            alert("Error al intentar cerrar sesión.");
        }
    });

    wallpaperButton?.addEventListener('click', () => {
        hideStartMenu(); // Ocultar menú primero
        handleChangeWallpaper();
    });

     // Iniciar el reloj y actualizarlo periódicamente
     updateClock();
     setInterval(updateClock, 15000); // Actualizar cada 15 segundos es suficiente

     console.log("Listeners globales configurados.");
}

// --- Exponer Funciones Públicas de UI ---
// Hacer accesibles las funciones que otros módulos (main.js) necesitan llamar
window.ui = window.ui || {}; // Asegurar que exista
window.ui.toggleStartMenu = toggleStartMenu;
window.ui.renderIcons = renderIcons;
window.ui.setupGlobalListeners = setupGlobalListeners;
window.ui.updateStorageIndicator = updateStorageIndicator;
window.ui.refreshCurrentView = refreshCurrentView; // Para que los diálogos puedan refrescar
window.ui.showSuccessMessage = showSuccessMessage; // Para feedback
window.ui.showErrorMessage = showErrorMessage; // Para feedback
// Añadir aquí otras funciones si main.js las necesita (ej. showAlertDialog, showConfirmDialog)
// window.ui.showAlertDialog = showAlertDialog;
// window.ui.showConfirmDialog = showConfirmDialog;

console.log("ui.js cargado y configurado.");
// =============================================
// public/js/main.js
// Lógica principal del Frontend Win98 Simulator
// =============================================

document.addEventListener('DOMContentLoaded', () => {

    // --- Obtener Referencias a Elementos del DOM ---
    // Contenedores principales
    const authContainer = document.getElementById('auth-container');
    const mainUIContainer = document.getElementById('main-ui');
    const desktopElement = document.getElementById('desktop');

    // Elementos de Autenticación
    const loginFormDiv = document.getElementById('login-form');
    const registerFormDiv = document.getElementById('register-form');
    const loginForm = document.getElementById('login');
    const registerForm = document.getElementById('register');
    const loginUsernameInput = document.getElementById('login-username');
    const loginPasswordInput = document.getElementById('login-password');
    const registerUsernameInput = document.getElementById('register-username');
    const registerPasswordInput = document.getElementById('register-password');
    const registerConfirmPasswordInput = document.getElementById('register-confirm-password');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    const registerSuccess = document.getElementById('register-success');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');

    // Elementos UI Principal
    const startButton = document.getElementById('start-button');

    // --- Verificación Inicial de Dependencias ---
    // Es crucial que ui.js y api.js se carguen ANTES que main.js en index.html
    if (!window.ui) {
        console.error("FATAL: ui.js no parece haberse cargado o no definió window.ui.");
        alert("Error crítico al cargar la interfaz. Por favor, recarga la página.");
        // Podrías intentar deshabilitar toda interacción aquí
        return;
    }
    if (!window.authAPI || !window.fsAPI) {
        console.error("FATAL: api.js no parece haberse cargado o no definió authAPI/fsAPI.");
        // Usar el diálogo de UI si ya está disponible, sino alert
        if (window.ui && typeof window.ui.showAlertDialog === 'function') {
             window.ui.showAlertDialog('Error Crítico', 'Error al cargar la conexión con el servidor. Por favor, recarga la página.', 'error');
        } else {
             alert("Error crítico al cargar la conexión con el servidor. Por favor, recarga la página.");
        }
        return;
    }


    // --- Funciones Principales de la Aplicación ---

    /**
     * Inicializa la aplicación verificando el estado de autenticación.
     * Decide si mostrar la pantalla de login o la interfaz principal.
     */
    async function initApp() {
        // Ocultar ambos contenedores inicialmente
        authContainer.style.display = 'none';
        mainUIContainer.style.display = 'none';

        try {
            console.log("Verificando estado de autenticación...");
            const status = await authAPI.checkStatus();

            if (status.loggedIn && status.user) {
                console.log(`Usuario ${status.user.username} (ID: ${status.user.id}) ya autenticado.`);
                // Pasar datos del usuario puede ser útil para otras funciones
                await initializeMainUI(status.user);
            } else {
                console.log("Usuario no autenticado. Mostrando pantalla de login.");
                showAuthUI();
            }
        } catch (error) {
            console.error("Error grave durante la verificación inicial de autenticación:", error);
            // Si falla la verificación, es más seguro mostrar el login
            showAuthUI();
            // Mostrar un mensaje de error genérico
            loginError.textContent = 'No se pudo verificar la sesión. Intenta iniciar sesión.';
             // Podría ser un error de red o del servidor caído
             if (window.ui && typeof window.ui.showAlertDialog === 'function') {
                 window.ui.showAlertDialog('Error de Conexión', `No se pudo comunicar con el servidor (${error.message || 'Error desconocido'}). Intenta recargar.`, 'error');
             }
        }
    }

    /**
     * Configura y muestra la interfaz principal (escritorio, taskbar)
     * después de un inicio de sesión exitoso.
     * @param {object} userData - Información básica del usuario logueado.
     */
    async function initializeMainUI(userData) {
        console.log("Inicializando UI principal para el usuario:", userData?.username);
        // Marcar el body para posibles estilos globales (opcional)
        document.body.classList.add('app-loaded');
        showMainUI(); // Muestra #main-ui y oculta #auth-container

        // Cargar elementos iniciales (iconos del escritorio)
        await loadDesktopItems();

        // Configurar listeners globales (menú contextual escritorio, reloj, etc.)
        // Se asume que ui.setupGlobalListeners está definida en ui.js
        if (typeof ui.setupGlobalListeners === 'function') {
            ui.setupGlobalListeners();
            console.log("Listeners globales de UI configurados.");
        } else {
             console.warn("La función ui.setupGlobalListeners no está definida.");
        }

        // Actualizar el indicador de almacenamiento en la barra de tareas
        // Se asume que ui.updateStorageIndicator está definida en ui.js
        if (typeof ui.updateStorageIndicator === 'function') {
            ui.updateStorageIndicator(); // Llama sin await si no necesita esperar
            console.log("Indicador de almacenamiento solicitado.");
        } else {
            console.warn("La función ui.updateStorageIndicator no está definida.");
        }
    }

    /** Muestra el contenedor de autenticación y oculta la UI principal. */
    function showAuthUI() {
        document.body.classList.remove('app-loaded'); // Quitar clase si se desloguea
        authContainer.style.display = 'block'; // O 'flex' si usas flex para centrar
        mainUIContainer.style.display = 'none';
        loginFormDiv.style.display = 'block'; // Por defecto mostrar login
        registerFormDiv.style.display = 'none';
        clearAuthMessages(); // Limpiar errores previos
        if (loginUsernameInput) loginUsernameInput.focus(); // Poner foco
    }

    /** Muestra el contenedor principal de la UI y oculta el de autenticación. */
    function showMainUI() {
        authContainer.style.display = 'none';
        mainUIContainer.style.display = 'flex'; // O el display correcto para tu layout
    }

    /** Limpia los mensajes de error y éxito en los formularios de autenticación. */
    function clearAuthMessages() {
        if (loginError) loginError.textContent = '';
        if (registerError) registerError.textContent = '';
        if (registerSuccess) registerSuccess.textContent = '';
    }

    /**
     * Carga los items del nivel raíz (escritorio, parentId=null) desde la API
     * y los renderiza usando ui.renderIcons.
     */
    async function loadDesktopItems() {
        console.log('[loadDesktopItems] Cargando iconos del escritorio...');
        if (!desktopElement) {
            console.error("[loadDesktopItems] Error crítico: Elemento '#desktop' no encontrado.");
            return; // Salir si no hay dónde dibujar
        }
        // Mostrar indicador de carga mientras se obtienen los datos
        desktopElement.innerHTML = '<i class="loading-indicator">Cargando escritorio...</i>';

        try {
            const items = await fsAPI.getItems(null); // null = obtener raíz/escritorio
            console.log('[loadDesktopItems] Items del escritorio recibidos:', items);

            // Usar la función renderIcons de ui.js para dibujar los iconos
            if (window.ui && typeof window.ui.renderIcons === 'function') {
                window.ui.renderIcons(items, desktopElement, true); // true = es el escritorio
                console.log('[loadDesktopItems] Escritorio renderizado.');
            } else {
                // Esto no debería pasar si la verificación inicial funcionó
                console.error('[loadDesktopItems] Error: La función ui.renderIcons no está definida/accesible.');
                desktopElement.innerHTML = '<i class="error-indicator" style="color:red;">Error interno al renderizar</i>';
            }
        } catch (error) {
            console.error("[loadDesktopItems] Error al cargar o renderizar iconos del escritorio:", error);
            desktopElement.innerHTML = `<i class="error-indicator" style="color:red;">Error al cargar escritorio: ${error.message || 'Error desconocido'}</i>`;
            // Si el error es por no estar autorizado (ej. sesión expiró), desloguear
            if (error.status === 401) {
                console.warn("[loadDesktopItems] Error 401 (No Autorizado) recibido. Deslogueando...");
                handleLogout(); // Llama a la función de logout
            }
        }
    }

    /**
     * Maneja el proceso de cierre de sesión del usuario.
     */
    async function handleLogout() {
        console.log("Iniciando proceso de cierre de sesión...");
        // Opcional: Mostrar un estado de "cerrando sesión" en la UI
        try {
            await authAPI.logout();
            console.log("Logout API exitoso. Recargando página...");
            // Recargar la página es la forma más simple de limpiar todo el estado del frontend
            window.location.reload();
        } catch (error) {
            console.error("Error durante el cierre de sesión:", error);
            // Informar al usuario del error
            if (window.ui && typeof window.ui.showAlertDialog === 'function') {
                window.ui.showAlertDialog('Error', `No se pudo cerrar la sesión: ${error.message}`, 'error');
            } else {
                 alert(`Error al cerrar sesión: ${error.message}`);
            }
            // Opcional: Reactivar la UI si se había deshabilitado
        }
    }

    // --- Hacer Funciones Clave Accesibles Globalmente desde ui.js ---
    // Nos aseguramos que ui.js pueda llamar a funciones definidas aquí
    // La verificación de window.ui ya se hizo al principio.
    window.ui.loadDesktopItems = loadDesktopItems; // Para refrescar escritorio
    window.ui.handleLogout = handleLogout; // Para el botón de cerrar sesión o errores 401

    // --- Configuración de Event Listeners para Autenticación y UI Principal ---

    // Listener para el formulario de Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevenir envío HTML estándar
            clearAuthMessages();
            const username = loginUsernameInput.value.trim();
            const password = loginPasswordInput.value;
            const submitButton = loginForm.querySelector('button[type="submit"]');

            if (!username || !password) {
                loginError.textContent = 'Nombre de usuario y contraseña son requeridos.';
                return;
            }

            submitButton.disabled = true; // Evitar doble clic

            try {
                console.log(`Intentando login como: ${username}`);
                const loginResult = await authAPI.login(username, password); // Esperar resultado
                console.log("Login exitoso, inicializando UI...");
                await initializeMainUI(loginResult.user); // Pasar datos del usuario
                // No es necesario re-habilitar el botón, la UI cambiará

            } catch (error) {
                console.error("Error en el proceso de login:", error);
                loginError.textContent = error.message || 'Credenciales incorrectas o error del servidor.';
                submitButton.disabled = false; // Re-habilitar botón para reintento
                loginPasswordInput.value = ''; // Limpiar contraseña por seguridad
                loginPasswordInput.focus();
            }
        });
    } else {
        console.warn("Elemento del formulario de login (#login) no encontrado.");
    }

    // Listener para el formulario de Registro
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAuthMessages();
            const username = registerUsernameInput.value.trim();
            const password = registerPasswordInput.value;
            const confirmPassword = registerConfirmPasswordInput.value;
            const submitButton = registerForm.querySelector('button[type="submit"]');

            // Validaciones del Frontend
            if (!username || !password || !confirmPassword) {
                registerError.textContent = 'Todos los campos son obligatorios.'; return;
            }
            if (username.length < 3) {
                registerError.textContent = 'El nombre de usuario debe tener al menos 3 caracteres.'; registerUsernameInput.focus(); return;
            }
            if (password.length < 6) {
                registerError.textContent = 'La contraseña debe tener al menos 6 caracteres.'; registerPasswordInput.focus(); return;
            }
            if (password !== confirmPassword) {
                registerError.textContent = 'Las contraseñas no coinciden.'; registerConfirmPasswordInput.focus(); return;
            }

            submitButton.disabled = true;

            try {
                console.log(`Intentando registrar nuevo usuario: ${username}`);
                const response = await authAPI.register(username, password);
                console.log("Registro exitoso:", response);
                registerSuccess.textContent = response.message + " Por favor, inicia sesión.";
                registerForm.reset(); // Limpiar el formulario

                // Cambiar automáticamente a la pantalla de login después de un éxito
                setTimeout(() => {
                    if (showLoginLink) showLoginLink.click(); // Simular clic en enlace
                    loginUsernameInput.value = username; // Pre-rellenar usuario
                    loginPasswordInput.focus();
                    // Asegurar que el botón de registro se re-habilita por si el usuario vuelve
                    submitButton.disabled = false;
                }, 2500); // Esperar 2.5 seg para leer mensaje

            } catch (error) {
                console.error("Error en el proceso de registro:", error);
                registerError.textContent = error.message || 'No se pudo registrar el usuario.';
                submitButton.disabled = false; // Re-habilitar botón
                registerUsernameInput.focus(); // Devolver foco para corregir
                registerUsernameInput.select();
            }
        });
    } else {
        console.warn("Elemento del formulario de registro (#register) no encontrado.");
    }

    // Listeners para los enlaces que cambian entre formularios Login/Registro
    showRegisterLink?.addEventListener('click', (e) => {
        e.preventDefault();
        loginFormDiv.style.display = 'none';
        registerFormDiv.style.display = 'block';
        clearAuthMessages();
        if (registerUsernameInput) registerUsernameInput.focus();
    });

    showLoginLink?.addEventListener('click', (e) => {
        e.preventDefault();
        registerFormDiv.style.display = 'none';
        loginFormDiv.style.display = 'block';
        clearAuthMessages();
        if (loginUsernameInput) loginUsernameInput.focus();
    });

    // Listener para el Botón de Inicio (Ejemplo: usarlo para Logout)
    startButton?.addEventListener('click', (e) => {
        e.stopPropagation(); // Evitar que el listener global de click cierre el menú inmediatamente
        console.log("Botón Inicio clickeado. Toggle Menú.");
        // Llamar a la función de ui.js para mostrar/ocultar el menú
        if (window.ui && typeof window.ui.toggleStartMenu === 'function') {
            window.ui.toggleStartMenu();
        } else {
            console.error("Error: window.ui.toggleStartMenu no está disponible.");
        }
    });


    // --- Iniciar la Aplicación ---
    console.log("DOM completamente cargado y parseado. Iniciando Win98 Simulator...");
    initApp();

});
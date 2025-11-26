// main.js - Sistema de Gestión
// Gestión de navegación, sesiones y carga de módulos

// ===== CONFIGURACIÓN SUPABASE =====
const SUPABASE_URL = 'https://lpsupabase.luispinta.com';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.bZRDLg2HoJKCXPp_B6BD5s-qcZM6-NrKO8qtxBtFGTk';

// Crear instancia global de Supabase
let supabase;
if (window.GestionSupabase) {
    supabase = window.GestionSupabase;
} else {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
    });
    window.GestionSupabase = supabase;
}

// ===== VARIABLES GLOBALES =====
let currentUser = null;
let isAuthenticated = false;

// ===== CONTROL DE ACCESO =====
function checkAccess(allowedRoles) {
    // Si no se especifican roles, permitir acceso (público o solo autenticado)
    if (!allowedRoles || allowedRoles.length === 0) return true;

    const storedRoles = localStorage.getItem('gestion_user_roles');
    if (!storedRoles) return false;

    // Convertir roles del usuario a array (separados por coma)
    const userRoles = storedRoles.split(',').map(r => r.trim().toLowerCase());

    // Verificar si el usuario tiene rol de admin (acceso total)
    if (userRoles.includes('admin')) return true;

    // Verificar si tiene alguno de los roles permitidos
    return allowedRoles.some(role => userRoles.includes(role.toLowerCase()));
}

// ===== UTILIDADES =====
function showToast(message, type = 'info', duration = 3000) {
    // Crear contenedor si no existe
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed top-4 right-4 z-50 space-y-2';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} p-4 rounded-lg shadow-lg max-w-sm`;

    const icon = type === 'success' ? 'check-circle' :
        type === 'error' ? 'exclamation-circle' :
            type === 'warning' ? 'exclamation-triangle' : 'info-circle';

    toast.innerHTML = `
        <div class="flex items-center space-x-3">
            <i class="fas fa-${icon} text-lg"></i>
            <span class="flex-1">${message}</span>
            <button class="toast-close text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    // Estilos según tipo
    if (type === 'success') {
        toast.classList.add('bg-green-500', 'text-white');
    } else if (type === 'error') {
        toast.classList.add('bg-red-500', 'text-white');
    } else if (type === 'warning') {
        toast.classList.add('bg-yellow-500', 'text-black');
    } else {
        toast.classList.add('bg-blue-500', 'text-white');
    }

    toastContainer.appendChild(toast);

    // Remover automáticamente
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, duration);

    // Permitir cerrar manualmente
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
}

function showModal(title, message, onConfirm = null, confirmText = 'Confirmar', cancelText = 'Cancelar') {
    // Crear modal si no existe
    let modal = document.getElementById('confirmation-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'confirmation-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 id="modal-title" class="text-lg font-semibold text-gray-900"></h3>
                    <button id="modal-close" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <p id="modal-message" class="text-gray-600 mb-6"></p>
                <div class="flex justify-end space-x-3">
                    <button id="modal-cancel" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">${cancelText}</button>
                    <button id="modal-confirm" class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">${confirmText}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const titleEl = modal.querySelector('#modal-title');
    const messageEl = modal.querySelector('#modal-message');
    const confirmBtn = modal.querySelector('#modal-confirm');
    const cancelBtn = modal.querySelector('#modal-cancel');
    const closeBtn = modal.querySelector('#modal-close');

    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    modal.style.display = 'flex';

    const closeModal = () => {
        modal.style.display = 'none';
    };

    confirmBtn.onclick = () => {
        if (onConfirm) onConfirm();
        closeModal();
    };

    cancelBtn.onclick = closeModal;
    closeBtn.onclick = closeModal;
}

// ===== GESTIÓN DE PANTALLA DE CARGA =====
function showLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const app = document.getElementById('app');

    if (loadingScreen) {
        loadingScreen.classList.remove('fade-out');
        loadingScreen.style.display = 'flex';
    }

    if (app) {
        app.classList.remove('show');
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const app = document.getElementById('app');

    if (loadingScreen) {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 300);
    }

    if (app) {
        app.classList.add('show');
    }
}

// ===== GESTIÓN DE AUTENTICACIÓN =====
async function checkAuth() {
    try {
        // Mostrar pantalla de carga inmediatamente
        showLoadingScreen();

        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            // Pequeño delay para mostrar el mensaje de carga
            setTimeout(() => {
                hideUserInterface();
                window.location.href = 'login.html';
            }, 500);
            return false;
        }

        currentUser = user;
        isAuthenticated = true;

        // Ocultar pantalla de carga y mostrar app
        hideLoadingScreen();
        updateUserInterface();

        return true;
    } catch (error) {
        console.error('Error verificando autenticación:', error);

        // Pequeño delay para mostrar el mensaje de carga
        setTimeout(() => {
            hideUserInterface();
            window.location.href = 'login.html';
        }, 500);

        return false;
    }
}

function updateUserInterface() {
    if (!currentUser) return;

    // Actualizar información del usuario en el header
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
        // Intentar obtener nombre del localStorage primero (setado en login)
        const storedName = localStorage.getItem('gestion_user_name');
        const displayName = storedName ||
            currentUser.user_metadata?.full_name ||
            currentUser.email?.split('@')[0] ||
            'Usuario';
        userInfo.textContent = displayName;
    }

    // Mostrar y configurar el botón de logout
    const logoutContainer = document.getElementById('logout-btn');
    if (logoutContainer) {
        logoutContainer.classList.remove('hidden');
        logoutContainer.innerHTML = `
            <button onclick="window.GestionAuth.logout()"
                    class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors flex items-center">
                <i class="fas fa-sign-out-alt mr-2"></i>
                <span class="hidden sm:inline">Cerrar Sesión</span>
                <span class="sm:hidden">Salir</span>
            </button>
        `;
    }
}

function hideUserInterface() {
    // Ocultar el botón de logout
    const logoutContainer = document.getElementById('logout-btn');
    if (logoutContainer) {
        logoutContainer.classList.add('hidden');
        logoutContainer.innerHTML = '';
    }

    // Resetear información del usuario
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
        userInfo.textContent = 'Usuario';
    }
}

async function logout() {
    showModal(
        'Cerrar Sesión',
        '¿Está seguro que desea cerrar sesión?',
        async () => {
            try {
                // Limpiar datos locales
                localStorage.removeItem('gestion_remember_me');
                localStorage.removeItem('gestion_user_name');
                localStorage.removeItem('gestion_user_roles');

                // Cerrar sesión en Supabase
                const { error } = await supabase.auth.signOut();
                if (error) {
                    console.warn('Error al cerrar sesión en Supabase:', error);
                }

                // Limpiar variables globales
                currentUser = null;
                isAuthenticated = false;

                // Ocultar elementos de UI de usuario
                hideUserInterface();

                // Mostrar formulario de login
                window.location.href = 'login.html';

                showToast('Sesión cerrada correctamente', 'info');

            } catch (error) {
                console.error('Error en logout:', error);
                // Aún así limpiar y mostrar login
                currentUser = null;
                isAuthenticated = false;
                hideUserInterface();
                window.location.href = 'login.html';
            }
        }
    );
}

// ===== ESCUCHAR CAMBIOS DE AUTENTICACIÓN =====
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
        currentUser = null;
        isAuthenticated = false;
        hideUserInterface();
        window.location.href = 'login.html';
    } else if (event === 'SIGNED_IN') {
        currentUser = session?.user || null;
        isAuthenticated = true;
        updateUserInterface();
    }
});

// ===== EXPORTAR FUNCIONES GLOBALES =====
window.GestionAuth = {
    checkAuth,
    logout,
    showToast,
    showModal,
    supabase: () => supabase,
    getCurrentUser: () => currentUser,
    getUser: () => currentUser,
    isAuthenticated: () => isAuthenticated,
    checkAccess,
    hideUserInterface,
    updateUserInterface
};

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
    // Verificar autenticación al cargar la página
    checkAuth();
});

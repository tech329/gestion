// caja.js - Lógica del Módulo de Caja
(function () {
    const db = window.GestionAuth.supabase();

    // Elementos del DOM
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const resultsContainer = document.getElementById('results-container');
    const resultsBody = document.getElementById('results-body');
    const noResults = document.getElementById('no-results');

    let debounceTimer;
    let cachedData = [];
    let isLoadingData = false;

    // Inicialización
    document.addEventListener('DOMContentLoaded', async () => {
        // Esperar a que se cargue el usuario
        let attempts = 0;
        while (!window.GestionAuth.getUser() && attempts < 20) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        // Verificar acceso (caja o admin)
        if (!window.GestionAuth.checkAccess(['admin', 'caja'])) {
            alert('No tienes permiso para acceder a este módulo.');
            window.location.href = 'index.html';
            return;
        }

        // 1. Cargar datos del localStorage si existen (para inmediatez)
        loadFromLocalStorage();

        // 2. Iniciar carga en segundo plano (actualizar datos)
        fetchDataInBackground();

        setupEventListeners();
    });

    function setupEventListeners() {
        // Búsqueda dinámica al escribir
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                performSearch();
            }, 300);
        });

        searchBtn.addEventListener('click', performSearch);
    }

    function loadFromLocalStorage() {
        const stored = localStorage.getItem('gestion_caja_data');
        if (stored) {
            try {
                cachedData = JSON.parse(stored);
                console.log('Datos cargados de caché local:', cachedData.length, 'registros');
            } catch (e) {
                console.error('Error parseando caché local', e);
                localStorage.removeItem('gestion_caja_data');
            }
        }
    }

    async function fetchDataInBackground() {
        if (isLoadingData) return;
        isLoadingData = true;
        console.log('Iniciando carga de datos en segundo plano...');

        try {
            // Seleccionamos solo los campos necesarios para optimizar
            const { data, error } = await db
                .from('actas_creditos_tupakra')
                .select('id, cedula_socio, nombre_socio, monto_aprobado, credito, created_at')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                cachedData = data;
                localStorage.setItem('gestion_caja_data', JSON.stringify(data));
                console.log('Datos actualizados en segundo plano:', data.length, 'registros');

                // Si el usuario ya buscó algo, actualizar resultados con la nueva data
                if (searchInput.value.trim()) {
                    performSearch();
                }
            }

        } catch (error) {
            console.error('Error cargando datos en segundo plano:', error);
            // No mostramos error al usuario para no interrumpir, seguimos con caché si hay
        } finally {
            isLoadingData = false;
        }
    }

    function performSearch() {
        const term = searchInput.value.trim().toLowerCase();

        // Si el campo está vacío, limpiar resultados
        if (!term) {
            resultsContainer.classList.add('hidden');
            noResults.classList.add('hidden');
            resultsBody.innerHTML = '';
            return;
        }

        // Búsqueda local
        // Filtramos por cedula_socio O nombre_socio
        const filtered = cachedData.filter(item => {
            const cedula = (item.cedula_socio || '').toLowerCase();
            const nombre = (item.nombre_socio || '').toLowerCase();
            return cedula.includes(term) || nombre.includes(term);
        });

        // Limitar resultados a 20 para renderizado rápido
        renderResults(filtered.slice(0, 20));
    }

    function renderResults(data) {
        resultsBody.innerHTML = '';

        if (!data || data.length === 0) {
            resultsContainer.classList.add('hidden');
            noResults.classList.remove('hidden');
            // Si estamos cargando datos aún y no hay resultados, podríamos indicarlo
            if (isLoadingData && cachedData.length === 0) {
                noResults.textContent = 'Cargando base de datos, por favor espere...';
            } else {
                noResults.textContent = 'No se encontraron resultados para la búsqueda.';
            }
            return;
        }

        noResults.classList.add('hidden');
        resultsContainer.classList.remove('hidden');

        data.forEach(item => {
            const tr = document.createElement('tr');

            const viewUrl = `https://cajatupakrantina.webcoopec.com/view/${item.credito}`;

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.cedula_socio || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 uppercase">${item.nombre_socio || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">$${item.monto_aprobado || '0.00'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <a href="${viewUrl}" target="_blank" class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                        <i class="fas fa-eye mr-1.5"></i> Ver
                    </a>
                </td>
            `;
            resultsBody.appendChild(tr);
        });
    }

})();

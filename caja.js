// caja.js - Lógica del Módulo de Caja
(function () {
    // Obtener instancia de Supabase de forma segura (espera a que esté listo)
    let db = null;

    async function getDb() {
        if (db && db.from) return db;
        if (window.GestionSupabaseReady) {
            db = await window.GestionSupabaseReady;
        } else if (window.GestionSupabase) {
            db = window.GestionSupabase;
        }
        return db;
    }

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
            const supabase = await getDb();
            if (!supabase) throw new Error('Cliente Supabase no disponible');

            // Seleccionamos solo los campos necesarios para optimizar
            const { data, error } = await supabase
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

    // Navegación
    function showSection(sectionId) {
        // Ocultar menú
        document.getElementById('caja-menu').classList.add('hidden');

        // Ocultar todas las secciones
        document.getElementById('section-consultar-pago').classList.add('hidden');
        document.getElementById('section-papeletas').classList.add('hidden');
        document.getElementById('section-licitud-fondos').classList.add('hidden');

        // Mostrar sección solicitada
        document.getElementById(`section-${sectionId}`).classList.remove('hidden');

        // Si es papeletas, cargar datos si está vacío
        if (sectionId === 'papeletas') {
            if (papeletasData.length === 0) {
                loadPapeletas();
            }
        } else if (sectionId === 'licitud-fondos') {
            loadActividadesCIIU(); // Cargar actividades en segundo plano/caché
            if (licitudData.length === 0) {
                loadLicitudFondos();
            }
        }
    }

    function showMenu() {
        // Ocultar todas las secciones
        document.getElementById('section-consultar-pago').classList.add('hidden');
        document.getElementById('section-papeletas').classList.add('hidden');
        document.getElementById('section-licitud-fondos').classList.add('hidden');

        // Mostrar menú
        document.getElementById('caja-menu').classList.remove('hidden');
    }

    // Variables para Papeletas
    let papeletasData = [];
    let currentPapeletasPage = 1;
    const itemsPerPage = 10;
    let currentPapeletaDetail = null;

    // Elementos DOM Papeletas
    const papeletasContainer = document.getElementById('papeletas-container');
    const papeletasBody = document.getElementById('papeletas-body');
    const papeletasLoading = document.getElementById('papeletas-loading');
    const papeletasSearch = document.getElementById('papeletas-search');
    const papeletasPagination = document.getElementById('papeletas-pagination');
    const modalDetalle = document.getElementById('modal-detalle-papeleta');
    const detalleContent = document.getElementById('detalle-content');
    const modalReporte = document.getElementById('modal-reporte');
    const reportSort = document.getElementById('report-sort');

    // Setup Event Listeners para Papeletas
    if (papeletasSearch) {
        papeletasSearch.addEventListener('input', (e) => {
            currentPapeletasPage = 1;
            renderPapeletasTable();
        });
    }

    // Lógica de Papeletas
    async function loadPapeletas() {
        papeletasLoading.classList.remove('hidden');
        papeletasContainer.classList.add('hidden');

        try {
            const response = await fetch('https://lpwebhook.luispinta.com/webhook/consultapapeletas');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            papeletasData = await response.json();

            // Ordenar por fecha descendente por defecto
            papeletasData.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            renderPapeletasTable();

        } catch (error) {
            console.error('Error cargando papeletas:', error);
            papeletasBody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Error al cargar datos: ${error.message}</td></tr>`;
            papeletasContainer.classList.remove('hidden');
        } finally {
            papeletasLoading.classList.add('hidden');
            papeletasContainer.classList.remove('hidden');
        }
    }

    function renderPapeletasTable() {
        const searchTerm = papeletasSearch.value.toLowerCase();

        const filtered = papeletasData.filter(item => {
            const papeleta = (item.papeleta || '').toString();
            const socio = (item.socio || '').toLowerCase();
            const cedula = (item.cedula || '').toLowerCase();
            return papeleta.includes(searchTerm) || socio.includes(searchTerm) || cedula.includes(searchTerm);
        });

        // Paginación
        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        const start = (currentPapeletasPage - 1) * itemsPerPage;
        const paginated = filtered.slice(start, start + itemsPerPage);

        papeletasBody.innerHTML = '';

        if (paginated.length === 0) {
            papeletasBody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No se encontraron registros</td></tr>`;
            papeletasPagination.innerHTML = '';
            return;
        }

        paginated.forEach(item => {
            const tr = document.createElement('tr');
            const fecha = item.fecha ? new Date(item.fecha).toLocaleDateString('es-EC') : '-';
            const monto = parseFloat(item.monto_num || 0).toFixed(2);

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#${item.papeleta || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${fecha}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 uppercase">${item.socio || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.tipo_transaccion || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono">$${monto}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <button onclick="window.CajaModule.openDetailModal(${item.papeleta})" class="text-blue-600 hover:text-blue-900 mr-3" title="Ver Detalle">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="window.CajaModule.printPapeleta(${item.papeleta})" class="text-green-600 hover:text-green-900" title="Imprimir">
                        <i class="fas fa-print"></i>
                    </button>
                </td>
            `;
            papeletasBody.appendChild(tr);
        });

        renderPagination(filtered.length, totalPages);
    }

    function renderPagination(totalItems, totalPages) {
        let paginationHtml = `
            <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                    <p class="text-sm text-gray-700">
                        Mostrando <span class="font-medium">${Math.min((currentPapeletasPage - 1) * itemsPerPage + 1, totalItems)}</span> a <span class="font-medium">${Math.min(currentPapeletasPage * itemsPerPage, totalItems)}</span> de <span class="font-medium">${totalItems}</span> resultados
                    </p>
                </div>
                <div>
                    <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button onclick="window.CajaModule.changePage(${currentPapeletasPage - 1})" ${currentPapeletasPage === 1 ? 'disabled' : ''} class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${currentPapeletasPage === 1 ? 'cursor-not-allowed opacity-50' : ''}">
                            <span class="sr-only">Anterior</span>
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <button onclick="window.CajaModule.changePage(${currentPapeletasPage + 1})" ${currentPapeletasPage === totalPages ? 'disabled' : ''} class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${currentPapeletasPage === totalPages ? 'cursor-not-allowed opacity-50' : ''}">
                            <span class="sr-only">Siguiente</span>
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </nav>
                </div>
            </div>
        `;
        papeletasPagination.innerHTML = paginationHtml;
    }

    function changePage(newPage) {
        currentPapeletasPage = newPage;
        renderPapeletasTable();
    }

    // Modales
    function openDetailModal(papeletaNum) {
        const item = papeletasData.find(i => i.papeleta === papeletaNum);
        if (!item) return;

        currentPapeletaDetail = item;

        const fecha = item.fecha ? new Date(item.fecha).toLocaleString('es-EC') : '-';
        const monto = parseFloat(item.monto_num || 0).toFixed(2);

        detalleContent.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div><span class="font-bold text-gray-700">Papeleta:</span> ${item.papeleta}</div>
                <div><span class="font-bold text-gray-700">Fecha:</span> ${fecha}</div>
                <div class="col-span-2"><span class="font-bold text-gray-700">Socio:</span> ${item.socio}</div>
                <div><span class="font-bold text-gray-700">Cédula:</span> ${item.cedula}</div>
                <div><span class="font-bold text-gray-700">Cuenta:</span> ${item.numero_cuenta || '-'}</div>
                <div class="col-span-2"><span class="font-bold text-gray-700">Operación:</span> ${item.tipo_operacion}</div>
                <div><span class="font-bold text-gray-700">Monto:</span> $${monto}</div>
                <div><span class="font-bold text-gray-700">Responsable:</span> ${item.responsable}</div>
                <div class="col-span-2 border-t pt-2 mt-2">
                    <span class="font-bold text-gray-700">Monto en Letras:</span><br>
                    <span class="italic text-gray-600">${item.monto_letras}</span>
                </div>
            </div>
        `;

        modalDetalle.classList.remove('hidden');
    }

    function closeDetailModal() {
        modalDetalle.classList.add('hidden');
        currentPapeletaDetail = null;
    }

    function openReportModal() {
        modalReporte.classList.remove('hidden');
    }

    function closeReportModal() {
        modalReporte.classList.add('hidden');
    }

    // Impresión
    function printPapeletaFromModal() {
        if (currentPapeletaDetail) {
            printPapeleta(currentPapeletaDetail.papeleta);
        }
    }

    function printPapeleta(papeletaNum) {
        const item = papeletasData.find(i => i.papeleta === papeletaNum);
        if (!item) return;

        const fecha = item.fecha ? new Date(item.fecha).toLocaleDateString('es-EC') : '-';
        const hora = item.fecha ? new Date(item.fecha).toLocaleTimeString('es-EC') : '-';
        const monto = parseFloat(item.monto_num || 0).toFixed(2);

        // Branding Colors
        const cPrimary = '#001749';
        const cAccent = '#e48410';
        const logoUrl = 'https://lh3.googleusercontent.com/d/1idgiPohtekZVIYJ-pmza9PSQqEamUvfH=w2048?name=TUPAK%20RANTINA%20(2).png';

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Papeleta_${item.papeleta}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
                    body { font-family: 'Roboto', sans-serif; margin: 0; padding: 20px; color: #333; font-size: 12px; }
                    .container { max-width: 800px; margin: 0 auto; border: 1px solid #ccc; padding: 20px; }
                    
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${cAccent}; padding-bottom: 10px; margin-bottom: 20px; }
                    .logo { max-height: 50px; }
                    .title-box { text-align: right; }
                    .title-box h1 { margin: 0; color: ${cPrimary}; font-size: 18px; text-transform: uppercase; }
                    .title-box p { margin: 2px 0 0; color: #666; font-size: 12px; }

                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
                    .info-row { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                    .label { font-weight: bold; color: ${cPrimary}; }
                    
                    .amount-box { background: #f9f9f9; padding: 10px; border: 1px solid #ddd; text-align: center; margin-bottom: 20px; }
                    .amount-label { font-size: 10px; text-transform: uppercase; color: #666; }
                    .amount-value { font-size: 24px; font-weight: bold; color: ${cPrimary}; }
                    .amount-words { font-style: italic; font-size: 11px; margin-top: 5px; }

                    .footer { margin-top: 40px; display: flex; justify-content: space-between; }
                    .signature-box { width: 40%; text-align: center; border-top: 1px solid #333; padding-top: 5px; }
                    .signature-label { font-size: 10px; color: #666; }

                    @media print {
                        body { padding: 0; }
                        .container { border: none; }
                        @page { margin: 0.5cm; size: A5 landscape; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <img src="${logoUrl}" alt="Tupak Rantina" class="logo">
                        <div class="title-box">
                            <h1>Comprobante de Transacción</h1>
                            <p>Nº Papeleta: <strong>${item.papeleta}</strong></p>
                        </div>
                    </div>

                    <div class="info-grid">
                        <div>
                            <div class="info-row"><span class="label">Fecha:</span> <span>${fecha}</span></div>
                            <div class="info-row"><span class="label">Hora:</span> <span>${hora}</span></div>
                            <div class="info-row"><span class="label">Oficina:</span> <span>MATRIZ</span></div>
                        </div>
                        <div>
                            <div class="info-row"><span class="label">Cuenta:</span> <span>${item.numero_cuenta || '-'}</span></div>
                            <div class="info-row"><span class="label">Tipo:</span> <span>${item.tipo_transaccion}</span></div>
                            <div class="info-row"><span class="label">Responsable:</span> <span>${item.responsable}</span></div>
                        </div>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <div class="info-row"><span class="label">Socio:</span> <span>${item.socio}</span></div>
                        <div class="info-row"><span class="label">Cédula:</span> <span>${item.cedula}</span></div>
                        <div class="info-row"><span class="label">Operación:</span> <span>${item.tipo_operacion}</span></div>
                    </div>

                    <div class="amount-box">
                        <div class="amount-label">Monto de la Transacción</div>
                        <div class="amount-value">$${monto}</div>
                        <div class="amount-words">${item.monto_letras}</div>
                    </div>

                    <div class="footer">
                        <div class="signature-box">
                            <div class="signature-label">Firma del Socio / Cliente</div>
                            <div style="margin-top: 5px;">${item.cedula}</div>
                        </div>
                        <div class="signature-box">
                            <div class="signature-label">Cajero(a)</div>
                            <div style="margin-top: 5px;">${item.responsable}</div>
                        </div>
                    </div>
                </div>
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        const win = window.open('', '_blank');
        win.document.write(htmlContent);
        win.document.close();
    }

    function generateReport() {
        closeReportModal();
        const sortField = reportSort.value;
        const fechaActual = new Date().toLocaleDateString('es-EC');
        const user = window.GestionAuth.getUser();
        const generatedBy = user ? user.email : 'Usuario del Sistema';

        // Copia y ordena datos
        let reportData = [...papeletasData];
        reportData.sort((a, b) => {
            if (sortField === 'fecha') return new Date(b.fecha) - new Date(a.fecha);
            if (sortField === 'papeleta') return b.papeleta - a.papeleta;
            if (sortField === 'socio') return a.socio.localeCompare(b.socio);
            return 0;
        });

        // Branding Colors
        const cPrimary = '#001749';
        const logoUrl = 'https://lh3.googleusercontent.com/d/1idgiPohtekZVIYJ-pmza9PSQqEamUvfH=w2048?name=TUPAK%20RANTINA%20(2).png';

        const rows = reportData.map((item, index) => `
            <tr style="background-color: ${index % 2 === 0 ? '#fff' : '#f9fafb'};">
                <td style="padding: 6px; border-bottom: 1px solid #eee;">${item.papeleta}</td>
                <td style="padding: 6px; border-bottom: 1px solid #eee;">${item.fecha ? new Date(item.fecha).toLocaleDateString('es-EC') : '-'}</td>
                <td style="padding: 6px; border-bottom: 1px solid #eee;">${item.socio}</td>
                <td style="padding: 6px; border-bottom: 1px solid #eee;">${item.cedula}</td>
                <td style="padding: 6px; border-bottom: 1px solid #eee;">${item.tipo_operacion}</td>
                <td style="padding: 6px; border-bottom: 1px solid #eee; text-align: right;">$${parseFloat(item.monto_num).toFixed(2)}</td>
            </tr>
        `).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Reporte_Papeletas_${fechaActual}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
                    body { font-family: 'Roboto', sans-serif; margin: 0; padding: 20px; color: #333; font-size: 10px; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${cPrimary}; padding-bottom: 10px; margin-bottom: 20px; }
                    .logo { height: 40px; }
                    .title { font-size: 16px; font-weight: bold; color: ${cPrimary}; }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: ${cPrimary}; color: white; padding: 6px; text-align: left; font-size: 10px; }
                    td { font-size: 10px; }
                    @media print { @page { margin: 1cm; size: landscape; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="${logoUrl}" alt="Logo" class="logo">
                    <div>
                        <div class="title">Reporte de Papeletas</div>
                        <div>Fecha: ${fechaActual} | Generado por: ${generatedBy}</div>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Papeleta</th>
                            <th>Fecha</th>
                            <th>Socio</th>
                            <th>Cédula</th>
                            <th>Tipo</th>
                            <th style="text-align: right;">Monto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;

        const win = window.open('', '_blank');
        win.document.write(htmlContent);
        win.document.close();
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

    // ==========================================
    // Lógica de Licitud de Fondos
    // ==========================================

    // Variables
    let licitudData = [];
    let actividadesCache = [];
    let currentLicitudPage = 1;
    let currentLicitudDetail = null;
    let isEditingLicitud = false;

    // Elementos DOM
    const licitudContainer = document.getElementById('licitud-container');
    const licitudBody = document.getElementById('licitud-body');
    const licitudLoading = document.getElementById('licitud-loading');
    const licitudSearch = document.getElementById('licitud-search');
    const licitudPagination = document.getElementById('licitud-pagination');

    // Formulario
    const modalLicitudForm = document.getElementById('modal-licitud-form');
    const licitudForm = document.getElementById('licitud-form');
    const licitudActividadInput = document.getElementById('licitud-actividad-input');
    const licitudActividadList = document.getElementById('licitud-actividad-list');
    const licitudActividadCodigo = document.getElementById('licitud-actividad-codigo');

    // Modales Detalle y Reporte
    const modalLicitudDetalle = document.getElementById('modal-licitud-detalle');
    const licitudDetalleContent = document.getElementById('licitud-detalle-content');
    const modalLicitudReporte = document.getElementById('modal-licitud-reporte');
    const licitudReportSort = document.getElementById('licitud-report-sort');

    // Event Listeners
    if (licitudSearch) {
        licitudSearch.addEventListener('input', () => {
            currentLicitudPage = 1;
            renderLicitudTable();
        });
    }

    // Cedula Lookup
    const licitudIdentificacion = document.getElementById('licitud-identificacion');
    if (licitudIdentificacion) {
        licitudIdentificacion.addEventListener('input', async (e) => {
            const val = e.target.value.replace(/\D/g, ''); // Solo números
            e.target.value = val;

            if (val.length === 10) {
                await searchLicitudCedula(val);
            }
        });
    }

    async function searchLicitudCedula(cedula) {
        const nombresInput = document.getElementById('licitud-nombres');
        // Mostrar indicador de carga visual si se desea, o cambiar cursor
        nombresInput.placeholder = "Buscando...";
        document.body.style.cursor = 'wait';

        try {
            const response = await fetch('https://lpwebhook.luispinta.com/webhook/15581914-f69b-4950-a772-65d2102978f2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cedula: cedula })
            });

            if (response.ok) {
                const data = await response.json();
                // Esperamos un array: [{ "cedula": "...", "encontrado": true, "nombre": "..." }]
                if (Array.isArray(data) && data.length > 0 && data[0].encontrado) {
                    nombresInput.value = data[0].nombre.toUpperCase();
                } else {
                    // No encontrado o formato diferente, permitir manual
                    console.log('Cédula no encontrada en webhook');
                }
            }
        } catch (error) {
            console.error('Error buscando cédula:', error);
        } finally {
            nombresInput.placeholder = "Nombre del socio/cliente";
            document.body.style.cursor = 'default';
        }
    }

    if (licitudActividadInput) {
        licitudActividadInput.addEventListener('input', (e) => {
            filterActividades(e.target.value);
        });

        // Cerrar lista al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!licitudActividadInput.contains(e.target) && !licitudActividadList.contains(e.target)) {
                licitudActividadList.classList.add('hidden');
            }
        });
    }

    // Carga de Actividades CIIU
    async function loadActividadesCIIU() {
        const stored = localStorage.getItem('gestion_actividades_ciiu');
        if (stored) {
            actividadesCache = JSON.parse(stored);
            return;
        }

        try {
            const supabase = await getDb();
            if (!supabase) throw new Error('Cliente Supabase no disponible');

            const { data, error } = await supabase
                .from('actividades_ciiu')
                .select('codigo, actividad')
                .eq('clasificacion', 'SUBNIVEL ACTIVIDAD');

            if (error) throw error;

            if (data) {
                // Normalizar texto: "CULTIVO DE TRIGO" -> "Cultivo de trigo"
                actividadesCache = data.map(item => ({
                    codigo: item.codigo,
                    actividad: normalizeSentenceCase(item.actividad),
                    fullText: `${item.codigo} - ${normalizeSentenceCase(item.actividad)}`
                }));

                localStorage.setItem('gestion_actividades_ciiu', JSON.stringify(actividadesCache));
            }
        } catch (error) {
            console.error('Error cargando actividades CIIU:', error);
        }
    }

    function normalizeSentenceCase(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    function filterActividades(term) {
        if (!term) {
            licitudActividadList.classList.add('hidden');
            return;
        }

        const lowerTerm = term.toLowerCase();
        const filtered = actividadesCache.filter(item =>
            item.fullText.toLowerCase().includes(lowerTerm)
        ).slice(0, 50); // Limitar a 50 resultados

        if (filtered.length === 0) {
            licitudActividadList.classList.add('hidden');
            return;
        }

        licitudActividadList.innerHTML = filtered.map(item => `
            <div class="cursor-pointer hover:bg-gray-100 px-4 py-2" 
                 onclick="window.CajaModule.selectActividad('${item.codigo}', '${item.actividad}')">
                <span class="font-mono text-gray-500 mr-2">${item.codigo}</span>
                <span>${item.actividad}</span>
            </div>
        `).join('');

        licitudActividadList.classList.remove('hidden');
    }

    function selectActividad(codigo, actividad) {
        licitudActividadInput.value = `${codigo} - ${actividad}`;
        licitudActividadCodigo.value = codigo;
        licitudActividadList.classList.add('hidden');
    }

    // CRUD Licitud
    async function loadLicitudFondos() {
        licitudLoading.classList.remove('hidden');
        licitudContainer.classList.add('hidden');

        try {
            const supabase = await getDb();
            if (!supabase) throw new Error('Cliente Supabase no disponible');

            const user = window.GestionAuth.getUser();
            const isAdmin = window.GestionAuth.checkAccess(['admin']);

            let query = supabase
                .from('licitud_fondos')
                .select('*')
                .order('fecha_ingreso', { ascending: false });

            // Si no es admin, filtrar por su email
            if (!isAdmin && user) {
                query = query.eq('user_email', user.email);
            }

            const { data, error } = await query;

            if (error) throw error;

            licitudData = data || [];
            renderLicitudTable();

        } catch (error) {
            console.error('Error cargando licitud de fondos:', error);
            licitudBody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Error al cargar datos: ${error.message}</td></tr>`;
        } finally {
            licitudLoading.classList.add('hidden');
            licitudContainer.classList.remove('hidden');
        }
    }

    function renderLicitudTable() {
        const searchTerm = licitudSearch.value.toLowerCase();

        const filtered = licitudData.filter(item => {
            const nombres = (item.nombres_completos || '').toLowerCase();
            const cedula = (item.identificacion || '').toLowerCase();
            return nombres.includes(searchTerm) || cedula.includes(searchTerm);
        });

        // Paginación
        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        const start = (currentLicitudPage - 1) * itemsPerPage;
        const paginated = filtered.slice(start, start + itemsPerPage);

        licitudBody.innerHTML = '';

        if (paginated.length === 0) {
            licitudBody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No se encontraron registros</td></tr>`;
            licitudPagination.innerHTML = '';
            return;
        }

        paginated.forEach(item => {
            const tr = document.createElement('tr');
            const fecha = item.fecha_ingreso ? new Date(item.fecha_ingreso).toLocaleDateString('es-EC', { timeZone: 'UTC' }) : '-';
            const valor = parseFloat(item.valor_operacion || 0).toFixed(2);

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${fecha}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${item.transaccion || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.identificacion || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 uppercase">${item.nombres_completos || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono">$${valor}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <button onclick="window.CajaModule.openDetailLicitudModal('${item.id}')" class="text-blue-600 hover:text-blue-900 mr-3" title="Ver Detalle">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="window.CajaModule.openEditLicitudModal('${item.id}')" class="text-indigo-600 hover:text-indigo-900" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
            licitudBody.appendChild(tr);
        });

        renderLicitudPagination(filtered.length, totalPages);
    }

    function renderLicitudPagination(totalItems, totalPages) {
        let paginationHtml = `
            <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                    <p class="text-sm text-gray-700">
                        Mostrando <span class="font-medium">${Math.min((currentLicitudPage - 1) * itemsPerPage + 1, totalItems)}</span> a <span class="font-medium">${Math.min(currentLicitudPage * itemsPerPage, totalItems)}</span> de <span class="font-medium">${totalItems}</span> resultados
                    </p>
                </div>
                <div>
                    <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button onclick="window.CajaModule.changeLicitudPage(${currentLicitudPage - 1})" ${currentLicitudPage === 1 ? 'disabled' : ''} class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${currentLicitudPage === 1 ? 'cursor-not-allowed opacity-50' : ''}">
                            <span class="sr-only">Anterior</span>
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <button onclick="window.CajaModule.changeLicitudPage(${currentLicitudPage + 1})" ${currentLicitudPage === totalPages ? 'disabled' : ''} class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${currentLicitudPage === totalPages ? 'cursor-not-allowed opacity-50' : ''}">
                            <span class="sr-only">Siguiente</span>
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </nav>
                </div>
            </div>
        `;
        licitudPagination.innerHTML = paginationHtml;
    }

    function changeLicitudPage(newPage) {
        currentLicitudPage = newPage;
        renderLicitudTable();
    }

    // Modal Functions
    function openNewLicitudModal() {
        isEditingLicitud = false;
        document.getElementById('modal-licitud-title').textContent = 'Nueva Licitud de Fondos';
        licitudForm.reset();
        document.getElementById('licitud-id').value = '';
        licitudActividadCodigo.value = '';

        // Defaults
        document.getElementById('licitud-agencia').value = 'MATRIZ';
        const today = new Date();
        // Ajustar zona horaria si es necesario, o usar local
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        document.getElementById('licitud-fecha').value = `${yyyy}-${mm}-${dd}`;

        modalLicitudForm.classList.remove('hidden');
    }

    function openEditLicitudModal(id) {
        const item = licitudData.find(i => i.id === id);
        if (!item) return;

        isEditingLicitud = true;
        document.getElementById('modal-licitud-title').textContent = 'Editar Licitud de Fondos';

        document.getElementById('licitud-id').value = item.id;
        document.getElementById('licitud-agencia').value = item.agencia || '';
        document.getElementById('licitud-transaccion').value = item.transaccion || '';
        document.getElementById('licitud-fecha').value = item.fecha_ingreso || '';
        document.getElementById('licitud-identificacion').value = item.identificacion || '';
        document.getElementById('licitud-nombres').value = item.nombres_completos || '';
        document.getElementById('licitud-actividad-input').value = item.actividad_economica || '';
        // Intentar extraer código si está en el formato "CODIGO - Actividad"
        const parts = (item.actividad_economica || '').split(' - ');
        document.getElementById('licitud-actividad-codigo').value = parts.length > 1 ? parts[0] : '';

        document.getElementById('licitud-documento').value = item.documento || '';
        document.getElementById('licitud-valor').value = item.valor_operacion || '';
        document.getElementById('licitud-observacion').value = item.observacion || '';

        modalLicitudForm.classList.remove('hidden');
    }

    function closeLicitudModal() {
        modalLicitudForm.classList.add('hidden');
    }

    async function saveLicitud() {
        const user = window.GestionAuth.getUser();
        if (!user) {
            alert('Sesión expirada. Por favor inicie sesión nuevamente.');
            return;
        }

        const formData = {
            agencia: document.getElementById('licitud-agencia').value,
            transaccion: document.getElementById('licitud-transaccion').value,
            fecha_ingreso: document.getElementById('licitud-fecha').value,
            identificacion: document.getElementById('licitud-identificacion').value,
            nombres_completos: document.getElementById('licitud-nombres').value.toUpperCase(),
            actividad_economica: document.getElementById('licitud-actividad-input').value,
            documento: document.getElementById('licitud-documento').value,
            valor_operacion: parseFloat(document.getElementById('licitud-valor').value),
            observacion: document.getElementById('licitud-observacion').value,
            usuario_transaccion: user.email,
            user_email: user.email
        };

        const id = document.getElementById('licitud-id').value;

        try {
            const supabase = await getDb();
            let error;
            if (isEditingLicitud && id) {
                // Update
                const { error: updateError } = await supabase
                    .from('licitud_fondos')
                    .update({ ...formData, updated_at: new Date() })
                    .eq('id', id);
                error = updateError;
            } else {
                // Insert
                const { error: insertError } = await supabase
                    .from('licitud_fondos')
                    .insert([formData]);
                error = insertError;
            }

            if (error) throw error;

            alert('Registro guardado exitosamente');
            closeLicitudModal();
            loadLicitudFondos(); // Recargar tabla

        } catch (error) {
            console.error('Error guardando licitud:', error);
            alert('Error al guardar: ' + error.message);
        }
    }

    function openDetailLicitudModal(id) {
        const item = licitudData.find(i => i.id === id);
        if (!item) return;

        const fecha = item.fecha_ingreso ? new Date(item.fecha_ingreso).toLocaleDateString('es-EC', { timeZone: 'UTC' }) : '-';
        const valor = parseFloat(item.valor_operacion || 0).toFixed(2);

        licitudDetalleContent.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div><span class="font-bold text-gray-700">Agencia:</span> ${item.agencia || '-'}</div>
                <div><span class="font-bold text-gray-700">Transacción:</span> ${item.transaccion || '-'}</div>
                <div><span class="font-bold text-gray-700">Fecha:</span> ${fecha}</div>
                <div><span class="font-bold text-gray-700">Valor:</span> $${valor}</div>
                <div class="col-span-2"><span class="font-bold text-gray-700">Socio:</span> ${item.nombres_completos}</div>
                <div><span class="font-bold text-gray-700">Identificación:</span> ${item.identificacion}</div>
                <div><span class="font-bold text-gray-700">Documento:</span> ${item.documento || '-'}</div>
                <div class="col-span-2"><span class="font-bold text-gray-700">Actividad:</span> ${item.actividad_economica || '-'}</div>
                <div class="col-span-2"><span class="font-bold text-gray-700">Observación:</span> ${item.observacion || '-'}</div>
                <div class="col-span-2 text-xs text-gray-500 mt-2 border-t pt-2">
                    Registrado por: ${item.usuario_transaccion || '-'}<br>
                    Fecha registro: ${new Date(item.created_at).toLocaleString()}
                </div>
            </div>
        `;
        modalLicitudDetalle.classList.remove('hidden');
    }

    function closeLicitudDetailModal() {
        modalLicitudDetalle.classList.add('hidden');
    }

    // Reporte Licitud
    function openLicitudReportModal() {
        modalLicitudReporte.classList.remove('hidden');
    }

    function closeLicitudReportModal() {
        modalLicitudReporte.classList.add('hidden');
    }

    function generateLicitudReport() {
        closeLicitudReportModal();
        const sortField = licitudReportSort.value;
        const fechaActual = new Date().toLocaleDateString('es-EC');
        const user = window.GestionAuth.getUser();

        let reportData = [...licitudData];
        reportData.sort((a, b) => {
            if (sortField === 'fecha') return new Date(b.fecha_ingreso) - new Date(a.fecha_ingreso);
            if (sortField === 'nombres') return (a.nombres_completos || '').localeCompare(b.nombres_completos || '');
            if (sortField === 'valor') return (b.valor_operacion || 0) - (a.valor_operacion || 0);
            return 0;
        });

        const cPrimary = '#001749';
        const logoUrl = 'https://lh3.googleusercontent.com/d/1idgiPohtekZVIYJ-pmza9PSQqEamUvfH=w2048?name=TUPAK%20RANTINA%20(2).png';

        const rows = reportData.map((item, index) => `
            <tr style="background-color: ${index % 2 === 0 ? '#fff' : '#f9fafb'};">
                <td style="padding: 6px; border-bottom: 1px solid #eee;">${item.fecha_ingreso ? new Date(item.fecha_ingreso).toLocaleDateString('es-EC', { timeZone: 'UTC' }) : '-'}</td>
                <td style="padding: 6px; border-bottom: 1px solid #eee;">${item.transaccion || '-'}</td>
                <td style="padding: 6px; border-bottom: 1px solid #eee;">${item.identificacion || '-'}</td>
                <td style="padding: 6px; border-bottom: 1px solid #eee;">${item.nombres_completos || '-'}</td>
                <td style="padding: 6px; border-bottom: 1px solid #eee;">${item.actividad_economica || '-'}</td>
                <td style="padding: 6px; border-bottom: 1px solid #eee; text-align: right;">$${parseFloat(item.valor_operacion || 0).toFixed(2)}</td>
            </tr>
        `).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Reporte_Licitud_${fechaActual}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
                    body { font-family: 'Roboto', sans-serif; margin: 0; padding: 20px; color: #333; font-size: 10px; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${cPrimary}; padding-bottom: 10px; margin-bottom: 20px; }
                    .logo { height: 40px; }
                    .title { font-size: 16px; font-weight: bold; color: ${cPrimary}; }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: ${cPrimary}; color: white; padding: 6px; text-align: left; font-size: 10px; }
                    td { font-size: 10px; }
                    @media print { @page { margin: 1cm; size: landscape; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="${logoUrl}" alt="Logo" class="logo">
                    <div>
                        <div class="title">Reporte de Licitud de Fondos</div>
                        <div>Fecha: ${fechaActual} | Generado por: ${user ? user.email : 'Sistema'}</div>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Transacción</th>
                            <th>Identificación</th>
                            <th>Nombres</th>
                            <th>Actividad Económica</th>
                            <th style="text-align: right;">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;

        const win = window.open('', '_blank');
        win.document.write(htmlContent);
        win.document.close();
    }

    // Exponer funciones globalmente
    window.CajaModule = {
        showSection,
        showMenu,
        loadPapeletas,
        changePage,
        openDetailModal,
        closeDetailModal,
        printPapeleta,
        printPapeletaFromModal,
        openReportModal,
        closeReportModal,
        generateReport,
        // Licitud Exports
        loadLicitudFondos,
        selectActividad,
        changeLicitudPage,
        openNewLicitudModal,
        openEditLicitudModal,
        closeLicitudModal,
        saveLicitud,
        openDetailLicitudModal,
        closeLicitudDetailModal,
        openLicitudReportModal,
        closeLicitudReportModal,
        generateLicitudReport
    };


})();

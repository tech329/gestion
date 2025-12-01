// pagares.js - Lógica del Módulo de Pagarés
(function () {
    const db = window.GestionAuth.supabase();

    // Estado local
    let pagaresData = [];
    let currentFilters = {
        search: '',
        status: 'all' // all, regularizado, no-regularizado
    };
    let currentSort = {
        field: 'created_at',
        order: 'desc'
    };

    // ===== ELEMENTOS DEL DOM =====
    const tableBody = document.getElementById('pagares-table-body');
    const searchInput = document.getElementById('search-input');
    const filterSelect = document.getElementById('filter-select');
    const totalRecordsEl = document.getElementById('total-records');

    // Modal de Confirmación
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmOkBtn = document.getElementById('confirm-ok-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    let pendingAction = null;

    // ===== INICIALIZACIÓN =====
    document.addEventListener('DOMContentLoaded', () => {
        // Verificar acceso nuevamente (aunque ya se hace en el HTML)
        // Verificar acceso nuevamente (aunque ya se hace en el HTML)
        if (!window.GestionAuth.checkAccess(['admin', 'pagares'])) return;

        loadPagares();
        setupEventListeners();
    });

    function setupEventListeners() {
        // Búsqueda
        searchInput.addEventListener('input', (e) => {
            currentFilters.search = e.target.value;
            applyFilters();
        });

        // Filtro Estado
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                currentFilters.status = e.target.value;
                applyFilters();
            });
        }

        // Confirm Modal
        if (confirmOkBtn) {
            confirmOkBtn.addEventListener('click', () => {
                if (pendingAction) pendingAction();
                closeConfirmModal();
            });
        }
        if (confirmCancelBtn) {
            confirmCancelBtn.addEventListener('click', closeConfirmModal);
        }
    }

    // ===== FUNCIONES PRINCIPALES =====
    async function loadPagares() {
        setLoadingTable(true);
        try {
            const { data, error } = await db
                .from('actas_creditos_tupakra')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            pagaresData = data || [];
            applyFilters();
        } catch (error) {
            console.error('Error cargando pagarés:', error);
            window.GestionAuth.showToast('Error al cargar los datos', 'error');
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-red-500">Error al cargar datos</td></tr>';
        } finally {
            setLoadingTable(false);
        }
    }

    function applyFilters() {
        let filtered = [...pagaresData];

        // Filtro Búsqueda
        if (currentFilters.search) {
            const term = currentFilters.search.toLowerCase();
            filtered = filtered.filter(item =>
                (item.cedula_socio && item.cedula_socio.toLowerCase().includes(term)) ||
                (item.nombre_socio && item.nombre_socio.toLowerCase().includes(term)) ||
                (item.credito && item.credito.toLowerCase().includes(term))
            );
        }

        // Filtro Estado
        if (currentFilters.status !== 'all') {
            const isRegularizado = currentFilters.status === 'regularizado';
            filtered = filtered.filter(item => item.regularizado === isRegularizado);
        }

        // Ordenamiento
        filtered.sort((a, b) => {
            let valA = a[currentSort.field] || '';
            let valB = b[currentSort.field] || '';

            if (currentSort.field === 'created_at' || currentSort.field === 'fecha_hora') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            } else if (currentSort.field === 'monto_aprobado' || currentSort.field === 'credito') {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            } else {
                valA = String(valA).toLowerCase();
                valB = String(valB).toLowerCase();
            }

            if (valA < valB) return currentSort.order === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.order === 'asc' ? 1 : -1;
            return 0;
        });

        updateSortIcons();
        renderTable(filtered);
    }

    function sortBy(field) {
        if (currentSort.field === field) {
            currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.field = field;
            currentSort.order = 'asc';
        }
        applyFilters();
    }

    function updateSortIcons() {
        // Reset all icons
        document.querySelectorAll('.sort-icon').forEach(icon => {
            icon.className = 'fas fa-sort sort-icon ml-1 text-gray-400';
        });

        // Update active icon
        const activeHeader = document.querySelector(`th[data-sort="${currentSort.field}"]`);
        if (activeHeader) {
            const icon = activeHeader.querySelector('.sort-icon');
            if (icon) {
                icon.className = `fas fa-sort-${currentSort.order === 'asc' ? 'up' : 'down'} sort-icon ml-1 text-purple-600`;
            }
        }
    }

    function renderTable(data) {
        totalRecordsEl.textContent = `${data.length} registros`;
        tableBody.innerHTML = '';

        if (data.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-4 text-center text-gray-500">
                        No se encontraron registros
                    </td>
                </tr>
            `;
            return;
        }

        data.forEach(item => {
            const tr = document.createElement('tr');
            const isRegularizado = item.regularizado;
            tr.className = `transition-colors ${!isRegularizado ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-gray-50'}`;

            const fecha = item.fecha_hora ? new Date(item.fecha_hora).toLocaleDateString('es-EC') : '-';
            const pagare = item.credito ? item.credito.toString().padStart(4, '0') : '-';

            tr.innerHTML = `
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${fecha}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">${item.cedula_socio || '-'}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-700 uppercase font-bold">${item.nombre_socio || '-'}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 font-mono">$${item.monto_aprobado || '0.00'}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 font-mono font-bold">${pagare}</td>
                <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-500">${item.asesor_credito || '-'}</td>
                <td class="px-3 py-2 whitespace-nowrap text-center">
                    <button onclick="window.PagaresModule.toggleRegularizado(${item.id}, ${isRegularizado})" 
                            class="focus:outline-none transition-transform hover:scale-110"
                            title="${isRegularizado ? 'Marcar como No Regularizado' : 'Marcar como Regularizado'}">
                        <i class="fas ${isRegularizado ? 'fa-check-circle text-green-500' : 'fa-times-circle text-red-500'} text-lg"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    function setLoadingTable(isLoading) {
        if (isLoading) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-10 text-center">
                        <div class="flex justify-center items-center">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                            <span class="ml-2 text-gray-600">Cargando datos...</span>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    // ===== ACCIONES =====
    function toggleRegularizado(id, currentStatus) {
        const item = pagaresData.find(i => i.id === id);
        const nombreSocio = item ? item.nombre_socio : 'este socio';
        const actionText = !currentStatus ? 'regularizado' : 'no regularizado';

        confirmMessage.textContent = `¿Estás seguro que el pagaré de ${nombreSocio} está ${actionText}?`;

        pendingAction = async () => {
            try {
                const newStatus = !currentStatus;

                // Optimistic update
                const itemIndex = pagaresData.findIndex(i => i.id === id);
                if (itemIndex !== -1) {
                    pagaresData[itemIndex].regularizado = newStatus;
                    applyFilters();
                }

                const { error } = await db
                    .from('actas_creditos_tupakra')
                    .update({ regularizado: newStatus })
                    .eq('id', id);

                if (error) {
                    // Revertir
                    if (itemIndex !== -1) {
                        pagaresData[itemIndex].regularizado = currentStatus;
                        applyFilters();
                    }
                    throw error;
                }

                window.GestionAuth.showToast(
                    `Registro marcado como ${newStatus ? 'Regularizado' : 'No Regularizado'}`,
                    newStatus ? 'success' : 'warning'
                );

            } catch (error) {
                console.error('Error actualizando estado:', error);
                window.GestionAuth.showToast('Error al actualizar el estado', 'error');
            }
        };

        openConfirmModal();
    }

    function openConfirmModal() {
        confirmModal.classList.remove('hidden');
        confirmModal.classList.add('flex');
    }

    function closeConfirmModal() {
        confirmModal.classList.add('hidden');
        confirmModal.classList.remove('flex');
        pendingAction = null;
    }

    // Cerrar modales al hacer click fuera
    window.addEventListener('click', (e) => {
        if (e.target === confirmModal) closeConfirmModal();
    });

    // ===== GENERACIÓN DE REPORTE =====
    function generateReport() {
        const user = window.GestionAuth.getUser();
        const generatedBy = user ? user.email : 'Usuario del Sistema';
        const fechaActual = new Date().toLocaleDateString('es-EC', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Branding Colors
        const cPrimary = '#001749';
        const cLightBlue = '#f0f4f8';
        const logoUrl = 'https://lh3.googleusercontent.com/d/1idgiPohtekZVIYJ-pmza9PSQqEamUvfH=w2048?name=TUPAK%20RANTINA%20(2).png';

        let reportData = [...pagaresData];

        // Re-aplicar filtros para el reporte
        if (currentFilters.search) {
            const term = currentFilters.search.toLowerCase();
            reportData = reportData.filter(item =>
                (item.cedula_socio && item.cedula_socio.toLowerCase().includes(term)) ||
                (item.nombre_socio && item.nombre_socio.toLowerCase().includes(term)) ||
                (item.credito && item.credito.toLowerCase().includes(term))
            );
        }
        if (currentFilters.status !== 'all') {
            const isRegularizado = currentFilters.status === 'regularizado';
            reportData = reportData.filter(item => item.regularizado === isRegularizado);
        }

        const rows = reportData.map((item, index) => {
            const fecha = item.fecha_hora ? new Date(item.fecha_hora).toLocaleDateString('es-EC') : '-';
            const pagare = item.credito ? item.credito.toString().padStart(4, '0') : '-';
            const estado = item.regularizado ? 'Regularizado' : 'Pendiente';
            const estadoColor = item.regularizado ? '#10b981' : '#ef4444';

            return `
                <tr style="background-color: ${index % 2 === 0 ? '#fff' : '#f9fafb'};">
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${fecha}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.cedula_socio || '-'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.nombre_socio || '-'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">$${item.monto_aprobado || '0.00'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${pagare}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.asesor_credito || '-'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: ${estadoColor}; font-weight: bold;">${estado}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Reporte de Pagarés - ${fechaActual}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                    body { font-family: 'Inter', sans-serif; margin: 0; padding: 40px; color: #1f2937; font-size: 12px; }
                    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 2px solid ${cPrimary}; padding-bottom: 20px; }
                    .logo { height: 60px; }
                    .title-section { text-align: right; }
                    .title { font-size: 24px; font-weight: 700; color: ${cPrimary}; margin: 0; text-transform: uppercase; }
                    .subtitle { font-size: 14px; color: #6b7280; margin: 5px 0 0; }
                    
                    .meta-info { display: flex; justify-content: space-between; background: ${cLightBlue}; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
                    .meta-item { display: flex; flex-direction: column; }
                    .meta-label { font-size: 10px; text-transform: uppercase; color: #6b7280; font-weight: 600; margin-bottom: 4px; }
                    .meta-value { font-size: 14px; font-weight: 500; color: ${cPrimary}; }

                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th { background: ${cPrimary}; color: white; padding: 10px 8px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; }
                    td { font-size: 11px; }
                    
                    .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; }

                    @media print {
                        body { padding: 20px; }
                        @page { margin: 1cm; size: landscape; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="${logoUrl}" alt="Logo" class="logo">
                    <div class="title-section">
                        <h1 class="title">Reporte General de Pagarés</h1>
                        <p class="subtitle">Sistema de Gestión Financiera</p>
                    </div>
                </div>

                <div class="meta-info">
                    <div class="meta-item">
                        <span class="meta-label">Generado Por</span>
                        <span class="meta-value">${generatedBy}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Fecha de Emisión</span>
                        <span class="meta-value">${fechaActual}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Total Registros</span>
                        <span class="meta-value">${reportData.length}</span>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%;">#</th>
                            <th style="width: 10%;">Fecha</th>
                            <th style="width: 10%;">Cédula</th>
                            <th style="width: 25%;">Socio</th>
                            <th style="width: 10%;">Monto</th>
                            <th style="width: 10%;">Pagaré</th>
                            <th style="width: 20%;">Asesor</th>
                            <th style="width: 10%;">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>

                <div class="footer">
                    <p>Este documento es un reporte generado automáticamente por el sistema. La información contenida es confidencial.</p>
                    <p>Tupak Rantina - ${new Date().getFullYear()}</p>
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

    // ===== EXPORTAR FUNCIONES PÚBLICAS =====
    window.PagaresModule = {
        toggleRegularizado,
        generateReport,
        sortBy
    };

})();

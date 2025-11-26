// cuentas.js - Lógica del Módulo de Cuentas
// Usamos IIFE para evitar contaminar el scope global y conflictos de variables
(function () {
    // Obtener instancia de Supabase desde main.js
    // Renombramos la variable local para evitar conflictos con otras declaraciones globales si las hubiera
    const db = window.GestionAuth.supabase();

    // Estado local
    let cuentasData = [];
    let currentFilters = {
        search: '',
        status: 'all', // all, regularizado, no-regularizado
        asesor: 'all',
        month: 'all'
    };
    let currentSort = {
        field: 'created_at',
        order: 'desc'
    };

    // ===== ELEMENTOS DEL DOM =====
    const tableBody = document.getElementById('cuentas-table-body');
    const searchInput = document.getElementById('search-input');
    const filterSelect = document.getElementById('filter-select');
    const filterAsesor = document.getElementById('filter-asesor');
    const filterMes = document.getElementById('filter-mes');
    const modal = document.getElementById('cuenta-modal');
    const form = document.getElementById('cuenta-form');
    const totalRecordsEl = document.getElementById('total-records');

    // Modal de Observación
    const obsModal = document.getElementById('observation-modal');
    const obsForm = document.getElementById('observation-form');
    const obsIdInput = document.getElementById('obs-id');
    const obsTextInput = document.getElementById('obs-text');

    // Modal de Confirmación
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmOkBtn = document.getElementById('confirm-ok-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    let pendingAction = null;

    // Modal de Reporte
    const reportModal = document.getElementById('report-modal');
    const reportSortField = document.getElementById('report-sort-field');
    const reportSortOrder = document.getElementById('report-sort-order');

    // ===== INICIALIZACIÓN =====
    document.addEventListener('DOMContentLoaded', () => {
        // Verificar acceso nuevamente
        if (!window.GestionAuth.checkAccess(['cuentas'])) return;

        loadCuentas();
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

        // Filtro Asesor
        if (filterAsesor) {
            filterAsesor.addEventListener('change', (e) => {
                currentFilters.asesor = e.target.value;
                applyFilters();
            });
        }

        // Filtro Mes
        if (filterMes) {
            filterMes.addEventListener('change', (e) => {
                currentFilters.month = e.target.value;
                applyFilters();
            });
        }

        // Formulario Nuevo
        form.addEventListener('submit', handleFormSubmit);

        // Formulario Observación
        if (obsForm) {
            obsForm.addEventListener('submit', handleObsSubmit);
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
    async function loadCuentas() {
        setLoadingTable(true);
        try {
            const { data, error } = await db
                .from('cuentas_tr')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            cuentasData = data || [];
            populateAsesorFilter();
            applyFilters();
        } catch (error) {
            console.error('Error cargando cuentas:', error);
            window.GestionAuth.showToast('Error al cargar los datos', 'error');
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-red-500">Error al cargar datos</td></tr>';
        } finally {
            setLoadingTable(false);
        }
    }

    function populateAsesorFilter() {
        if (!filterAsesor) return;
        const asesores = [...new Set(cuentasData.map(item => item.asesor).filter(Boolean))].sort();
        
        // Guardar selección actual si existe
        const currentVal = filterAsesor.value;
        
        filterAsesor.innerHTML = '<option value="all">Oficial: Todos</option>';
        asesores.forEach(asesor => {
            const option = document.createElement('option');
            option.value = asesor;
            option.textContent = asesor;
            filterAsesor.appendChild(option);
        });
        
        // Restaurar selección si es posible
        if (currentVal && asesores.includes(currentVal)) {
            filterAsesor.value = currentVal;
        }
    }

    function applyFilters() {
        let filtered = [...cuentasData];

        // Filtro Búsqueda
        if (currentFilters.search) {
            const term = currentFilters.search.toLowerCase();
            filtered = filtered.filter(item => 
                (item.cedula && item.cedula.toLowerCase().includes(term)) ||
                (item.nombre_1 && item.nombre_1.toLowerCase().includes(term)) ||
                (item.apellido_1 && item.apellido_1.toLowerCase().includes(term)) ||
                (item.cuenta && item.cuenta.toLowerCase().includes(term))
            );
        }

        // Filtro Estado
        if (currentFilters.status !== 'all') {
            const isRegularizado = currentFilters.status === 'regularizado';
            filtered = filtered.filter(item => item.regularizado === isRegularizado);
        }

        // Filtro Asesor
        if (currentFilters.asesor !== 'all') {
            filtered = filtered.filter(item => item.asesor === currentFilters.asesor);
        }

        // Filtro Mes
        if (currentFilters.month !== 'all') {
            const month = parseInt(currentFilters.month);
            filtered = filtered.filter(item => {
                const date = new Date(item.created_at);
                return date.getMonth() === month;
            });
        }

        // Ordenamiento
        filtered.sort((a, b) => {
            let valA = a[currentSort.field] || '';
            let valB = b[currentSort.field] || '';

            if (currentSort.field === 'created_at') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
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
                    <td colspan="8" class="px-6 py-4 text-center text-gray-500">
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
            
            const fecha = new Date(item.created_at).toLocaleDateString('es-EC');
            const nombres = `${item.nombre_1 || ''} ${item.nombre_2 || ''}`.trim();
            const apellidos = `${item.apellido_1 || ''} ${item.apellido_2 || ''}`.trim();
            
            tr.innerHTML = `
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${fecha}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">${item.cedula || '-'}</td>
                <td class="px-3 py-2 whitespace-nowrap">
                    <div class="text-sm font-bold text-gray-900 uppercase">${apellidos}</div>
                    <div class="text-xs text-gray-500 uppercase">${nombres}</div>
                </td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 font-mono">${item.cuenta || '-'}</td>
                <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-500">${item.asesor || '-'}</td>
                <td class="px-3 py-2 whitespace-nowrap text-center">
                    <button onclick="window.CuentasModule.toggleRegularizado(${item.id}, ${isRegularizado})" 
                            class="focus:outline-none transition-transform hover:scale-110"
                            title="${isRegularizado ? 'Marcar como No Regularizado' : 'Marcar como Regularizado'}">
                        <i class="fas ${isRegularizado ? 'fa-check-circle text-green-500' : 'fa-times-circle text-red-500'} text-lg"></i>
                    </button>
                </td>
                <td class="px-3 py-2 text-sm text-gray-500 max-w-xs cursor-pointer group relative"
                    onclick="window.CuentasModule.openObservationModal(${item.id}, '${(item.observaciones || '').replace(/'/g, "\\'")}')"
                    title="Clic para editar observación">
                    <div class="flex items-center justify-between">
                        <span class="truncate mr-2">${item.observaciones || '<span class="italic text-gray-400">Sin observaciones</span>'}</span>
                        <i class="fas fa-pencil-alt text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                </td>
                <td class="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="window.CuentasModule.generateChecklist(${item.id})" class="text-blue-600 hover:text-blue-900 mr-3" title="Imprimir Checklist">
                        <i class="fas fa-print"></i>
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
                    <td colspan="8" class="px-6 py-10 text-center">
                        <div class="flex justify-center items-center">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                            <span class="ml-2 text-gray-600">Cargando datos...</span>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Añadir campos automáticos
        const user = window.GestionAuth.getUser();
        data.asesor = user ? user.email : 'Desconocido';
        
        try {
            const { error } = await db.from('cuentas_tr').insert([data]);
            
            if (error) throw error;
            
            window.GestionAuth.showToast('Cuenta creada exitosamente', 'success');
            closeModal();
            form.reset();
            loadCuentas();
            
        } catch (error) {
            console.error('Error creando cuenta:', error);
            window.GestionAuth.showToast('Error al crear la cuenta: ' + error.message, 'error');
        }
    }

    async function handleObsSubmit(e) {
        e.preventDefault();
        const id = obsIdInput.value;
        const observaciones = obsTextInput.value;
        
        try {
            const { error } = await db
                .from('cuentas_tr')
                .update({ observaciones })
                .eq('id', id);
                
            if (error) throw error;
            
            // Actualizar localmente
            const item = cuentasData.find(i => i.id == id);
            if (item) item.observaciones = observaciones;
            
            window.GestionAuth.showToast('Observación actualizada', 'success');
            closeObservationModal();
            applyFilters(); // Re-renderizar para mostrar cambios
            
        } catch (error) {
            console.error('Error actualizando observación:', error);
            window.GestionAuth.showToast('Error al actualizar', 'error');
        }
    }

    // ===== GENERACIÓN DE REPORTE =====
    function openReportModal() {
        reportModal.classList.remove('hidden');
        reportModal.classList.add('flex');
    }

    function closeReportModal() {
        reportModal.classList.add('hidden');
        reportModal.classList.remove('flex');
    }

    function generateReport() {
        closeReportModal();
        const user = window.GestionAuth.getUser();
        const generatedBy = user ? user.email : 'Usuario del Sistema';
        const fechaActual = new Date().toLocaleDateString('es-EC', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Opciones de ordenamiento
        const sortField = reportSortField.value;
        const sortOrder = reportSortOrder.value;

        // Branding Colors
        const cPrimary = '#001749';
        const cLightBlue = '#f0f4f8';
        const logoUrl = 'https://lh3.googleusercontent.com/d/1idgiPohtekZVIYJ-pmza9PSQqEamUvfH=w2048?name=TUPAK%20RANTINA%20(2).png';

        let reportData = [...cuentasData];
        
        // Re-aplicar filtros para el reporte
        if (currentFilters.search) {
            const term = currentFilters.search.toLowerCase();
            reportData = reportData.filter(item => 
                (item.cedula && item.cedula.toLowerCase().includes(term)) ||
                (item.nombre_1 && item.nombre_1.toLowerCase().includes(term)) ||
                (item.apellido_1 && item.apellido_1.toLowerCase().includes(term)) ||
                (item.cuenta && item.cuenta.toLowerCase().includes(term))
            );
        }
        if (currentFilters.status !== 'all') {
            const isRegularizado = currentFilters.status === 'regularizado';
            reportData = reportData.filter(item => item.regularizado === isRegularizado);
        }
        if (currentFilters.asesor !== 'all') {
            reportData = reportData.filter(item => item.asesor === currentFilters.asesor);
        }
        if (currentFilters.month !== 'all') {
            const month = parseInt(currentFilters.month);
            reportData = reportData.filter(item => {
                const date = new Date(item.created_at);
                return date.getMonth() === month;
            });
        }

        // Aplicar ordenamiento
        reportData.sort((a, b) => {
            let valA = a[sortField] || '';
            let valB = b[sortField] || '';

            // Manejo especial para fechas
            if (sortField === 'created_at') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            } else {
                valA = String(valA).toLowerCase();
                valB = String(valB).toLowerCase();
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        const rows = reportData.map((item, index) => {
            const fecha = new Date(item.created_at).toLocaleDateString('es-EC');
            const nombreCompleto = `${item.apellido_1 || ''} ${item.apellido_2 || ''} ${item.nombre_1 || ''} ${item.nombre_2 || ''}`.trim();
            const estado = item.regularizado ? 'Regularizado' : 'Pendiente';
            const estadoColor = item.regularizado ? '#10b981' : '#ef4444';
            
            return `
                <tr style="background-color: ${index % 2 === 0 ? '#fff' : '#f9fafb'};">
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${fecha}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.cedula || '-'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${nombreCompleto}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.cuenta || '-'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.asesor || '-'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: ${estadoColor}; font-weight: bold;">${estado}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Reporte de Cuentas - ${fechaActual}</title>
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
                        <h1 class="title">Reporte General de Cuentas</h1>
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
                            <th style="width: 15%;">Cuenta</th>
                            <th style="width: 20%;">Oficial de cuenta</th>
                            <th style="width: 15%;">Completado</th>
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

    // ===== GENERACIÓN DE CHECKLIST =====
    function generateChecklist(id) {
        const item = cuentasData.find(i => i.id === id);
        if (!item) return;

        const nombres = `${item.nombre_1 || ''} ${item.nombre_2 || ''}`.trim();
        const apellidos = `${item.apellido_1 || ''} ${item.apellido_2 || ''}`.trim();
        const nombreCompleto = `${apellidos} ${nombres}`.trim();
        const fechaActual = new Date().toLocaleDateString('es-EC');

        // Branding Colors
        const cPrimary = '#001749';
        const cAccent = '#e48410';
        const cBlue = '#3787c6';
        const cLightBlue = '#015cd0';
        const logoUrl = 'https://lh3.googleusercontent.com/d/1idgiPohtekZVIYJ-pmza9PSQqEamUvfH=w2048?name=TUPAK%20RANTINA%20(2).png';

        const checklistItems = [
            'Pasaporte (Si Aplica)',
            'Cédula Titular y Cónyuge (Si Aplica)',
            'Papeleta de Votación Titular y Cónyuge (Si Aplica)',
            'Pago de Servicio Básico (Últimos 3 meses)',
            'Formulario conozca a su Cliente',
            'Términos y condiciones de datos personales',
            'Formulario para persona natural',
            'Solicitud de Apertura de cliente natural',
            'Autocertificacion de residencia fiscal',
            'Certificado de validacion',
            'Contrato de Apertura de la Cuenta ahorro normal',
            'Contrato de Apertura de la Cuenta Certificados de aportacion'
        ];

        const checklistRows = checklistItems.map(text => `
            <tr>
                <td style="padding: 4px 8px; border: 1px solid #ccc;">${text}</td>
                <!-- Consta SI/NO -->
                <td style="padding: 0; border: 1px solid #ccc; text-align: center; width: 30px; font-size: 10px;"></td>
                <td style="padding: 0; border: 1px solid #ccc; text-align: center; width: 30px; font-size: 10px;"></td>
                <!-- Verifica SI/NO -->
                <td style="padding: 0; border: 1px solid #ccc; text-align: center; width: 30px; font-size: 10px;"></td>
                <td style="padding: 0; border: 1px solid #ccc; text-align: center; width: 30px; font-size: 10px;"></td>
                <td style="padding: 4px 8px; border: 1px solid #ccc; width: 150px;"></td>
            </tr>
        `).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Checklist_cuenta_${apellidos.replace(/\s+/g, '_')}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
                    body { font-family: 'Roboto', sans-serif; margin: 0; padding: 20px; color: #333; font-size: 11px; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid ${cAccent}; padding-bottom: 15px; margin-bottom: 10px; }
                    .logo { max-height: 60px; }
                    .title-box { text-align: right; }
                    .title-box h1 { margin: 0; color: ${cPrimary}; font-size: 18px; text-transform: uppercase; }
                    .title-box p { margin: 2px 0 0; color: ${cBlue}; font-size: 12px; }

                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; background: #f9f9f9; padding: 10px; border-radius: 8px; border-left: 5px solid ${cPrimary}; }
                    .info-item { margin-bottom: 5px; }
                    .info-label { font-weight: bold; color: ${cPrimary}; display: block; font-size: 10px; text-transform: uppercase; }
                    .info-value { font-size: 13px; color: #000; border-bottom: 1px solid #ddd; padding-bottom: 2px; display: block; width: 100%; min-height: 18px; }
                    
                    .checkbox-group { display: flex; gap: 15px; align-items: center; margin-top: 5px; }
                    .checkbox-item { display: flex; align-items: center; gap: 5px; font-size: 12px; }
                    .box { width: 12px; height: 12px; border: 1px solid #333; display: inline-block; }

                    .section-title { background: ${cPrimary}; color: white; padding: 5px 10px; font-weight: bold; margin-top: 15px; margin-bottom: 5px; font-size: 12px; border-radius: 4px; }

                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th { background: ${cLightBlue}; color: white; padding: 4px; text-align: center; font-size: 10px; border: 1px solid ${cPrimary}; }
                    td { font-size: 11px; }

                    .footer { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
                    .signature-box { width: 30%; text-align: center; border-top: 1px solid #333; padding-top: 5px; }
                    .signature-label { font-size: 10px; color: #666; }

                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                        @page { margin: 0.5cm; size: A4; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="${logoUrl}" alt="Tupak Rantina" class="logo">
                    <div class="title-box">
                        <h1>Check List Expediente del Socio</h1>
                        <p>Gestión de Cuentas</p>
                        <p><strong>Código:</strong> CATR-CA-2025</p>
                    </div>
                </div>

                <div class="info-grid">
                    <div class="info-item" style="grid-column: span 2;">
                        <span class="info-label">Socio</span>
                        <span class="info-value">${nombreCompleto}</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-label">Proviene de Crédito</span>
                        <div class="checkbox-group">
                            <div class="checkbox-item">SI <span class="box"></span></div>
                            <div class="checkbox-item">NO <span class="box"></span></div>
                        </div>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Asesor de Crédito (Manual)</span>
                        <span class="info-value"></span>
                    </div>

                    <div class="info-item">
                        <span class="info-label">Tipo Persona</span>
                        <div class="checkbox-group">
                            <div class="checkbox-item">P. Natural <span class="box"></span></div>
                            <div class="checkbox-item">Menor <span class="box"></span></div>
                        </div>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Tipo Cuenta</span>
                        <div class="checkbox-group">
                            <div class="checkbox-item">Ahorro <span class="box"></span></div>
                            <div class="checkbox-item">C.A <span class="box"></span></div>
                            <div class="checkbox-item">Programado <span class="box"></span></div>
                        </div>
                    </div>

                    <div class="info-item">
                        <span class="info-label">Fecha de Elaboración</span>
                        <span class="info-value">${fechaActual}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Nº OP (Cuenta)</span>
                        <span class="info-value">${item.cuenta || ''}</span>
                    </div>
                </div>

                <div class="section-title">DOCUMENTACIÓN REQUERIDA</div>

                <table>
                    <thead>
                        <tr>
                            <th rowspan="2" style="width: 40%; text-align: left; padding-left: 8px;">DOCUMENTACIÓN</th>
                            <th colspan="2" style="width: 15%;">CONSTA</th>
                            <th colspan="2" style="width: 15%;">VERIFICA</th>
                            <th rowspan="2" style="width: 30%;">OBSERVACIONES</th>
                        </tr>
                        <tr>
                            <th style="width: 7.5%;">SI</th>
                            <th style="width: 7.5%;">NO</th>
                            <th style="width: 7.5%;">SI</th>
                            <th style="width: 7.5%;">NO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${checklistRows}
                    </tbody>
                </table>

                <div class="footer">
                    <div class="signature-box">
                        <div class="signature-label">Oficial de Cuenta</div>
                        <div style="font-weight: bold; margin-top: 5px;">${item.asesor || 'Asesor'}</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-label">Revisado por</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-label">Aprobado por</div>
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

    // ===== ACCIONES =====
    function toggleRegularizado(id, currentStatus) {
        const item = cuentasData.find(i => i.id === id);
        const nombreSocio = item ? `${item.nombre_1} ${item.apellido_1}` : 'este socio';
        const actionText = !currentStatus ? 'regularizada' : 'no regularizada';

        confirmMessage.textContent = `¿Estás seguro que la cuenta de ${nombreSocio} está ${actionText}?`;

        pendingAction = async () => {
            try {
                const newStatus = !currentStatus;

                // Optimistic update
                const itemIndex = cuentasData.findIndex(i => i.id === id);
                if (itemIndex !== -1) {
                    cuentasData[itemIndex].regularizado = newStatus;
                    applyFilters();
                }

                const { error } = await db
                    .from('cuentas_tr')
                    .update({ regularizado: newStatus })
                    .eq('id', id);

                if (error) {
                    // Revertir
                    if (itemIndex !== -1) {
                        cuentasData[itemIndex].regularizado = currentStatus;
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

    // ... (handleFormSubmit, handleObsSubmit remain unchanged)

    // ===== MODALES =====
    function openModal() {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => document.getElementById('cedula').focus(), 100);
    }

    function closeModal() {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    function openObservationModal(id, currentText) {
        obsIdInput.value = id;
        obsTextInput.value = currentText || '';
        obsModal.classList.remove('hidden');
        obsModal.classList.add('flex');
        setTimeout(() => obsTextInput.focus(), 100);
    }

    function closeObservationModal() {
        obsModal.classList.add('hidden');
        obsModal.classList.remove('flex');
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
        if (e.target === modal) closeModal();
        if (e.target === obsModal) closeObservationModal();
        if (e.target === confirmModal) closeConfirmModal();
        if (e.target === reportModal) closeReportModal();
    });

    // ===== EXPORTAR FUNCIONES PÚBLICAS =====
    window.CuentasModule = {
        toggleRegularizado,
        openModal,
        closeModal,
        openObservationModal,
        closeObservationModal,
        generateChecklist,
        generateReport,
        openReportModal,
        closeReportModal,
        sortBy
    };

})();

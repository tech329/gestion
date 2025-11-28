// creditos.js - Lógica del Módulo de Créditos
(function () {
    // Obtener instancia de Supabase desde main.js
    const db = window.GestionAuth.supabase();

    // Estado local
    let creditosData = [];
    let currentFilters = {
        search: '',
        status: 'all', // all, regularizado, no-regularizado
        asesor: 'all'
    };
    let currentSort = {
        field: 'fecha_hora',
        order: 'desc'
    };

    // ===== ELEMENTOS DEL DOM =====
    const tableBody = document.getElementById('creditos-table-body');
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
    document.addEventListener('DOMContentLoaded', async () => {
        // Esperar a que se cargue el usuario (max 2 seg)
        let attempts = 0;
        while (!window.GestionAuth.getUser() && attempts < 20) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        // Verificar acceso nuevamente
        if (!window.GestionAuth.checkAccess(['admin', 'asesor'])) return;

        loadCreditos();
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
    async function loadCreditos() {
        setLoadingTable(true);
        try {
            const user = window.GestionAuth.getUser();
            const userRoles = (localStorage.getItem('gestion_user_roles') || '').toLowerCase();
            const isAdmin = userRoles.includes('admin');
            const isAsesor = userRoles.includes('asesor');

            let query = db
                .from('actas_creditos_tupakra')
                .select('*')
                .order('fecha_hora', { ascending: false });

            // Si es asesor y NO es admin, filtrar por su correo
            if (isAsesor && !isAdmin) {
                if (user && user.email) {
                    query = query.eq('correo_asesor', user.email);
                }
            }

            const { data, error } = await query;

            if (error) throw error;

            creditosData = data || [];
            applyFilters();
        } catch (error) {
            console.error('Error cargando créditos:', error);
            window.GestionAuth.showToast('Error al cargar los datos', 'error');
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-red-500">Error al cargar datos</td></tr>';
        } finally {
            setLoadingTable(false);
        }
    }

    function applyFilters() {
        let filtered = [...creditosData];

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
            filtered = filtered.filter(item => item.regularizado_cred === isRegularizado);
        }

        // Ordenamiento
        filtered.sort((a, b) => {
            let valA = a[currentSort.field] || '';
            let valB = b[currentSort.field] || '';

            if (currentSort.field === 'fecha_hora') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            } else if (currentSort.field === 'monto_aprobado') {
                // Limpiar símbolos de moneda y comas si es necesario, aunque parece ser text
                valA = parseFloat(String(valA).replace(/[^0-9.-]+/g, "")) || 0;
                valB = parseFloat(String(valB).replace(/[^0-9.-]+/g, "")) || 0;
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
        document.querySelectorAll('.sort-icon').forEach(icon => {
            icon.className = 'fas fa-sort sort-icon ml-1 text-gray-400';
        });

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
            const isRegularizado = item.regularizado_cred;
            tr.className = `transition-colors ${!isRegularizado ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-gray-50'}`;

            const fecha = item.fecha_hora ? new Date(item.fecha_hora).toLocaleDateString('es-EC') : '-';

            tr.innerHTML = `
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${fecha}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">${item.cedula_socio || '-'}</td>
                <td class="px-3 py-2 whitespace-nowrap">
                    <div class="text-sm font-bold text-gray-900 uppercase">${item.nombre_socio || '-'}</div>
                </td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 font-mono">${item.monto_aprobado || '-'}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 font-mono">${item.credito || '-'}</td>
                <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-500">${item.asesor_credito || '-'}</td>
                <td class="px-3 py-2 whitespace-nowrap text-center">
                    <button onclick="window.CreditosModule.toggleRegularizado(${item.id}, ${isRegularizado})" 
                            class="focus:outline-none transition-transform hover:scale-110"
                            title="${isRegularizado ? 'Marcar como No Regularizado' : 'Marcar como Regularizado'}">
                        <i class="fas ${isRegularizado ? 'fa-check-circle text-green-500' : 'fa-times-circle text-red-500'} text-lg"></i>
                    </button>
                    <button onclick="window.CreditosModule.generateChecklist(${item.id})" class="ml-3 text-blue-600 hover:text-blue-900" title="Imprimir Checklist">
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
        const item = creditosData.find(i => i.id === id);
        const nombreSocio = item ? item.nombre_socio : 'este socio';
        const actionText = !currentStatus ? 'regularizado' : 'no regularizado';

        confirmMessage.textContent = `¿Estás seguro que el crédito de ${nombreSocio} está ${actionText}?`;

        pendingAction = async () => {
            try {
                const newStatus = !currentStatus;

                // Optimistic update
                const itemIndex = creditosData.findIndex(i => i.id === id);
                if (itemIndex !== -1) {
                    creditosData[itemIndex].regularizado_cred = newStatus;
                    applyFilters();
                }

                const { error } = await db
                    .from('actas_creditos_tupakra')
                    .update({ regularizado_cred: newStatus })
                    .eq('id', id);

                if (error) {
                    // Revertir
                    if (itemIndex !== -1) {
                        creditosData[itemIndex].regularizado_cred = currentStatus;
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

    // ===== MODALES =====
    function openConfirmModal() {
        confirmModal.classList.remove('hidden');
        confirmModal.classList.add('flex');
    }

    function closeConfirmModal() {
        confirmModal.classList.add('hidden');
        confirmModal.classList.remove('flex');
        pendingAction = null;
    }

    // ===== UTILIDADES =====
    function numberToWords(number) {
        const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
        const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
        const diez_veinte = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
        const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

        function convertGroup(n) {
            let output = '';
            if (n === 100) return 'CIEN';

            if (n >= 100) {
                output += centenas[Math.floor(n / 100)] + ' ';
                n %= 100;
            }

            if (n >= 10 && n <= 19) {
                output += diez_veinte[n - 10] + ' ';
                return output;
            } else if (n >= 20) {
                output += decenas[Math.floor(n / 10)] + ' ';
                n %= 10;
                if (n > 0) output = output.trim() + ' Y ';
            }

            if (n > 0) {
                output += unidades[n] + ' ';
            }
            return output;
        }

        if (number === 0) return 'CERO';

        let str = '';
        const millions = Math.floor(number / 1000000);
        number %= 1000000;
        const thousands = Math.floor(number / 1000);
        const units = Math.floor(number % 1000);

        if (millions > 0) {
            str += (millions === 1 ? 'UN MILLON' : convertGroup(millions).trim() + ' MILLONES') + ' ';
        }
        if (thousands > 0) {
            str += (thousands === 1 ? 'MIL' : convertGroup(thousands).trim() + ' MIL') + ' ';
        }
        if (units > 0) {
            str += convertGroup(units);
        }

        return str.trim();
    }

    function formatCurrency(amount) {
        // Limpiar el string de monto para obtener el número
        let num = parseFloat(String(amount).replace(/[^0-9.]/g, '')) || 0;

        // Formatear a USD con 2 decimales
        const formattedUSD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

        // Obtener parte entera y decimal
        const integerPart = Math.floor(num);
        const decimalPart = Math.round((num - integerPart) * 100);
        const decimalStr = decimalPart.toString().padStart(2, '0');

        // Convertir a letras
        const words = numberToWords(integerPart);

        return `${formattedUSD} (${words} DOLARES ${decimalStr}/100)`;
    }

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

        let reportData = [...creditosData];

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
            reportData = reportData.filter(item => item.regularizado_cred === isRegularizado);
        }

        // Ordenamiento (usar el actual)
        reportData.sort((a, b) => {
            let valA = a[currentSort.field] || '';
            let valB = b[currentSort.field] || '';

            if (currentSort.field === 'fecha_hora') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            } else if (currentSort.field === 'monto_aprobado') {
                valA = parseFloat(String(valA).replace(/[^0-9.-]+/g, "")) || 0;
                valB = parseFloat(String(valB).replace(/[^0-9.-]+/g, "")) || 0;
            } else {
                valA = String(valA).toLowerCase();
                valB = String(valB).toLowerCase();
            }

            if (valA < valB) return currentSort.order === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.order === 'asc' ? 1 : -1;
            return 0;
        });

        const rows = reportData.map((item, index) => {
            const fecha = item.fecha_hora ? new Date(item.fecha_hora).toLocaleDateString('es-EC') : '-';
            const estado = item.regularizado_cred ? 'Regularizado' : 'Pendiente';
            const estadoColor = item.regularizado_cred ? '#10b981' : '#ef4444';

            return `
                <tr style="background-color: ${index % 2 === 0 ? '#fff' : '#f9fafb'};">
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${fecha}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.cedula_socio || '-'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.nombre_socio || '-'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.monto_aprobado || '-'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.credito || '-'}</td>
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
                <title>Reporte de Créditos - ${fechaActual}</title>
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
                        <h1 class="title">Reporte General de Créditos</h1>
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
                            <th style="width: 10%;">Crédito</th>
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

    // ===== GENERACIÓN DE CHECKLIST =====
    function generateChecklist(id) {
        const item = creditosData.find(i => i.id === id);
        if (!item) return;

        const nombreSocio = item.nombre_socio || '';
        const fechaActual = new Date().toLocaleDateString('es-EC');
        const asesor = item.asesor_credito || '';
        const montoRaw = item.monto_aprobado || '0';
        const montoFormatted = formatCurrency(montoRaw);
        const numCredito = item.credito || '';

        // Branding Colors
        const cPrimary = '#001749';
        const cAccent = '#e48410';
        const cBlue = '#3787c6';
        const cLightBlue = '#015cd0';
        const logoUrl = 'https://lh3.googleusercontent.com/d/1idgiPohtekZVIYJ-pmza9PSQqEamUvfH=w2048?name=TUPAK%20RANTINA%20(2).png';

        const expedienteItems = [
            'Acta de aprobación y Correos de aprobación',
            'Solicitud de Crédito',
            'Formulario del deudor',
            'Contrato de adhesión',
            'Tabla de amortización',
            'Copia de pagaré a la orden',
            'Licitud de fondos',
            'Autorización de la transferencia',
            'Autorización de Buró de Crédito',
            'Consulta de Buró de Crédito',
            'Consulta de Función Judicial',
            'Consulta de SUPA',
            'Copia de la cédula y la papeleta de votación deudor y cónyuge',
            'Planilla de luz, agua, teléfono del último mes',
            'Certificado de trabajo o Rol de pagos <b>si lo posee</b>',
            'Certificados de consumo agrícola',
            'RUC, Facturas de compra',
            'Copia de la escritura',
            'Pago predial actual',
            'Copia de la matrícula vehicular <b>si lo posee</b>',
            'Croquis de domicilio o trabajo',
            'Otros:'
        ];

        const garantesItems = [
            'Solicitud de Crédito',
            'Formulario del Garante',
            'Autorización de Buró de Crédito',
            'Consulta de Buró de Crédito',
            'Consulta de Función Judicial',
            'Consulta de SUPA',
            'Copia de la cédula y la papeleta de votación garante y cónyuge',
            'Planilla de luz, agua, teléfono del último mes',
            'Certificado de trabajo o Rol de pagos <b>si lo posee</b>',
            'Certificados de consumo agrícola',
            'RUC o Facturas de compra',
            'Copia de la escritura',
            'Pago predial actual año',
            'Copia de la matrícula vehicular <b>si lo posee</b>',
            'Croquis de domicilio o trabajo',
            'Otros:'
        ];


        const createRows = (items) => items.map(text => `
            <tr>
                <td style="padding: 2px 4px; border: 1px solid #ccc;">${text}</td>
                <!-- Consta SI/NO -->
                <td style="padding: 0; border: 1px solid #ccc; text-align: center; width: 25px; font-size: 9px;"></td>
                <td style="padding: 0; border: 1px solid #ccc; text-align: center; width: 25px; font-size: 9px;"></td>
                <!-- Verifica SI/NO -->
                <td style="padding: 0; border: 1px solid #ccc; text-align: center; width: 25px; font-size: 9px;"></td>
                <td style="padding: 0; border: 1px solid #ccc; text-align: center; width: 25px; font-size: 9px;"></td>
                <td style="padding: 2px 4px; border: 1px solid #ccc; width: 120px;"></td>
            </tr>
        `).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Checklist_credito_${nombreSocio.replace(/\s+/g, '_')}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
                    body { font-family: 'Roboto', sans-serif; margin: 0; padding: 15px; color: #333; font-size: 10px; }
                    
                    /* Header Style similar to Cuentas */
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${cAccent}; padding-bottom: 10px; margin-bottom: 8px; }
                    .logo { max-height: 50px; }
                    .title-box { text-align: right; }
                    .title-box h1 { margin: 0; color: ${cPrimary}; font-size: 16px; text-transform: uppercase; }
                    .title-box p { margin: 1px 0 0; color: ${cBlue}; font-size: 11px; }
                    .meta-codes { font-size: 9px; color: #666; margin-top: 3px; }

                    /* Info Grid similar to Cuentas */
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; background: #f9f9f9; padding: 8px; border-radius: 6px; border-left: 4px solid ${cPrimary}; }
                    .info-item { margin-bottom: 3px; }
                    .info-label { font-weight: bold; color: ${cPrimary}; display: block; font-size: 9px; text-transform: uppercase; }
                    .info-value { font-size: 11px; color: #000; border-bottom: 1px solid #ddd; padding-bottom: 1px; display: block; width: 100%; min-height: 15px; }
                    
                    /* Section Title */
                    .section-title { background: ${cPrimary}; color: white; padding: 3px 8px; font-weight: bold; margin-top: 10px; margin-bottom: 3px; font-size: 10px; border-radius: 3px; }

                    /* Table Styles */
                    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                    th { background: ${cLightBlue}; color: white; padding: 2px; text-align: center; font-size: 9px; border: 1px solid ${cPrimary}; }
                    td { font-size: 9px; }
                    /* Alternating Row Colors */
                    tr:nth-child(even) { background-color: #f2f2f2; }

                    /* Footer Styles */
                    .footer { margin-top: 20px; display: flex; justify-content: space-between; page-break-inside: avoid; }
                    .signature-box { width: 45%; border: 1px solid #333; display: flex; flex-direction: column; }
                    .signature-label { background: #e0e0e0; color: #000; font-weight: bold; font-size: 9px; text-align: center; padding: 2px; border-bottom: 1px solid #333; }
                    .signature-content { height: 60px; } /* Space for signature */
                    .signature-footer { border-top: 1px solid #333; padding: 5px; font-size: 9px; }

                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                        @page { margin: 0.5cm; size: A4; }
                        /* Ensure background colors print */
                        tr:nth-child(even) { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: #f2f2f2; }
                        .signature-label { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: #e0e0e0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="${logoUrl}" alt="Tupak Rantina" class="logo">
                    <div class="title-box">
                        <h1>Check List Expediente del Socio</h1>
                        <p>Gestión de Créditos</p>
                        <div class="meta-codes">
                            <div>Código: CATR-CRE-2025</div>
                            <div>Fecha: 27/11/2025 | Rev: 01</div>
                        </div>
                    </div>
                </div>

                <div class="info-grid">
                    <div class="info-item" style="grid-column: span 2;">
                        <span class="info-label">Socio</span>
                        <span class="info-value">${nombreSocio}</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-label">Asesor de Crédito</span>
                        <span class="info-value">${asesor}</span>
                    </div>

                    <div class="info-item">
                        <span class="info-label">Monto Aprobado</span>
                        <span class="info-value">${montoFormatted}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Nº Operación</span>
                        <span class="info-value">${numCredito}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Número de Crédito</span>
                        <span class="info-value">&nbsp;</span>
                    </div>
                </div>

                <div class="section-title">EXPEDIENTE DEL CRÉDITO</div>

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
                        ${createRows(expedienteItems)}
                    </tbody>
                </table>

                <div class="section-title">DOCUMENTACIÓN GARANTES</div>

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
                        ${createRows(garantesItems)}
                    </tbody>
                </table>

                <div class="footer">
                    <div class="signature-box">
                        <div class="signature-label">Entrega</div>
                        <div class="signature-content"></div>
                        <div class="signature-footer">
                            Nombre:<br>
                            Fecha:
                        </div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-label">Verificado por Administrador de la Caja</div>
                        <div class="signature-content"></div>
                        <div class="signature-footer">
                            Nombre:<br>
                            Fecha:
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

    // Exponer funciones globalmente
    window.CreditosModule = {
        loadCreditos,
        sortBy,
        toggleRegularizado,
        generateChecklist,
        generateReport
    };

})();

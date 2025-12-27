// ahorro_programado.js - Lógica del Módulo de Ahorro Programado
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
    const filterStatus = document.getElementById('filter-status');
    const filterOficina = document.getElementById('filter-oficina');
    const tableBody = document.getElementById('table-body');
    const totalRecords = document.getElementById('total-records');
    const detailModal = document.getElementById('detail-modal');
    const formModal = document.getElementById('form-modal');
    const ahorroForm = document.getElementById('ahorro-form');

    // Estado
    let ahorrosData = [];
    let currentFilters = {
        search: '',
        status: 'all',
        oficina: 'all'
    };
    let currentSort = {
        field: 'created_at',
        direction: 'desc'
    };

    // Inicialización
    document.addEventListener('DOMContentLoaded', async () => {
        // Esperar a que se cargue el usuario
        let attempts = 0;
        while (!window.GestionAuth.getUser() && attempts < 20) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        // Verificar acceso (admin o programado)
        if (!window.GestionAuth.checkAccess(['admin', 'programado'])) {
            alert('No tienes permiso para acceder a este módulo.');
            window.location.href = 'index.html';
            return;
        }

        loadData();
        setupEventListeners();
    });

    function setupEventListeners() {
        searchInput.addEventListener('input', () => {
            currentFilters.search = searchInput.value;
            applyFilters();
        });

        filterStatus.addEventListener('change', () => {
            currentFilters.status = filterStatus.value;
            applyFilters();
        });

        filterOficina.addEventListener('change', () => {
            currentFilters.oficina = filterOficina.value;
            applyFilters();
        });

        ahorroForm.addEventListener('submit', handleFormSubmit);
    }

    async function loadData() {
        try {
            const supabase = await getDb();
            if (!supabase) throw new Error('Cliente Supabase no disponible');

            const { data, error } = await supabase
                .from('programado_tr')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            ahorrosData = data || [];
            populateFilters();
            applyFilters();
        } catch (error) {
            console.error('Error cargando datos:', error);
            window.GestionAuth.showToast('Error al cargar los datos', 'error');
        }
    }

    function populateFilters() {
        // Poblar filtro de estatus
        const statusSet = new Set(ahorrosData.map(item => item.estatus).filter(Boolean));
        filterStatus.innerHTML = '<option value="all">Estatus: Todos</option>';
        statusSet.forEach(status => {
            const option = document.createElement('option');
            option.value = status;
            option.textContent = status;
            filterStatus.appendChild(option);
        });

        // Poblar filtro de oficina
        const oficinaSet = new Set(ahorrosData.map(item => item.oficina).filter(Boolean));
        filterOficina.innerHTML = '<option value="all">Oficina: Todas</option>';
        oficinaSet.forEach(oficina => {
            const option = document.createElement('option');
            option.value = oficina;
            option.textContent = oficina;
            filterOficina.appendChild(option);
        });
    }

    function applyFilters() {
        let filtered = [...ahorrosData];

        // Filtro de búsqueda
        if (currentFilters.search) {
            const term = currentFilters.search.toLowerCase();
            filtered = filtered.filter(item =>
                (item.cedula && item.cedula.toLowerCase().includes(term)) ||
                (item.nombre_socio && item.nombre_socio.toLowerCase().includes(term)) ||
                (item.nro_socio && item.nro_socio.toLowerCase().includes(term))
            );
        }

        // Filtro de estatus
        if (currentFilters.status !== 'all') {
            filtered = filtered.filter(item => item.estatus === currentFilters.status);
        }

        // Filtro de oficina
        if (currentFilters.oficina !== 'all') {
            filtered = filtered.filter(item => item.oficina === currentFilters.oficina);
        }

        // Aplicar ordenamiento
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

            if (currentSort.direction === 'asc') {
                return valA > valB ? 1 : -1;
            } else {
                return valA < valB ? 1 : -1;
            }
        });

        renderTable(filtered);
        totalRecords.textContent = `${filtered.length} registro${filtered.length !== 1 ? 's' : ''}`;
    }

    function renderTable(data) {
        tableBody.innerHTML = '';

        if (data.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="px-6 py-8 text-center text-gray-500">
                        <i class="fas fa-inbox text-4xl mb-2 opacity-50"></i>
                        <p>No se encontraron registros</p>
                    </td>
                </tr>
            `;
            return;
        }

        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors cursor-pointer';
            tr.onclick = () => openDetailModal(item);

            tr.innerHTML = `
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${item.nro || '-'}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${item.anio || '-'}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${item.mes || '-'}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 font-mono">${item.cedula || '-'}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 uppercase">${item.nombre_socio || '-'}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${item.nro_socio || '-'}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${item.oficina || '-'}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm">
                    <span class="px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.estatus)}">
                        ${item.estatus || 'Sin estatus'}
                    </span>
                </td>
                <td class="px-3 py-2 whitespace-nowrap text-center text-sm">
                    <button onclick="event.stopPropagation(); window.AhorroProgramadoModule.openDetailModal(${JSON.stringify(item).replace(/"/g, '&quot;')})" 
                            class="text-blue-600 hover:text-blue-800 transition-colors mr-2"
                            title="Ver detalles">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="event.stopPropagation(); window.AhorroProgramadoModule.openEditModal(${JSON.stringify(item).replace(/"/g, '&quot;')})" 
                            class="text-purple-600 hover:text-purple-800 transition-colors mr-2"
                            title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="event.stopPropagation(); window.AhorroProgramadoModule.generateChecklist(${JSON.stringify(item).replace(/"/g, '&quot;')})" 
                            class="text-orange-600 hover:text-orange-800 transition-colors"
                            title="Imprimir Checklist">
                        <i class="fas fa-print"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    function getStatusColor(status) {
        const colors = {
            'ACTIVO': 'bg-green-100 text-green-800',
            'INACTIVO': 'bg-gray-100 text-gray-800',
            'VENCIDO': 'bg-red-100 text-red-800',
            'PENDIENTE': 'bg-yellow-100 text-yellow-800',
            'SUSPENDIDO': 'bg-orange-100 text-orange-800',
            'PAUSADO': 'bg-blue-100 text-blue-800',
            'CANCELADO': 'bg-red-100 text-red-800'
        };
        return colors[status] || 'bg-blue-100 text-blue-800';
    }

    function openDetailModal(item) {
        const detailContent = document.getElementById('detail-content');
        detailContent.innerHTML = `
            <div class="col-span-2 bg-gray-50 p-4 rounded-lg mb-4">
                <h4 class="font-semibold text-gray-700 mb-2">Información General</h4>
            </div>
            <div><span class="text-sm font-medium text-gray-500">Nro:</span><p class="text-gray-900">${item.nro || '-'}</p></div>
            <div><span class="text-sm font-medium text-gray-500">Año:</span><p class="text-gray-900">${item.anio || '-'}</p></div>
            <div><span class="text-sm font-medium text-gray-500">Mes:</span><p class="text-gray-900">${item.mes || '-'}</p></div>
            <div><span class="text-sm font-medium text-gray-500">Cédula:</span><p class="text-gray-900 font-mono">${item.cedula || '-'}</p></div>
            <div class="col-span-2"><span class="text-sm font-medium text-gray-500">Nombre Socio:</span><p class="text-gray-900 uppercase">${item.nombre_socio || '-'}</p></div>
            <div><span class="text-sm font-medium text-gray-500">Nro Socio:</span><p class="text-gray-900">${item.nro_socio || '-'}</p></div>
            <div><span class="text-sm font-medium text-gray-500">Oficina:</span><p class="text-gray-900">${item.oficina || '-'}</p></div>
            
            <div class="col-span-2 bg-gray-50 p-4 rounded-lg mb-4 mt-4">
                <h4 class="font-semibold text-gray-700 mb-2">Información de Póliza y Crédito</h4>
            </div>
            <div><span class="text-sm font-medium text-gray-500">Nro Póliza:</span><p class="text-gray-900">${item.nro_poliza || '-'}</p></div>
            <div><span class="text-sm font-medium text-gray-500">Nro Crédito:</span><p class="text-gray-900">${item.nro_credito || '-'}</p></div>
            <div><span class="text-sm font-medium text-gray-500">Monto Crédito:</span><p class="text-gray-900 font-mono">$${item.monto_credito || '0.00'}</p></div>
            <div><span class="text-sm font-medium text-gray-500">Valor Póliza:</span><p class="text-gray-900 font-mono">$${item.valor_poliza || '0.00'}</p></div>
            
            <div class="col-span-2 bg-gray-50 p-4 rounded-lg mb-4 mt-4">
                <h4 class="font-semibold text-gray-700 mb-2">Fechas</h4>
            </div>
            <div><span class="text-sm font-medium text-gray-500">Emisión Crédito:</span><p class="text-gray-900">${item.fecha_emision_credito ? new Date(item.fecha_emision_credito).toLocaleDateString('es-EC') : '-'}</p></div>
            <div><span class="text-sm font-medium text-gray-500">Vencimiento Crédito:</span><p class="text-gray-900">${item.fecha_vencimiento_credito ? new Date(item.fecha_vencimiento_credito).toLocaleDateString('es-EC') : '-'}</p></div>
            <div><span class="text-sm font-medium text-gray-500">Emisión Póliza:</span><p class="text-gray-900">${item.fecha_emision_poliza ? new Date(item.fecha_emision_poliza).toLocaleDateString('es-EC') : '-'}</p></div>
            <div><span class="text-sm font-medium text-gray-500">Vencimiento Póliza:</span><p class="text-gray-900">${item.fecha_vencimiento_poliza ? new Date(item.fecha_vencimiento_poliza).toLocaleDateString('es-EC') : '-'}</p></div>
            
            <div class="col-span-2 mt-4">
                <span class="text-sm font-medium text-gray-500">Estatus:</span>
                <p class="mt-1">
                    <span class="px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(item.estatus)}">
                        ${item.estatus || 'Sin estatus'}
                    </span>
                </p>
            </div>
        `;
        detailModal.classList.remove('hidden');
        detailModal.classList.add('flex');
    }

    function closeDetailModal() {
        detailModal.classList.add('hidden');
        detailModal.classList.remove('flex');
    }

    function openNewModal() {
        document.getElementById('form-modal-title').textContent = 'Nuevo Registro';
        ahorroForm.reset();
        document.getElementById('form-id').value = '';

        // Calcular el siguiente número disponible
        const maxNro = ahorrosData.length > 0
            ? Math.max(...ahorrosData.map(item => parseInt(item.nro) || 0))
            : 0;
        document.getElementById('form-nro').value = maxNro + 1;

        // Año actual
        const currentYear = new Date().getFullYear();
        document.getElementById('form-anio').value = currentYear;

        // Mes actual en español
        const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        const currentMonth = monthNames[new Date().getMonth()];
        document.getElementById('form-mes').value = currentMonth;

        // Estatus por defecto: ACTIVO
        document.getElementById('form-estatus').value = 'ACTIVO';

        formModal.classList.remove('hidden');
        formModal.classList.add('flex');
    }

    function openEditModal(item) {
        document.getElementById('form-modal-title').textContent = 'Editar Registro';
        document.getElementById('form-id').value = item.id;
        document.getElementById('form-nro').value = item.nro || '';
        document.getElementById('form-anio').value = item.anio || '';
        document.getElementById('form-mes').value = item.mes || '';
        document.getElementById('form-cedula').value = item.cedula || '';
        document.getElementById('form-nombre-socio').value = item.nombre_socio || '';
        document.getElementById('form-nro-socio').value = item.nro_socio || '';
        document.getElementById('form-oficina').value = item.oficina || '';
        document.getElementById('form-nro-poliza').value = item.nro_poliza || '';
        document.getElementById('form-nro-credito').value = item.nro_credito || '';
        document.getElementById('form-monto-credito').value = item.monto_credito || '';
        document.getElementById('form-valor-poliza').value = item.valor_poliza || '';
        document.getElementById('form-fecha-emision-credito').value = item.fecha_emision_credito || '';
        document.getElementById('form-fecha-vencimiento-credito').value = item.fecha_vencimiento_credito || '';
        document.getElementById('form-fecha-emision-poliza').value = item.fecha_emision_poliza || '';
        document.getElementById('form-fecha-vencimiento-poliza').value = item.fecha_vencimiento_poliza || '';
        document.getElementById('form-estatus').value = item.estatus || '';

        formModal.classList.remove('hidden');
        formModal.classList.add('flex');
    }

    function closeFormModal() {
        formModal.classList.add('hidden');
        formModal.classList.remove('flex');
    }

    async function handleFormSubmit(e) {
        e.preventDefault();

        const formId = document.getElementById('form-id').value;
        const formData = {
            nro: document.getElementById('form-nro').value || null,
            anio: parseInt(document.getElementById('form-anio').value) || null,
            mes: document.getElementById('form-mes').value || null,
            cedula: document.getElementById('form-cedula').value || null,
            nombre_socio: document.getElementById('form-nombre-socio').value || null,
            nro_socio: document.getElementById('form-nro-socio').value || null,
            oficina: document.getElementById('form-oficina').value || null,
            nro_poliza: parseInt(document.getElementById('form-nro-poliza').value) || null,
            nro_credito: parseInt(document.getElementById('form-nro-credito').value) || null,
            monto_credito: parseFloat(document.getElementById('form-monto-credito').value) || null,
            valor_poliza: parseFloat(document.getElementById('form-valor-poliza').value) || null,
            fecha_emision_credito: document.getElementById('form-fecha-emision-credito').value || null,
            fecha_vencimiento_credito: document.getElementById('form-fecha-vencimiento-credito').value || null,
            fecha_emision_poliza: document.getElementById('form-fecha-emision-poliza').value || null,
            fecha_vencimiento_poliza: document.getElementById('form-fecha-vencimiento-poliza').value || null,
            estatus: document.getElementById('form-estatus').value || null
        };

        try {
            let result;
            const supabase = await getDb();

            if (formId) {
                // Actualizar registro existente
                result = await supabase
                    .from('programado_tr')
                    .update(formData)
                    .eq('id', parseInt(formId))
                    .select();

                if (result.error) {
                    throw result.error;
                }

                if (!result.data || result.data.length === 0) {
                    throw new Error('No se encontró el registro para actualizar.');
                }
            } else {
                // Insertar nuevo registro
                result = await supabase
                    .from('programado_tr')
                    .insert([formData])
                    .select();

                if (result.error) {
                    throw result.error;
                }
            }

            window.GestionAuth.showToast(
                formId ? 'Registro actualizado exitosamente' : 'Registro guardado exitosamente',
                'success'
            );
            closeFormModal();
            loadData();
        } catch (error) {
            console.error('Error guardando registro:', error);
            window.GestionAuth.showToast(
                `Error al guardar el registro: ${error.message || 'Error desconocido'}`,
                'error'
            );
        }
    }

    function sortBy(field) {
        if (currentSort.field === field) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.field = field;
            currentSort.direction = 'asc';
        }

        // Actualizar iconos de ordenamiento
        document.querySelectorAll('.sort-icon').forEach(icon => {
            icon.className = 'fas fa-sort sort-icon ml-1 text-gray-400';
        });

        const header = document.querySelector(`[data-sort="${field}"]`);
        if (header) {
            const icon = header.querySelector('.sort-icon');
            if (icon) {
                icon.className = `fas fa-sort-${currentSort.direction === 'asc' ? 'up' : 'down'} sort-icon ml-1 text-purple-600`;
            }
        }

        applyFilters();
    }

    // ===== UTILIDADES PARA CHECKLIST =====
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
        let num = parseFloat(String(amount).replace(/[^0-9.]/g, '')) || 0;
        const formattedUSD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
        const integerPart = Math.floor(num);
        const decimalPart = Math.round((num - integerPart) * 100);
        const decimalStr = decimalPart.toString().padStart(2, '0');
        const words = numberToWords(integerPart);
        return `${formattedUSD} (${words} DOLARES ${decimalStr}/100)`;
    }

    function generateChecklist(item) {
        if (!item) return;

        const nombreSocio = item.nombre_socio || '';
        const fechaActual = new Date().toLocaleDateString('es-EC');
        const oficina = item.oficina || '';
        const montoRaw = item.valor_poliza || '0';
        const montoFormatted = formatCurrency(montoRaw);

        // Branding Colors
        const cPrimary = '#001749';
        const cAccent = '#e48410';
        const cBlue = '#3787c6';
        const cLightBlue = '#015cd0';
        const logoUrl = 'https://lh3.googleusercontent.com/d/1idgiPohtekZVIYJ-pmza9PSQqEamUvfH=w2048?name=TUPAK%20RANTINA%20(2).png';

        const personaNaturalItems = [
            'Copia de la cedula Deudor/ a Color',
            'Papeleta de votación',
            'Solicitud de ingreso',
            'Formulario conozca a su cliente',
            'Certificado de Ahorro inversion',
            'Licitud de fondos',
            'Planilla de la luz',
            'Otros:'
        ];

        const personaJuridicaItems = [
            'Ruc, de la institución',
            'Nombramiento del representante Legal',
            'Copia de la cedula del representante Legal / a Color',
            'Papeleta de votación',
            'Solicitud de ingreso',
            'Formulario conozca a su cliente',
            'Certificado de Ahorro inversión',
            'Licitud de Fondo',
            'Planilla de la luz',
            'Otros:'
        ];

        const createRows = (items) => items.map(text => `
            <tr>
                <td style="padding: 2px 4px; border: 1px solid #ccc;">${text}</td>
                <!-- SI -->
                <td style="padding: 0; border: 1px solid #ccc; text-align: center; width: 25px; font-size: 9px;"></td>
                <!-- NO -->
                <td style="padding: 0; border: 1px solid #ccc; text-align: center; width: 25px; font-size: 9px;"></td>
                <!-- SI -->
                <td style="padding: 0; border: 1px solid #ccc; text-align: center; width: 25px; font-size: 9px;"></td>
                <!-- NO -->
                <td style="padding: 0; border: 1px solid #ccc; text-align: center; width: 25px; font-size: 9px;"></td>
                <!-- OBSERVACIÓN -->
                <td style="padding: 2px 4px; border: 1px solid #ccc; width: 150px;"></td>
            </tr>
        `).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Checklist_Ahorro_${nombreSocio.replace(/\\s+/g, '_')}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
                    body { font-family: 'Roboto', sans-serif; margin: 0; padding: 15px; color: #333; font-size: 10px; }
                    
                    /* Header Style similar to Cuentas/Creditos */
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${cAccent}; padding-bottom: 10px; margin-bottom: 8px; }
                    .logo { max-height: 50px; }
                    .title-box { text-align: right; }
                    .title-box h1 { margin: 0; color: ${cPrimary}; font-size: 16px; text-transform: uppercase; }
                    .title-box p { margin: 1px 0 0; color: ${cBlue}; font-size: 11px; }
                    .meta-codes { font-size: 9px; color: #666; margin-top: 3px; }

                    /* Info Grid */
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; background: #f9f9f9; padding: 8px; border-radius: 6px; border-left: 4px solid ${cPrimary}; }
                    .info-item { margin-bottom: 3px; }
                    .info-label { font-weight: bold; color: ${cPrimary}; display: block; font-size: 9px; text-transform: uppercase; }
                    .info-value { font-size: 11px; color: #000; border-bottom: 1px solid #ddd; padding-bottom: 1px; display: block; width: 100%; min-height: 15px; }
                    
                    /* Section Title */
                    .section-title { background: #d1d5db; color: #000; padding: 3px 8px; font-weight: bold; margin-top: 10px; margin-bottom: 3px; font-size: 10px; border-radius: 3px; text-transform: uppercase; }

                    /* Table Styles */
                    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                    th { background: #d1d5db; color: #000; padding: 2px; text-align: center; font-size: 9px; border: 1px solid #9ca3af; font-weight: bold; }
                    td { font-size: 9px; }
                    /* Alternating Row Colors */
                    tr:nth-child(even) { background-color: #f2f2f2; }

                    /* Footer Styles */
                    .footer { margin-top: 20px; display: flex; justify-content: space-between; page-break-inside: avoid; }
                    .signature-box { width: 45%; border: 1px solid #333; display: flex; flex-direction: column; }
                    .signature-label { background: ${cBlue}; color: white; font-weight: bold; font-size: 9px; text-align: center; padding: 2px; border-bottom: 1px solid #333; }
                    .signature-content { height: 60px; } /* Space for signature */
                    .signature-footer { border-top: 1px solid #333; padding: 5px; font-size: 9px; }

                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                        @page { margin: 0.5cm; size: A4; }
                        /* Ensure background colors print */
                        tr:nth-child(even) { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: #f2f2f2; }
                        .signature-label { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: ${cBlue}; color: white; }
                        .section-title { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: #d1d5db; }
                        th { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: #d1d5db; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="${logoUrl}" alt="Tupak Rantina" class="logo">
                    <div class="title-box">
                        <h1>CHECK LIST AHORRO INVERSIÓN</h1>
                        <p>Gestión de Ahorro Programado</p>
                        <p>CATR-AP-2025</p>
                        <div class="meta-codes">
                            <div>Fecha: ${fechaActual}</div>
                        </div>
                    </div>
                </div>

                <div class="info-grid">
                    <div class="info-item" style="grid-column: span 2;">
                        <span class="info-label">Socio</span>
                        <span class="info-value">${nombreSocio}</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-label">Cédula</span>
                        <span class="info-value">${item.cedula || ''}</span>
                    </div>

                    <div class="info-item">
                        <span class="info-label">Oficina</span>
                        <span class="info-value">${oficina}</span>
                    </div>

                    <div class="info-item" style="grid-column: span 2;">
                        <span class="info-label">Monto Inversión</span>
                        <span class="info-value">${montoFormatted}</span>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th rowspan="2" style="width: 40%; text-align: left; padding-left: 8px;">DOCUMENTACIÓN PERSONA NATURAL</th>
                            <th colspan="2" style="width: 15%;">SI / NO</th>
                            <th colspan="2" style="width: 15%;">SI / NO</th>
                            <th rowspan="2" style="width: 30%;">OBSERVACIÓN</th>
                        </tr>
                        <tr>
                            <th style="width: 7.5%;">SI</th>
                            <th style="width: 7.5%;">NO</th>
                            <th style="width: 7.5%;">SI</th>
                            <th style="width: 7.5%;">NO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${createRows(personaNaturalItems)}
                    </tbody>
                </table>

                <table>
                    <thead>
                        <tr>
                            <th rowspan="2" style="width: 40%; text-align: left; padding-left: 8px;">DOCUMENTACIÓN PERSONA JURIDICA</th>
                            <th colspan="2" style="width: 15%;">SI / NO</th>
                            <th colspan="2" style="width: 15%;">SI / NO</th>
                            <th rowspan="2" style="width: 30%;">OBSERVACIÓN</th>
                        </tr>
                        <tr>
                            <th style="width: 7.5%;">SI</th>
                            <th style="width: 7.5%;">NO</th>
                            <th style="width: 7.5%;">SI</th>
                            <th style="width: 7.5%;">NO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${createRows(personaJuridicaItems)}
                    </tbody>
                </table>

                <div class="footer">
                    <div class="signature-box">
                        <div class="signature-label">Entrega Asistente de Ahorros inversión</div>
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

        const cPrimary = '#001749';
        const cLightBlue = '#f0f4f8';
        const logoUrl = 'https://lh3.googleusercontent.com/d/1idgiPohtekZVIYJ-pmza9PSQqEamUvfH=w2048?name=TUPAK%20RANTINA%20(2).png';

        let reportData = [...ahorrosData];

        // Re-aplicar filtros para el reporte
        if (currentFilters.search) {
            const term = currentFilters.search.toLowerCase();
            reportData = reportData.filter(item =>
                (item.cedula && item.cedula.toLowerCase().includes(term)) ||
                (item.nombre_socio && item.nombre_socio.toLowerCase().includes(term)) ||
                (item.nro_socio && item.nro_socio.toLowerCase().includes(term))
            );
        }
        if (currentFilters.status !== 'all') {
            reportData = reportData.filter(item => item.estatus === currentFilters.status);
        }
        if (currentFilters.oficina !== 'all') {
            reportData = reportData.filter(item => item.oficina === currentFilters.oficina);
        }

        const rows = reportData.map((item, index) => {
            const fechaEmision = item.fecha_emision_poliza
                ? new Date(item.fecha_emision_poliza).toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' })
                : '-';
            const fechaVencimiento = item.fecha_vencimiento_poliza
                ? new Date(item.fecha_vencimiento_poliza).toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' })
                : '-';

            return `
                <tr style="background-color: ${index % 2 === 0 ? '#fff' : '#f9fafb'};">
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.nro || '-'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.anio || '-'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.mes || '-'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.cedula || '-'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.nombre_socio || '-'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.nro_socio || '-'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.oficina || '-'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${fechaEmision}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${fechaVencimiento}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">$${item.valor_poliza || '0.00'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.estatus || '-'}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Reporte de Ahorro Programado - ${fechaActual}</title>
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
                        <h1 class="title">Reporte de Ahorro Programado</h1>
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
                            <th style="width: 4%;">#</th>
                            <th style="width: 4%;">Nro</th>
                            <th style="width: 6%;">Año</th>
                            <th style="width: 8%;">Mes</th>
                            <th style="width: 9%;">Cédula</th>
                            <th style="width: 18%;">Socio</th>
                            <th style="width: 8%;">Nro Socio</th>
                            <th style="width: 10%;">Oficina</th>
                            <th style="width: 9%;">F. Emisión</th>
                            <th style="width: 9%;">F. Vencimiento</th>
                            <th style="width: 8%;">Monto</th>
                            <th style="width: 7%;">Estatus</th>
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

    // Exponer funciones globalmente
    window.AhorroProgramadoModule = {
        openDetailModal,
        closeDetailModal,
        openNewModal,
        openEditModal,
        closeFormModal,
        sortBy,
        generateReport,
        generateChecklist
    };

})();

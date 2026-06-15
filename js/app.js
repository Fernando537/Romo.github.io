const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playAlarmaSonido() {
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    } catch(e) { console.log("Audio play bloqueado o deshabilitado"); }
}

// ================= ESTADOS CENTRALIZADOS (LOCALSTORAGE) =================
let canchasFechaActual = new Date();
let tiendaSubModuloActivo = 'pos';
let prodImagenBase64Temporal = '';

// Data Store
let canchasReservas = [];
let billarHistorial = [];
let tiendaCategorias = [];
let tiendaProductos = [];
let tiendaCarrito = [];
let flujoCaja = [];

// Inicialización de Datos
function inicializarBaseDatos() {
    // Canchas
    if (!localStorage.getItem('wally_romo_canchas')) {
        const hoyISO = obtenerFechaISO(new Date());
        canchasReservas = [
            { 
                id: "1", cancha: 2, inicioStr: "13:00", finStr: "14:30", fecha: hoyISO, telefono: '71234567',
                cliente: 'Jesús Tarqui', juego: 'Wally', total: '60.00', acuenta: '60.00', saldo: '0.00',
                historial: ['Turno registrado por Mauricio']
            },
            { 
                id: "2", cancha: 3, inicioStr: "19:00", finStr: "20:30", fecha: hoyISO, telefono: '68214578',
                cliente: 'Alex Sandro', juego: 'Futbito', total: '80.00', acuenta: '40.00', saldo: '40.00',
                historial: ['Se registró un adelanto de 40 Bs.']
            }
        ];
        localStorage.setItem('wally_romo_canchas', JSON.stringify(canchasReservas));
    } else {
        canchasReservas = JSON.parse(localStorage.getItem('wally_romo_canchas'));
    }

    // Billar
    billarHistorial = JSON.parse(localStorage.getItem('wally_romo_billar_historial')) || [];
    restaurarBillarActivo();

    // Tienda Categorías
    if (!localStorage.getItem('wally_romo_categorias')) {
        tiendaCategorias = ["Bebidas", "Snacks", "Accesorios"];
        localStorage.setItem('wally_romo_categorias', JSON.stringify(tiendaCategorias));
    } else {
        tiendaCategorias = JSON.parse(localStorage.getItem('wally_romo_categorias'));
    }

    // Tienda Productos
    if (!localStorage.getItem('wally_romo_productos')) {
        tiendaProductos = [
            { id: 1, nombre: "Gatorade Frutos Rojos", categoria: "Bebidas", precio: 10.00, stock: 25, imagen: "" },
            { id: 2, nombre: "Papa Fritas Lay's", categoria: "Snacks", precio: 7.00, stock: 15, imagen: "" },
            { id: 3, nombre: "Agua Mineral 500ml", categoria: "Bebidas", precio: 5.00, stock: 30, imagen: "" }
        ];
        localStorage.setItem('wally_romo_productos', JSON.stringify(tiendaProductos));
    } else {
        tiendaProductos = JSON.parse(localStorage.getItem('wally_romo_productos'));
    }

    // Flujo de Caja
    if (!localStorage.getItem('wally_romo_flujo')) {
        flujoCaja = [
            { id: 1, timestamp: new Date().toISOString(), fecha: obtenerFechaISO(new Date()), tipo: 'Ingreso', categoria: 'Caja Inicial', concepto: 'Apertura de Caja Mínima', monto: 100.00 }
        ];
        localStorage.setItem('wally_romo_flujo', JSON.stringify(flujoCaja));
    } else {
        flujoCaja = JSON.parse(localStorage.getItem('wally_romo_flujo'));
    }
}

function guardarCanchas() {
    localStorage.setItem('wally_romo_canchas', JSON.stringify(canchasReservas));
    actualizarDashboardEstadisticas();
}
function guardarBillarHistorial() {
    localStorage.setItem('wally_romo_billar_historial', JSON.stringify(billarHistorial));
    actualizarDashboardEstadisticas();
}
function guardarTiendaCategorias() {
    localStorage.setItem('wally_romo_categorias', JSON.stringify(tiendaCategorias));
}
function guardarTiendaProductos() {
    localStorage.setItem('wally_romo_productos', JSON.stringify(tiendaProductos));
    actualizarDashboardEstadisticas();
}
function guardarFlujoCaja() {
    localStorage.setItem('wally_romo_flujo', JSON.stringify(flujoCaja));
    actualizarDashboardEstadisticas();
}

// ================= CONTROL GENERAL DE NAVEGACIÓN =================
function cambiarModulo(idModulo) {
    document.querySelectorAll('.structural-modulo').forEach(mod => mod.classList.add('hidden'));
    document.getElementById(`modulo-${idModulo}`).classList.remove('hidden');
    
    // Iconos y Títulos del encabezado superior
    const config = {
        'inicio': { icono: '🏠', titulo: 'Inicio / Resumen Diario' },
        'canchas': { icono: '🏐', titulo: 'Gestión de Canchas Wally' },
        'billar': { icono: '🎱', titulo: 'Control de Mesas de Billar' },
        'tienda': { icono: '🏪', titulo: 'Tienda & POS / Snack Bar' },
        'flujo': { icono: '📊', titulo: 'Libro de Caja y Finanzas' }
    };

    document.getElementById('header-icono').innerText = config[idModulo].icono;
    document.getElementById('titulo-modulo-activo').innerText = config[idModulo].titulo;

    // Cambiar estados de botones de navegación lateral
    document.querySelectorAll('aside nav button').forEach(btn => {
        btn.className = "w-full flex items-center gap-3 text-slate-400 hover:text-slate-200 hover:bg-[#1a222c] px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left";
    });
    const activeBtn = document.getElementById(`btn-nav-${idModulo}`);
    if (activeBtn) {
        activeBtn.className = "w-full flex items-center gap-3 bg-[#1e2732] border-l-4 border-cyan-500 text-cyan-400 px-3 py-2.5 rounded-r-xl font-bold text-xs transition-all text-left";
    }

    // Ocultar barra lateral en móviles al clickear
    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.add('hidden');
    }

    // Inicializar renderizados específicos
    if (idModulo === 'inicio') actualizarDashboardEstadisticas();
    else if (idModulo === 'canchas') renderizarAgendaCanchas();
    else if (idModulo === 'billar') renderizarBillarMonitor();
    else if (idModulo === 'tienda') { renderCategoriasTienda(); renderProductosTienda(); renderProductosPOS(); }
    else if (idModulo === 'flujo') { 
        document.getElementById('flujo-filtro-fecha').value = obtenerFechaISO(new Date());
        renderizarFlujoCaja(); 
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('hidden');
}

// ================= AUXILIARES =================
function obtenerFechaISO(dateObj) {
    let m = dateObj.getMonth() + 1;
    let d = dateObj.getDate();
    return `${dateObj.getFullYear()}-${m < 10 ? '0'+m : m}-${d < 10 ? '0'+d : d}`;
}
function formatMoney(amount) {
    return `Bs ${parseFloat(amount).toFixed(2)}`;
}

// ================= MODULO INICIO / STATS =================
function actualizarDashboardEstadisticas() {
    const hoyISO = obtenerFechaISO(new Date());

    // 1. Caja Neta de Hoy (Ingresos - Egresos de hoy)
    const transaccionesHoy = flujoCaja.filter(f => f.fecha === hoyISO);
    let ingresosHoy = 0;
    let egresosHoy = 0;
    transaccionesHoy.forEach(t => {
        if (t.tipo === 'Ingreso') ingresosHoy += parseFloat(t.monto);
        else egresosHoy += parseFloat(t.monto);
    });
    const balanceHoy = ingresosHoy - egresosHoy;
    document.getElementById('stat-caja').innerText = formatMoney(balanceHoy);
    document.getElementById('stat-caja').className = balanceHoy >= 0 ? "text-xl font-black text-emerald-600" : "text-xl font-black text-red-650";

    // 2. Canchas Reservadas Hoy
    const turnosHoy = canchasReservas.filter(r => r.fecha === hoyISO).length;
    document.getElementById('stat-canchas').innerText = `${turnosHoy} Turno${turnosHoy !== 1 ? 's':''}`;

    // 3. Mesas en Uso Actual (Billiards active)
    let activeBilliards = 0;
    for (let i = 1; i <= 2; i++) {
        if (activeMesasBillar[i] && activeMesasBillar[i].activo) activeBilliards++;
    }
    document.getElementById('stat-billar').innerText = `${activeBilliards} Activa${activeBilliards !== 1 ? 's':''}`;

    // 4. Saldos por Cobrar (Saldos de canchas hoy)
    let saldosHoy = 0;
    canchasReservas.filter(r => r.fecha === hoyISO).forEach(r => {
        saldosHoy += parseFloat(r.saldo) || 0;
    });
    document.getElementById('stat-saldos').innerText = formatMoney(saldosHoy);
}

// ================= MODULO CANCHAS (INTERACTIVIDAD) =================
const ALTURA_FILA = 65;
let cReservaSeleccionada = null; // Para editar/eliminar

function renderizarAgendaCanchas() {
    const contenedor = document.getElementById('contenedor-horas-canchas');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    const fechaFiltroISO = obtenerFechaISO(canchasFechaActual);

    // Títulos y visual de la fecha
    const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById('fecha-display').innerText = canchasFechaActual.toLocaleDateString('es-ES', opciones);
    document.getElementById('canchas-date-picker').value = fechaFiltroISO;

    // Generar cuadrícula horaria de 08:00 a 23:00
    for (let hora = 8; hora <= 23; hora++) {
        const fila = document.createElement('div');
        fila.className = "grid grid-cols-[70px_1fr_1fr_1fr] min-h-[65px] border-b border-slate-200/80 relative";
        
        const colHora = document.createElement('div');
        colHora.className = "text-[11px] text-slate-400 font-extrabold p-3.5 text-right border-r border-slate-200 bg-white font-mono";
        colHora.innerText = `${hora < 10 ? '0'+hora : hora}:00`;
        fila.appendChild(colHora);

        for (let canchaId = 2; canchaId <= 4; canchaId++) {
            const celda = document.createElement('div');
            celda.className = `border-r border-slate-200/40 celda-interactiva cursor-pointer transition-all duration-100`;
            
            // Al hacer clic, abre el modal de reserva con la hora y cancha pre-seleccionadas
            celda.onclick = () => {
                abrirModalReservaCanchas(canchaId, `${hora < 10 ? '0'+hora : hora}:00`, `${(hora + 1) < 10 ? '0'+(hora + 1) : (hora + 1)}:00`);
            };

            fila.appendChild(celda);
        }
        contenedor.appendChild(fila);
    }

    // Pintar Reservas encima de las celdas
    const reservasDia = canchasReservas.filter(r => r.fecha === fechaFiltroISO);
    reservasDia.forEach(res => {
        const pIn = res.inicioStr.split(':');
        const pFi = res.finStr.split(':');
        const horaIn = parseInt(pIn[0]) + (parseInt(pIn[1])/60);
        const horaFi = parseInt(pFi[0]) + (parseInt(pFi[1])/60);
        
        const topBloque = (horaIn - 8) * ALTURA_FILA;
        const alturaBloque = (horaFi - horaIn) * ALTURA_FILA;

        let leftOffset = '70px';
        let anchoColumna = '30.8%';
        if (res.cancha === 3) leftOffset = 'calc(70px + 31.1%)';
        if (res.cancha === 4) leftOffset = 'calc(70px + 62.2%)';

        // Color dinámico según saldo / pago completo
        const colorClase = obtenerColorTurno(res.total, res.acuenta);

        const bloque = document.createElement('div');
        bloque.className = `absolute ${colorClase} p-2 rounded-2xl border z-10 shadow-md overflow-hidden flex flex-col justify-center cursor-pointer text-center font-bold tracking-wide text-[11px] transition-all duration-150 transform hover:scale-[1.01] hover:shadow-lg`;
        bloque.style.top = `${topBloque}px`;
        bloque.style.left = leftOffset;
        bloque.style.width = anchoColumna;
        bloque.style.height = `${alturaBloque}px`;
        bloque.innerHTML = `
            <p class="truncate uppercase text-[11px] leading-tight">${res.cliente}</p>
            <p class="text-[9px] opacity-90 font-medium bg-black/10 rounded-lg px-1.5 mt-1 inline-block mx-auto uppercase">${res.juego}</p>
        `;
        
        bloque.onclick = (e) => {
            e.stopPropagation();
            abrirComprobanteCanchas(res);
        };
        contenedor.appendChild(bloque);
    });

    // Pintar línea de tiempo efectiva
    renderizarLineaTiempoCanchas();
    // Listar reservas del día en la barra lateral
    renderizarListaCanchasDia();
}

function obtenerColorTurno(totalStr, acuentaStr) {
    const total = parseFloat(totalStr) || 0;
    const acuenta = parseFloat(acuentaStr) || 0;
    const saldo = total - acuenta;
    
    if (saldo <= 0 && total > 0) {
        return 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700'; 
    } else if (acuenta > 0 && saldo > 0) {
        return 'bg-blue-600 border-blue-700 text-white hover:bg-blue-700'; 
    } else {
        return 'bg-amber-500 border-amber-600 text-slate-900 hover:bg-amber-600'; 
    }
}

function renderizarLineaTiempoCanchas() {
    const contenedor = document.getElementById('contenedor-horas-canchas');
    if (!contenedor) return;

    const viejaLinea = document.getElementById('linea-tiempo-canchas');
    if (viejaLinea) viejaLinea.remove();

    const hoy = new Date();
    if (obtenerFechaISO(canchasFechaActual) !== obtenerFechaISO(hoy)) return;

    const h = hoy.getHours();
    const m = hoy.getMinutes();

    if (h >= 8 && h <= 23) {
        const topPixel = (h - 8 + (m / 60)) * ALTURA_FILA;
        const linea = document.createElement('div');
        linea.id = 'linea-tiempo-canchas';
        linea.className = "absolute left-0 right-0 z-20 pointer-events-none flex items-center";
        linea.style.top = `${topPixel}px`;
        linea.innerHTML = `
            <div class="w-3.5 h-3.5 bg-red-600 rounded-full absolute left-[63px] -translate-x-1/2 shadow pulso-tiempo"></div>
            <div class="w-full h-[2px] bg-red-500/80 ml-[68px]"></div>
        `;
        contenedor.appendChild(linea);
    }
}

function renderizarListaCanchasDia() {
    const lista = document.getElementById('lista-registros-canchas');
    if (!lista) return;
    lista.innerHTML = '';
    
    const fechaFiltroISO = obtenerFechaISO(canchasFechaActual);
    const reservasDia = canchasReservas.filter(r => r.fecha === fechaFiltroISO);

    if (reservasDia.length === 0) {
        lista.innerHTML = `<p class="text-slate-400 text-center py-8 italic font-medium">No hay reservas para hoy.</p>`;
        return;
    }

    reservasDia.forEach(res => {
        const item = document.createElement('div');
        item.className = "p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2 hover:shadow transition relative";
        
        const esPagado = (parseFloat(res.saldo) <= 0);
        const badgeEst = esPagado 
            ? `<span class="bg-emerald-100 text-emerald-800 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase">Pagado</span>`
            : `<span class="bg-amber-100 text-amber-800 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase">Saldo Bs ${res.saldo}</span>`;

        item.innerHTML = `
            <div class="flex justify-between items-center border-b pb-1">
                <strong class="text-slate-800 uppercase">${res.cliente}</strong>
                <span class="text-cyan-700 font-extrabold text-[10px] uppercase">Cancha ${res.cancha}</span>
            </div>
            <div class="text-[10px] text-slate-500 space-y-1">
                <p>⏱️ ${res.inicioStr} a ${res.finStr} | 🏆 ${res.juego}</p>
                <div class="flex justify-between items-center">
                    ${badgeEst}
                    <button onclick='abrirComprobanteCanchasPorId("${res.id}")' class="text-slate-400 hover:text-slate-800 font-extrabold uppercase text-[9px]">Ver Ficha</button>
                </div>
            </div>
        `;
        lista.appendChild(item);
    });
}

// Navegación de Fechas Cancha
function modificarFechaCanchas(dias) {
    canchasFechaActual.setDate(canchasFechaActual.getDate() + dias);
    renderizarAgendaCanchas();
}
function establecerHoyCanchas() {
    canchasFechaActual = new Date();
    renderizarAgendaCanchas();
}
function seleccionarFechaCanchas(valStr) {
    if (valStr) {
        const partes = valStr.split('-');
        canchasFechaActual = new Date(partes[0], partes[1] - 1, partes[2]);
        renderizarAgendaCanchas();
    }
}

// Modal Reserva Canchas
function abrirModalReservaCanchas(cancha, inicioStr, finStr, idReserva = "") {
    document.getElementById('form-canchas-id').value = idReserva;
    document.getElementById('form-canchas-cancha').value = cancha;
    document.getElementById('form-canchas-inicio').value = inicioStr;
    document.getElementById('form-canchas-fin').value = finStr;
    document.getElementById('form-canchas-fecha').value = obtenerFechaISO(canchasFechaActual);

    if (!idReserva) {
        document.getElementById('titulo-modal-canchas').innerText = "📋 Nueva Reserva Administrativa";
        document.getElementById('form-canchas-cliente').value = '';
        document.getElementById('form-canchas-telefono').value = '';
        document.getElementById('form-canchas-total').value = '60.00';
        document.getElementById('form-canchas-acuenta').value = '0.00';
        document.getElementById('form-canchas-saldo').innerText = '60.00 Bs.';
    }

    document.getElementById('modal-reserva-canchas').classList.remove('hidden');
}

function abrirModalReservaCanchasManual() {
    abrirModalReservaCanchas(2, "19:00", "20:00");
}

function cerrarModalCanchas() {
    document.getElementById('modal-reserva-canchas').classList.add('hidden');
}

function calcularSaldoCanchasForm() {
    const tot = parseFloat(document.getElementById('form-canchas-total').value) || 0;
    const acu = parseFloat(document.getElementById('form-canchas-acuenta').value) || 0;
    const sal = (tot - acu).toFixed(2);
    document.getElementById('form-canchas-saldo').innerText = `${sal} Bs.`;
}

function guardarReservaCanchas() {
    const id = document.getElementById('form-canchas-id').value;
    const cliente = document.getElementById('form-canchas-cliente').value.trim() || 'Cliente General';
    const telefono = document.getElementById('form-canchas-telefono').value;
    const fecha = document.getElementById('form-canchas-fecha').value;
    const cancha = parseInt(document.getElementById('form-canchas-cancha').value);
    const juego = document.getElementById('form-canchas-juego').value;
    const inicio = document.getElementById('form-canchas-inicio').value;
    const fin = document.getElementById('form-canchas-fin').value;
    const total = parseFloat(document.getElementById('form-canchas-total').value) || 0;
    const acuenta = parseFloat(document.getElementById('form-canchas-acuenta').value) || 0;
    const saldo = (total - acuenta).toFixed(2);

    const timestamp = new Date().toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'});

    if (id) {
        // Modificar existente
        const index = canchasReservas.findIndex(r => r.id === id);
        if (index !== -1) {
            const vieja = canchasReservas[index];
            const logs = [...(vieja.historial || [])];
            logs.push(`Modificado: Total ${total.toFixed(2)} / Adelanto: ${acuenta.toFixed(2)} Bs. a las ${timestamp}`);
            
            canchasReservas[index] = {
                id, cancha, inicioStr: inicio, finStr: fin, fecha, telefono, cliente, juego,
                total: total.toFixed(2), acuenta: acuenta.toFixed(2), saldo, historial: logs
            };

            // Registrar cobro parcial en caja si cambió el acuenta a más
            const diffAcuenta = acuenta - parseFloat(vieja.acuenta);
            if (diffAcuenta > 0) {
                registrarEnFlujoCaja('Ingreso', 'Canchas', `Abono/Saldo cancha de ${cliente} (Cancha ${cancha})`, diffAcuenta);
            }
        }
    } else {
        // Crear nueva reserva
        const nueva = {
            id: Date.now().toString(),
            cancha, inicioStr: inicio, finStr: fin, fecha, telefono, cliente, juego,
            total: total.toFixed(2), acuenta: acuenta.toFixed(2), saldo,
            historial: [`Creado originalmente a las ${timestamp} con adelanto de ${acuenta.toFixed(2)} Bs.`]
        };
        canchasReservas.push(nueva);

        // Si hay abono inicial registrar en Flujo de Caja
        if (acuenta > 0) {
            registrarEnFlujoCaja('Ingreso', 'Canchas', `Adelanto cancha de ${cliente} (Cancha ${cancha})`, acuenta);
        }
    }

    guardarCanchas();
    cerrarModalCanchas();
    renderizarAgendaCanchas();
}

// Ficha/Comprobante Canchas
function abrirComprobanteCanchas(res) {
    cReservaSeleccionada = res;
    document.getElementById('comp-cliente').innerText = res.cliente;
    document.getElementById('comp-cancha').innerText = `Cancha ${res.cancha} (${res.cancha === 2 ? 'Wally/Vóley' : res.cancha === 3 ? 'Futbito' : 'Raquetbol'})`;
    document.getElementById('comp-juego').innerText = res.juego;
    document.getElementById('comp-fecha').innerText = res.fecha;
    document.getElementById('comp-inicio').innerText = res.inicioStr;
    document.getElementById('comp-fin').innerText = res.finStr;
    document.getElementById('comp-total').innerText = `${res.total} Bs.`;
    document.getElementById('comp-acuenta').innerText = `${res.acuenta} Bs.`;
    document.getElementById('comp-saldo').innerText = `${res.saldo} Bs.`;

    // Botón editar
    document.getElementById('btn-comp-editar').onclick = () => {
        cerrarComprobanteCanchas();
        abrirModalReservaCanchas(res.cancha, res.inicioStr, res.finStr, res.id);
        document.getElementById('form-canchas-cliente').value = res.cliente;
        document.getElementById('form-canchas-telefono').value = res.telefono;
        document.getElementById('form-canchas-total').value = res.total;
        document.getElementById('form-canchas-acuenta').value = res.acuenta;
        document.getElementById('form-canchas-fecha').value = res.fecha;
        calcularSaldoCanchasForm();
    };

    document.getElementById('modal-comprobante-canchas').classList.remove('hidden');
}

function abrirComprobanteCanchasPorId(id) {
    const res = canchasReservas.find(r => r.id === id);
    if (res) abrirComprobanteCanchas(res);
}

function cerrarComprobanteCanchas() {
    document.getElementById('modal-comprobante-canchas').classList.add('hidden');
    cReservaSeleccionada = null;
}

function liberarCanchaCompleta() {
    if (cReservaSeleccionada) {
        const res = cReservaSeleccionada;
        if (confirm(`¿Estás seguro de liberar la reserva de "${res.cliente}" en Cancha ${res.cancha}?`)) {
            canchasReservas = canchasReservas.filter(r => r.id !== res.id);
            guardarCanchas();
            cerrarComprobanteCanchas();
            renderizarAgendaCanchas();
        }
    }
}

// ================= MODULO BILLAR (LOGICA DE TIEMPOS) =================
let activeMesasBillar = {
    1: { activo: false, modo: 'cronometro', inicio: null, minutosAjustados: 60, intervalo: null },
    2: { activo: false, modo: 'cronometro', inicio: null, minutosAjustados: 60, intervalo: null }
};
const TARIFA_FIJA_HORA = 15.00;

function guardarBillarActivo() {
    const data = {};
    for (let id = 1; id <= 2; id++) {
        const m = activeMesasBillar[id];
        data[id] = {
            activo: m.activo,
            modo: m.modo,
            inicio: m.inicio ? m.inicio.toISOString() : null,
            minutosAjustados: m.minutosAjustados
        };
    }
    localStorage.setItem('wally_romo_billar_activo', JSON.stringify(data));
}

function restaurarBillarActivo() {
    const saved = localStorage.getItem('wally_romo_billar_activo');
    if (!saved) return;
    try {
        const data = JSON.parse(saved);
        for (let id = 1; id <= 2; id++) {
            const d = data[id];
            if (d && d.activo && d.inicio) {
                const m = activeMesasBillar[id];
                m.activo = true;
                m.modo = d.modo;
                m.inicio = new Date(d.inicio);
                m.minutosAjustados = d.minutosAjustados || 60;
                m.intervalo = setInterval(() => { cicloCalculoBillar(id); }, 1000);
            }
        }
    } catch (e) {
        localStorage.removeItem('wally_romo_billar_activo');
    }
}

function renderizarBillarMonitor() {
    renderHistorialBillar();
    for (let id = 1; id <= 2; id++) {
        syncMesaBillarUI(id);
    }
}

function setModeBillar(idMesa, modo) {
    if (activeMesasBillar[idMesa].activo) return;
    activeMesasBillar[idMesa].modo = modo;
    
    const btnCron = document.getElementById(`btnModeCron-${idMesa}`);
    const btnTemp = document.getElementById(`btnModeTemp-${idMesa}`);
    const wrapper = document.getElementById(`wrapperMinutos-${idMesa}`);
    const lblTiempo = document.getElementById(`lblTiempo-${idMesa}`);
    const lblFin = document.getElementById(`lblFin-${idMesa}`);

    if (modo === 'cronometro') {
        btnCron.className = "flex-1 bg-cyan-600 text-white font-bold py-1.5 rounded-lg text-[10px] uppercase tracking-wider shadow";
        btnTemp.className = "flex-1 text-slate-500 hover:text-slate-700 font-bold py-1.5 rounded-lg text-[10px] uppercase tracking-wider";
        wrapper.classList.add('hidden');
        lblTiempo.textContent = "Tiempo de Juego:";
        lblFin.textContent = "Hora Actual";
    } else {
        btnTemp.className = "flex-1 bg-cyan-600 text-white font-bold py-1.5 rounded-lg text-[10px] uppercase tracking-wider shadow";
        btnCron.className = "flex-1 text-slate-500 hover:text-slate-700 font-bold py-1.5 rounded-lg text-[10px] uppercase tracking-wider";
        wrapper.classList.remove('hidden');
        lblTiempo.textContent = "Tiempo Restante:";
        lblFin.textContent = "Fin Prometido";
    }
}

function toggleMesaBillar(idMesa) {
    let m = activeMesasBillar[idMesa];
    let btnMain = document.getElementById(`btnMain-${idMesa}`);
    let badge = document.getElementById(`badge-${idMesa}`);
    let stateSelect = document.getElementById(`paymentStatus-${idMesa}`);

    if (!m.activo) {
        // --- INICIAR JUEGO ---
        m.activo = true;
        m.inicio = new Date();

        if (m.modo === 'temporizador') {
            let mins = parseInt(document.getElementById(`inputMinutos-${idMesa}`).value) || 60;
            m.minutosAjustados = mins;
            m.finEstimado = new Date(m.inicio.getTime() + mins * 60000);
            
            document.getElementById(`valFin-${idMesa}`).textContent = m.finEstimado.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
            badge.textContent = "⏳ Temporizador";
            badge.className = "status-badge bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border border-amber-200";
        } else {
            badge.textContent = "⏱ Cronómetro";
            badge.className = "status-badge bg-cyan-150 text-cyan-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border border-cyan-200";
        }

        document.getElementById(`valInicio-${idMesa}`).textContent = m.inicio.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
        
        cicloCalculoBillar(idMesa);
        m.intervalo = setInterval(() => { cicloCalculoBillar(idMesa); }, 1000);
        guardarBillarActivo();

        btnMain.textContent = "🛑 Terminar y Cobrar";
        btnMain.className = "w-full bg-red-650 hover:bg-red-700 text-white py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-md";
        
        actualizarDashboardEstadisticas();
    } else {
        // --- DETENER Y COBRAR ---
        clearInterval(m.intervalo);
        let finReal = new Date();
        let segs = Math.floor((finReal - m.inicio) / 1000);
        if (segs < 0) segs = 0;
        let mins = segs / 60;
        let importeFinal = 0;
        let duracionFormateada = formatearSegundos(segs);

        if (m.modo === 'cronometro') {
            importeFinal = calcularCostoBillarEspecial(mins);
        } else {
            if (mins > m.minutosAjustados) {
                let basePactada = parseFloat(calcularCostoBillarEspecial(m.minutosAjustados));
                let minsExtra = mins - m.minutosAjustados;
                let costoExtra = (minsExtra / 60) * TARIFA_FIJA_HORA;
                importeFinal = (basePactada + costoExtra).toFixed(2);
            } else {
                importeFinal = calcularCostoBillarEspecial(m.minutosAjustados);
            }
            duracionFormateada += ` (${m.minutosAjustados}m pactados)`;
        }

        let estadoDePago = stateSelect.value;
        
        // Guardar en Historial Billar
        const nuevoItem = {
            mesa: idMesa,
            modo: m.modo === 'cronometro' ? 'Cronómetro' : 'Temporizador',
            fecha: finReal.toLocaleDateString(),
            inicioStr: m.inicio.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            finStr: finReal.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            duracion: duracionFormateada,
            importe: importeFinal,
            estado: estadoDePago
        };
        billarHistorial.unshift(nuevoItem);
        guardarBillarHistorial();

        // Registrar en caja si está pagado
        if (estadoDePago === 'Pagado') {
            registrarEnFlujoCaja('Ingreso', 'Billar', `Alquiler Mesa ${idMesa} (${duracionFormateada})`, importeFinal);
        }

        // Resetear estados
        m.activo = false;
        m.intervalo = null;
        localStorage.removeItem('wally_romo_billar_activo');

        btnMain.textContent = "⚡ Iniciar Juego";
        btnMain.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-md";
        badge.textContent = "Disponible";
        badge.className = "status-badge bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-slate-200";
        
        document.getElementById(`valInicio-${idMesa}`).textContent = "--:--:--";
        document.getElementById(`valFin-${idMesa}`).textContent = "--:--:--";
        document.getElementById(`valTiempo-${idMesa}`).textContent = "00:00:00";
        document.getElementById(`valImporte-${idMesa}`).textContent = "Bs 0.00";
        document.getElementById(`valTiempo-${idMesa}`).style.color = "";
        stateSelect.value = "Por pagar";

        setModeBillar(idMesa, m.modo);
        renderHistorialBillar();
        actualizarDashboardEstadisticas();

        alert(`MESA ${idMesa} CERRADA\n-------------------------\nDuración: ${duracionFormateada}\nEstado: ${estadoDePago}\nTotal: Bs ${importeFinal}`);
    }
}

function cicloCalculoBillar(idMesa) {
    let m = activeMesasBillar[idMesa];
    let ahora = new Date();
    let segs = Math.floor((ahora - m.inicio) / 1000);

    let displayTiempo = document.getElementById(`valTiempo-${idMesa}`);
    let displayImporte = document.getElementById(`valImporte-${idMesa}`);
    let displayHoraActual = document.getElementById(`valFin-${idMesa}`);

    let mins = segs / 60;

    if (m.modo === 'cronometro') {
        displayHoraActual.textContent = ahora.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
        displayTiempo.textContent = formatearSegundos(segs);
        displayImporte.textContent = `Bs ${calcularCostoBillarEspecial(mins)}`;
    } else {
        let segsTotalesPrometidos = m.minutosAjustados * 60;
        let segsRestantes = segsTotalesPrometidos - segs;

        if (segsRestantes <= 0) {
            displayTiempo.textContent = "¡TIEMPO CUMPLIDO!";
            displayTiempo.style.color = "red";
            if (segsRestantes % 5 === 0) playAlarmaSonido();
            
            let basePactada = parseFloat(calcularCostoBillarEspecial(m.minutosAjustados));
            let minsExtra = mins - m.minutosAjustados;
            let costoExtra = (minsExtra / 60) * TARIFA_FIJA_HORA;
            displayImporte.textContent = `Bs ${(basePactada + costoExtra).toFixed(2)}`;
        } else {
            displayTiempo.textContent = formatearSegundos(segsRestantes);
            displayImporte.textContent = `Bs ${calcularCostoBillarEspecial(m.minutosAjustados)}`;
        }
    }
}

function calcularCostoBillarEspecial(minutos) {
    if (minutos <= 0) return "0.00";
    
    if (minutos >= 15 && minutos < 30) {
        return "4.00"; // Salto de 15 minutos
    } else if (minutos >= 30 && minutos < 60) {
        return "8.00"; // Salto de 30 minutos
    } else {
        // Menos de 15 min O más de 60 min proporcional a 15.00 Bs/hora
        let costoProporcional = (minutos / 60) * TARIFA_FIJA_HORA;
        return costoProporcional.toFixed(2);
    }
}

function formatearSegundos(totalSegundos) {
    let hrs = Math.floor(totalSegundos / 3600);
    let mins = Math.floor((totalSegundos % 3600) / 60);
    let secs = totalSegundos % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function syncMesaBillarUI(idMesa) {
    // Sincroniza la visual de la mesa en caso de estar activa al navegar de nuevo
    let m = activeMesasBillar[idMesa];
    let btnMain = document.getElementById(`btnMain-${idMesa}`);
    let badge = document.getElementById(`badge-${idMesa}`);

    if (m.activo) {
        btnMain.textContent = "🛑 Terminar y Cobrar";
        btnMain.className = "w-full bg-red-650 hover:bg-red-700 text-white py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-md";
        
        if (m.modo === 'temporizador') {
            badge.textContent = "⏳ Temporizador";
            badge.className = "status-badge bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border border-amber-200";
        } else {
            badge.textContent = "⏱ Cronómetro";
            badge.className = "status-badge bg-cyan-150 text-cyan-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border border-cyan-200";
        }
    } else {
        setModeBillar(idMesa, m.modo);
    }
}

function toggleHistoryBillar() {
    document.getElementById('historySectionBillar').classList.toggle('hidden');
}
function limpiarHistorialBillar() {
    if (confirm("¿Seguro de limpiar el historial de billar?")) {
        billarHistorial = [];
        guardarBillarHistorial();
        renderHistorialBillar();
    }
}

function renderHistorialBillar() {
    const tbody = document.getElementById('recordsTableBodyBillar');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (billarHistorial.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-slate-400 italic">No hay registros aún.</td></tr>`;
        return;
    }

    billarHistorial.forEach(h => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3"><b>Mesa ${h.mesa}</b></td>
            <td class="p-3"><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase text-[9px]">${h.modo}</span></td>
            <td class="p-3 text-slate-500">${h.fecha} | ${h.inicioStr}-${h.finStr}</td>
            <td class="p-3 font-mono">${h.duracion}</td>
            <td class="p-3"><span class="${h.estado === 'Pagado' ? 'text-emerald-600':'text-red-500'} font-bold">${h.estado}</span></td>
            <td class="p-3 text-right font-black text-emerald-600">Bs ${h.importe}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ================= MODULO TIENDA & POS =================
let filtroCategoriaPOS = '';

function cambiarSubModuloTienda(sub) {
    tiendaSubModuloActivo = sub;
    const tabPOS = document.getElementById('tab-tienda-pos');
    const tabInv = document.getElementById('tab-tienda-inventario');
    const subPOS = document.getElementById('sub-tienda-pos');
    const subInv = document.getElementById('sub-tienda-inventario');

    if (sub === 'pos') {
        tabPOS.className = "flex-1 bg-slate-800 text-white font-extrabold py-2 px-4 rounded-xl text-xs uppercase tracking-wider shadow";
        tabInv.className = "flex-1 text-slate-500 hover:text-slate-800 font-extrabold py-2 px-4 rounded-xl text-xs uppercase tracking-wider transition";
        subPOS.classList.remove('hidden');
        subInv.classList.add('hidden');
        renderProductosPOS();
    } else {
        tabInv.className = "flex-1 bg-slate-800 text-white font-extrabold py-2 px-4 rounded-xl text-xs uppercase tracking-wider shadow";
        tabPOS.className = "flex-1 text-slate-500 hover:text-slate-800 font-extrabold py-2 px-4 rounded-xl text-xs uppercase tracking-wider transition";
        subInv.classList.remove('hidden');
        subPOS.classList.add('hidden');
        renderCategoriasTienda();
        renderProductosTienda();
    }
}

// INVENTARIO
function renderCategoriasTienda() {
    const select = document.getElementById('prodCategoria');
    if (select) {
        select.innerHTML = '<option value="">Selecciona Categoría</option>';
        tiendaCategorias.forEach(cat => {
            select.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }
}

function agregarCategoriaTienda() {
    const n = prompt("Nombre de la nueva categoría:");
    if (n && n.trim()) {
        const clean = n.trim();
        if (!tiendaCategorias.includes(clean)) {
            tiendaCategorias.push(clean);
            guardarTiendaCategorias();
            renderCategoriasTienda();
            renderProductosPOS();
        }
    }
}

function guardarProductoTienda(e) {
    e.preventDefault();
    const nombre = document.getElementById('prodNombre').value.trim();
    const categoria = document.getElementById('prodCategoria').value;
    const precio = parseFloat(document.getElementById('prodPrecio').value) || 0;
    const stock = parseInt(document.getElementById('prodStock').value) || 0;

    if (nombre && categoria) {
        const nuevo = {
            id: Date.now(),
            nombre,
            categoria,
            precio,
            stock
            // Se eliminó por completo la propiedad de la imagen
        };
        tiendaProductos.push(nuevo);
        guardarTiendaProductos();

        // Limpiar form
        document.getElementById('productForm').reset();

        renderProductosTienda();
        alert("Producto añadido exitosamente.");
    }
}

function renderProductosTienda() {
    const tbody = document.getElementById('tablaProductos');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    document.getElementById('contadorProductos').innerText = `${tiendaProductos.length} Producto(s)`;

    if (tiendaProductos.length === 0) {
        // Cambiado el colspan a 5 ya que eliminamos la columna de fotos
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-slate-400 italic">No hay productos en stock.</td></tr>`;
        return;
    }

    tiendaProductos.forEach(p => {
        const tr = document.createElement('tr');
        // Se removió la celda <td> con el tag <img>
        tr.innerHTML = `
            <td class="p-3"><b>${p.nombre}</b></td>
            <td class="p-3"><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold text-[10px] uppercase">${p.categoria}</span></td>
            <td class="p-3 text-center font-bold text-slate-700">${formatMoney(p.precio)}</td>
            <td class="p-3 text-center"><span class="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-black">${p.stock}</span></td>
            <td class="p-3 text-center"><button onclick="eliminarProductoInventario(${p.id})" class="text-red-500 hover:underline font-bold uppercase text-[10px]">Eliminar</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function eliminarProductoInventario(id) {
    if (confirm("¿Estás seguro de eliminar este producto?")) {
        tiendaProductos = tiendaProductos.filter(p => p.id !== id);
        guardarTiendaProductos();
        renderProductosTienda();
    }
}

// ================= FLUJO DE CAJA CONTABLE =================
function registrarEnFlujoCaja(tipo, categoria, concepto, monto) {
    const hoy = new Date();
    const item = {
        id: Date.now(),
        timestamp: hoy.toISOString(),
        fecha: obtenerFechaISO(hoy),
        tipo,        // 'Ingreso' / 'Egreso'
        categoria,   // 'Canchas' / 'Billar' / 'Tienda' / 'Manual'
        concepto,
        monto: parseFloat(monto).toFixed(2)
    };
    flujoCaja.push(item);
    guardarFlujoCaja();
}

function renderizarFlujoCaja() {
    const tbody = document.getElementById('tablaFlujo');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtroFecha = document.getElementById('flujo-filtro-fecha').value;

    // Filtrar movimientos
    const filtrados = flujoCaja.filter(f => !filtroFecha || f.fecha === filtroFecha);

    let ingresos = 0;
    let egresos = 0;

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-slate-400 italic">No hay movimientos financieros para este día.</td></tr>`;
        document.getElementById('flujo-total-ingresos').innerText = "Bs 0.00";
        document.getElementById('flujo-total-egresos').innerText = "Bs 0.00";
        document.getElementById('flujo-total-neto').innerText = "Bs 0.00";
        return;
    }

    filtrados.forEach(f => {
        const montoVal = parseFloat(f.monto);
        const esIngreso = f.tipo === 'Ingreso';
        if (esIngreso) ingresos += montoVal;
        else egresos += montoVal;

        // Formatear hora
        const hora = new Date(f.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 text-slate-500 font-mono">${f.fecha} | ${hora}</td>
            <td class="p-3"><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider">${f.categoria}</span></td>
            <td class="p-3 text-slate-700">${f.concepto}</td>
            <td class="p-3 text-right font-black ${esIngreso ? 'text-emerald-600':'text-red-500'}">${esIngreso ? '+':'-'} Bs ${montoVal.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });

    const neto = ingresos - egresos;
    document.getElementById('flujo-total-ingresos').innerText = formatMoney(ingresos);
    document.getElementById('flujo-total-egresos').innerText = formatMoney(egresos);
    document.getElementById('flujo-total-neto').innerText = formatMoney(neto);
    document.getElementById('flujo-total-neto').className = neto >= 0 ? "text-emerald-600 text-sm":"text-red-500 text-sm";
}

function guardarMovimientoFlujoManual() {
    const tipo = document.getElementById('flujo-tipo').value;
    const concepto = document.getElementById('flujo-concepto').value.trim() || 'Movimiento Manual';
    const importe = parseFloat(document.getElementById('flujo-importe').value) || 0;

    if (importe <= 0) {
        alert("Por favor ingresa un monto válido mayor a 0.");
        return;
    }

    registrarEnFlujoCaja(tipo, 'Manual', concepto, importe);
    
    // Limpiar
    document.getElementById('flujo-concepto').value = '';
    document.getElementById('flujo-importe').value = '';

    renderizarFlujoCaja();
    actualizarDashboardEstadisticas();
    alert("Operación manual registrada correctamente.");
}

function limpiarHistorialFlujo() {
    if (confirm("ATENCIÓN: Se borrarán todos los registros contables del Flujo de Caja. ¿Estás seguro?")) {
        // CAMBIADO: Ahora se inicializa vacío, sin el registro de 100.00 Bs.
        flujoCaja = []; 
        
        guardarFlujoCaja();
        renderizarFlujoCaja();
    }
}

function exportarExcelFlujo() {
    // Descarga simple en formato JSON formateado
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(flujoCaja, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href",     dataStr);
    downloadAnchor.setAttribute("download", `flujo_caja_wally_romo_${obtenerFechaISO(new Date())}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

// ================= WINDOW LOAD INITIALIZER =================
window.onload = function() {
    inicializarBaseDatos();
    cambiarModulo('inicio');
};
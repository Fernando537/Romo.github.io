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

// ================= CONFIGURACIÓN Y CONEXIÓN A SUPABASE =================
const SUPABASE_URL = "https://TU_PROYECTO.supabase.co"; // REEMPLAZA CON TU URL
const SUPABASE_ANON_KEY = "TU_ANON_KEY_DE_SUPABASE";   // REEMPLAZA CON TU KEY

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let canchasFechaActual = new Date();
let tiendaSubModuloActivo = 'pos';

// Data Store (Sincronizados dinámicamente desde Supabase)
let canchasReservas = [];
let billarHistorial = []; // Local por el momento
let tiendaCategorias = [];
let tiendaProductos = [];
let tiendaCarrito = [];
let flujoCaja = [];

// Inicialización de Datos asíncrona
async function inicializarBaseDatos() {
    console.log("Conectando y descargando datos desde Supabase...");
    
    // Descargamos toda la información en paralelo desde la nube
    await Promise.all([
        cargarCanchasDesdeNube(),
        cargarCategoriasDesdeNube(),
        cargarProductosDesdeNube(),
        cargarFlujoCajaDesdeNube()
    ]);

    // Renderizado inicial una vez obtenidos los datos reales
    renderizarPlanillaCanchas();
    renderCategoriasTienda();
    renderProductosTienda();
    renderProductosPOS();
    renderCategoriasFiltrosPOS();
    renderizarFlujoCaja();
    actualizarDashboardEstadisticas();
}

// ================= FUNCIONES DE CARGA (READ) DESDE SUPABASE =================

async function cargarCanchasDesdeNube() {
    let { data, error } = await supabase.from('canchas_reservas').select('*');
    if (error) console.error("Error cargando canchas:", error);
    else canchasReservas = data || [];
}

async function cargarCategoriasDesdeNube() {
    let { data, error } = await supabase.from('tienda_categorias').select('*');
    if (error) console.error("Error cargando categorías:", error);
    else tiendaCategorias = (data || []).map(c => c.nombre);
}

async function cargarProductosDesdeNube() {
    let { data, error } = await supabase.from('tienda_productos').select('*');
    if (error) console.error("Error cargando productos:", error);
    else tiendaProductos = data || [];
}

async function cargarFlujoCajaDesdeNube() {
    let { data, error } = await supabase.from('flujo_caja').select('*').order('id', { ascending: true });
    if (error) console.error("Error cargando flujo de caja:", error);
    else flujoCaja = data || [];
}

// ================= NAVEGACIÓN GENERAL =================
function cambiarModulo(moduloId) {
    document.querySelectorAll('.structural-modulo').forEach(m => m.classList.add('hidden'));
    const target = document.getElementById(`modulo-${moduloId}`);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.sidebar-btn').forEach(b => {
        b.classList.remove('bg-white/10', 'text-white', 'border-l-4', 'border-white');
        b.classList.add('text-white/70');
    });
    const activeBtn = document.getElementById(`btn-nav-${moduloId}`);
    if (activeBtn) {
        activeBtn.classList.remove('text-white/70');
        activeBtn.classList.add('bg-white/10', 'text-white', 'border-l-4', 'border-white');
    }

    const titles = {
        'inicio': ['🏠', 'Inicio / Resumen Diario'],
        'canchas': ['⚽', 'Planilla de Canchas (Wally)'],
        'billar': ['🎱', 'Mesas de Billar / Snack'],
        'tienda': ['🛒', 'Almacén, Tienda & POS'],
        'flujo': ['💸', 'Flujo de Caja / Contabilidad']
    };
    if (titles[moduloId]) {
        document.getElementById('header-icono').innerText = titles[moduloId][0];
        document.getElementById('titulo-modulo-activo').innerText = titles[moduloId][1];
    }
}

// ================= UTILS / HELPERS =================
function obtenerFechaISO(dateObj) {
    return dateObj.toISOString().split('T')[0];
}
function formatMoney(num) {
    return "Bs " + parseFloat(num).toFixed(2);
}

// ================= MODULO INICIO / DASHBOARD =================
function actualizarDashboardEstadisticas() {
    const hoyStr = obtenerFechaISO(new Date());

    // Ingresos de hoy en flujo de caja
    const ingresosHoy = flujoCaja
        .filter(item => item.fecha === hoyStr && item.tipo === 'Ingreso')
        .reduce((sum, item) => sum + item.monto, 0);

    // Egresos de hoy en flujo de caja
    const egresosHoy = flujoCaja
        .filter(item => item.fecha === hoyStr && item.tipo === 'Egreso')
        .reduce((sum, item) => sum + item.monto, 0);

    const cajaNetaHoy = ingresosHoy - egresosHoy;

    // Reservas de hoy
    const resHoy = canchasReservas.filter(r => r.fecha === hoyStr);
    const totalReservasHoy = resHoy.length;
    const ocupadasHoy = resHoy.filter(r => r.estado === 'Pagado' || r.estado === 'Pendiente').length;
    const porcenOcupacion = totalReservasHoy > 0 ? Math.round((ocupadasHoy / 16) * 100) : 0; // 16 horas operativas estimadas

    // Inyectar en DOM
    document.getElementById('dash-ingresos').innerText = formatMoney(ingresosHoy);
    document.getElementById('dash-egresos').innerText = formatMoney(egresosHoy);
    
    const cajaNetEl = document.getElementById('dash-cajaneta');
    cajaNetEl.innerText = formatMoney(cajaNetaHoy);
    if(cajaNetaHoy >= 0) {
        cajaNetEl.className = "text-xl md:text-2xl font-black text-emerald-600";
    } else {
        cajaNetEl.className = "text-xl md:text-2xl font-black text-red-500";
    }

    document.getElementById('dash-reservas-count').innerText = `${ocupadasHoy} Reservas`;
    document.getElementById('dash-ocupacion-porc').innerText = `${porcenOcupacion}% Ocupación`;
}

// ================= MODULO CANCHAS (WALLY) =================
const horasDia = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00"];
let reservaSeleccionadaId = null;

function cambiarFechaCanchas(offset) {
    canchasFechaActual.setDate(canchasFechaActual.getDate() + offset);
    renderizarPlanillaCanchas();
}

function establecerFechaHoyCanchas() {
    canchasFechaActual = new Date();
    renderizarPlanillaCanchas();
}

function renderizarPlanillaCanchas() {
    const fechaStr = obtenerFechaISO(canchasFechaActual);
    
    // Opciones de formato legibles en español
    const opcionesDia = { weekday: 'long', day: 'numeric', month: 'long' };
    let textoFecha = canchasFechaActual.toLocaleDateString('es-ES', opcionesDia);
    textoFecha = textoFecha.charAt(0).toUpperCase() + textoFecha.slice(1);
    
    document.getElementById('canchas-fecha-texto').innerText = textoFecha;

    const tbody = document.getElementById('body-tabla-canchas');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Filtrar reservas del día actual
    const reservasDia = canchasReservas.filter(r => r.fecha === fechaStr);

    horasDia.forEach(hora => {
        const finHora = calcularFinHora(hora);
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-100 hover:bg-slate-50/50 transition";

        // Celda Hora
        let htmlRow = `<td class="p-3 font-bold text-slate-400 text-center bg-slate-50/80 shrink-0 select-none">${hora} - ${finHora}</td>`;

        // Celda Cancha 1 y Cancha 2
        for (let c = 1; c <= 2; c++) {
            const res = reservasDia.find(r => r.cancha === c && r.inicio_str === hora);

            if (res) {
                let colorBg = "bg-amber-50 border-amber-200 hover:bg-amber-100/70 text-amber-800";
                let badge = `<span class="bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-extrabold text-[9px] uppercase tracking-wide">PENDIENTE (Sald. ${res.saldo})</span>`;
                
                if (res.estado === 'Pagado') {
                    colorBg = "bg-emerald-50 border-emerald-200 hover:bg-emerald-100/70 text-emerald-800";
                    badge = `<span class="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-extrabold text-[9px] uppercase tracking-wide">PAGADO COMPLETAMENTE</span>`;
                }

                htmlRow += `
                    <td class="p-2">
                        <div onclick="abrirComprobanteCanchas('${res.id}')" class="${colorBg} border p-2.5 rounded-xl cursor-pointer shadow-sm transition flex flex-col justify-between h-full min-h-[56px]">
                            <div class="flex justify-between items-start gap-1">
                                <span class="font-black text-xs uppercase tracking-wide truncate flex-1">${res.cliente}</span>
                                <span class="font-black text-xs shrink-0">${formatMoney(res.total)}</span>
                            </div>
                            <div class="flex justify-between items-center mt-1.5 gap-2">
                                <span class="text-[10px] text-slate-500 font-medium truncate">📞 ${res.telefono || 'Sin telf.'}</span>
                                ${badge}
                            </div>
                        </div>
                    </td>
                `;
            } else {
                htmlRow += `
                    <td class="p-2">
                        <div onclick="abrirModalNuevaReserva(${c}, '${hora}')" class="border border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 text-slate-300 hover:text-blue-500 rounded-xl p-3 text-center cursor-pointer font-bold text-xs uppercase tracking-widest transition celda-interactiva h-full min-h-[56px] flex items-center justify-center gap-1 select-none">
                            <span>+ Reservar</span>
                        </div>
                    </td>
                `;
            }
        }

        tr.innerHTML = htmlRow;
        tbody.appendChild(tr);
    });
}

function calcularFinHora(horaStr) {
    const parts = horaStr.split(':');
    let h = parseInt(parts[0]) + 1;
    return (h < 10 ? '0' + h : h) + ':' + parts[1];
}

// MODAL NUEVA / EDITAR RESERVA
function abrirModalNuevaReserva(cancha, hora) {
    document.getElementById('modal-canchas-titulo').innerText = "📝 Registrar Nueva Reserva";
    document.getElementById('form-reserva-id').value = '';
    document.getElementById('form-reserva-cancha').value = cancha;
    document.getElementById('form-reserva-fecha').value = obtenerFechaISO(canchasFechaActual);
    document.getElementById('form-reserva-inicio').value = hora;
    document.getElementById('form-reserva-fin').value = calcularFinHora(hora);
    
    document.getElementById('form-reserva-cliente').value = '';
    document.getElementById('form-reserva-telefono').value = '';
    document.getElementById('form-reserva-total').value = 60; // Precio por defecto
    document.getElementById('form-reserva-acuenta').value = 0;
    document.getElementById('form-reserva-saldo').value = 60;
    document.getElementById('form-reserva-nota').value = '';
    document.getElementById('form-reserva-estado').value = 'Pendiente';

    document.getElementById('btn-canchas-eliminar-modal').classList.add('hidden');
    document.getElementById('modal-canchas').classList.remove('hidden');
}

function calcularSaldoReserva() {
    const tot = parseFloat(document.getElementById('form-reserva-total').value) || 0;
    const acu = parseFloat(document.getElementById('form-reserva-acuenta').value) || 0;
    const sal = tot - acu;
    document.getElementById('form-reserva-saldo').value = sal >= 0 ? sal : 0;
    
    const estadoSel = document.getElementById('form-reserva-estado');
    if(sal <= 0) {
        estadoSel.value = 'Pagado';
    } else {
        estadoSel.value = 'Pendiente';
    }
}

function cerrarModalCanchas() {
    document.getElementById('modal-canchas').classList.add('hidden');
}

async function guardarReservaCancha(e) {
    e.preventDefault();
    const idReserva = document.getElementById('form-reserva-id').value;
    const canchaSel = document.getElementById('form-reserva-cancha').value;
    const fechaSel = document.getElementById('form-reserva-fecha').value;
    const inicioSel = document.getElementById('form-reserva-inicio').value;
    const finSel = document.getElementById('form-reserva-fin').value;
    
    const cliente = document.getElementById('form-reserva-cliente').value.trim();
    const telefono = document.getElementById('form-reserva-telefono').value.trim();
    const total = parseFloat(document.getElementById('form-reserva-total').value) || 0;
    const acuenta = parseFloat(document.getElementById('form-reserva-acuenta').value) || 0;
    const saldo = parseFloat(document.getElementById('form-reserva-saldo').value) || 0;
    const estado = document.getElementById('form-reserva-estado').value;
    const nota = document.getElementById('form-reserva-nota').value.trim();

    if(!cliente) { alert("Ingresa el nombre del cliente."); return; }

    const esEdicion = idReserva !== '';
    const finalId = esEdicion ? idReserva : Date.now().toString();

    const nuevaReserva = {
        id: finalId,
        cancha: parseInt(canchaSel),
        cliente,
        telefono,
        fecha: fechaSel,
        inicio_str: inicioSel,
        fin_str: finSel,
        total,
        acuenta,
        saldo,
        estado,
        nota
    };

    if (esEdicion) {
        // Actualizar en Supabase
        const { error } = await supabase.from('canchas_reservas').update(nuevaReserva).eq('id', finalId);
        if (error) { alert("Error al editar reserva en Supabase: " + error.message); return; }

        const idx = canchasReservas.findIndex(r => r.id === finalId);
        if (idx !== -1) canchasReservas[idx] = nuevaReserva;
    } else {
        // Insertar en Supabase
        const { error } = await supabase.from('canchas_reservas').insert([nuevaReserva]);
        if (error) { alert("Error al crear reserva en Supabase: " + error.message); return; }

        canchasReservas.push(nuevaReserva);

        // Si dejó dinero a cuenta, impacta automáticamente en Flujo de Caja
        if (acuenta > 0) {
            await registrarEnFlujoCaja('Ingreso', 'Canchas', `Seña Cancha ${canchaSel} - ${cliente}`, acuenta);
        }
    }

    cerrarModalCanchas();
    renderizarPlanillaCanchas();
    actualizarDashboardEstadisticas();
    playAlarmaSonido();
}

// COMPROBANTE / VISTA DETALLE RESERVA
function abrirComprobanteCanchas(id) {
    const res = canchasReservas.find(r => r.id === id);
    if(!res) return;
    reservaSeleccionadaId = id;

    document.getElementById('comp-fecha').innerText = res.fecha;
    document.getElementById('comp-horario').innerText = `${res.inicio_str} a ${res.fin_str}`;
    document.getElementById('comp-cancha').innerText = `CANCHA 0${res.cancha}`;
    document.getElementById('comp-cliente').innerText = res.cliente;
    document.getElementById('comp-telefono').innerText = res.telefono || 'Ninguno';
    document.getElementById('comp-nota').innerText = res.nota || 'Sin observaciones.';
    document.getElementById('comp-total').innerText = formatMoney(res.total);
    document.getElementById('comp-acuenta').innerText = formatMoney(res.acuenta);
    document.getElementById('comp-saldo').innerText = formatMoney(res.saldo);

    const btnEditar = document.getElementById('btn-comp-editar');
    btnEditar.onclick = function() {
        cerrarComprobanteCanchas();
        abrirModalEditarReserva(res.id);
    };

    document.getElementById('modal-comprobante-canchas').classList.remove('hidden');
}

function cerrarComprobanteCanchas() {
    document.getElementById('modal-comprobante-canchas').classList.add('hidden');
    reservaSeleccionadaId = null;
}

function abrirModalEditarReserva(id) {
    const res = canchasReservas.find(r => r.id === id);
    if(!res) return;

    document.getElementById('modal-canchas-titulo').innerText = "✏️ Editar / Liquidar Reserva";
    document.getElementById('form-reserva-id').value = res.id;
    document.getElementById('form-reserva-cancha').value = res.cancha;
    document.getElementById('form-reserva-fecha').value = res.fecha;
    document.getElementById('form-reserva-inicio').value = res.inicio_str;
    document.getElementById('form-reserva-fin').value = res.fin_str;
    
    document.getElementById('form-reserva-cliente').value = res.cliente;
    document.getElementById('form-reserva-telefono').value = res.telefono;
    document.getElementById('form-reserva-total').value = res.total;
    document.getElementById('form-reserva-acuenta').value = res.acuenta;
    document.getElementById('form-reserva-saldo').value = res.saldo;
    document.getElementById('form-reserva-nota').value = res.nota;
    document.getElementById('form-reserva-estado').value = res.estado;

    document.getElementById('btn-canchas-eliminar-modal').classList.remove('hidden');
    document.getElementById('modal-canchas').classList.remove('hidden');
}

async function liberarCanchaCompleta() {
    const targetId = reservaSeleccionadaId || document.getElementById('form-reserva-id').value;
    if (!targetId) return;

    if (confirm("¿Estás seguro de que deseas eliminar permanentemente esta reserva de la nube?")) {
        const { error } = await supabase.from('canchas_reservas').delete().eq('id', targetId);
        if (error) { alert("No se pudo eliminar la reserva en Supabase: " + error.message); return; }

        canchasReservas = canchasReservas.filter(r => r.id !== targetId);
        cerrarComprobanteCanchas();
        cerrarModalCanchas();
        renderizarPlanillaCanchas();
        actualizarDashboardEstadisticas();
        alert("Reserva eliminada de la nube.");
    }
}

// ================= MODULO BILLAR & SNACK (LOCAL POR EL MOMENTO) =================
const mesasBillarConfig = [
    { num: 1, tipo: 'Pool' },
    { num: 2, tipo: 'Pool' },
    { num: 3, tipo: 'Carambola' }
];
let mesasEstado = {}; 
mesasBillarConfig.forEach(m => {
    mesasEstado[m.num] = { activa: false, cliente: '', inicio: null, intervalo: null };
});

function toggleMesaBillar(num) {
    const estado = mesasEstado[num];
    if (!estado.activa) {
        const cl = prompt("Nombre del Cliente para Mesa " + num + ":");
        if(cl && cl.trim()) {
            estado.activa = true;
            estado.cliente = cl.trim();
            estado.inicio = new Date();
            
            document.getElementById(`billar-card-${num}`).className = "bg-red-50 border border-red-200 rounded-3xl p-5 shadow-sm space-y-4 relative overflow-hidden";
            document.getElementById(`billar-status-${num}`).className = "bg-red-200 text-red-900 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider pulso-tiempo";
            document.getElementById(`billar-status-${num}`).innerText = "🔴 En Juego";
            document.getElementById(`billar-cliente-${num}`).innerText = estado.cliente;
            document.getElementById(`billar-btn-${num}`).innerText = "🛑 Detener e Imprimir Caja";
            document.getElementById(`billar-btn-${num}`).className = "w-full bg-red-600 hover:bg-red-700 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow";
            
            estado.intervalo = setInterval(() => {
                const trans = calcularTiempoDineroBillar(estado.inicio);
                document.getElementById(`billar-tiempo-${num}`).innerText = trans.tiempoStr;
                document.getElementById(`billar-monto-${num}`).innerText = formatMoney(trans.costo);
            }, 1000);
        }
    } else {
        if(confirm(`¿Finalizar el juego de la mesa ${num} para ${estado.cliente}?`)) {
            clearInterval(estado.intervalo);
            const trans = calcularTiempoDineroBillar(estado.inicio);
            
            registrarEnFlujoCaja('Ingreso', 'Billar', `Mesa ${num} (${mesasBillarConfig.find(m=>m.num===num).tipo}) - ${estado.cliente} (${trans.tiempoStr})`, trans.costo);

            estado.activa = false;
            estado.cliente = '';
            estado.inicio = null;
            estado.intervalo = null;

            document.getElementById(`billar-card-${num}`).className = "bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 relative overflow-hidden";
            document.getElementById(`billar-status-${num}`).className = "bg-emerald-100 text-emerald-800 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider";
            document.getElementById(`billar-status-${num}`).innerText = "🟢 Disponible";
            document.getElementById(`billar-cliente-${num}`).innerText = "Ninguno";
            document.getElementById(`billar-tiempo-${num}`).innerText = "00:00:00";
            document.getElementById(`billar-monto-${num}`).innerText = "Bs 0.00";
            document.getElementById(`billar-btn-${num}`).innerText = "🎯 Iniciar Mesa";
            document.getElementById(`billar-btn-${num}`).className = "w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow";
            
            alert(`Juego Terminado.\nTiempo: ${trans.tiempoStr}\nTotal cobrado: ${formatMoney(trans.costo)}`);
        }
    }
}

function calcularTiempoDineroBillar(inicioDate) {
    const diffMs = new Date() - inicioDate;
    const diffSecs = Math.floor(diffMs / 1000);
    const hrs = Math.floor(diffSecs / 3600);
    const mins = Math.floor((diffSecs % 3600) / 60);
    const secs = diffSecs % 60;

    const tiempoStr = `${hrs<10?'0'+hrs:hrs}:${mins<10?'0'+mins:mins}:${secs<10?'0'+secs:secs}`;
    const precioPorHora = 15.00; 
    let costo = (diffSecs / 3600) * precioPorHora;
    if (costo < 1.00 && diffSecs > 5) costo = 1.00; // Mínimo cobro
    
    return { tiempoStr, costo: parseFloat(costo.toFixed(2)) };
}

// ================= MODULO TIENDA & POS =================

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

// INVENTARIO / STOCK
function renderCategoriasTienda() {
    const select = document.getElementById('prodCategoria');
    if (select) {
        select.innerHTML = '<option value="">Selecciona Categoría</option>';
        tiendaCategorias.forEach(cat => {
            select.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }
}

async function agregarCategoriaTienda() {
    const n = prompt("Nombre de la nueva categoría:");
    if (n && n.trim()) {
        const clean = n.trim();
        if (!tiendaCategorias.includes(clean)) {
            // Guardar en Supabase
            const { error } = await supabase.from('tienda_categorias').insert([{ nombre: clean }]);
            if (error) { alert("Error al guardar categoría en la nube: " + error.message); return; }

            tiendaCategorias.push(clean);
            renderCategoriasTienda();
            renderCategoriasFiltrosPOS();
            renderProductosPOS();
        }
    }
}

async function guardarProductoTienda(e) {
    e.preventDefault();
    const nombre = document.getElementById('prodNombre').value.trim();
    const categoria = document.getElementById('prodCategoria').value;
    const precio = parseFloat(document.getElementById('prodPrecio').value) || 0;
    const stock = parseInt(document.getElementById('prodStock').value) || 0;

    if (nombre && categoria) {
        const finalId = Date.now(); // Usamos ID numérico único
        const nuevo = {
            id: finalId,
            nombre,
            categoria,
            precio,
            stock
        };

        // Guardar en la tabla de Supabase
        const { error } = await supabase.from('tienda_productos').insert([nuevo]);
        if (error) { alert("Error al añadir producto a la nube: " + error.message); return; }

        tiendaProductos.push(nuevo);
        document.getElementById('productForm').reset();
        renderProductosTienda();
        alert("Producto añadido exitosamente a la base de datos.");
    }
}

function renderProductosTienda() {
    const tbody = document.getElementById('tablaProductos');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    document.getElementById('contadorProductos').innerText = `${tiendaProductos.length} Producto(s)`;

    if (tiendaProductos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-slate-400 italic">No hay productos en stock.</td></tr>`;
        return;
    }

    tiendaProductos.forEach(p => {
        const tr = document.createElement('tr');
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

async function eliminarProductoInventario(id) {
    if (confirm("¿Estás seguro de eliminar este producto de la nube?")) {
        const { error } = await supabase.from('tienda_productos').delete().eq('id', id);
        if (error) { alert("No se pudo eliminar el producto de Supabase: " + error.message); return; }

        tiendaProductos = tiendaProductos.filter(p => p.id !== id);
        renderProductosTienda();
    }
}

// CAJA / VENTAS POS
function renderCategoriasFiltrosPOS() {
    const container = document.getElementById('categorias-filtro-pos');
    if(!container) return;
    
    let html = `<button onclick="filtrarCategoriaPOS_Click('')" class="px-3 py-1.5 rounded-xl text-[10px] uppercase font-black tracking-wider transition ${filtroCategoriaPOS===''?'bg-blue-600 text-white':'bg-slate-100 text-slate-500 hover:bg-slate-200'}">Todos</button>`;
    
    tiendaCategorias.forEach(cat => {
        html += `<button onclick="filtrarCategoriaPOS_Click('${cat}')" class="px-3 py-1.5 rounded-xl text-[10px] uppercase font-black tracking-wider transition shrink-0 ${filtroCategoriaPOS===cat?'bg-blue-600 text-white':'bg-slate-100 text-slate-500 hover:bg-slate-200'}">${cat}</button>`;
    });
    container.innerHTML = html;
}

function filtrarCategoriaPOS_Click(cat) {
    filtroCategoriaPOS = cat;
    renderCategoriasFiltrosPOS();
    renderProductosPOS();
}

function filtrarProductosPOS() {
    renderProductosPOS();
}

function renderProductosPOS() {
    const grid = document.getElementById('grid-productos-pos');
    if(!grid) return;
    grid.innerHTML = '';

    const buscador = document.getElementById('buscador-pos').value.toLowerCase().trim();

    let listado = tiendaProductos;
    if(filtroCategoriaPOS !== '') {
        listado = listado.filter(p => p.categoria === filtroCategoriaPOS);
    }
    if(buscador !== '') {
        listado = listado.filter(p => p.nombre.toLowerCase().includes(buscador));
    }

    if(listado.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center p-8 text-slate-400 italic">Ningún producto coincide con el filtro.</div>`;
        return;
    }

    listado.forEach(p => {
        const sinStock = p.stock <= 0;
        const card = document.createElement('div');
        card.className = `bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex flex-col justify-between transition relative ${sinStock?'opacity-60 select-none': 'hover:shadow-md cursor-pointer'}`;
        if(!sinStock) {
            card.onclick = () => agregarAlCarritoPOS(p.id);
        }

        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start gap-1">
                    <h5 class="font-extrabold text-xs text-slate-800 uppercase tracking-wide line-clamp-2">${p.nombre}</h5>
                </div>
                <span class="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase mt-1 inline-block">${p.categoria}</span>
            </div>
            <div class="flex justify-between items-center mt-3 border-t border-slate-50 pt-2">
                <span class="text-blue-600 font-black text-xs">${formatMoney(p.precio)}</span>
                <span class="text-[10px] font-extrabold ${p.stock<=2?'text-red-500':'text-slate-400'}">Stock: ${p.stock}</span>
            </div>
            ${sinStock?'<div class="absolute inset-0 bg-white/40 flex items-center justify-center rounded-2xl"><span class="bg-red-500 text-white font-black text-[9px] px-2 py-0.5 rounded uppercase tracking-wider">Agotado</span></div>':''}
        `;
        grid.appendChild(card);
    });
}

// CARRITO COMPRAS
function agregarAlCarritoPOS(id) {
    const prod = tiendaProductos.find(p => p.id === id);
    if(!prod || prod.stock <= 0) return;

    const exist = tiendaCarrito.find(item => item.id === id);
    if(exist) {
        if(exist.cantidad < prod.stock) {
            exist.cantidad++;
        } else {
            alert("No puedes agregar más unidades que el stock disponible en almacén.");
            return;
        }
    } else {
        tiendaCarrito.push({ id: prod.id, nombre: prod.nombre, precio: prod.precio, cantidad: 1 });
    }
    renderCarritoPOS();
}

function cambiarCantidadCarrito(id, delta) {
    const item = tiendaCarrito.find(i => i.id === id);
    const prod = tiendaProductos.find(p => p.id === id);
    if(!item || !prod) return;

    item.cantidad += delta;
    if(item.cantidad <= 0) {
        tiendaCarrito = tiendaCarrito.filter(i => i.id !== id);
    } else if(item.cantidad > prod.stock) {
        alert("Límite de stock alcanzado.");
        item.cantidad = prod.stock;
    }
    renderCarritoPOS();
}

function vaciarCarrito() {
    tiendaCarrito = [];
    renderCarritoPOS();
}

function renderCarritoPOS() {
    const container = document.getElementById('carrito-items');
    if(!container) return;
    container.innerHTML = '';

    let total = 0;

    if(tiendaCarrito.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 italic text-[11px] py-16">El carrito está vacío. Selecciona productos a la izquierda.</div>`;
        document.getElementById('carrito-total').innerText = "Bs 0.00";
        return;
    }

    tiendaCarrito.forEach(item => {
        const sub = item.precio * item.cantidad;
        total += sub;

        const div = document.createElement('div');
        div.className = "bg-slate-50 border rounded-xl p-2.5 flex items-center justify-between text-xs font-semibold text-slate-700";
        div.innerHTML = `
            <div class="flex-1 min-w-0 pr-2">
                <p class="font-extrabold truncate text-slate-800 uppercase text-[11px]">${item.nombre}</p>
                <p class="text-blue-600 font-bold text-[10px] mt-0.5">${formatMoney(item.precio)} c/u</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <div class="flex items-center border bg-white rounded-lg overflow-hidden font-black">
                    <button onclick="cambiarCantidadCarrito(${item.id}, -1)" class="px-2 py-0.5 hover:bg-slate-100 text-slate-400 text-[11px]">-</button>
                    <span class="px-2 text-slate-800 text-[10px]">${item.cantidad}</span>
                    <button onclick="cambiarCantidadCarrito(${item.id}, 1)" class="px-2 py-0.5 hover:bg-slate-100 text-slate-400 text-[11px]">+</button>
                </div>
                <span class="font-black text-slate-800 text-[11px] w-14 text-right">${formatMoney(sub)}</span>
            </div>
        `;
        container.appendChild(div);
    });

    document.getElementById('carrito-total').innerText = formatMoney(total);
}

async function procesarVentaPOS() {
    if(tiendaCarrito.length === 0) return;

    const totalVenta = tiendaCarrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);

    if(confirm(`¿Confirmar cobro de venta rápida por ${formatMoney(totalVenta)}?`)) {
        
        // 1. Actualizar el stock de los productos uno a uno en Supabase
        for (const item of tiendaCarrito) {
            const p = tiendaProductos.find(prod => prod.id === item.id);
            if (p) {
                p.stock -= item.cantidad;
                // Update directo en Supabase
                const { error } = await supabase.from('tienda_productos').update({ stock: p.stock }).eq('id', p.id);
                if (error) console.error(`Error actualizando stock de ${p.nombre}:`, error);
            }
        }

        // 2. Insertar el ingreso monetario en Flujo de Caja en la nube
        const conceptos = tiendaCarrito.map(i => `${i.cantidad}x ${i.nombre}`).join(', ');
        await registrarEnFlujoCaja('Ingreso', 'Tienda', `Venta POS: ${conceptos}`, totalVenta);

        // Limpiar estado local
        vaciarCarrito();
        renderProductosPOS();
        renderProductosTienda();
        alert("Venta procesada, stock rebajado e ingresos guardados en Supabase.");
        playAlarmaSonido();
    }
}

// ================= MODULO FLUJO DE CAJA / CONTABILIDAD =================

function renderizarFlujoCaja() {
    const tbody = document.getElementById('body-tabla-flujo');
    if(!tbody) return;
    tbody.innerHTML = '';

    if(flujoCaja.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-slate-400 italic">No existen registros en el libro contable.</td></tr>`;
        return;
    }

    // Clonamos y damos vuelta el array para ver lo más nuevo arriba
    const invertido = [...flujoCaja].reverse();

    invertido.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-100 hover:bg-slate-50/40 font-semibold text-slate-700 text-xs";
        
        const badgeTipo = item.tipo === 'Ingreso' 
            ? `<span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider">🟢 Ingreso</span>`
            : `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider">🔴 Egreso</span>`;

        const badgeCat = `<span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold text-[9px] uppercase">${item.categoria}</span>`;

        tr.innerHTML = `
            <td class="p-3 text-slate-400 font-normal">${new Date(item.timestamp || item.id).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
            <td class="p-3 text-slate-500 font-normal">${item.fecha}</td>
            <td class="p-3 text-center">${badgeTipo}</td>
            <td class="p-3">${badgeCat}</td>
            <td class="p-3 text-slate-600 max-w-xs truncate"><b>${item.concepto}</b></td>
            <td class="p-3 text-right font-black ${item.tipo==='Ingreso'?'text-emerald-600':'text-red-500'}">${formatMoney(item.monto)}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function registrarEnFlujoCaja(tipo, categoria, concepto, monto) {
    const hoy = new Date();
    const nuevoItem = {
        id: Date.now(),
        timestamp: hoy.toISOString(),
        fecha: obtenerFechaISO(hoy),
        tipo,        
        categoria,   
        concepto,
        monto: parseFloat(monto)
    };

    // Subida directa a Supabase
    const { error } = await supabase.from('flujo_caja').insert([nuevoItem]);
    if (error) {
        alert("Error crítico al sincronizar flujo de caja en Supabase: " + error.message);
        return;
    }

    flujoCaja.push(nuevoItem);
    renderizarFlujoCaja();
    actualizarDashboardEstadisticas();
}

function agregarMovimientoManualFlujo(tipo) {
    const concepto = document.getElementById('flujo-concepto').value.trim();
    const importe = parseFloat(document.getElementById('flujo-importe').value) || 0;

    if(!concepto) { alert("Ingresa un concepto descriptivo."); return; }
    if(importe <= 0) { alert("Ingresa un monto válido mayor a 0."); return; }

    registrarEnFlujoCaja(tipo, 'Manual', concepto, importe);
    
    // Limpiar campos
    document.getElementById('flujo-concepto').value = '';
    document.getElementById('flujo-importe').value = '';

    alert("Operación manual registrada correctamente en Supabase.");
}

async function limpiarHistorialFlujo() {
    if (confirm("ATENCIÓN: Se borrarán todos los registros contables en la nube de forma permanente. ¿Estás seguro?")) {
        // Borrar todo de la tabla
        const { error } = await supabase.from('flujo_caja').delete().gt('id', 0);
        if (error) { alert("No se pudo limpiar la tabla en la nube: " + error.message); return; }

        flujoCaja = [];
        renderizarFlujoCaja();
        actualizarDashboardEstadisticas();
        alert("Libro contable reiniciado con éxito.");
    }
}

function exportarExcelFlujo() {
    const dataStr = "data:text/json;charset=utf-8格式," + encodeURIComponent(JSON.stringify(flujoCaja, null, 2));
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

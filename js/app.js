import { createClient } from '@insforge/sdk'

const insforge = createClient({
  baseUrl: 'https://z78hcdj9.us-west.insforge.app',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NzY4MTR9.Q_vWTTKyqF2Kkdw1EZ_cWLnfPdwKqx8HmhsXWS-NAvA'
})

let loadAttempts = 0
const MAX_LOAD_ATTEMPTS = 3

const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
function playAlarmaSonido() {
  try {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, audioCtx.currentTime)
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.4)
  } catch (e) { console.log('Audio bloqueado') }
}

let canchasFechaActual = new Date()
let tiendaSubModuloActivo = 'pos'

let canchasReservas = []
let billarHistorial = []
let tiendaCategorias = []
let tiendaProductos = []
let tiendaCarrito = []
let flujoCaja = []

// ================= INSFORGE INIT =================
async function cargarDesdeInsForge() {
  try {
    const [resCanchas, resBillar, resCategorias, resProductos, resFlujo] = await Promise.all([
      insforge.database.from('reservas_canchas').select('*').order('fecha', { ascending: false }),
      insforge.database.from('historial_billar').select('*').order('created_at', { ascending: false }),
      insforge.database.from('categorias_tienda').select('*').order('id'),
      insforge.database.from('productos_tienda').select('*').order('id'),
      insforge.database.from('flujo_caja').select('*').order('fecha_hora', { ascending: false })
    ])
    if (resCanchas.data) canchasReservas = resCanchas.data
    if (resBillar.data) billarHistorial = resBillar.data
    if (resCategorias.data) tiendaCategorias = resCategorias.data
    if (resProductos.data) tiendaProductos = resProductos.data
    if (resFlujo.data) flujoCaja = resFlujo.data
  } catch (e) {
    console.error('Error cargando datos de InsForge:', e)
  }
}

async function conectarRealtime() {
  try {
    await insforge.realtime.connect()
    console.log('Realtime conectado')
    estadoConexion(true)
  } catch (e) {
    console.error('Error conectando realtime:', e)
    estadoConexion(false)
    return
  }

  for (const ch of ['canchas', 'billar', 'tienda', 'flujo']) {
    const res = await insforge.realtime.subscribe(ch)
    if (!res.ok) console.warn('No se pudo suscribir a', ch, res.error)
  }

  insforge.realtime.on('canchas_changed', (msg) => manejarEventoRealtime('canchas', msg))
  insforge.realtime.on('billar_changed', (msg) => manejarEventoRealtime('billar', msg))
  insforge.realtime.on('productos_changed', (msg) => manejarEventoRealtime('productos', msg))
  insforge.realtime.on('categorias_changed', (msg) => manejarEventoRealtime('categorias', msg))
  insforge.realtime.on('flujo_changed', (msg) => manejarEventoRealtime('flujo', msg))

  insforge.realtime.on('connect', () => { estadoConexion(true) })
  insforge.realtime.on('disconnect', () => { estadoConexion(false) })

  // Presencia de colaboradores
  await insforge.realtime.subscribe('presencia')
  insforge.realtime.on('presence:join', ({ member }) => {
    agregarColaborador(member.presenceId)
  })
  insforge.realtime.on('presence:leave', ({ member }) => {
    quitarColaborador(member.presenceId)
  })
}

function manejarEventoRealtime(origen, msg) {
  const { event, data } = msg
  if (!data) return
  switch (origen) {
    case 'canchas':
      if (event === 'INSERT') canchasReservas.unshift(data)
      else if (event === 'UPDATE') {
        const idx = canchasReservas.findIndex(r => r.id === data.id)
        if (idx >= 0) canchasReservas[idx] = data
      } else if (event === 'DELETE') {
        canchasReservas = canchasReservas.filter(r => r.id !== data.id)
      }
      break
    case 'billar':
      if (event === 'INSERT') billarHistorial.unshift(data)
      break
    case 'productos':
      if (event === 'INSERT') tiendaProductos.push(data)
      else if (event === 'UPDATE') {
        const idx = tiendaProductos.findIndex(p => p.id === data.id)
        if (idx >= 0) tiendaProductos[idx] = data
      } else if (event === 'DELETE') {
        tiendaProductos = tiendaProductos.filter(p => p.id !== data.id)
      }
      break
    case 'categorias':
      if (event === 'INSERT') tiendaCategorias.push(data)
      break
    case 'flujo':
      if (event === 'INSERT') flujoCaja.unshift(data)
      break
  }
  if (document.getElementById('modulo-inicio') && !document.getElementById('modulo-inicio').classList.contains('hidden')) {
    actualizarDashboardEstadisticas()
  }
}

function estadoConexion(conectado) {
  const badge = document.getElementById('realtime-badge')
  if (badge) {
    badge.textContent = conectado ? '🟢 En Vivo' : '🔴 Desconectado'
    badge.className = conectado
      ? 'text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700'
      : 'text-[10px] font-bold px-2 py-1 rounded-lg bg-red-100 text-red-700'
  }
}

function agregarColaborador(id) {
  const cont = document.getElementById('colaboradores-lista')
  if (!cont) return
  if (document.getElementById(`colab-${id}`)) return
  const el = document.createElement('span')
  el.id = `colab-${id}`
  el.className = 'text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold'
  el.textContent = '👤 Colaborador'
  cont.appendChild(el)
}

function quitarColaborador(id) {
  const el = document.getElementById(`colab-${id}`)
  if (el) el.remove()
}

// ================= INICIALIZACIÓN =================
async function inicializarApp() {
  await cargarDesdeInsForge()
  conectarRealtime()
  cambiarModulo('inicio')
}

function obtenerFechaISO(dateObj) {
  let m = dateObj.getMonth() + 1
  let d = dateObj.getDate()
  return `${dateObj.getFullYear()}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`
}
function formatMoney(amount) {
  return `Bs ${parseFloat(amount).toFixed(2)}`
}

// ================= NAVEGACIÓN =================
function cambiarModulo(idModulo) {
  document.querySelectorAll('.structural-modulo').forEach(mod => mod.classList.add('hidden'))
  document.getElementById(`modulo-${idModulo}`).classList.remove('hidden')
  const config = {
    inicio: { icono: '🏠', titulo: 'Inicio / Resumen Diario' },
    canchas: { icono: '🏐', titulo: 'Gestión de Canchas Wally' },
    billar: { icono: '🎱', titulo: 'Control de Mesas de Billar' },
    tienda: { icono: '🏪', titulo: 'Tienda & POS / Snack Bar' },
    flujo: { icono: '📊', titulo: 'Libro de Caja y Finanzas' }
  }
  document.getElementById('header-icono').innerText = config[idModulo].icono
  document.getElementById('titulo-modulo-activo').innerText = config[idModulo].titulo
  document.querySelectorAll('aside nav button').forEach(btn => {
    btn.className = 'w-full flex items-center gap-3 text-slate-400 hover:text-slate-200 hover:bg-[#1a222c] px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left'
  })
  const activeBtn = document.getElementById(`btn-nav-${idModulo}`)
  if (activeBtn) {
    activeBtn.className = 'w-full flex items-center gap-3 bg-[#1e2732] border-l-4 border-cyan-500 text-cyan-400 px-3 py-2.5 rounded-r-xl font-bold text-xs transition-all text-left'
  }
  if (window.innerWidth < 768) {
    document.getElementById('sidebar').classList.add('hidden')
  }
  if (idModulo === 'inicio') actualizarDashboardEstadisticas()
  else if (idModulo === 'canchas') renderizarAgendaCanchas()
  else if (idModulo === 'billar') renderizarBillarMonitor()
  else if (idModulo === 'tienda') { renderCategoriasTienda(); renderProductosTienda(); renderProductosPOS() }
  else if (idModulo === 'flujo') {
    document.getElementById('flujo-filtro-fecha').value = obtenerFechaISO(new Date())
    renderizarFlujoCaja()
  }
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar')
  if (sb) sb.classList.toggle('hidden')
}

// ================= DASHBOARD =================
function actualizarDashboardEstadisticas() {
  const hoyISO = obtenerFechaISO(new Date())
  const transaccionesHoy = flujoCaja.filter(f => {
    if (f.fecha) return f.fecha === hoyISO
    if (f.fecha_hora) return f.fecha_hora.slice(0, 10) === hoyISO
    return false
  })
  let ingresosHoy = 0, egresosHoy = 0
  transaccionesHoy.forEach(t => {
    if (t.tipo === 'Ingreso') ingresosHoy += parseFloat(t.importe || t.monto || 0)
    else egresosHoy += parseFloat(t.importe || t.monto || 0)
  })
  const balanceHoy = ingresosHoy - egresosHoy
  document.getElementById('stat-caja').innerText = formatMoney(balanceHoy)
  document.getElementById('stat-caja').className = balanceHoy >= 0 ? 'text-xl font-black text-emerald-600' : 'text-xl font-black text-red-650'
  const turnosHoy = canchasReservas.filter(r => r.fecha === hoyISO).length
  document.getElementById('stat-canchas').innerText = `${turnosHoy} Turno${turnosHoy !== 1 ? 's' : ''}`
  let activeBilliards = 0
  for (let i = 1; i <= 2; i++) {
    if (activeMesasBillar[i] && activeMesasBillar[i].activo) activeBilliards++
  }
  document.getElementById('stat-billar').innerText = `${activeBilliards} Activa${activeBilliards !== 1 ? 's' : ''}`
  let saldosHoy = 0
  canchasReservas.filter(r => r.fecha === hoyISO).forEach(r => {
    saldosHoy += parseFloat(r.saldo || 0)
  })
  document.getElementById('stat-saldos').innerText = formatMoney(saldosHoy)
}

// ================= CANCHAS =================
const ALTURA_FILA = 65
let cReservaSeleccionada = null

function renderizarAgendaCanchas() {
  const contenedor = document.getElementById('contenedor-horas-canchas')
  if (!contenedor) return
  contenedor.innerHTML = ''
  const fechaFiltroISO = obtenerFechaISO(canchasFechaActual)
  const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  document.getElementById('fecha-display').innerText = canchasFechaActual.toLocaleDateString('es-ES', opciones)
  document.getElementById('canchas-date-picker').value = fechaFiltroISO
  for (let hora = 8; hora <= 23; hora++) {
    const fila = document.createElement('div')
    fila.className = 'grid grid-cols-[70px_1fr_1fr_1fr] min-h-[65px] border-b border-slate-200/80 relative'
    const colHora = document.createElement('div')
    colHora.className = 'text-[11px] text-slate-400 font-extrabold p-3.5 text-right border-r border-slate-200 bg-white font-mono'
    colHora.innerText = `${hora < 10 ? '0' + hora : hora}:00`
    fila.appendChild(colHora)
    for (let canchaId = 2; canchaId <= 4; canchaId++) {
      const celda = document.createElement('div')
      celda.className = 'border-r border-slate-200/40 celda-interactiva cursor-pointer transition-all duration-100'
      celda.onclick = () => {
        abrirModalReservaCanchas(canchaId, `${hora < 10 ? '0' + hora : hora}:00`, `${(hora + 1) < 10 ? '0' + (hora + 1) : (hora + 1)}:00`)
      }
      fila.appendChild(celda)
    }
    contenedor.appendChild(fila)
  }
  const reservasDia = canchasReservas.filter(r => r.fecha === fechaFiltroISO)
  reservasDia.forEach(res => {
    const pIn = (res.hora_inicio || res.inicioStr || '00:00').split(':')
    const pFi = (res.hora_fin || res.finStr || '00:00').split(':')
    const horaIn = parseInt(pIn[0]) + (parseInt(pIn[1]) / 60)
    const horaFi = parseInt(pFi[0]) + (parseInt(pFi[1]) / 60)
    const topBloque = (horaIn - 8) * ALTURA_FILA
    const alturaBloque = (horaFi - horaIn) * ALTURA_FILA
    let leftOffset = '70px'
    let anchoColumna = '30.8%'
    if (res.cancha === 3) leftOffset = 'calc(70px + 31.1%)'
    if (res.cancha === 4) leftOffset = 'calc(70px + 62.2%)'
    const colorClase = obtenerColorTurno(res.total, res.a_cuenta || res.acuenta)
    const bloque = document.createElement('div')
    bloque.className = `absolute ${colorClase} p-2 rounded-2xl border z-10 shadow-md overflow-hidden flex flex-col justify-center cursor-pointer text-center font-bold tracking-wide text-[11px] transition-all duration-150 transform hover:scale-[1.01] hover:shadow-lg`
    bloque.style.top = `${topBloque}px`
    bloque.style.left = leftOffset
    bloque.style.width = anchoColumna
    bloque.style.height = `${alturaBloque}px`
    bloque.innerHTML = `
      <p class="truncate uppercase text-[11px] leading-tight">${res.cliente}</p>
      <p class="text-[9px] opacity-90 font-medium bg-black/10 rounded-lg px-1.5 mt-1 inline-block mx-auto uppercase">${res.juego}</p>
    `
    bloque.onclick = (e) => {
      e.stopPropagation()
      abrirComprobanteCanchas(res)
    }
    contenedor.appendChild(bloque)
  })
  renderizarLineaTiempoCanchas()
  renderizarListaCanchasDia()
}

function obtenerColorTurno(totalStr, acuentaStr) {
  const total = parseFloat(totalStr) || 0
  const acuenta = parseFloat(acuentaStr) || 0
  const saldo = total - acuenta
  if (saldo <= 0 && total > 0) return 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700'
  else if (acuenta > 0 && saldo > 0) return 'bg-blue-600 border-blue-700 text-white hover:bg-blue-700'
  else return 'bg-amber-500 border-amber-600 text-slate-900 hover:bg-amber-600'
}

function renderizarLineaTiempoCanchas() {
  const contenedor = document.getElementById('contenedor-horas-canchas')
  if (!contenedor) return
  const viejaLinea = document.getElementById('linea-tiempo-canchas')
  if (viejaLinea) viejaLinea.remove()
  const hoy = new Date()
  if (obtenerFechaISO(canchasFechaActual) !== obtenerFechaISO(hoy)) return
  const h = hoy.getHours()
  const m = hoy.getMinutes()
  if (h >= 8 && h <= 23) {
    const topPixel = (h - 8 + (m / 60)) * ALTURA_FILA
    const linea = document.createElement('div')
    linea.id = 'linea-tiempo-canchas'
    linea.className = 'absolute left-0 right-0 z-20 pointer-events-none flex items-center'
    linea.style.top = `${topPixel}px`
    linea.innerHTML = `
      <div class="w-3.5 h-3.5 bg-red-600 rounded-full absolute left-[63px] -translate-x-1/2 shadow pulso-tiempo"></div>
      <div class="w-full h-[2px] bg-red-500/80 ml-[68px]"></div>
    `
    contenedor.appendChild(linea)
  }
}

function renderizarListaCanchasDia() {
  const lista = document.getElementById('lista-registros-canchas')
  if (!lista) return
  lista.innerHTML = ''
  const fechaFiltroISO = obtenerFechaISO(canchasFechaActual)
  const reservasDia = canchasReservas.filter(r => r.fecha === fechaFiltroISO)
  if (reservasDia.length === 0) {
    lista.innerHTML = '<p class="text-slate-400 text-center py-8 italic font-medium">No hay reservas para hoy.</p>'
    return
  }
  reservasDia.forEach(res => {
    const item = document.createElement('div')
    item.className = 'p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2 hover:shadow transition relative'
    const esPagado = (parseFloat(res.saldo) <= 0)
    const badgeEst = esPagado
      ? '<span class="bg-emerald-100 text-emerald-800 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase">Pagado</span>'
      : `<span class="bg-amber-100 text-amber-800 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase">Saldo Bs ${res.saldo}</span>`
    item.innerHTML = `
      <div class="flex justify-between items-center border-b pb-1">
        <strong class="text-slate-800 uppercase">${res.cliente}</strong>
        <span class="text-cyan-700 font-extrabold text-[10px] uppercase">Cancha ${res.cancha}</span>
      </div>
      <div class="text-[10px] text-slate-500 space-y-1">
        <p>⏱️ ${res.hora_inicio || res.inicioStr} a ${res.hora_fin || res.finStr} | 🏆 ${res.juego}</p>
        <div class="flex justify-between items-center">
          ${badgeEst}
          <button onclick='abrirComprobanteCanchasPorId(${res.id})' class="text-slate-400 hover:text-slate-800 font-extrabold uppercase text-[9px]">Ver Ficha</button>
        </div>
      </div>
    `
    lista.appendChild(item)
  })
}

function modificarFechaCanchas(dias) {
  canchasFechaActual.setDate(canchasFechaActual.getDate() + dias)
  renderizarAgendaCanchas()
}
function establecerHoyCanchas() {
  canchasFechaActual = new Date()
  renderizarAgendaCanchas()
}
function seleccionarFechaCanchas(valStr) {
  if (valStr) {
    const partes = valStr.split('-')
    canchasFechaActual = new Date(partes[0], partes[1] - 1, partes[2])
    renderizarAgendaCanchas()
  }
}

function abrirModalReservaCanchas(cancha, inicioStr, finStr, idReserva = '') {
  document.getElementById('form-canchas-id').value = idReserva
  document.getElementById('form-canchas-cancha').value = cancha
  document.getElementById('form-canchas-inicio').value = inicioStr
  document.getElementById('form-canchas-fin').value = finStr
  document.getElementById('form-canchas-fecha').value = obtenerFechaISO(canchasFechaActual)
  if (!idReserva) {
    document.getElementById('titulo-modal-canchas').innerText = '📋 Nueva Reserva Administrativa'
    document.getElementById('form-canchas-cliente').value = ''
    document.getElementById('form-canchas-telefono').value = ''
    document.getElementById('form-canchas-total').value = '60.00'
    document.getElementById('form-canchas-acuenta').value = '0.00'
    document.getElementById('form-canchas-saldo').innerText = '60.00 Bs.'
  }
  document.getElementById('modal-reserva-canchas').classList.remove('hidden')
}
function abrirModalReservaCanchasManual() {
  abrirModalReservaCanchas(2, '19:00', '20:00')
}
function cerrarModalCanchas() {
  document.getElementById('modal-reserva-canchas').classList.add('hidden')
}
function calcularSaldoCanchasForm() {
  const tot = parseFloat(document.getElementById('form-canchas-total').value) || 0
  const acu = parseFloat(document.getElementById('form-canchas-acuenta').value) || 0
  const sal = (tot - acu).toFixed(2)
  document.getElementById('form-canchas-saldo').innerText = `${sal} Bs.`
}

async function guardarReservaCanchas() {
  const id = document.getElementById('form-canchas-id').value
  const cliente = document.getElementById('form-canchas-cliente').value.trim() || 'Cliente General'
  const telefono = document.getElementById('form-canchas-telefono').value
  const fecha = document.getElementById('form-canchas-fecha').value
  const cancha = parseInt(document.getElementById('form-canchas-cancha').value)
  const juego = document.getElementById('form-canchas-juego').value
  const inicio = document.getElementById('form-canchas-inicio').value
  const fin = document.getElementById('form-canchas-fin').value
  const total = parseFloat(document.getElementById('form-canchas-total').value) || 0
  const acuenta = parseFloat(document.getElementById('form-canchas-acuenta').value) || 0
  const saldo = (total - acuenta).toFixed(2)
  const timestamp = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  if (id) {
    const oldRes = canchasReservas.find(r => r.id == id)
    const logs = oldRes?.historial ? JSON.parse(oldRes.historial) : []
    logs.push(`Modificado: Total ${total.toFixed(2)} / Adelanto: ${acuenta.toFixed(2)} Bs. a las ${timestamp}`)
    await insforge.database.from('reservas_canchas').update({
      cliente, telefono, fecha, cancha, juego,
      hora_inicio: inicio, hora_fin: fin,
      total: total.toFixed(2), a_cuenta: acuenta.toFixed(2), saldo,
      historial: JSON.stringify(logs)
    }).eq('id', id)
    const diffAcuenta = acuenta - parseFloat(oldRes?.a_cuenta || oldRes?.acuenta || 0)
    if (diffAcuenta > 0) {
      await registrarEnFlujoCaja('Ingreso', 'Canchas', `Abono/Saldo cancha de ${cliente} (Cancha ${cancha})`, diffAcuenta)
    }
  } else {
    const { data } = await insforge.database.from('reservas_canchas').insert([{
      cliente, telefono, fecha, cancha, juego,
      hora_inicio: inicio, hora_fin: fin,
      total: total.toFixed(2), a_cuenta: acuenta.toFixed(2), saldo,
      historial: JSON.stringify([`Creado a las ${timestamp} con adelanto de ${acuenta.toFixed(2)} Bs.`])
    }]).select()
    if (data && data[0]) canchasReservas.unshift(data[0])
    if (acuenta > 0) {
      await registrarEnFlujoCaja('Ingreso', 'Canchas', `Adelanto cancha de ${cliente} (Cancha ${cancha})`, acuenta)
    }
  }
  cerrarModalCanchas()
  renderizarAgendaCanchas()
}

function abrirComprobanteCanchas(res) {
  cReservaSeleccionada = res
  document.getElementById('comp-cliente').innerText = res.cliente
  document.getElementById('comp-cancha').innerText = `Cancha ${res.cancha} (${res.cancha === 2 ? 'Wally/Vóley' : res.cancha === 3 ? 'Futbito' : 'Raquetbol'})`
  document.getElementById('comp-juego').innerText = res.juego
  document.getElementById('comp-fecha').innerText = res.fecha
  document.getElementById('comp-inicio').innerText = res.hora_inicio || res.inicioStr
  document.getElementById('comp-fin').innerText = res.hora_fin || res.finStr
  document.getElementById('comp-total').innerText = `${res.total} Bs.`
  document.getElementById('comp-acuenta').innerText = `${res.a_cuenta || res.acuenta} Bs.`
  document.getElementById('comp-saldo').innerText = `${res.saldo} Bs.`
  document.getElementById('btn-comp-editar').onclick = () => {
    cerrarComprobanteCanchas()
    abrirModalReservaCanchas(res.cancha, res.hora_inicio || res.inicioStr, res.hora_fin || res.finStr, res.id)
    document.getElementById('form-canchas-cliente').value = res.cliente
    document.getElementById('form-canchas-telefono').value = res.telefono
    document.getElementById('form-canchas-total').value = res.total
    document.getElementById('form-canchas-acuenta').value = res.a_cuenta || res.acuenta
    document.getElementById('form-canchas-fecha').value = res.fecha
    calcularSaldoCanchasForm()
  }
  document.getElementById('modal-comprobante-canchas').classList.remove('hidden')
}

function abrirComprobanteCanchasPorId(id) {
  const res = canchasReservas.find(r => r.id == id)
  if (res) abrirComprobanteCanchas(res)
}
function cerrarComprobanteCanchas() {
  document.getElementById('modal-comprobante-canchas').classList.add('hidden')
  cReservaSeleccionada = null
}

async function liberarCanchaCompleta() {
  if (cReservaSeleccionada) {
    const res = cReservaSeleccionada
    if (confirm(`¿Estás seguro de liberar la reserva de "${res.cliente}" en Cancha ${res.cancha}?`)) {
      await insforge.database.from('reservas_canchas').delete().eq('id', res.id)
      canchasReservas = canchasReservas.filter(r => r.id !== res.id)
      cerrarComprobanteCanchas()
      renderizarAgendaCanchas()
    }
  }
}

// ================= BILLAR =================
let activeMesasBillar = {
  1: { activo: false, modo: 'cronometro', inicio: null, minutosAjustados: 60, intervalo: null },
  2: { activo: false, modo: 'cronometro', inicio: null, minutosAjustados: 60, intervalo: null }
}
const TARIFA_FIJA_HORA = 15.00

function renderizarBillarMonitor() {
  renderHistorialBillar()
  for (let id = 1; id <= 2; id++) { syncMesaBillarUI(id) }
}

function setModeBillar(idMesa, modo) {
  if (activeMesasBillar[idMesa].activo) return
  activeMesasBillar[idMesa].modo = modo
  const btnCron = document.getElementById(`btnModeCron-${idMesa}`)
  const btnTemp = document.getElementById(`btnModeTemp-${idMesa}`)
  const wrapper = document.getElementById(`wrapperMinutos-${idMesa}`)
  const lblTiempo = document.getElementById(`lblTiempo-${idMesa}`)
  const lblFin = document.getElementById(`lblFin-${idMesa}`)
  if (modo === 'cronometro') {
    btnCron.className = 'flex-1 bg-cyan-600 text-white font-bold py-1.5 rounded-lg text-[10px] uppercase tracking-wider shadow'
    btnTemp.className = 'flex-1 text-slate-500 hover:text-slate-700 font-bold py-1.5 rounded-lg text-[10px] uppercase tracking-wider'
    wrapper.classList.add('hidden')
    lblTiempo.textContent = 'Tiempo de Juego:'
    lblFin.textContent = 'Hora Actual'
  } else {
    btnTemp.className = 'flex-1 bg-cyan-600 text-white font-bold py-1.5 rounded-lg text-[10px] uppercase tracking-wider shadow'
    btnCron.className = 'flex-1 text-slate-500 hover:text-slate-700 font-bold py-1.5 rounded-lg text-[10px] uppercase tracking-wider'
    wrapper.classList.remove('hidden')
    lblTiempo.textContent = 'Tiempo Restante:'
    lblFin.textContent = 'Fin Prometido'
  }
}

async function toggleMesaBillar(idMesa) {
  let m = activeMesasBillar[idMesa]
  let btnMain = document.getElementById(`btnMain-${idMesa}`)
  let badge = document.getElementById(`badge-${idMesa}`)
  let stateSelect = document.getElementById(`paymentStatus-${idMesa}`)
  if (!m.activo) {
    m.activo = true
    m.inicio = new Date()
    if (m.modo === 'temporizador') {
      let mins = parseInt(document.getElementById(`inputMinutos-${idMesa}`).value) || 60
      m.minutosAjustados = mins
      m.finEstimado = new Date(m.inicio.getTime() + mins * 60000)
      document.getElementById(`valFin-${idMesa}`).textContent = m.finEstimado.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      badge.textContent = '⏳ Temporizador'
      badge.className = 'status-badge bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border border-amber-200'
    } else {
      badge.textContent = '⏱ Cronómetro'
      badge.className = 'status-badge bg-cyan-150 text-cyan-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border border-cyan-200'
    }
    document.getElementById(`valInicio-${idMesa}`).textContent = m.inicio.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    cicloCalculoBillar(idMesa)
    m.intervalo = setInterval(() => { cicloCalculoBillar(idMesa) }, 1000)
    btnMain.textContent = '🛑 Terminar y Cobrar'
    btnMain.className = 'w-full bg-red-650 hover:bg-red-700 text-white py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-md'
    actualizarDashboardEstadisticas()
  } else {
    clearInterval(m.intervalo)
    let finReal = new Date()
    let segs = Math.floor((finReal - m.inicio) / 1000)
    if (segs < 0) segs = 0
    let mins = segs / 60
    let importeFinal = 0
    let duracionFormateada = formatearSegundos(segs)
    if (m.modo === 'cronometro') {
      importeFinal = calcularCostoBillarEspecial(mins)
    } else {
      if (mins > m.minutosAjustados) {
        let basePactada = parseFloat(calcularCostoBillarEspecial(m.minutosAjustados))
        let minsExtra = mins - m.minutosAjustados
        let costoExtra = (minsExtra / 60) * TARIFA_FIJA_HORA
        importeFinal = (basePactada + costoExtra).toFixed(2)
      } else {
        importeFinal = calcularCostoBillarEspecial(m.minutosAjustados)
      }
      duracionFormateada += ` (${m.minutosAjustados}m pactados)`
    }
    let estadoDePago = stateSelect.value
    await insforge.database.from('historial_billar').insert([{
      mesa: idMesa,
      modo: m.modo === 'cronometro' ? 'Cronómetro' : 'Temporizador',
      hora_inicio: m.inicio.toISOString(),
      hora_fin: finReal.toISOString(),
      duracion_real: duracionFormateada,
      total_cobrado: importeFinal,
      estado_pago: estadoDePago
    }])
    if (estadoDePago === 'Pagado') {
      await registrarEnFlujoCaja('Ingreso', 'Billar', `Alquiler Mesa ${idMesa} (${duracionFormateada})`, importeFinal)
    }
    m.activo = false
    m.intervalo = null
    btnMain.textContent = '⚡ Iniciar Juego'
    btnMain.className = 'w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-md'
    badge.textContent = 'Disponible'
    badge.className = 'status-badge bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-slate-200'
    document.getElementById(`valInicio-${idMesa}`).textContent = '--:--:--'
    document.getElementById(`valFin-${idMesa}`).textContent = '--:--:--'
    document.getElementById(`valTiempo-${idMesa}`).textContent = '00:00:00'
    document.getElementById(`valImporte-${idMesa}`).textContent = 'Bs 0.00'
    document.getElementById(`valTiempo-${idMesa}`).style.color = ''
    stateSelect.value = 'Por pagar'
    setModeBillar(idMesa, m.modo)
    renderHistorialBillar()
    actualizarDashboardEstadisticas()
    alert(`MESA ${idMesa} CERRADA\n-------------------------\nDuración: ${duracionFormateada}\nEstado: ${estadoDePago}\nTotal: Bs ${importeFinal}`)
  }
}

function cicloCalculoBillar(idMesa) {
  let m = activeMesasBillar[idMesa]
  let ahora = new Date()
  let segs = Math.floor((ahora - m.inicio) / 1000)
  let displayTiempo = document.getElementById(`valTiempo-${idMesa}`)
  let displayImporte = document.getElementById(`valImporte-${idMesa}`)
  let displayHoraActual = document.getElementById(`valFin-${idMesa}`)
  let mins = segs / 60
  if (m.modo === 'cronometro') {
    displayHoraActual.textContent = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    displayTiempo.textContent = formatearSegundos(segs)
    displayImporte.textContent = `Bs ${calcularCostoBillarEspecial(mins)}`
  } else {
    let segsTotalesPrometidos = m.minutosAjustados * 60
    let segsRestantes = segsTotalesPrometidos - segs
    if (segsRestantes <= 0) {
      displayTiempo.textContent = '¡TIEMPO CUMPLIDO!'
      displayTiempo.style.color = 'red'
      if (segsRestantes % 5 === 0) playAlarmaSonido()
      let basePactada = parseFloat(calcularCostoBillarEspecial(m.minutosAjustados))
      let minsExtra = mins - m.minutosAjustados
      let costoExtra = (minsExtra / 60) * TARIFA_FIJA_HORA
      displayImporte.textContent = `Bs ${(basePactada + costoExtra).toFixed(2)}`
    } else {
      displayTiempo.textContent = formatearSegundos(segsRestantes)
      displayImporte.textContent = `Bs ${calcularCostoBillarEspecial(m.minutosAjustados)}`
    }
  }
}

function calcularCostoBillarEspecial(minutos) {
  if (minutos <= 0) return '0.00'
  if (minutos >= 15 && minutos < 30) return '4.00'
  else if (minutos >= 30 && minutos < 60) return '8.00'
  else {
    let costoProporcional = (minutos / 60) * TARIFA_FIJA_HORA
    return costoProporcional.toFixed(2)
  }
}

function formatearSegundos(totalSegundos) {
  let hrs = Math.floor(totalSegundos / 3600)
  let mins = Math.floor((totalSegundos % 3600) / 60)
  let secs = totalSegundos % 60
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function syncMesaBillarUI(idMesa) {
  let m = activeMesasBillar[idMesa]
  let btnMain = document.getElementById(`btnMain-${idMesa}`)
  let badge = document.getElementById(`badge-${idMesa}`)
  if (m.activo) {
    btnMain.textContent = '🛑 Terminar y Cobrar'
    btnMain.className = 'w-full bg-red-650 hover:bg-red-700 text-white py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-md'
    if (m.modo === 'temporizador') {
      badge.textContent = '⏳ Temporizador'
      badge.className = 'status-badge bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border border-amber-200'
    } else {
      badge.textContent = '⏱ Cronómetro'
      badge.className = 'status-badge bg-cyan-150 text-cyan-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border border-cyan-200'
    }
  } else {
    setModeBillar(idMesa, m.modo)
  }
}

function toggleHistoryBillar() {
  document.getElementById('historySectionBillar').classList.toggle('hidden')
}

async function limpiarHistorialBillar() {
  if (confirm('¿Seguro de limpiar el historial de billar?')) {
    await insforge.database.from('historial_billar').delete().gte('id', 0)
    billarHistorial = []
    renderHistorialBillar()
  }
}

function renderHistorialBillar() {
  const tbody = document.getElementById('recordsTableBodyBillar')
  if (!tbody) return
  tbody.innerHTML = ''
  if (billarHistorial.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-slate-400 italic">No hay registros aún.</td></tr>'
    return
  }
  billarHistorial.forEach(h => {
    const tr = document.createElement('tr')
    const inicio = new Date(h.hora_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const fin = new Date(h.hora_fin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const fecha = new Date(h.hora_inicio).toLocaleDateString()
    tr.innerHTML = `
      <td class="p-3"><b>Mesa ${h.mesa}</b></td>
      <td class="p-3"><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase text-[9px]">${h.modo}</span></td>
      <td class="p-3 text-slate-500">${fecha} | ${inicio}-${fin}</td>
      <td class="p-3 font-mono">${h.duracion_real}</td>
      <td class="p-3"><span class="${h.estado_pago === 'Pagado' ? 'text-emerald-600' : 'text-red-500'} font-bold">${h.estado_pago}</span></td>
      <td class="p-3 text-right font-black text-emerald-600">Bs ${h.total_cobrado}</td>
    `
    tbody.appendChild(tr)
  })
}

// ================= TIENDA & POS =================
let filtroCategoriaPOS = ''

function cambiarSubModuloTienda(sub) {
  tiendaSubModuloActivo = sub
  const tabPOS = document.getElementById('tab-tienda-pos')
  const tabInv = document.getElementById('tab-tienda-inventario')
  const subPOS = document.getElementById('sub-tienda-pos')
  const subInv = document.getElementById('sub-tienda-inventario')
  if (sub === 'pos') {
    tabPOS.className = 'flex-1 bg-slate-800 text-white font-extrabold py-2 px-4 rounded-xl text-xs uppercase tracking-wider shadow'
    tabInv.className = 'flex-1 text-slate-500 hover:text-slate-800 font-extrabold py-2 px-4 rounded-xl text-xs uppercase tracking-wider transition'
    subPOS.classList.remove('hidden')
    subInv.classList.add('hidden')
    renderProductosPOS()
  } else {
    tabInv.className = 'flex-1 bg-slate-800 text-white font-extrabold py-2 px-4 rounded-xl text-xs uppercase tracking-wider shadow'
    tabPOS.className = 'flex-1 text-slate-500 hover:text-slate-800 font-extrabold py-2 px-4 rounded-xl text-xs uppercase tracking-wider transition'
    subInv.classList.remove('hidden')
    subPOS.classList.add('hidden')
    renderCategoriasTienda()
    renderProductosTienda()
  }
}

function renderCategoriasTienda() {
  const select = document.getElementById('prodCategoria')
  const filtro = document.getElementById('categorias-filtro-pos')
  if (select) {
    select.innerHTML = '<option value="">Selecciona Categoría</option>'
    tiendaCategorias.forEach(cat => {
      const name = cat.nombre || cat
      select.innerHTML += `<option value="${name}">${name}</option>`
    })
  }
  if (filtro) {
    filtro.innerHTML = '<button onclick="filtrarPorCategoriaPOS(\'\')" class="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border ' + (filtroCategoriaPOS === '' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100') + '">Todos</button>'
    tiendaCategorias.forEach(cat => {
      const name = cat.nombre || cat
      const activo = filtroCategoriaPOS === name
      filtro.innerHTML += `<button onclick="filtrarPorCategoriaPOS('${name}')" class="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border ${activo ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}">${name}</button>`
    })
  }
}

function agregarCategoriaTienda() {
  const n = prompt('Nombre de la nueva categoría:')
  if (n && n.trim()) {
    const clean = n.trim()
    const exists = tiendaCategorias.some(c => (c.nombre || c) === clean)
    if (!exists) {
      insforge.database.from('categorias_tienda').insert([{ nombre: clean }]).select().then(({ data }) => {
        if (data && data[0]) tiendaCategorias.push(data[0])
        renderCategoriasTienda()
        renderProductosPOS()
      })
    } else {
      alert('Esa categoría ya existe.')
    }
  }
}

function filtrarPorCategoriaPOS(cat) {
  filtroCategoriaPOS = cat
  renderProductosPOS()
}

function filtrarProductosPOS() {
  renderProductosPOS()
}

async function guardarProductoTienda(e) {
  e.preventDefault()
  const nombre = document.getElementById('prodNombre').value.trim()
  const categoriaNombre = document.getElementById('prodCategoria').value
  const precio = parseFloat(document.getElementById('prodPrecio').value) || 0
  const stock = parseInt(document.getElementById('prodStock').value) || 0
  if (nombre && categoriaNombre) {
    const cat = tiendaCategorias.find(c => (c.nombre || c) === categoriaNombre)
    const { data } = await insforge.database.from('productos_tienda').insert([{
      nombre,
      categoria_id: cat?.id || null,
      categoria: categoriaNombre,
      precio,
      stock
    }]).select()
    if (data && data[0]) tiendaProductos.push(data[0])
    document.getElementById('productForm').reset()
    renderProductosTienda()
    alert('Producto añadido exitosamente.')
  }
}

function renderProductosTienda() {
  const tbody = document.getElementById('tablaProductos')
  if (!tbody) return
  tbody.innerHTML = ''
  document.getElementById('contadorProductos').innerText = `${tiendaProductos.length} Producto(s)`
  if (tiendaProductos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center p-6 text-slate-400 italic">No hay productos en stock.</td></tr>'
    return
  }
  tiendaProductos.forEach(p => {
    const tr = document.createElement('tr')
    const catName = p.categoria || (tiendaCategorias.find(c => c.id === p.categoria_id)?.nombre || '')
    tr.innerHTML = `
      <td class="p-3"><b>${p.nombre}</b></td>
      <td class="p-3"><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold text-[10px] uppercase">${catName}</span></td>
      <td class="p-3 text-center font-bold text-slate-700">${formatMoney(p.precio)}</td>
      <td class="p-3 text-center"><span class="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-black">${p.stock}</span></td>
      <td class="p-3 text-center"><button onclick="eliminarProductoInventario(${p.id})" class="text-red-500 hover:underline font-bold uppercase text-[10px]">Eliminar</button></td>
    `
    tbody.appendChild(tr)
  })
}

async function eliminarProductoInventario(id) {
  if (confirm('¿Estás seguro de eliminar este producto?')) {
    await insforge.database.from('productos_tienda').delete().eq('id', id)
    tiendaProductos = tiendaProductos.filter(p => p.id !== id)
    renderProductosTienda()
  }
}

function renderProductosPOS() {
  const grid = document.getElementById('grid-productos-pos')
  if (!grid) return
  grid.innerHTML = ''
  const busqueda = (document.getElementById('buscador-pos').value || '').toLowerCase()
  let filtrados = tiendaProductos
  if (filtroCategoriaPOS) {
    filtrados = filtrados.filter(p => {
      const catName = p.categoria || (tiendaCategorias.find(c => c.id === p.categoria_id)?.nombre || '')
      return catName === filtroCategoriaPOS
    })
  }
  if (busqueda) filtrados = filtrados.filter(p => p.nombre.toLowerCase().includes(busqueda))
  if (filtrados.length === 0) {
    grid.innerHTML = '<p class="col-span-3 text-center text-slate-400 py-10 italic">No se encontraron productos.</p>'
    return
  }
  filtrados.forEach(p => {
    const card = document.createElement('div')
    card.className = 'bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center text-center shadow-sm hover:shadow-md transition cursor-pointer'
    card.onclick = () => agregarAlCarrito(p)
    const catName = p.categoria || (tiendaCategorias.find(c => c.id === p.categoria_id)?.nombre || '')
    card.innerHTML = `
      <div class="text-3xl mb-2">${catName === 'Bebidas' ? '🥤' : catName === 'Snacks' ? '🍿' : '📦'}</div>
      <h4 class="font-bold text-xs text-slate-700 uppercase leading-tight">${p.nombre}</h4>
      <p class="font-black text-blue-600 text-sm mt-1">${formatMoney(p.precio)}</p>
      <p class="text-[9px] text-slate-400 font-bold uppercase mt-1">Stock: ${p.stock}</p>
    `
    grid.appendChild(card)
  })
}

// ================= CARRITO POS =================
function agregarAlCarrito(producto) {
  const existente = tiendaCarrito.find(c => c.id === producto.id)
  if (existente) {
    existente.cantidad++
  } else {
    tiendaCarrito.push({ ...producto, cantidad: 1 })
  }
  renderCarrito()
}

function quitarDelCarrito(id) {
  tiendaCarrito = tiendaCarrito.filter(c => c.id !== id)
  renderCarrito()
}

function vaciarCarrito() {
  tiendaCarrito = []
  renderCarrito()
}

function renderCarrito() {
  const contenedor = document.getElementById('carrito-items')
  const totalSpan = document.getElementById('carrito-total')
  if (!contenedor) return
  contenedor.innerHTML = ''
  let total = 0
  if (tiendaCarrito.length === 0) {
    contenedor.innerHTML = '<p class="text-center text-slate-400 italic py-8 text-xs">Carrito vacío. Selecciona productos.</p>'
    totalSpan.innerText = 'Bs 0.00'
    return
  }
  tiendaCarrito.forEach(c => {
    const subtotal = c.precio * c.cantidad
    total += subtotal
    const item = document.createElement('div')
    item.className = 'flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100'
    item.innerHTML = `
      <div class="flex-1 min-w-0">
        <p class="font-bold text-[11px] text-slate-700 truncate">${c.nombre}</p>
        <div class="flex items-center gap-1 mt-1">
          <button onclick="cambiarCantidadCarrito(${c.id}, -1)" class="w-5 h-5 bg-slate-200 rounded-full text-[10px] font-bold hover:bg-slate-300">−</button>
          <span class="text-xs font-black text-slate-600 w-4 text-center">${c.cantidad}</span>
          <button onclick="cambiarCantidadCarrito(${c.id}, 1)" class="w-5 h-5 bg-slate-200 rounded-full text-[10px] font-bold hover:bg-slate-300">+</button>
        </div>
      </div>
      <div class="text-right ml-2">
        <p class="font-black text-blue-600 text-xs">${formatMoney(subtotal)}</p>
        <button onclick="quitarDelCarrito(${c.id})" class="text-red-400 text-[9px] font-bold hover:text-red-600">✕</button>
      </div>
    `
    contenedor.appendChild(item)
  })
  totalSpan.innerText = formatMoney(total)
}

function cambiarCantidadCarrito(id, delta) {
  const item = tiendaCarrito.find(c => c.id === id)
  if (item) {
    item.cantidad += delta
    if (item.cantidad <= 0) tiendaCarrito = tiendaCarrito.filter(c => c.id !== id)
    renderCarrito()
  }
}

async function procesarVentaPOS() {
  if (tiendaCarrito.length === 0) {
    alert('El carrito está vacío.')
    return
  }
  let totalVenta = 0
  tiendaCarrito.forEach(c => { totalVenta += c.precio * c.cantidad })
  const concepto = `Venta POS: ${tiendaCarrito.map(c => `${c.cantidad}x ${c.nombre}`).join(', ')}`
  await registrarEnFlujoCaja('Ingreso', 'Tienda', concepto, totalVenta)
  for (const c of tiendaCarrito) {
    const idx = tiendaProductos.findIndex(p => p.id === c.id)
    if (idx >= 0) {
      const nuevoStock = tiendaProductos[idx].stock - c.cantidad
      await insforge.database.from('productos_tienda').update({ stock: nuevoStock }).eq('id', c.id)
      tiendaProductos[idx].stock = nuevoStock
    }
  }
  alert(`✅ Venta completada!\nTotal: ${formatMoney(totalVenta)}`)
  tiendaCarrito = []
  renderCarrito()
  renderProductosTienda()
  renderProductosPOS()
}

// ================= FLUJO DE CAJA =================
async function registrarEnFlujoCaja(tipo, categoria, concepto, monto) {
  const ahora = new Date()
  const { data } = await insforge.database.from('flujo_caja').insert([{
    tipo,
    categoria,
    concepto,
    importe: parseFloat(monto).toFixed(2),
    fecha_hora: ahora.toISOString(),
    fecha: obtenerFechaISO(ahora)
  }]).select()
  if (data && data[0]) flujoCaja.unshift(data[0])
  actualizarDashboardEstadisticas()
}

function renderizarFlujoCaja() {
  const tbody = document.getElementById('tablaFlujo')
  if (!tbody) return
  tbody.innerHTML = ''
  const filtroFecha = document.getElementById('flujo-filtro-fecha').value
  const filtrados = flujoCaja.filter(f => {
    if (!filtroFecha) return true
    if (f.fecha) return f.fecha === filtroFecha
    if (f.fecha_hora) return f.fecha_hora.slice(0, 10) === filtroFecha
    return false
  })
  let ingresos = 0, egresos = 0
  if (filtrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center p-6 text-slate-400 italic">No hay movimientos financieros para este día.</td></tr>'
    document.getElementById('flujo-total-ingresos').innerText = 'Bs 0.00'
    document.getElementById('flujo-total-egresos').innerText = 'Bs 0.00'
    document.getElementById('flujo-total-neto').innerText = 'Bs 0.00'
    return
  }
  filtrados.forEach(f => {
    const montoVal = parseFloat(f.importe || 0)
    const esIngreso = f.tipo === 'Ingreso'
    if (esIngreso) ingresos += montoVal
    else egresos += montoVal
    const hora = f.fecha_hora
      ? new Date(f.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : ''
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td class="p-3 text-slate-500 font-mono">${f.fecha || (f.fecha_hora || '').slice(0, 10)} | ${hora}</td>
      <td class="p-3"><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider">${f.categoria || ''}</span></td>
      <td class="p-3 text-slate-700">${f.concepto}</td>
      <td class="p-3 text-right font-black ${esIngreso ? 'text-emerald-600' : 'text-red-500'}">${esIngreso ? '+' : '-'} Bs ${montoVal.toFixed(2)}</td>
    `
    tbody.appendChild(tr)
  })
  const neto = ingresos - egresos
  document.getElementById('flujo-total-ingresos').innerText = formatMoney(ingresos)
  document.getElementById('flujo-total-egresos').innerText = formatMoney(egresos)
  document.getElementById('flujo-total-neto').innerText = formatMoney(neto)
  document.getElementById('flujo-total-neto').className = neto >= 0 ? 'text-emerald-600 text-sm' : 'text-red-500 text-sm'
}

async function guardarMovimientoFlujoManual() {
  const tipo = document.getElementById('flujo-tipo').value
  const concepto = document.getElementById('flujo-concepto').value.trim() || 'Movimiento Manual'
  const importe = parseFloat(document.getElementById('flujo-importe').value) || 0
  if (importe <= 0) {
    alert('Por favor ingresa un monto válido mayor a 0.')
    return
  }
  await registrarEnFlujoCaja(tipo, 'Manual', concepto, importe)
  document.getElementById('flujo-concepto').value = ''
  document.getElementById('flujo-importe').value = ''
  renderizarFlujoCaja()
  actualizarDashboardEstadisticas()
  alert('Operación manual registrada correctamente.')
}

async function limpiarHistorialFlujo() {
  if (confirm('ATENCIÓN: Se borrarán todos los registros contables del Flujo de Caja. ¿Estás seguro?')) {
    await insforge.database.from('flujo_caja').delete().gte('id', 0)
    flujoCaja = []
    renderizarFlujoCaja()
  }
}

function exportarExcelFlujo() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(flujoCaja, null, 2))
  const downloadAnchor = document.createElement('a')
  downloadAnchor.setAttribute('href', dataStr)
  downloadAnchor.setAttribute('download', `flujo_caja_wally_romo_${obtenerFechaISO(new Date())}.json`)
  document.body.appendChild(downloadAnchor)
  downloadAnchor.click()
  downloadAnchor.remove()
}

// ================= EXPORT GLOBAL FUNCTIONS =================
window.cambiarModulo = cambiarModulo
window.toggleSidebar = toggleSidebar
window.modificarFechaCanchas = modificarFechaCanchas
window.establecerHoyCanchas = establecerHoyCanchas
window.seleccionarFechaCanchas = seleccionarFechaCanchas
window.abrirModalReservaCanchas = abrirModalReservaCanchas
window.abrirModalReservaCanchasManual = abrirModalReservaCanchasManual
window.cerrarModalCanchas = cerrarModalCanchas
window.calcularSaldoCanchasForm = calcularSaldoCanchasForm
window.guardarReservaCanchas = guardarReservaCanchas
window.abrirComprobanteCanchasPorId = abrirComprobanteCanchasPorId
window.cerrarComprobanteCanchas = cerrarComprobanteCanchas
window.liberarCanchaCompleta = liberarCanchaCompleta
window.setModeBillar = setModeBillar
window.toggleMesaBillar = toggleMesaBillar
window.toggleHistoryBillar = toggleHistoryBillar
window.limpiarHistorialBillar = limpiarHistorialBillar
window.cambiarSubModuloTienda = cambiarSubModuloTienda
window.guardarProductoTienda = guardarProductoTienda
window.agregarCategoriaTienda = agregarCategoriaTienda
window.filtrarProductosPOS = filtrarProductosPOS
window.filtrarPorCategoriaPOS = filtrarPorCategoriaPOS
window.eliminarProductoInventario = eliminarProductoInventario
window.agregarAlCarrito = agregarAlCarrito
window.quitarDelCarrito = quitarDelCarrito
window.vaciarCarrito = vaciarCarrito
window.cambiarCantidadCarrito = cambiarCantidadCarrito
window.procesarVentaPOS = procesarVentaPOS
window.guardarMovimientoFlujoManual = guardarMovimientoFlujoManual
window.limpiarHistorialFlujo = limpiarHistorialFlujo
window.exportarExcelFlujo = exportarExcelFlujo
window.renderProductosPOS = renderProductosPOS

// ================= INIT =================
window.onload = inicializarApp

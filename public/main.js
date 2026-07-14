const API = `${window.APP_CONFIG.API_BASE}/casos`;
const API_INSPECTORES = `${window.APP_CONFIG.API_BASE}/inspectores`;
const usuarioActual = Session.user;
let paginaActual = 1;
let totalPaginas = 1;
const LIMITE = 10;

document.addEventListener("DOMContentLoaded", inicializarApp);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function configurarInterfaz() {
  document.getElementById("usuarioActual").textContent = `${usuarioActual.nombre || usuarioActual.correo} · ${usuarioActual.rol}`;
  if (usuarioActual.rol === "admin") document.getElementById("usuariosNavItem").classList.remove("d-none");
  if (usuarioActual.rol === "inspector") document.getElementById("nuevoCasoButton").classList.add("d-none");
}

async function cargarInspectores() {
  const response = await Session.fetchWithAuth(API_INSPECTORES);
  const inspectores = await response.json();
  const select = document.getElementById("inspectorNombre");
  select.innerHTML = '<option value="">Seleccionar inspector</option>' + inspectores.map((inspector) => `<option value="${escapeHtml(inspector.assignmentKey)}" data-correo="${escapeHtml(inspector.correo)}">${escapeHtml(inspector.nombre)}</option>`).join("");
  select.addEventListener("change", () => { document.getElementById("inspectorCorreo").value = select.selectedOptions[0]?.dataset.correo || ""; });
}

document.getElementById("formCaso")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const response = await Session.fetchWithAuth(API, { method: "POST", body: JSON.stringify({ numeroCaso: document.getElementById("numeroCaso").value.trim(), nombrePatrono: document.getElementById("nombrePatrono").value.trim(), tipoInvestigacion: document.getElementById("tipoInvestigacion").value, zona: document.getElementById("zona").value, inspector: document.getElementById("inspectorNombre").value, fechaAsignado: document.getElementById("fechaAsignado").value }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return mostrarAlerta(data.error || data.mensaje || "No se pudo crear el caso.", "danger");
  event.currentTarget.reset();
  mostrarAlerta("Caso registrado correctamente.", "success");
  bootstrap.Collapse.getOrCreateInstance(document.getElementById("nuevoCasoPanel")).hide();
  await cargarCasos(1);
});

function mostrarAlerta(message, type) {
  const alert = document.getElementById("tableAlert");
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
}

function formatDate(value) { return value ? new Date(value).toLocaleDateString("es-CR") : "—"; }
function statusClass(status) { return `status-${String(status).toLowerCase()}`; }

function pintarTabla(casos) {
  const body = document.getElementById("listaCasos");
  if (!casos.length) { body.innerHTML = '<tr><td colspan="12" class="empty-row">No hay casos que coincidan con la búsqueda.</td></tr>'; return; }
  body.innerHTML = casos.map((caso) => `<tr><td><strong>${escapeHtml(caso.numeroCaso)}</strong></td><td>${escapeHtml(caso.nombrePatrono)}</td><td>${escapeHtml(caso.tipoInvestigacion)}</td><td>${escapeHtml(caso.zona)}</td><td>${escapeHtml(caso.inspector?.nombre || caso.inspector)}</td><td><span class="badge-status ${statusClass(caso.estado)}">${escapeHtml(caso.estado)}</span></td><td>${escapeHtml(caso.viaAdministrativa || "—")}</td><td>${formatDate(caso.fechaAsignado)}</td><td>${formatDate(caso.fechaResuelto)}</td><td>${escapeHtml(caso.diasHabiles ?? "—")}</td><td>${escapeHtml(caso.numeroResolucion || "—")}</td><td><div class="d-flex gap-2"><a class="btn btn-light btn-sm" href="caso.html?id=${caso._id}">Expediente</a>${usuarioActual.rol === "admin" ? `<button class="btn btn-outline-danger btn-sm" onclick="eliminarCaso('${caso._id}')">Eliminar</button>` : ""}</div></td></tr>`).join("");
}

function actualizarIndicadores(resumen = {}) {
  document.getElementById("totalCasos").textContent = resumen.total || 0;
  document.getElementById("casosPendientes").textContent = resumen.pendientes || 0;
  document.getElementById("casosResueltos").textContent = resumen.resueltos || 0;
  document.getElementById("casosSectorizados").textContent = resumen.sectorizados || 0;
}

function construirParametros(page) {
  const params = new URLSearchParams({ page, limit: LIMITE });
  const filtros = {
    q: document.getElementById("filtroBusqueda").value.trim(),
    estado: document.getElementById("filtroEstado").value,
    via: document.getElementById("filtroVia").value,
    zona: document.getElementById("filtroZona").value,
  };
  Object.entries(filtros).forEach(([clave, valor]) => { if (valor) params.set(clave, valor); });
  if (document.getElementById("filtroAtrasados").checked) params.set("atrasados", "true");
  return params;
}

async function cargarCasos(page = 1) {
  try {
    const response = await Session.fetchWithAuth(`${API}?${construirParametros(page)}`);
    if (!response.ok) throw new Error("No se pudieron cargar los casos.");
    const data = await response.json();
    pintarTabla(data.casos); actualizarIndicadores(data.resumen);
    paginaActual = data.page; totalPaginas = data.totalPages || 1; actualizarPaginacion();
  } catch (error) { mostrarAlerta(error.message, "danger"); }
}

function actualizarPaginacion() { document.getElementById("paginaActual").textContent = paginaActual; document.getElementById("totalPaginas").textContent = totalPaginas; document.getElementById("anteriorButton").disabled = paginaActual <= 1; document.getElementById("siguienteButton").disabled = paginaActual >= totalPaginas; }
function paginaAnterior() { if (paginaActual > 1) cargarCasos(paginaActual - 1); }
function paginaSiguiente() { if (paginaActual < totalPaginas) cargarCasos(paginaActual + 1); }

async function abrirEditar(id) { const response = await Session.fetchWithAuth(`${API}/${id}`); const caso = await response.json(); if (!response.ok) return mostrarAlerta(caso.error || "No se pudo abrir el caso.", "danger"); document.getElementById("editId").value = caso._id; document.getElementById("editVia").value = caso.viaAdministrativa || ""; document.getElementById("editResolucion").value = caso.numeroResolucion || ""; document.getElementById("editEstado").value = caso.estado; renderHistorial(caso.historial || []); bootstrap.Modal.getOrCreateInstance(document.getElementById("modalEditar")).show(); }

function renderHistorial(historial) {
  const container = document.getElementById("historialCaso");
  if (!historial.length) { container.innerHTML = '<p class="text-secondary small mb-0">Este caso todavía no tiene actividad registrada.</p>'; return; }
  container.innerHTML = [...historial].reverse().map((evento) => `<article class="history-event"><span class="history-dot"></span><div><strong>${escapeHtml(evento.descripcion)}</strong><p class="small text-secondary mb-0">${escapeHtml(evento.usuario?.nombre || "Sistema")} · ${new Date(evento.fecha).toLocaleString("es-CR")}</p></div></article>`).join("");
}

async function guardarCambios() { const id = document.getElementById("editId").value; const update = await Session.fetchWithAuth(`${API}/${id}`, { method: "PUT", body: JSON.stringify({ viaAdministrativa: document.getElementById("editVia").value, numeroResolucion: document.getElementById("editResolucion").value.trim() }) }); if (!update.ok) return mostrarAlerta("No se pudieron guardar los cambios.", "danger"); const state = await Session.fetchWithAuth(`${API}/${id}/estado`, { method: "PATCH", body: JSON.stringify({ estado: document.getElementById("editEstado").value }) }); if (!state.ok) return mostrarAlerta("No se pudo actualizar el estado.", "danger"); bootstrap.Modal.getInstance(document.getElementById("modalEditar")).hide(); mostrarAlerta("Caso actualizado correctamente.", "success"); cargarCasos(paginaActual); }

async function eliminarCaso(id) { if (!window.confirm("¿Deseas eliminar este caso de forma permanente?")) return; const response = await Session.fetchWithAuth(`${API}/${id}`, { method: "DELETE" }); const data = await response.json().catch(() => ({})); if (!response.ok) return mostrarAlerta(data.error || "No se pudo eliminar el caso.", "danger"); mostrarAlerta("Caso eliminado correctamente.", "success"); cargarCasos(paginaActual); }

function filtrarCasos() { cargarCasos(1); }
function limpiarFiltros() { ["filtroBusqueda", "filtroEstado", "filtroVia", "filtroZona"].forEach((id) => { document.getElementById(id).value = ""; }); document.getElementById("filtroAtrasados").checked = false; cargarCasos(1); }

document.getElementById("filtroBusqueda").addEventListener("keydown", (event) => { if (event.key === "Enter") filtrarCasos(); });

async function inicializarApp() { configurarInterfaz(); actualizarPaginacion(); await Promise.all([cargarInspectores(), cargarCasos(1)]); }

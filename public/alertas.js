const ALERTS_API = window.APP_CONFIG.API_BASE;
const usuarioActual = Session.user;

document.getElementById("usuarioActual").textContent = `${usuarioActual.nombre || usuarioActual.correo} · ${usuarioActual.rol}`;
if (usuarioActual.rol === "admin") document.getElementById("usuariosNavItem").classList.remove("d-none");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("es-CR") : "—";
}

function diasTranscurridos(value) {
  return Math.max(Math.floor((Date.now() - new Date(value).getTime()) / 86400000), 0);
}

function mostrarMensaje(message, type) {
  const alert = document.getElementById("alertasResultado");
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
}

function renderCasos(data) {
  const casos = data.casos;
  document.getElementById("totalAtrasados").textContent = data.total;
  document.getElementById("casosAtrasados").innerHTML = casos.length
    ? casos.map((caso) => `<tr><td><strong>${escapeHtml(caso.numeroCaso)}</strong></td><td>${escapeHtml(caso.nombrePatrono)}</td><td>${escapeHtml(caso.inspector?.nombre || "—")}</td><td><span class="badge-status status-${escapeHtml(caso.estado.toLowerCase())}">${escapeHtml(caso.estado)}</span></td><td>${formatDate(caso.fechaAsignado)}</td><td><strong class="text-danger">${diasTranscurridos(caso.fechaAsignado)} días</strong></td></tr>`).join("")
    : '<tr><td colspan="6" class="empty-row">No hay casos atrasados. Excelente control operativo.</td></tr>';
}

function renderNotificaciones(data) {
  document.getElementById("totalPendientes").textContent = data.resumen.pendientes;
  document.getElementById("totalEnviadas").textContent = data.resumen.enviadas;
  document.getElementById("totalFallidas").textContent = data.resumen.fallidas;
  document.getElementById("emailDeshabilitado").classList.toggle("d-none", data.emailHabilitado);
  const puedeReintentar = ["admin", "supervisor"].includes(usuarioActual.rol) && data.emailHabilitado;
  document.getElementById("listaNotificaciones").innerHTML = data.notificaciones.length
    ? data.notificaciones.map((item) => `<tr><td><strong>${escapeHtml(item.caso?.numeroCaso || "Caso eliminado")}</strong><small class="d-block text-secondary">${escapeHtml(item.caso?.nombrePatrono || "")}</small></td><td>${escapeHtml(item.destinatario.nombre)}<small class="d-block text-secondary">${escapeHtml(item.destinatario.correo)}</small></td><td><span class="notification-status notification-${escapeHtml(item.estado)}">${escapeHtml(item.estado)}</span>${item.ultimoError ? `<small class="d-block text-danger mt-1" title="${escapeHtml(item.ultimoError)}">Error de entrega</small>` : ""}</td><td>${item.intentos}</td><td>${formatDate(item.updatedAt)}</td><td>${puedeReintentar && item.estado === "fallida" ? `<button class="btn btn-light btn-sm" onclick="reintentar('${item._id}')">Reintentar</button>` : "—"}</td></tr>`).join("")
    : '<tr><td colspan="6" class="empty-row">Todavía no hay notificaciones registradas.</td></tr>';
}

async function cargarAlertas() {
  try {
    const [casosResponse, notificationsResponse] = await Promise.all([
      Session.fetchWithAuth(`${ALERTS_API}/casos?atrasados=true&page=1&limit=100`),
      Session.fetchWithAuth(`${ALERTS_API}/notificaciones?page=1&limit=100`),
    ]);
    const casos = await casosResponse.json();
    const notifications = await notificationsResponse.json();
    if (!casosResponse.ok) throw new Error(casos.error || "No se pudieron cargar los casos atrasados.");
    if (!notificationsResponse.ok) throw new Error(notifications.mensaje || "No se pudieron cargar las notificaciones.");
    renderCasos(casos);
    renderNotificaciones(notifications);
  } catch (error) {
    mostrarMensaje(error.message, "danger");
  }
}

async function reintentar(id) {
  const response = await Session.fetchWithAuth(`${ALERTS_API}/notificaciones/${id}/reintentar`, { method: "POST" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return mostrarMensaje(data.mensaje || "No se pudo reintentar la notificación.", "danger");
  mostrarMensaje(data.mensaje, "success");
  await cargarAlertas();
}

cargarAlertas();

const CASES_API = `${window.APP_CONFIG.API_BASE}/casos`;
const caseId = new URLSearchParams(window.location.search).get("id");
const currentUser = Session.user;
let currentCase = null;

document.getElementById("usuarioActual").textContent = `${currentUser.nombre || currentUser.correo} · ${currentUser.rol}`;
if (currentUser.rol === "admin") document.getElementById("usuariosNavItem").classList.remove("d-none");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function formatDate(value, withTime = false) {
  if (!value) return "—";
  const options = withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" };
  return new Intl.DateTimeFormat("es-CR", options).format(new Date(value));
}

function statusClass(status) {
  return `status-${String(status).toLowerCase()}`;
}

function mostrarMensaje(message, type) {
  const alert = document.getElementById("casoResultado");
  alert.className = `alert alert-${type} mt-3`;
  alert.textContent = message;
}

function calcularAntiguedad(fecha) {
  return `${Math.max(Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000), 0)} días`;
}

function renderNotas(notas = []) {
  document.getElementById("totalNotas").textContent = notas.length;
  document.getElementById("listaNotas").innerHTML = notas.length
    ? [...notas].reverse().map((nota) => `<article class="case-note"><div class="case-note-meta"><strong>${escapeHtml(nota.autor?.nombre || "Sistema")}</strong><span>${escapeHtml(nota.autor?.rol || "")} · ${formatDate(nota.fecha, true)}</span></div><p>${escapeHtml(nota.texto)}</p></article>`).join("")
    : '<p class="empty-dashboard">Este expediente todavía no tiene notas internas.</p>';
}

function renderHistorial(historial = []) {
  document.getElementById("casoHistorial").innerHTML = historial.length
    ? [...historial].reverse().map((evento) => `<article class="history-event"><span class="history-dot"></span><div><strong>${escapeHtml(evento.descripcion)}</strong><p class="small text-secondary mb-0">${escapeHtml(evento.usuario?.nombre || "Sistema")} · ${formatDate(evento.fecha, true)}</p></div></article>`).join("")
    : '<p class="empty-dashboard">No hay actividad registrada.</p>';
}

function renderCaso(caso) {
  currentCase = caso;
  document.title = `${caso.numeroCaso} | Gestor de Casos`;
  document.getElementById("casoNumero").textContent = caso.numeroCaso;
  document.getElementById("casoPatrono").textContent = caso.nombrePatrono;
  const badge = document.getElementById("casoEstadoBadge");
  badge.className = `badge-status ${statusClass(caso.estado)}`;
  badge.textContent = caso.estado;
  document.getElementById("casoAntiguedad").textContent = calcularAntiguedad(caso.fechaAsignado);
  document.getElementById("casoTipo").textContent = caso.tipoInvestigacion;
  document.getElementById("casoZona").textContent = caso.zona;
  document.getElementById("casoInspector").textContent = caso.inspector?.nombre || "—";
  document.getElementById("casoInspectorCorreo").textContent = caso.inspector?.correo || "";
  document.getElementById("casoFechaAsignado").textContent = formatDate(caso.fechaAsignado);
  document.getElementById("casoFechaResuelto").textContent = formatDate(caso.fechaResuelto);
  document.getElementById("casoDiasHabiles").textContent = caso.diasHabiles ?? "—";
  document.getElementById("gestionEstado").value = caso.estado;
  document.getElementById("gestionVia").value = caso.viaAdministrativa || "";
  document.getElementById("gestionResolucion").value = caso.numeroResolucion || "";
  renderNotas(caso.notas);
  renderHistorial(caso.historial);
  document.getElementById("casoContenido").classList.remove("d-none");
}

async function cargarCaso() {
  if (!caseId || !/^[a-f\d]{24}$/i.test(caseId)) {
    mostrarMensaje("El enlace del expediente no es válido.", "danger");
    return;
  }
  try {
    const response = await Session.fetchWithAuth(`${CASES_API}/${caseId}`);
    const caso = await response.json();
    if (!response.ok) throw new Error(caso.error || "No se pudo cargar el expediente.");
    renderCaso(caso);
  } catch (error) {
    mostrarMensaje(error.message, "danger");
  }
}

document.getElementById("formGestion").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.getElementById("guardarGestionButton");
  button.disabled = true;
  button.textContent = "Guardando...";
  try {
    const response = await Session.fetchWithAuth(`${CASES_API}/${caseId}/gestion`, {
      method: "PATCH",
      body: JSON.stringify({ estado: document.getElementById("gestionEstado").value, viaAdministrativa: document.getElementById("gestionVia").value, numeroResolucion: document.getElementById("gestionResolucion").value.trim() }),
    });
    const caso = await response.json();
    if (!response.ok) throw new Error(caso.error || "No se pudo actualizar la gestión del expediente.");
    renderCaso(caso);
    mostrarMensaje("Expediente actualizado correctamente.", "success");
  } catch (error) {
    mostrarMensaje(error.message, "danger");
  } finally {
    button.disabled = false;
    button.textContent = "Guardar cambios";
  }
});

document.getElementById("formNota").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.getElementById("agregarNotaButton");
  const texto = document.getElementById("notaTexto").value.trim();
  if (!texto) return;
  button.disabled = true;
  button.textContent = "Agregando...";
  try {
    const response = await Session.fetchWithAuth(`${CASES_API}/${caseId}/notas`, { method: "POST", body: JSON.stringify({ texto }) });
    const caso = await response.json();
    if (!response.ok) throw new Error(caso.error || "No se pudo agregar la nota.");
    form.reset();
    document.getElementById("notaContador").textContent = "0 / 1000";
    renderCaso(caso);
    mostrarMensaje("Nota agregada al expediente.", "success");
  } catch (error) {
    mostrarMensaje(error.message, "danger");
  } finally {
    button.disabled = false;
    button.textContent = "Agregar nota";
  }
});

document.getElementById("notaTexto").addEventListener("input", (event) => {
  document.getElementById("notaContador").textContent = `${event.target.value.length} / 1000`;
});

cargarCaso();

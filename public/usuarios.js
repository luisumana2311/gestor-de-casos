const USERS_API = `${window.APP_CONFIG.API_BASE}/auth/users`;
document.getElementById("usuarioActual").textContent = `${Session.user.nombre || Session.user.correo} · ${Session.user.rol}`;
document.addEventListener("DOMContentLoaded", cargarUsuarios);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function initials(name) {
  return String(name).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function showListMessage(message, type) {
  const alert = document.getElementById("listaUsuariosResultado");
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
}

async function cargarUsuarios() {
  try {
    const response = await Session.fetchWithAuth(USERS_API);
    const users = await response.json().catch(() => []);
    if (!response.ok) throw new Error(users.mensaje || "No se pudieron cargar los usuarios.");
    renderUsers(users);
    document.getElementById("totalUsuarios").textContent = users.length;
    document.getElementById("usuariosActivos").textContent = users.filter((user) => user.activo).length;
  } catch (error) {
    showListMessage(error.message, "danger");
  }
}

function renderUsers(users) {
  const body = document.getElementById("listaUsuarios");
  if (!users.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-row">No hay usuarios registrados.</td></tr>';
    return;
  }

  body.innerHTML = users.map((user) => {
    const isCurrent = String(user._id) === String(Session.user.id);
    const statusLabel = user.activo ? "Activo" : "Inactivo";
    return `<tr>
      <td><div class="d-flex align-items-center gap-2"><span class="user-avatar">${escapeHtml(initials(user.nombre))}</span><div><strong>${escapeHtml(user.nombre)}</strong>${isCurrent ? '<small class="d-block text-secondary">Sesión actual</small>' : ""}</div></div></td>
      <td>${escapeHtml(user.correo)}</td>
      <td><span class="badge text-bg-light text-capitalize">${escapeHtml(user.rol)}</span></td>
      <td><span><i class="status-dot ${user.activo ? "status-active" : "status-inactive"}"></i>${statusLabel}</span></td>
      <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString("es-CR") : "—"}</td>
      <td><div class="d-flex gap-2">
        ${isCurrent ? '<span class="text-secondary small">Protegida</span>' : `<button class="btn btn-light btn-sm" onclick="cambiarEstado('${user._id}', ${!user.activo})">${user.activo ? "Desactivar" : "Activar"}</button><button class="btn btn-outline-danger btn-sm" onclick="eliminarUsuario('${user._id}')">Eliminar</button>`}
      </div></td>
    </tr>`;
  }).join("");
}

async function cambiarEstado(id, activo) {
  const response = await Session.fetchWithAuth(`${USERS_API}/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ activo }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return showListMessage(data.mensaje || "No se pudo actualizar la cuenta.", "danger");
  showListMessage(data.mensaje, "success");
  await cargarUsuarios();
}

async function eliminarUsuario(id) {
  if (!window.confirm("¿Eliminar permanentemente esta cuenta? Esta acción no se puede deshacer.")) return;
  const response = await Session.fetchWithAuth(`${USERS_API}/${id}`, { method: "DELETE" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return showListMessage(data.mensaje || "No se pudo eliminar la cuenta.", "danger");
  showListMessage(data.mensaje, "success");
  await cargarUsuarios();
}

document.getElementById("formUsuario").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.getElementById("crearUsuarioButton");
  const result = document.getElementById("usuarioResultado");
  button.disabled = true;
  button.textContent = "Creando...";
  result.classList.add("d-none");

  try {
    const response = await Session.fetchWithAuth(`${window.APP_CONFIG.API_BASE}/auth/register`, {
      method: "POST",
      body: JSON.stringify({ nombre: document.getElementById("usuarioNombre").value.trim(), correo: document.getElementById("usuarioCorreo").value.trim(), password: document.getElementById("usuarioPassword").value, rol: document.getElementById("usuarioRol").value }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.mensaje || "No se pudo crear el usuario.");
    result.className = "alert alert-success mt-4 mb-0";
    result.textContent = "Usuario creado correctamente.";
    event.currentTarget.reset();
    await cargarUsuarios();
  } catch (error) {
    result.className = "alert alert-danger mt-4 mb-0";
    result.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Crear usuario";
  }
});

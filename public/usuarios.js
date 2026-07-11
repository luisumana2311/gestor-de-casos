document.getElementById("usuarioActual").textContent = `${Session.user.nombre || Session.user.correo} · ${Session.user.rol}`;

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
      body: JSON.stringify({
        nombre: document.getElementById("usuarioNombre").value.trim(),
        correo: document.getElementById("usuarioCorreo").value.trim(),
        password: document.getElementById("usuarioPassword").value,
        rol: document.getElementById("usuarioRol").value,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.mensaje || "No se pudo crear el usuario.");
    result.className = "alert alert-success mt-4 mb-0";
    result.textContent = "Usuario creado correctamente. Ya puede iniciar sesión con sus credenciales.";
    event.currentTarget.reset();
  } catch (error) {
    result.className = "alert alert-danger mt-4 mb-0";
    result.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Crear usuario";
  }
});

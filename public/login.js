document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.getElementById("loginButton");
  const error = document.getElementById("loginError");
  button.disabled = true;
  button.textContent = "Verificando...";
  error.textContent = "";

  try {
    const response = await fetch(`${window.APP_CONFIG.API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: document.getElementById("correo").value.trim(),
        password: document.getElementById("password").value,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.mensaje || "No fue posible iniciar sesión.");
    localStorage.setItem("token", data.token);
    window.location.replace("index.html");
  } catch (reason) {
    error.textContent = reason.message;
  } finally {
    button.disabled = false;
    button.textContent = "Ingresar al sistema";
  }
});

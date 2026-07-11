(() => {
  const token = localStorage.getItem("token");

  function decodeUser() {
    try {
      const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
      const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (_error) {
      localStorage.removeItem("token");
      window.location.replace("login.html");
      return null;
    }
  }

  const user = decodeUser();

  async function fetchWithAuth(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      localStorage.removeItem("token");
      window.location.replace("login.html");
      throw new Error("La sesión expiró.");
    }

    return response;
  }

  function logout() {
    localStorage.removeItem("token");
    window.location.replace("login.html");
  }

  function requireRole(role) {
    if (user?.rol !== role) window.location.replace("index.html");
  }

  window.Session = Object.freeze({ token, user, fetchWithAuth, logout, requireRole });
})();

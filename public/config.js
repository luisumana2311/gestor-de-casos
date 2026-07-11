(() => {
  const localHosts = new Set(["localhost", "127.0.0.1"]);

  window.APP_CONFIG = Object.freeze({
    API_BASE: localHosts.has(window.location.hostname)
      ? window.location.origin
      : "https://gestor-de-casos.onrender.com",
  });
})();

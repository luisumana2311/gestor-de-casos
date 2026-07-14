const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

describe("users frontend", () => {
  it("resets the form and refreshes the user table after creating an account", async () => {
    const listeners = {};
    let resetCount = 0;
    const elements = new Map();
    const element = (id) => {
      if (!elements.has(id)) {
        elements.set(id, {
          id,
          value: "",
          textContent: "",
          innerHTML: "",
          className: "",
          disabled: false,
          classList: { add() {}, remove() {} },
          addEventListener(type, handler) { listeners[`${id}:${type}`] = handler; },
          reset() { resetCount += 1; },
        });
      }
      return elements.get(id);
    };

    element("usuarioNombre").value = "Nuevo Inspector";
    element("usuarioCorreo").value = "nuevo@example.com";
    element("usuarioPassword").value = "password-seguro";
    element("usuarioRol").value = "inspector";

    const responses = [
      { ok: true, json: async () => ({ mensaje: "Usuario creado." }) },
      { ok: true, json: async () => [{ _id: "2", nombre: "Nuevo Inspector", correo: "nuevo@example.com", rol: "inspector", activo: true }] },
    ];
    const context = {
      window: { APP_CONFIG: { API_BASE: "https://api.example.com" }, confirm: () => true },
      document: {
        getElementById: element,
        addEventListener(type, handler) { listeners[`document:${type}`] = handler; },
      },
      Session: {
        user: { id: "1", nombre: "Admin", rol: "admin" },
        fetchWithAuth: async () => responses.shift(),
      },
      console,
    };

    const source = fs.readFileSync(path.join(__dirname, "..", "public", "usuarios.js"), "utf8");
    vm.runInNewContext(source, context);

    const form = element("formUsuario");
    await listeners["formUsuario:submit"]({ preventDefault() {}, currentTarget: form });

    assert.equal(resetCount, 1);
    assert.equal(element("totalUsuarios").textContent, 1);
    assert.match(element("listaUsuarios").innerHTML, /Nuevo Inspector/);
    assert.equal(element("usuarioResultado").textContent, "Usuario creado correctamente.");
  });
});

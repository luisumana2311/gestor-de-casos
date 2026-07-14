const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

describe("alerts frontend", () => {
  it("renders overdue cases and notification delivery metrics", async () => {
    const elements = new Map();
    const element = (id) => {
      if (!elements.has(id)) {
        const classes = new Set(["d-none"]);
        elements.set(id, {
          textContent: "",
          innerHTML: "",
          className: "",
          classList: {
            add(value) { classes.add(value); },
            remove(value) { classes.delete(value); },
            toggle(value, force) { if (force) classes.add(value); else classes.delete(value); },
            contains(value) { return classes.has(value); },
          },
        });
      }
      return elements.get(id);
    };

    const context = {
      window: { APP_CONFIG: { API_BASE: "https://api.example.com" } },
      document: { getElementById: element },
      Session: {
        user: { nombre: "Admin", rol: "admin" },
        async fetchWithAuth(url) {
          if (url.includes("/casos?")) {
            return { ok: true, json: async () => ({ total: 1, casos: [{ numeroCaso: "ATR-001", nombrePatrono: "Patrono", inspector: { nombre: "Inspector" }, estado: "Pendiente", fechaAsignado: "2026-01-01T12:00:00Z" }] }) };
          }
          return { ok: true, json: async () => ({ resumen: { pendientes: 2, enviadas: 4, fallidas: 1 }, emailHabilitado: true, notificaciones: [{ _id: "1", caso: { numeroCaso: "ATR-001", nombrePatrono: "Patrono" }, destinatario: { nombre: "Inspector", correo: "inspector@example.com" }, estado: "fallida", intentos: 3, ultimoError: "SMTP", updatedAt: "2026-07-13T12:00:00Z" }] }) };
        },
      },
      console,
      Date,
      Promise,
    };

    const source = fs.readFileSync(path.join(__dirname, "..", "public", "alertas.js"), "utf8");
    vm.runInNewContext(source, context);
    await context.cargarAlertas();

    assert.equal(element("totalAtrasados").textContent, 1);
    assert.equal(element("totalPendientes").textContent, 2);
    assert.equal(element("totalEnviadas").textContent, 4);
    assert.equal(element("totalFallidas").textContent, 1);
    assert.match(element("casosAtrasados").innerHTML, /ATR-001/);
    assert.match(element("listaNotificaciones").innerHTML, /Reintentar/);
    assert.equal(element("emailDeshabilitado").classList.contains("d-none"), true);
  });
});

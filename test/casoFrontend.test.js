const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

describe("case workspace frontend", () => {
  it("renders case facts, notes and audit history", async () => {
    const elements = new Map();
    const listeners = {};
    const element = (id) => {
      if (!elements.has(id)) {
        const classes = new Set(["d-none"]);
        elements.set(id, {
          id,
          value: "",
          textContent: "",
          innerHTML: "",
          className: "",
          disabled: false,
          classList: {
            add(value) { classes.add(value); },
            remove(value) { classes.delete(value); },
            contains(value) { return classes.has(value); },
          },
          addEventListener(type, handler) { listeners[`${id}:${type}`] = handler; },
          reset() {},
        });
      }
      return elements.get(id);
    };
    const caseData = {
      _id: "507f1f77bcf86cd799439011",
      numeroCaso: "EXP-001",
      nombrePatrono: "Patrono del expediente",
      tipoInvestigacion: "Inscripción Patronal",
      zona: "Pavas",
      inspector: { nombre: "Inspector Uno", correo: "inspector@example.com" },
      estado: "Pendiente",
      viaAdministrativa: "",
      numeroResolucion: "",
      fechaAsignado: "2026-07-01T12:00:00Z",
      fechaResuelto: null,
      diasHabiles: null,
      notas: [{ texto: "Visita coordinada", autor: { nombre: "Inspector Uno", rol: "inspector" }, fecha: "2026-07-02T12:00:00Z" }],
      historial: [{ descripcion: "Caso creado", usuario: { nombre: "Admin" }, fecha: "2026-07-01T12:00:00Z" }],
    };
    const context = {
      window: { APP_CONFIG: { API_BASE: "https://api.example.com" }, location: { search: `?id=${caseData._id}` } },
      document: { getElementById: element, title: "" },
      Session: { user: { nombre: "Admin", rol: "admin" }, fetchWithAuth: async () => ({ ok: true, json: async () => caseData }) },
      URLSearchParams,
      Intl,
      Date,
      console,
    };

    const source = fs.readFileSync(path.join(__dirname, "..", "public", "caso.js"), "utf8");
    vm.runInNewContext(source, context);
    await context.cargarCaso();

    assert.equal(element("casoNumero").textContent, "EXP-001");
    assert.equal(element("casoInspector").textContent, "Inspector Uno");
    assert.equal(element("totalNotas").textContent, 1);
    assert.match(element("listaNotas").innerHTML, /Visita coordinada/);
    assert.match(element("casoHistorial").innerHTML, /Caso creado/);
    assert.equal(element("casoContenido").classList.contains("d-none"), false);
    assert.ok(listeners["formGestion:submit"]);
    assert.ok(listeners["formNota:submit"]);
  });
});

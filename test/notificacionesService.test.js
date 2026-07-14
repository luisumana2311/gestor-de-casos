const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { enviarDocumento } = require("../src/services/notificacionesService");

function crearNotificacion() {
  return {
    destinatario: { correo: "inspector@example.com" },
    asunto: "Caso asignado",
    contenido: "Contenido",
    estado: "procesando",
    intentos: 1,
    ultimoError: "",
    enviadaEn: null,
    async save() { this.guardada = true; },
  };
}

describe("notification delivery service", () => {
  it("records a failed delivery without throwing", async () => {
    const notificacion = crearNotificacion();
    await enviarDocumento(notificacion, {
      async sendMail() { throw new Error("SMTP unavailable"); },
    });

    assert.equal(notificacion.estado, "fallida");
    assert.match(notificacion.ultimoError, /SMTP unavailable/);
    assert.ok(notificacion.proximoIntento > new Date());
    assert.equal(notificacion.guardada, true);
  });

  it("records a successful delivery", async () => {
    const notificacion = crearNotificacion();
    await enviarDocumento(notificacion, { async sendMail() {} });

    assert.equal(notificacion.estado, "enviada");
    assert.ok(notificacion.enviadaEn instanceof Date);
    assert.equal(notificacion.guardada, true);
  });
});
